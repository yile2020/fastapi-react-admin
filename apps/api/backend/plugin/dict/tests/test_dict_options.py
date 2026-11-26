"""`GET /sys/dict-datas/options`：给前端下拉 / 标签读字典用的「登录即可」批量接口。

原来前端读字典值只有 `/type-codes/{code}` 一条路，它挂着 `dict:data:list`、空类型 / 不存在 / 全停用一律 404、
还按 `sort` **降序**返回 —— 普通用户的下拉读不到，管理员在字典页看到的顺序和下拉相反（2026-11-26 实测，
见 `packages/platform/src/pages/_shared/AGENTS.md` 的「字典」一节）。这里钉住新接口的形状。
"""

import uuid

from collections.abc import Iterator

import pytest
import sqlalchemy as sa

from starlette.testclient import TestClient

from backend.core.conf import settings
from backend.database.redis import redis_client
from backend.plugin.dict.model import DictData, DictType
from backend.tests.utils.data_change import engine

_RUN = uuid.uuid4().hex[:8]
TYPES = '/sys/dict-types'
DATAS = '/sys/dict-datas'
FULL = f'op{_RUN}'  # 有四个启用项（其中两个同 sort）+ 一个停用项
EMPTY = f'oe{_RUN}'  # 类型存在、没有任何项
OFF = f'of{_RUN}'  # 只有停用项
GHOST = f'og{_RUN}'  # 根本不存在的类型
ALL_CODES = (FULL, EMPTY, OFF, GHOST)


def _login(client: TestClient, username: str, password: str = '123456') -> dict[str, str]:
    resp = client.post('/auth/login/swagger', params={'username': username, 'password': password})
    resp.raise_for_status()
    body = resp.json()
    return {'Authorization': f'{body["token_type"]} {body["access_token"]}'}


def _options(client: TestClient, headers: dict[str, str] | None, *codes: str):
    return client.get(f'{DATAS}/options', headers=headers, params={'codes': list(codes)})


def _key(code: str) -> str:
    return f'{settings.CACHE_DICT_REDIS_PREFIX}:options:{code}'


@pytest.fixture(autouse=True)
def _purge(client: TestClient) -> Iterator[None]:
    yield
    for code in ALL_CODES:
        client.portal.call(redis_client.delete, _key(code))
    with engine().begin() as conn:
        conn.execute(sa.delete(DictData.__table__).where(DictData.__table__.c.type_code.in_(ALL_CODES)))
        conn.execute(sa.delete(DictType.__table__).where(DictType.__table__.c.code.in_(ALL_CODES)))


@pytest.fixture
def seeded(client: TestClient, token_headers: dict[str, str]) -> dict[str, str]:
    """造三类数据，返回 {编码: 类型 id}。项故意不按 sort 顺序创建，才能证明排序不是插入顺序"""
    ids: dict[str, str] = {}
    for code in (FULL, EMPTY, OFF):
        assert (
            client.post(TYPES, headers=token_headers, json={'name': f'选项{code}', 'code': code}).json()['code'] == 200
        )
        ids[code] = client.get(TYPES, headers=token_headers, params={'code': code}).json()['data']['items'][0]['id']

    def add(code: str, label: str, value: str, sort: int, status: int = 1, color: str | None = None) -> None:
        body = {'type_id': ids[code], 'label': label, 'value': value, 'sort': sort, 'status': status, 'color': color}
        assert client.post(DATAS, headers=token_headers, json=body).json()['code'] == 200

    add(FULL, '丙', '3', 3, color='green')
    add(FULL, '甲', '1', 1)
    add(FULL, '乙停用', '2', 2, status=0)
    add(FULL, '乙', '22', 2)
    add(FULL, '乙二', '23', 2)  # 和「乙」同 sort：靠 id 兜底，先创建的在前
    add(OFF, '全停用', '1', 1, status=0)
    return ids


def test_a_user_without_dict_permission_can_read_options(
    client: TestClient, token_headers: dict[str, str], seeded: dict[str, str]
) -> None:
    """STAFF 没有任何 `dict:data:*`：管理接口 403（对照组），选项接口 200 —— 普通页面的下拉就靠这个"""
    staff = _login(client, 'test')
    assert client.get(DATAS, headers=staff).status_code == 403, '前提：管理接口照旧要权限'
    assert client.get(f'{DATAS}/type-codes/{FULL}', headers=staff).status_code == 403, '前提：老的读接口也要权限'

    resp = _options(client, staff, FULL)
    assert resp.status_code == 200, resp.text
    assert [o['label'] for o in resp.json()['data'][FULL]] == ['甲', '乙', '乙二', '丙']


def test_options_require_login(client: TestClient, seeded: dict[str, str]) -> None:
    assert _options(client, None, FULL).status_code in (401, 403)


