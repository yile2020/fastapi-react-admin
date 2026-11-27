"""#455：SQL Server 上删用户 × 用户导入提交互相死锁（1205）。

根因：关联表主键是 (id, 父列, 成员列)，按 `user_id` 删 / 查只能扫全表；RCSI 关着时读也加共享锁，扫描排在
别的事务**没提交**的行后面。两个事务各往 `sys_user_role` 里写了几行、又都去扫它（删除语句本身、数据变更审计在
语句前和提交前各拍一次的快照）就成环。修法：父列建索引（`model/m2m.py`）+ 审计按键取行在 SQL Server 上
`FORCESEEK`（`common/data_change/capture.py: _by_keys`，小表上 `IN (20 个值)` 优化器宁可扫索引）。

测法不靠赛跑：A 事务停在「手里攥着别人的没提交的行」，B 走真实的删除 / 导入路径并提交，连接上设 `LOCK_TIMEOUT`
—— 修之前 B 排在 A 的行后面，3 秒后报 1222（锁请求超时）；修之后 B 和 A 互不相干、直接提交。
死锁要两边互等，这里只造了一边；但成环的那条边就是「B 等 A 的行」，没有这条边就成不了环。

两条行为测试只在 SQL Server 上跑：PostgreSQL 读不加锁，在那里恒绿、证明不了任何事。MySQL 没实测过。
⚠️ 导入那条只在**小表**上抓得到「去掉 FORCESEEK」：本地新建的测试库（`sys_user_role` 10 行）上两次都红在 1222，
灌到两千多行之后优化器自己就选 seek 了，变异照样绿（都是实测）。CI 上跑整套时这张表有多少行、选什么计划，**没验过** ——
这一条以下面两条静态守卫为准（它们不看计划）。
"""

import contextlib
import functools
import uuid

from types import SimpleNamespace

import bcrypt
import pytest

from sqlalchemy import delete, event, insert, select
from sqlalchemy.dialects import mssql, postgresql
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from starlette.background import BackgroundTasks

from backend.app.admin.crud.crud_user import user_dao
from backend.app.admin.dataio import USER_IMPORT
from backend.app.admin.model import Dept, Role, User, user_role
from backend.app.admin.service.user_service import user_service
from backend.app.admin.utils.password_security import get_hash_password
from backend.common.data_change import data_change_source, registry
from backend.common.data_change.capture import _by_keys, _leads_an_index
from backend.common.dataio.importing import ImportContext, ImportRow
from backend.core.conf import settings
from backend.database.db import create_database_async_session, get_database_url, register_mssql_datetimeoffset
from backend.tests.utils.db import async_test_db_session

sqlserver_only = pytest.mark.skipif(
    settings.DATABASE_TYPE != 'sqlserver', reason='只有 SQL Server（RCSI 关）读加锁，别的库上恒绿'
)

PREFIX = 'pytest_m2mlock_'
PASSWORD = 'Pytest@Lock1'
#: B 最多等这么久。修之前一定等满（A 不会自己提交），修之后不该等
LOCK_WAIT_MS = 3000
#: 导入一批的行数。小表上 `user_id IN (1 个值)` 走 seek，20 个值时优化器宁可扫索引 —— 这条要覆盖到后者
IMPORT_ROWS = 20


def _call(client, fn, *args, **kwargs):
    return client.portal.call(functools.partial(fn, *args, **kwargs))


