"""通行密钥（Passkey / WebAuthn）：注册、管理、登录时的断言校验。

```
个人中心「添加」── registration_options() ──→ navigator.credentials.create() ──→ register()
登录页「用通行密钥登录」── login_options() ──→ navigator.credentials.get() ──→ auth_service.passkey_login()
                                                                                └─ verify_login() 校验断言
```

几条设计，每条对应一种静默出错的方式：

- 🔴 **只做「不先输用户名」的流程（可发现凭据）**：先输用户名再要挑战的话，「这个账号有没有通行密钥」就从挑战里漏出去了
  （同手机登录那条防枚举）。登录挑战里不带 `allowCredentials`，用哪把由认证器挑
- 🔴 **一律要求用户验证（UV：指纹 / 面容 / PIN）**。带 UV 的通行密钥本身就是「持有设备 + 生物特征 / PIN」两个因素，
  所以通行密钥登录**不再走二次验证**，被强制开 MFA 的账号也一样（`auth_service.passkey_login`）。不要 UV 的话，
  捡到一把没锁的安全钥匙就能登
- 🔴 **挑战一次性**：存 Redis、`GETDEL` 取，取不到就是过期 / 用过了。断言被截下来重放时挑战已经没了
- 🔴 **登录失败对外一律同一句「通行密钥无效」**：凭据不存在 / 用户已删 / 签名不对 / 计数倒退 ——
  区分开就是一张凭据核对器。
  原因进日志。失败计入 IP 失败计数，**不计入账号**：拿不到私钥的人造不出有效断言，按账号计等于谁都能把别人锁住
- `sign_count`：新的不大于库里的就拒（py_webauthn 在两边都是 0 时不比 —— iCloud / Google 的同步型 Passkey 恒为 0）
"""

from __future__ import annotations

import hashlib
import json
import secrets

from typing import TYPE_CHECKING, Any

from sqlalchemy import delete, func, select
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from backend.app.admin.crud.crud_user import user_dao
from backend.app.admin.model import User, UserPasskey
from backend.app.admin.schema.passkey import PasskeyLoginOptions, PasskeyReauthParam
from backend.app.admin.service.mfa_service import mfa_service
from backend.app.admin.utils import password_set_grant
from backend.app.admin.utils.password_security import password_verify
from backend.common.exception import errors
from backend.common.i18n import t
from backend.common.log import log
from backend.common.security.data_scope import bypass_data_scope
from backend.core.conf import settings
from backend.database.redis import redis_client
from backend.utils.timezone import timezone

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

#: 认证器声明的传输方式里只认这几个，别的丢掉（这一列只是给人看的提示）
_TRANSPORTS = {'ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'}


def enabled() -> bool:
    """RP ID 和来源都配了才算启用（配一半当没配，生产启动检查会拦）"""
    return bool(settings.PASSKEY_RP_ID and settings.PASSKEY_ORIGINS)


def _require_enabled() -> None:
    if not enabled():
        raise errors.RequestError(msg=t('error.passkey.disabled'))


def _key(kind: str, token: str) -> str:
    return f'{settings.PASSKEY_REDIS_PREFIX}:{kind}:{token}'


def _credential_hash(raw_id: bytes) -> str:
    return hashlib.sha256(raw_id).hexdigest()


def user_handle(user: User) -> bytes:
    """WebAuthn 的 user.id：要不透明、不能含个人信息（用户名 / 邮箱都不行）—— 用用户的 uuid"""
    return str(user.uuid).encode()


def _invalid() -> errors.AuthorizationError:
    return errors.AuthorizationError(msg=t('error.passkey.invalid'))


async def _from_db(db: AsyncSession, user: Any) -> User:
    """
    🔴 注册时的用户句柄要用**库里**那一行的 uuid，不能用 `request.user`（Redis 里的登录快照）。

    登录时是按凭据查库里的用户、拿它的 uuid 比 userHandle；注册用快照的话，两边一旦不是同一个值，
    这把钥匙就永远登不上（「userHandle 对不上」）。实测：本机几套库共用一个 Redis、管理员的雪花 ID 相同，
    快照里的 uuid 是别的库写进去的 —— 添加成功、登录必失败，界面上只有一句「通行密钥无效」
    """
    # 🔴 要 `bypass_data_scope()`：已登录请求里 DAO 会套上当前用户的数据范围，STAFF 这类「开了过滤、没有规则」的人
    # 连自己都查不到（同 `app/admin` 分册「用户快照」那一节的刷新 token 那条）
    with bypass_data_scope():
        row = await user_dao.get(db, user.id)
    if row is None:
        raise errors.NotFoundError(msg=t('error.user.not_found'))
    return row


