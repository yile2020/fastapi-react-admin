"""关联表的父列加索引：SQL Server 上删用户 × 用户导入提交互相死锁（#455）

Revision ID: aw000000m2mparentidx
Revises: au000000aiproxydefault
Create Date: 2026-11-27 12:00:00

四张关联表的主键是 (id, 父列, 成员列)，以雪花 id 领头，按父列删 / 查用不上它、只能扫全表。SQL Server 在
RCSI 关着时读也加共享锁，扫描排在别的事务没提交的行后面：两个事务各往同一张关联表里写了几行、又都去扫它
（数据变更审计在提交前拍快照），就是 1205。见 `app/admin/model/m2m.py` 文件头。

`create_all` 建的新库（`fba init` / 测试库）从模型建表、自带这几个索引，并且 stamp 到 head，不会再跑这一条。
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = 'aw000000m2mparentidx'
down_revision = 'au000000aiproxydefault'
branch_labels = None
depends_on = None

_PARENT_COLUMNS = (
    ('sys_user_role', 'user_id'),
    ('sys_role_menu', 'role_id'),
    ('sys_role_data_scope', 'role_id'),
    ('sys_data_scope_rule', 'data_scope_id'),
)


def upgrade() -> None:
    for table, column in _PARENT_COLUMNS:
        op.create_index(op.f(f'ix_{table}_{column}'), table, [column], unique=False)


def downgrade() -> None:
    for table, column in reversed(_PARENT_COLUMNS):
        op.drop_index(op.f(f'ix_{table}_{column}'), table_name=table)