@contextlib.asynccontextmanager
async def _impatient_session():
    """B 用的会话：每条连接一建好就 `SET LOCK_TIMEOUT`，等锁超过 `LOCK_WAIT_MS` 就报 1222，不再一直等。

    🔴 B 要用自己的引擎（`NullPool`：连接用完就关），不能在共享池的连接上设了再还原。实测（评审抓到的）：
    原来的写法是设完 → 提交 → `rollback()` → 再 `SET LOCK_TIMEOUT -1`，可提交那一刻连接已经回池了，还原落在池里
    另一条连接上（池是先进先出），设过 3000 的那条原样留在池里 —— 4 条池连接里有一条是 3000。之后哪条测试拿到它、
    等锁超过 3 秒，就是一个莫名其妙的 1222。
    超时设在 `connect` 事件上（同 `register_mssql_datetimeoffset`，对底层 pyodbc 连接同步执行），
    这样不管提交 / 回滚之后换没换连接都带着它
    """
    engine = create_async_engine(get_database_url(unittest=True), poolclass=NullPool)
    register_mssql_datetimeoffset(engine)

    def _set_lock_timeout(dbapi_connection, _record):
        dbapi_connection._connection._conn.execute(f'SET LOCK_TIMEOUT {LOCK_WAIT_MS}')

    event.listen(engine.sync_engine, 'connect', _set_lock_timeout)
    try:
        async with create_database_async_session(engine)() as db:
            yield db
    finally:
        await engine.dispose()


@pytest.fixture
def ctx(client):
    """一个要被删的人（挂一个角色）· 部门 / 角色编码 · 操作人（admin）"""
    state = {}

    async def setup():
        async with async_test_db_session.begin() as db:
            dept = await db.scalar(select(Dept).where(Dept.deleted == 0, Dept.status == 1).order_by(Dept.id))
            role = await db.scalar(select(Role).where(Role.deleted == 0).order_by(Role.id))
            admin = await db.scalar(select(User.id).where(User.username == 'admin'))
            salt = bcrypt.gensalt()
            target = User(
                username=f'{PREFIX}t_{uuid.uuid4().hex[:8]}',
                nickname='target',
                password=get_hash_password(PASSWORD, salt),
                salt=salt,
                dept_id=dept.id,
            )
            db.add(target)
            await db.flush()
            await db.execute(insert(user_role).values(user_id=target.id, role_id=role.id))
            state.update(
                target=target.id, admin=admin, dept_id=dept.id, role_id=role.id, dept=dept.code, role=role.code
            )

    async def teardown():
        # 硬删（逻辑删除的行永远留在表里）；审计记录不删 —— 删了就在防篡改链上挖出缺口（data_change 分册）
        async with async_test_db_session.begin() as db:
            ids = list((await db.scalars(select(User.id).where(User.username.like(f'{PREFIX}%')))).all())
            if ids:
                await db.execute(delete(user_role).where(user_role.c.user_id.in_(ids)))
                await db.execute(delete(User).where(User.id.in_(ids)))

    original = settings.USER_IMPORT_DEFAULT_PASSWORD
    settings.USER_IMPORT_DEFAULT_PASSWORD = PASSWORD
    try:
        _call(client, setup)
        yield state
    finally:
        settings.USER_IMPORT_DEFAULT_PASSWORD = original
        _call(client, teardown)


def _import_rows(state, n):
    tag = uuid.uuid4().hex[:8]
    return [
        ImportRow(
            row_no=i + 2,
            values={
                'username': f'{PREFIX}i_{tag}_{i}',
                'nickname': None,
                'email': None,
                'phone': None,
                'dept_code': state['dept'],
                'role_codes': state['role'],
            },
            raw={},
        )
        for i in range(n)
    ]


@sqlserver_only
def test_deleting_a_user_does_not_wait_on_another_transactions_new_role_rows(client, ctx):
    """A = 导入提交到一半（新用户和它们的角色行已经写进去、没提交）；B = 删另一个人"""

    async def run():
        async with async_test_db_session() as holder:
            await user_dao.bulk_add(
                holder,
                [
                    {
                        'username': f'{PREFIX}h_{uuid.uuid4().hex[:8]}_{i}',
                        'nickname': 'holder',
                        'email': None,
                        'phone': None,
                        'dept_id': ctx['dept_id'],
                        'role_ids': [ctx['role_id']],
                    }
                    for i in range(IMPORT_ROWS)
                ],
                PASSWORD,
            )
            try:
                async with _impatient_session() as db:
                    request = SimpleNamespace(user=SimpleNamespace(id=ctx['admin']))
                    count = await user_service.delete(
                        db=db, request=request, background_tasks=BackgroundTasks(), pk=ctx['target']
                    )
                    await db.commit()
                    return count
            finally:
                await holder.rollback()

    assert _call(client, run) == 1

    async def deleted():
        async with async_test_db_session() as db:
            return await db.scalar(select(User.deleted).where(User.id == ctx['target']))

    assert _call(client, deleted) == ctx['target']


