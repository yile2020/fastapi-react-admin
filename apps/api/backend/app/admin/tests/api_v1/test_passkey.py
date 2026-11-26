"""通行密钥（Passkey / WebAuthn）：注册 · 无用户名登录 · 每一种该拒的情形。

浏览器那一侧用一个纯 Python 的软件认证器代替（P-256 密钥，按规范拼 authenticatorData / clientDataJSON / 签名），
走的是真实 HTTP 接口和真的 py_webauthn 校验。浏览器 + CDP 虚拟认证器那一层的实测见 `app/admin` 分册「通行密钥」一节。
"""

import hashlib
import json
import os
import struct

from collections.abc import Iterator
from typing import Any

import cbor2
import pytest
import sqlalchemy as sa

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from starlette.testclient import TestClient
from webauthn.helpers import bytes_to_base64url

from backend.app.admin.model import UserPasskey
from backend.core.conf import settings
from backend.tests.utils.data_change import changes_of, engine

RP_ID = 'localhost'
ORIGIN = 'http://localhost:8888'
#: authenticatorData 的标志位
UP, UV, AT = 0x01, 0x04, 0x40


class SoftAuthenticator:
    """一个软件认证器：一把 P-256 密钥、一个凭据 ID、一个签名计数"""

    def __init__(self) -> None:
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.credential_id = os.urandom(32)
        self.count = 0
        self.user_handle: str | None = None

    def _cose_public_key(self) -> bytes:
        numbers = self.key.public_key().public_numbers()
        return cbor2.dumps({1: 2, 3: -7, -1: 1, -2: numbers.x.to_bytes(32, 'big'), -3: numbers.y.to_bytes(32, 'big')})

    def create(self, options: dict[str, Any], *, origin: str = ORIGIN, flags: int = UP | UV | AT) -> dict[str, Any]:
        self.user_handle = options['user']['id']
        client_data = json.dumps({
            'type': 'webauthn.create',
            'challenge': options['challenge'],
            'origin': origin,
        }).encode()
        self.count += 1
        auth_data = (
            hashlib.sha256(options['rp']['id'].encode()).digest()
            + bytes([flags])
            + struct.pack('>I', self.count)
            + b'\x00' * 16  # AAGUID
            + struct.pack('>H', len(self.credential_id))
            + self.credential_id
            + self._cose_public_key()
        )
        attestation = cbor2.dumps({'fmt': 'none', 'attStmt': {}, 'authData': auth_data})
        cid = bytes_to_base64url(self.credential_id)
        return {
            'id': cid,
            'rawId': cid,
            'type': 'public-key',
            'response': {
                'clientDataJSON': bytes_to_base64url(client_data),
                'attestationObject': bytes_to_base64url(attestation),
                'transports': ['internal', 'made-up'],
            },
            'clientExtensionResults': {},
        }

    def get(
        self,
        options: dict[str, Any],
        *,
        origin: str = ORIGIN,
        flags: int = UP | UV,
        bump: bool = True,
        user_handle: str | None = None,
    ) -> dict[str, Any]:
        client_data = json.dumps({'type': 'webauthn.get', 'challenge': options['challenge'], 'origin': origin}).encode()
        if bump:
            self.count += 1
        auth_data = hashlib.sha256(options['rpId'].encode()).digest() + bytes([flags]) + struct.pack('>I', self.count)
        signature = self.key.sign(auth_data + hashlib.sha256(client_data).digest(), ec.ECDSA(hashes.SHA256()))
        cid = bytes_to_base64url(self.credential_id)
        return {
            'id': cid,
            'rawId': cid,
            'type': 'public-key',
            'response': {
                'clientDataJSON': bytes_to_base64url(client_data),
                'authenticatorData': bytes_to_base64url(auth_data),
                'signature': bytes_to_base64url(signature),
                'userHandle': user_handle if user_handle is not None else self.user_handle,
            },
            'clientExtensionResults': {},
        }


def _bearer(client: TestClient, username: str, password: str) -> dict[str, str]:
    body = client.post('/auth/login/swagger', params={'username': username, 'password': password}).json()
    return {'Authorization': f'{body["token_type"]} {body["access_token"]}'}


