import sqlalchemy as sa

from backend.common.enums import PrimaryKeyType
from backend.common.model import MappedBase
from backend.core.conf import settings
from backend.utils.snowflake import snowflake

# 🔴 关联表的父列都要单独建索引（#455）。主键是 (id, 父列, 成员列)，以雪花 id 领头 —— 按父列删 / 查
# （删用户、改角色、存权限矩阵的「全删再全插」，以及数据变更审计在语句前、提交前各拍一次的快照）用不上它，只能扫全表。
# SQL Server 在 RCSI 关着时读也要加共享锁，扫描会在**每一行**上要锁、排在别的事务没提交的行后面：两个事务各自往
# 同一张关联表里写了几行、又都去扫它，就是互等 → 1205，接口 500。实测（SQL Server 2022）：删两个不同的用户就会撞，
# 删用户 × 用户导入提交、两个角色同时存权限也一样。PostgreSQL 读不加锁，碰不到。


def _pk_column() -> sa.Column:
    """
    关联表主键，跟随 DATABASE_PK_MODE。

    原实现硬编码 autoincrement=True，与主表在雪花模式下不一致；
    在 SQL Server 上这会让关联表主键变成 IDENTITY，导致种子数据无法显式插入 id
    （"Cannot insert explicit value for identity column ... IDENTITY_INSERT is set to OFF"）。
    """
    if PrimaryKeyType.autoincrement == settings.DATABASE_PK_MODE:
        return sa.Column(
            'id',
            sa.BigInteger,
            primary_key=True,
            unique=True,
            index=True,
            autoincrement=True,
            comment='主键 ID',
        )
    return sa.Column(
        'id',
        sa.BigInteger,
        primary_key=True,
        unique=True,
        index=True,
        default=snowflake.generate,
        comment='雪花算法主键 ID',
    )


# 用户角色表
user_role = sa.Table(
    'sys_user_role',
    MappedBase.metadata,
    _pk_column(),
    # 🔴 父列（「全删再全插」和审计拍快照按它取行的那一列）要单独建索引（#455），见文件头
    sa.Column('user_id', sa.BigInteger, primary_key=True, index=True, comment='用户ID'),
    sa.Column('role_id', sa.BigInteger, primary_key=True, comment='角色ID'),
)

# 角色菜单表
role_menu = sa.Table(
    'sys_role_menu',
    MappedBase.metadata,
    _pk_column(),
    sa.Column('role_id', sa.BigInteger, primary_key=True, index=True, comment='角色ID'),
    sa.Column('menu_id', sa.BigInteger, primary_key=True, comment='菜单ID'),
)

# 角色数据范围表
role_data_scope = sa.Table(
    'sys_role_data_scope',
    MappedBase.metadata,
    _pk_column(),
    sa.Column('role_id', sa.BigInteger, primary_key=True, index=True, comment='角色 ID'),
    sa.Column('data_scope_id', sa.BigInteger, primary_key=True, comment='数据范围 ID'),
)

# 数据范围规则表
data_scope_rule = sa.Table(
    'sys_data_scope_rule',
    MappedBase.metadata,
    _pk_column(),
    sa.Column('data_scope_id', sa.BigInteger, primary_key=True, index=True, comment='数据范围 ID'),
    sa.Column('data_rule_id', sa.BigInteger, primary_key=True, comment='数据规则 ID'),
)