@sqlserver_only
def test_an_import_commit_does_not_wait_on_another_users_pending_delete(client, ctx):
    """A = 删一个人删到一半（他的角色行已经删掉、没提交）；B = 导入一批人并提交（审计按 20 个 user_id 拍快照）"""
    rows = _import_rows(ctx, IMPORT_ROWS)

    async def run():
        import_ctx = ImportContext(user=SimpleNamespace(id=ctx['admin']), background_tasks=BackgroundTasks())
        # 提交前的重新校验只读、读完就放锁，不参与成环；放在 A 开始之前，免得它和 A 那一行的写锁搅在一起
        async with async_test_db_session() as db:
            await USER_IMPORT.validate(db, rows, 'create', import_ctx)
        assert all(row.ok for row in rows), [row.errors for row in rows]

        async with async_test_db_session() as holder:
            request = SimpleNamespace(user=SimpleNamespace(id=ctx['admin']))
            await user_service.delete(db=holder, request=request, background_tasks=BackgroundTasks(), pk=ctx['target'])
            try:
                async with _impatient_session() as db:
                    with data_change_source('import', uuid.uuid4().hex, actor_id=ctx['admin']):
                        outcome = await USER_IMPORT.commit(db, rows, import_ctx)
                    # `_user_commit` 把数据库错误吞成「这一行失败」（原样的错误只进日志）—— 这里要的是它根本没失败
                    assert not outcome.failed, outcome.failed
                    await db.commit()
                    return len(outcome.created)
            finally:
                await holder.rollback()

    assert _call(client, run) == IMPORT_ROWS


def test_every_folded_table_has_an_index_on_its_parent_column(client):
    """审计按父列删 / 查 / 拍快照的表（关联表 · 一对一子表），父列必须领头某个索引 —— 否则 SQL Server 上只能扫全表、
    排在别人没提交的行后面（这批测试开头那段）。新登记一张关联表忘了建索引，这里当场红"""
    registry.load_data_change_extensions()
    folded = [*registry.SETS.values(), *registry.CHILDREN.values()]
    assert len(folded) >= 6, '登记表没加载上 —— 先断言有，再断言没有问题'
    # 主键 / 普通索引 / 唯一约束（SQL Server 用索引实现它）领头都算：二次验证、第三方账号走的是唯一约束
    missing = [
        f'{spec.table.name}.{spec.parent_column}'
        for spec in folded
        if not _leads_an_index(spec.table, spec.table.c[spec.parent_column])
    ]
    assert not missing


def test_capture_forces_a_seek_only_where_an_index_can_serve_it(client):
    """`FORCESEEK` 只给 SQL Server、只给领头某个索引的列 —— 没有可 seek 的索引时它直接报 8622（生成不出计划）"""
    with_index = _by_keys(user_role, user_role.c.user_id, [1, 2])
    assert 'WITH (FORCESEEK)' in str(with_index.compile(dialect=mssql.dialect()))
    assert 'FORCESEEK' not in str(with_index.compile(dialect=postgresql.dialect()))

    # 成员列没有自己的索引（它在主键里排第三）：不加，否则就是 8622
    without_index = _by_keys(user_role, user_role.c.role_id, [1, 2])
    assert 'FORCESEEK' not in str(without_index.compile(dialect=mssql.dialect()))