def test_options_are_ascending_enabled_only_and_carry_only_display_fields(
    client: TestClient, token_headers: dict[str, str], seeded: dict[str, str]
) -> None:
    # 先改一下「乙」：PostgreSQL 的 UPDATE 会把行挪到堆的后面，没有 id 兜底时同 sort 的两项就会反过来 ——
    # 不这么做的话，数据库恰好按插入顺序吐出来，去掉兜底测试也照绿（变异实测过）
    yi = client.get(DATAS, headers=token_headers, params={'type_code': FULL, 'label': '乙'}).json()['data']['items']
    yi = next(i for i in yi if i['label'] == '乙')
    upd = {'type_id': seeded[FULL], 'label': '乙', 'value': '22', 'sort': 2, 'status': 1, 'color': 'primary'}
    assert client.put(f'{DATAS}/{yi["id"]}', headers=token_headers, json=upd).json()['code'] == 200

    data = _options(client, token_headers, FULL).json()['data'][FULL]
    # sort 升序（和字典页分页列表一致）；同 sort 的「乙」「乙二」按 id —— 创建顺序在前的在前
    assert [(o['label'], o['value']) for o in data] == [('甲', '1'), ('乙', '22'), ('乙二', '23'), ('丙', '3')]
    assert 'status' not in data[0] and 'remark' not in data[0] and 'id' not in data[0], '只下发展示要用的字段'
    assert data[3]['color'] == 'green' and data[0]['color'] is None

    # 对照：老接口是降序 —— 新接口存在的理由之一
    old = client.get(f'{DATAS}/type-codes/{FULL}', headers=token_headers).json()['data']
    assert [old[0]['label'], old[-1]['label']] == ['丙', '甲']


def test_missing_empty_and_all_disabled_types_are_an_empty_list_not_404(
    client: TestClient, token_headers: dict[str, str], seeded: dict[str, str]
) -> None:
    resp = _options(client, token_headers, EMPTY, OFF, GHOST)
    assert resp.status_code == 200, resp.text
    assert resp.json()['data'] == {EMPTY: [], OFF: [], GHOST: []}
    # 对照：老接口对这三种都是 404，调用方分不出区别
    for code in (EMPTY, OFF, GHOST):
        assert client.get(f'{DATAS}/type-codes/{code}', headers=token_headers).json()['code'] == 404


def test_multiple_codes_in_one_request_keep_a_key_each_and_dedupe(
    client: TestClient, token_headers: dict[str, str], seeded: dict[str, str]
) -> None:
    data = _options(client, token_headers, FULL, EMPTY, FULL).json()['data']
    assert list(data) == [FULL, EMPTY]
    assert len(data[FULL]) == 4 and data[EMPTY] == []


@pytest.mark.parametrize(
    'codes',
    [[], [f'c{i}' for i in range(21)], ['x' * 33], ['']],
    ids=['零个', '21个', '编码33位', '空串'],
)
def test_bad_code_lists_are_rejected(client: TestClient, token_headers: dict[str, str], codes: list[str]) -> None:
    assert _options(client, token_headers, *codes).status_code == 422


def test_unknown_codes_do_not_write_cache_keys(
    client: TestClient, token_headers: dict[str, str], seeded: dict[str, str]
) -> None:
    """🔴 任何登录用户都能调、编码随便填：查无的不能缓存，否则他能往 Redis 里刷任意多个键"""
    _options(client, token_headers, FULL, EMPTY, OFF, GHOST)
    assert client.portal.call(redis_client.exists, _key(FULL)), '前提：有选项的类型会缓存（不然下面的断言证明不了什么）'
    for code in (EMPTY, OFF, GHOST):
        assert not client.portal.call(redis_client.exists, _key(code)), f'{code} 不该有缓存键'


def test_writes_to_items_and_types_show_up_in_the_next_read(
    client: TestClient, token_headers: dict[str, str], seeded: dict[str, str]
) -> None:
    """缓存键在字典命名空间下，增 / 改 / 删都整个命名空间一起清 —— 先焐热再改，断言读到新值"""
    assert len(_options(client, token_headers, FULL).json()['data'][FULL]) == 4  # 焐热

    # 新增
    body = {'type_id': seeded[FULL], 'label': '丁', 'value': '4', 'sort': 4, 'status': 1}
    assert client.post(DATAS, headers=token_headers, json=body).json()['code'] == 200
    assert [o['label'] for o in _options(client, token_headers, FULL).json()['data'][FULL]] == [
        '甲',
        '乙',
        '乙二',
        '丙',
        '丁',
    ]

    # 停用一项
    jia = client.get(DATAS, headers=token_headers, params={'type_code': FULL, 'label': '甲'}).json()['data']['items'][0]
    upd = {'type_id': seeded[FULL], 'label': '甲', 'value': '1', 'sort': 1, 'status': 0}
    assert client.put(f'{DATAS}/{jia["id"]}', headers=token_headers, json=upd).json()['code'] == 200
    assert [o['label'] for o in _options(client, token_headers, FULL).json()['data'][FULL]] == [
        '乙',
        '乙二',
        '丙',
        '丁',
    ]

    # 删类型：选项跟着没
    assert client.request('DELETE', TYPES, headers=token_headers, json={'pks': [seeded[FULL]]}).json()['code'] == 200
    assert _options(client, token_headers, FULL).json()['data'] == {FULL: []}
