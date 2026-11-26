from datetime import datetime

import sqlalchemy as sa

from sqlalchemy.orm import Mapped, mapped_column

from backend.common.model import DataClassBase, DateTimeMixin, TimeZone, UniversalStr, UniversalText, id_key


# 通行密钥（Passkey / WebAuthn）：一个用户可以有多把（手机、电脑、安全钥匙各一把），一把一行。
#
# 🔴 **唯一键是 `credential_hash`（凭据 ID 的 sha256），不是 `credential_id` 本身。** 规范允许凭据 ID 长到 1023 字节
# （base64url 1364 个字符），直接建唯一索引在 MySQL utf8mb4 下超出 3072 字节的索引上限；按哈希查也一样快。
#
# 公钥不是秘密（它只能验签），但也不进审计表 —— 记了没有任何可读的意义（见 `app/admin/data_change.py`）。
# `sign_count` 每次登录都写，用来发现被克隆的认证器：新的计数不大于库里的就拒
# （两边都是 0 时不比 —— 同步型 Passkey 恒为 0）。
#
# 硬删：删掉就是这把钥匙不能再登录，没有「还原」的需要
#
# ⚠️ 类 docstring 保持一行（会原样成为表注释）
class UserPasskey(DataClassBase, DateTimeMixin):
    """用户通行密钥表"""

    __tablename__ = 'sys_user_passkey'

    id: Mapped[id_key] = mapped_column(init=False)
    user_id: Mapped[int] = mapped_column(sa.BigInteger, index=True, comment='用户 ID')
    name: Mapped[str] = mapped_column(UniversalStr(64), comment='名称（用户自己起的，如「我的手机」）')
    credential_hash: Mapped[str] = mapped_column(sa.String(64), unique=True, comment='凭据 ID 的 sha256（唯一键）')
    credential_id: Mapped[str] = mapped_column(UniversalText, comment='凭据 ID（base64url）')
    public_key: Mapped[str] = mapped_column(UniversalText, comment='公钥（COSE，base64url）')
    sign_count: Mapped[int] = mapped_column(sa.BigInteger, default=0, comment='签名计数（防克隆）')
    transports: Mapped[str | None] = mapped_column(sa.String(128), default=None, comment='传输方式，逗号分隔')
    aaguid: Mapped[str | None] = mapped_column(sa.String(36), default=None, comment='认证器型号（AAGUID）')
    backed_up: Mapped[bool] = mapped_column(default=False, comment='是否已同步备份（云端 Passkey）')
    last_used_time: Mapped[datetime | None] = mapped_column(TimeZone, default=None, comment='最近一次用它登录的时间')
