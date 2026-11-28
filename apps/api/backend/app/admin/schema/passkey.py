import json

from datetime import datetime
from typing import Any, Literal

from pydantic import ConfigDict, Field, field_validator

from backend.common.schema import SchemaBase

#: 浏览器给的凭据 JSON 正常是 1～2 KB；放得宽一点，但不让人塞一个几 MB 的对象进来让服务端去解析
_CREDENTIAL_MAX_BYTES = 32 * 1024


def _bounded(value: dict[str, Any]) -> dict[str, Any]:
    if len(json.dumps(value, ensure_ascii=False)) > _CREDENTIAL_MAX_BYTES:
        raise ValueError('credential 太大')
    return value


class GetPasskeyDetail(SchemaBase):
    """通行密钥（只下发展示要用的，公钥 / 凭据 ID 不出网）"""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description='通行密钥 ID')
    name: str = Field(description='名称')
    backed_up: bool = Field(description='是否已同步备份（云端 Passkey，换设备也能用）')
    transports: str | None = Field(None, description='传输方式，逗号分隔（internal / hybrid / usb …）')
    created_time: datetime = Field(description='添加时间')
    last_used_time: datetime | None = Field(None, description='最近一次用它登录的时间')


class PasskeyNameParam(SchemaBase):
    """改名"""

    name: str = Field(min_length=1, max_length=64, description='名称')


class PasskeyRegisterParam(PasskeyNameParam):
    """添加：`navigator.credentials.create()` 的结果"""

    credential: dict[str, Any] = Field(description='PublicKeyCredential.toJSON() 的结果')

    _check = field_validator('credential')(_bounded)


class PasskeyReauthParam(SchemaBase):
    """
    添加前本人再确认一次：有密码的输当前密码，开了二次验证的再输动态码（或恢复码）。
    🔴 不确认的话，一个泄露的 access token（30 分钟）就能给账号添上攻击者自己的认证器 —— 通行密钥登录不走二次验证，
    改密码也不动它，等于一个长期的后门（#457 评审）。字段名 `password` / `otp` 都在操作日志的打码清单里
    """

    password: str | None = Field(None, max_length=128, description='当前密码（账号有密码时必填）')
    otp: str | None = Field(None, max_length=32, description='动态码或恢复码（开了二次验证时必填）')


class PasskeyLoginOptions(SchemaBase):
    """登录第一步：挑战。`options` 原样交给 `PublicKeyCredential.parseRequestOptionsFromJSON()`"""

    challenge_id: str = Field(description='挑战编号，第二步原样带回')
    options: dict[str, Any] = Field(description='WebAuthn 的 PublicKeyCredentialRequestOptions（JSON 形式）')


class PasskeyLoginParam(SchemaBase):
    """登录第二步：`navigator.credentials.get()` 的结果"""

    challenge_id: str = Field(min_length=16, max_length=64, description='第一步给的挑战编号')
    credential: dict[str, Any] = Field(description='PublicKeyCredential.toJSON() 的结果')
    client: Literal['web', 'desktop', 'mobile'] = Field('web', description='登录端')

    _check = field_validator('credential')(_bounded)


class GetPasskeyAvailability(SchemaBase):
    """登录页据此决定出不出「用通行密钥登录」按钮"""

    enabled: bool = Field(description='服务端是否配置了通行密钥（PASSKEY_RP_ID + PASSKEY_ORIGINS）')