def _register(client: TestClient, headers: dict[str, str], auth: SoftAuthenticator, name: str = '我的电脑', **kw: Any):
    options = client.post('/sys/users/me/passkeys/options', headers=headers).json()
    assert options['code'] == 200, options
    return client.post(
        '/sys/users/me/passkeys', headers=headers, json={'name': name, 'credential': auth.create(options['data'], **kw)}
    )


def _login(client: TestClient, auth: SoftAuthenticator, **kw: Any) -> tuple[Any, dict[str, Any]]:
    first = client.post('/auth/passkey/options').json()
    assert first['code'] == 200, first
    data = first['data']
    credential = auth.get(data['options'], **kw)
    return client.post(
        '/auth/passkey/login', json={'challenge_id': data['challenge_id'], 'credential': credential}
    ), data


@pytest.fixture(autouse=True)
def _passkey_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, 'PASSKEY_RP_ID', RP_ID)
    monkeypatch.setattr(settings, 'PASSKEY_ORIGINS', [ORIGIN])


@pytest.fixture
def me(client: TestClient, temp_user: str) -> Iterator[dict[str, Any]]:
    """临时用户 + 它的登录头；收尾硬删它名下的通行密钥（用户本身由 temp_user 硬删）"""
    yield {'id': temp_user, 'headers': _bearer(client, 'pytest_tmp_writes', 'Tmp@123456')}
    with engine().begin() as conn:
        conn.execute(sa.delete(UserPasskey.__table__).where(UserPasskey.__table__.c.user_id == int(temp_user)))


@pytest.fixture
def registered(client: TestClient, me: dict[str, Any]) -> tuple[dict[str, Any], SoftAuthenticator, dict[str, Any]]:
    auth = SoftAuthenticator()
    resp = _register(client, me['headers'], auth)
    assert resp.json()['code'] == 200, resp.text
    return me, auth, resp.json()['data']


def test_disabled_until_both_settings_are_configured(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, 'PASSKEY_ORIGINS', [])
    assert client.get('/auth/passkey/enabled').json()['data'] == {'enabled': False}
    resp = client.post('/auth/passkey/options').json()
    assert resp['code'] == 400 and 'PASSKEY_RP_ID' in resp['msg']
    monkeypatch.setattr(settings, 'PASSKEY_ORIGINS', [ORIGIN])
    assert client.get('/auth/passkey/enabled').json()['data'] == {'enabled': True}


def test_register_then_sign_in_without_a_username(client: TestClient, registered) -> None:
    me, auth, detail = registered
    assert detail['name'] == '我的电脑'
    assert detail['transports'] == 'internal', '只留认得的传输方式'
    listed = client.get('/sys/users/me/passkeys', headers=me['headers']).json()['data']
    assert [p['id'] for p in listed] == [detail['id']]
    assert 'public_key' not in listed[0] and 'credential_id' not in listed[0], '钥匙材料不出网'

    resp, first = _login(client, auth)
    assert 'allowCredentials' not in first['options'] or not first['options']['allowCredentials'], (
        '不能先暴露有哪些凭据'
    )
    assert first['options']['userVerification'] == 'required'
    body = resp.json()
    assert body['code'] == 200, body
    headers = {'Authorization': f'Bearer {body["data"]["access_token"]}'}
    assert client.get('/sys/users/me', headers=headers).json()['data']['username'] == 'pytest_tmp_writes'
    used = client.get('/sys/users/me/passkeys', headers=me['headers']).json()['data'][0]
    assert used['last_used_time'] is not None


def test_a_challenge_can_be_used_once(client: TestClient, registered) -> None:
    _, auth, _ = registered
    first = client.post('/auth/passkey/options').json()['data']
    credential = auth.get(first['options'])
    ok = client.post('/auth/passkey/login', json={'challenge_id': first['challenge_id'], 'credential': credential})
    assert ok.json()['code'] == 200
    # 🔴 第二次用一份**新签的**断言（计数增长了）：只重交同一份的话计数检查本来就会拒，证明不了挑战被作废（变异实测过）
    fresh = auth.get(first['options'])
    again = client.post('/auth/passkey/login', json={'challenge_id': first['challenge_id'], 'credential': fresh})
    assert again.json()['code'] == 403, '同一个挑战第二次用'