async def list_mine(db: AsyncSession, user_id: int) -> list[UserPasskey]:
    rows = await db.scalars(select(UserPasskey).where(UserPasskey.user_id == user_id).order_by(UserPasskey.id))
    return list(rows)


async def _own(db: AsyncSession, user_id: int, pk: int) -> UserPasskey:
    row = await db.scalar(select(UserPasskey).where(UserPasskey.id == pk, UserPasskey.user_id == user_id))
    if row is None:
        # 别人的和不存在的一样：不承认那一行存在
        raise errors.NotFoundError(msg=t('error.passkey.not_found'))
    return row


async def _reauth(db: AsyncSession, user: User, session_uuid: str, obj: PasskeyReauthParam) -> None:
    """
    添加前本人再确认一次（#457 评审）：有密码的要当前密码；没有密码的（只用第三方登录建的号）要这个会话里
    刚用第三方账号验证过（同「设置密码」那条，`password_set_grant`）；开了二次验证的再要动态码。
    只在取挑战这一步查 —— 交注册结果那一步要用这里存下的挑战，绕不过去
    """
    if user.password:
        if not (obj.password and password_verify(obj.password, user.password)):
            raise errors.RequestError(msg=t('error.passkey.reauth_failed'))
    elif not await password_set_grant.is_granted(user.id, session_uuid):
        raise errors.RequestError(msg=t('error.passkey.reauth_required'))
    await mfa_service.verify_if_enabled(db, user, obj.otp)


async def registration_options(
    db: AsyncSession, user: Any, session_uuid: str, reauth: PasskeyReauthParam
) -> dict[str, Any]:
    """添加一把：本人再确认一次，再生成注册挑战。原样交给 `PublicKeyCredential.parseCreationOptionsFromJSON()`"""
    _require_enabled()
    user = await _from_db(db, user)
    await _reauth(db, user, session_uuid, reauth)
    rows = await list_mine(db, user.id)
    if len(rows) >= settings.PASSKEY_MAX_PER_USER:
        raise errors.RequestError(msg=t('error.passkey.too_many', max=settings.PASSKEY_MAX_PER_USER))
    options = generate_registration_options(
        rp_id=settings.PASSKEY_RP_ID,
        rp_name=settings.PASSKEY_RP_NAME or settings.FASTAPI_TITLE,
        user_id=user_handle(user),
        user_name=user.username,
        user_display_name=user.nickname or user.username,
        timeout=settings.PASSKEY_CHALLENGE_SECONDS * 1000,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        # 同一个认证器不许登记两次（浏览器会直接报 InvalidStateError）
        exclude_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(r.credential_id)) for r in rows],
    )
    # 按人存：同一个人再点一次「添加」就覆盖上一次的挑战，旧的那个弹窗再提交会对不上
    await redis_client.set(
        _key('reg', str(user.id)), bytes_to_base64url(options.challenge), ex=settings.PASSKEY_CHALLENGE_SECONDS
    )
    return json.loads(options_to_json(options))


async def register(db: AsyncSession, user: User, name: str, credential: dict[str, Any]) -> UserPasskey:
    """添加一把：校验注册结果并落库"""
    _require_enabled()
    challenge = await redis_client.getdel(_key('reg', str(user.id)))
    if not challenge:
        raise errors.RequestError(msg=t('error.passkey.challenge_expired'))
    try:
        verified = verify_registration_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(challenge),
            expected_rp_id=settings.PASSKEY_RP_ID,
            expected_origin=list(settings.PASSKEY_ORIGINS),
            require_user_verification=True,
        )
    except Exception as e:
        log.info(f'通行密钥注册校验没过（用户 {user.id}）：{type(e).__name__}: {e}')
        raise errors.RequestError(msg=t('error.passkey.register_failed')) from e

    count = await db.scalar(select(func.count()).select_from(UserPasskey).where(UserPasskey.user_id == user.id))
    if (count or 0) >= settings.PASSKEY_MAX_PER_USER:
        raise errors.RequestError(msg=t('error.passkey.too_many', max=settings.PASSKEY_MAX_PER_USER))
    digest = _credential_hash(verified.credential_id)
    if await db.scalar(select(UserPasskey.id).where(UserPasskey.credential_hash == digest)) is not None:
        raise errors.ConflictError(msg=t('error.passkey.already_registered'))

    declared = (credential.get('response') or {}).get('transports') or []
    transports = ','.join(sorted({x for x in declared if isinstance(x, str) and x in _TRANSPORTS})) or None
    row = UserPasskey(
        user_id=user.id,
        name=name.strip(),
        credential_hash=digest,
        credential_id=bytes_to_base64url(verified.credential_id),
        public_key=bytes_to_base64url(verified.credential_public_key),
        sign_count=verified.sign_count,
        transports=transports,
        aaguid=str(verified.aaguid) if verified.aaguid else None,
        backed_up=bool(verified.credential_backed_up),
    )
    db.add(row)
    await db.flush()
    return row