def test_replaying_an_assertion_under_a_new_challenge_is_rejected(client: TestClient, registered) -> None:
    _, auth, _ = registered
    resp, first = _login(client, auth)
    assert resp.json()['code'] == 200
    stolen = auth.get(first['options'], bump=False)  # 截下来的旧断言（旧挑战、旧计数）
    fresh = client.post('/auth/passkey/options').json()['data']
    replay = client.post('/auth/passkey/login', json={'challenge_id': fresh['challenge_id'], 'credential': stolen})
    assert replay.json()['code'] == 403


@pytest.mark.parametrize(
    ('kwargs', 'why'),
    [
        ({'origin': 'https://evil.example'}, '别的站点'),
        ({'flags': UP}, '没做用户验证（UV）'),
        ({'bump': False}, '签名计数没增长（像是被克隆的认证器）'),
        ({'user_handle': bytes_to_base64url(b'someone-else')}, 'userHandle 对不上'),
    ],
    ids=['origin', 'no-uv', 'counter', 'user-handle'],
)
def test_bad_assertions_get_the_same_message(client: TestClient, registered, kwargs: dict[str, Any], why: str) -> None:
    _, auth, _ = registered
    assert _login(client, auth)[0].json()['code'] == 200, '前提：这把钥匙本来能登'
    resp, _ = _login(client, auth, **kwargs)
    body = resp.json()
    assert body['code'] == 403, why
    assert body['msg'] == '通行密钥无效，请换一把或用密码登录', f'{why}：失败原因不能对外区分'


def test_unknown_and_deleted_credentials_look_the_same(client: TestClient, registered) -> None:
    me, auth, detail = registered
    stranger = SoftAuthenticator()
    stranger.user_handle = auth.user_handle
    unknown = _login(client, stranger)[0].json()
    assert client.delete(f'/sys/users/me/passkeys/{detail["id"]}', headers=me['headers']).json()['code'] == 200
    deleted = _login(client, auth)[0].json()
    # 🔴 和固定文案比，不只两者互比：「不存在」「已删」走同一个分支，换了说法两边一起变（变异实测过）
    assert unknown['code'] == deleted['code'] == 403
    assert unknown['msg'] == deleted['msg'] == '通行密钥无效，请换一把或用密码登录'


def test_registration_requires_user_verification_and_the_right_origin(client: TestClient, me) -> None:
    for kwargs in ({'flags': UP | AT}, {'origin': 'https://evil.example'}):
        resp = _register(client, me['headers'], SoftAuthenticator(), **kwargs).json()
        assert resp['code'] == 400, kwargs
    assert client.get('/sys/users/me/passkeys', headers=me['headers']).json()['data'] == []


def test_the_same_authenticator_cannot_be_added_twice(client: TestClient, registered) -> None:
    me, auth, _ = registered
    resp = _register(client, me['headers'], auth, name='同一把').json()
    assert resp['code'] == 409


def test_per_user_limit(client: TestClient, registered, monkeypatch: pytest.MonkeyPatch) -> None:
    me, _, _ = registered
    monkeypatch.setattr(settings, 'PASSKEY_MAX_PER_USER', 1)
    resp = client.post('/sys/users/me/passkeys/options', headers=me['headers']).json()
    assert resp['code'] == 400 and '1' in resp['msg']


def test_someone_elses_passkey_is_not_found(client: TestClient, registered, token_headers: dict[str, str]) -> None:
    _, _, detail = registered
    # 管理员也不行：「我的」接口只认本人；管理员要清走的是重置接口
    assert (
        client.put(f'/sys/users/me/passkeys/{detail["id"]}', headers=token_headers, json={'name': 'x'}).json()['code']
        == 404
    )
    assert client.delete(f'/sys/users/me/passkeys/{detail["id"]}', headers=token_headers).json()['code'] == 404


def test_disabled_user_cannot_sign_in(client: TestClient, registered, token_headers: dict[str, str]) -> None:
    me, auth, _ = registered
    assert (
        client.put(f'/sys/users/{me["id"]}/permissions', headers=token_headers, params={'type': 'status'}).json()[
            'code'
        ]
        == 200
    )
    body = _login(client, auth)[0].json()
    assert body['code'] == 403 and body['msg'] != '通行密钥无效，请换一把或用密码登录', (
        '钥匙是对的，可以如实说明账号状态'
    )


def test_passkey_sign_in_skips_the_second_factor(
    client: TestClient, registered, monkeypatch: pytest.MonkeyPatch
) -> None:
    """带 UV 的通行密钥本身就是两个因素：被强制开 MFA 的人也不再走 mfa_gate"""
    from backend.app.admin.service import auth_service as module

    async def boom(*_a: Any, **_kw: Any) -> None:  # ruff: ignore[unused-async] - 顶掉的原函数是 async
        raise AssertionError('通行密钥登录不该走二次验证')

    monkeypatch.setattr(module, 'mfa_gate', boom)
    _, auth, _ = registered
    assert _login(client, auth)[0].json()['code'] == 200


def test_failures_count_against_the_ip_not_the_account(
    client: TestClient, registered, monkeypatch: pytest.MonkeyPatch
) -> None:
    from backend.app.admin.service.user_password_history_service import password_security_service as pss

    calls: list[str] = []
    real_ip = pss.handle_ip_login_failure

    async def ip_failure(ip: str, username: str | None = None) -> None:
        calls.append('ip')
        await real_ip(ip, username)

    async def account_failure(*_a: Any, **_kw: Any) -> None:  # ruff: ignore[unused-async] - 顶掉的原函数是 async
        calls.append('account')

    monkeypatch.setattr(pss, 'handle_ip_login_failure', ip_failure)
    monkeypatch.setattr(pss, 'handle_login_failure', account_failure)
    _, auth, _ = registered
    assert _login(client, auth, origin='https://evil.example')[0].json()['code'] == 403
    assert calls == ['ip'], '拿不到私钥的人造不出有效断言，按账号计等于谁都能把别人锁住'
    assert _login(client, auth)[0].json()['code'] == 200, '之后照样能登（顺带把 IP 计数清零）'


def test_superuser_can_clear_someones_passkeys(client: TestClient, registered, token_headers: dict[str, str]) -> None:
    me, auth, _ = registered
    assert client.delete(f'/sys/users/{me["id"]}/passkeys', headers=me['headers']).json()['code'] in (401, 403), (
        '非超管不能重置'
    )
    assert client.delete(f'/sys/users/{me["id"]}/passkeys', headers=token_headers).json()['code'] == 200
    assert _login(client, auth)[0].json()['code'] == 403


def test_changes_are_recorded_but_sign_ins_are_not(client: TestClient, registered) -> None:
    me, auth, detail = registered
    assert _login(client, auth)[0].json()['code'] == 200  # 回写计数 / 最近使用时间：都在忽略列里
    assert (
        client.put(f'/sys/users/me/passkeys/{detail["id"]}', headers=me['headers'], json={'name': '我的手机'}).json()[
            'code'
        ]
        == 200
    )
    assert client.delete(f'/sys/users/me/passkeys/{detail["id"]}', headers=me['headers']).json()['code'] == 200
    records = changes_of('user_passkey', detail['id'])
    assert [r['action'] for r in records] == ['create', 'update', 'delete'], records
    blob = json.dumps(records, ensure_ascii=False, default=str)
    assert 'public_key' not in blob and 'credential' not in blob, '钥匙材料不进审计表'


@pytest.mark.parametrize(
    ('rp_id', 'origins', 'problem'),
    [
        ('', [], None),
        ('example.com', ['https://example.com', 'https://admin.example.com'], None),
        ('example.com', [], '要一起配'),
        ('', ['https://example.com'], '要一起配'),
        ('localhost', ['http://localhost:8888'], '正式域名'),
        ('10.0.0.8', ['https://10.0.0.8'], '正式域名'),
        ('example.com', ['http://example.com'], 'https'),
        ('example.com', ['https://evil.com'], '不属于'),
        ('example.com', ['https://notexample.com'], '不属于'),
    ],
    ids=['off', 'ok', 'origins-missing', 'rp-missing', 'localhost', 'ip', 'http', 'foreign', 'suffix-trick'],
)
def test_production_check(rp_id: str, origins: list[str], problem: str | None) -> None:
    from types import SimpleNamespace

    from backend.core.conf import _check_passkey

    result = _check_passkey(SimpleNamespace(PASSKEY_RP_ID=rp_id, PASSKEY_ORIGINS=origins))
    if problem is None:
        assert result is None
    else:
        assert result is not None and problem in result, result