async def rename(db: AsyncSession, user_id: int, pk: int, name: str) -> None:
    row = await _own(db, user_id, pk)
    row.name = name.strip()


async def remove(db: AsyncSession, user_id: int, pk: int) -> None:
    row = await _own(db, user_id, pk)
    await db.delete(row)


async def admin_reset(db: AsyncSession, user_id: int) -> int:
    """管理员清掉某人的全部通行密钥（设备丢了 / 离职交接）。返回删了几把"""
    result = await db.execute(delete(UserPasskey).where(UserPasskey.user_id == user_id))
    return result.rowcount or 0


async def login_options() -> PasskeyLoginOptions:
    """登录第一步（匿名）。不带 allowCredentials —— 不先问用户名，见模块说明"""
    _require_enabled()
    options = generate_authentication_options(
        rp_id=settings.PASSKEY_RP_ID,
        timeout=settings.PASSKEY_CHALLENGE_SECONDS * 1000,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    challenge_id = secrets.token_urlsafe(24)
    await redis_client.set(
        _key('login', challenge_id), bytes_to_base64url(options.challenge), ex=settings.PASSKEY_CHALLENGE_SECONDS
    )
    return PasskeyLoginOptions(challenge_id=challenge_id, options=json.loads(options_to_json(options)))


async def verify_login(
    db: AsyncSession, challenge_id: str, credential: dict[str, Any]
) -> tuple[User, UserPasskey, int]:
    """
    登录第二步：校验断言，返回（用户, 用的哪一把, 新的签名计数）。不开会话、不记日志 —— 那是 `auth_service` 的事

    :raises errors.AuthorizationError: 挑战过期 / 用过了，或者「通行密钥无效」（原因只进日志）
    """
    _require_enabled()
    challenge = await redis_client.getdel(_key('login', challenge_id))
    if not challenge:
        raise errors.AuthorizationError(msg=t('error.passkey.challenge_expired'))

    raw_id = credential.get('rawId') or credential.get('id')
    try:
        raw = base64url_to_bytes(raw_id) if isinstance(raw_id, str) else b''
    except Exception:
        raw = b''
    if not raw:
        log.info('通行密钥登录：凭据里没有可用的 id')
        raise _invalid()

    row = await db.scalar(select(UserPasskey).where(UserPasskey.credential_hash == _credential_hash(raw)))
    if row is None:
        log.info('通行密钥登录：库里没有这把凭据（可能已被删除 / 管理员重置）')
        raise _invalid()
    with bypass_data_scope():  # 匿名请求本来没有范围上下文；包上是防将来有人在已登录的上下文里调它
        user = await user_dao.get(db, row.user_id)
    if user is None:
        log.info(f'通行密钥登录：凭据 {row.id} 的用户已不存在')
        raise _invalid()

    handle = (credential.get('response') or {}).get('userHandle')
    if handle:
        try:
            handle_ok = base64url_to_bytes(handle) == user_handle(user)
        except Exception:
            handle_ok = False
        if not handle_ok:
            log.warning(f'通行密钥登录：凭据 {row.id} 带的 userHandle 和它所属的用户对不上')
            raise _invalid()

    try:
        verified = verify_authentication_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(challenge),
            expected_rp_id=settings.PASSKEY_RP_ID,
            expected_origin=list(settings.PASSKEY_ORIGINS),
            credential_public_key=base64url_to_bytes(row.public_key),
            credential_current_sign_count=row.sign_count,
            require_user_verification=True,
        )
    except Exception as e:
        log.warning(f'通行密钥登录：凭据 {row.id}（用户 {user.id}）校验没过：{type(e).__name__}: {e}')
        raise _invalid() from e
    return user, row, verified.new_sign_count


def record_use(row: UserPasskey, new_sign_count: int) -> None:
    """登录成功后回写计数和最近使用时间（两列都在审计的忽略列里，不出变更记录）"""
    row.sign_count = new_sign_count
    row.last_used_time = timezone.now()
