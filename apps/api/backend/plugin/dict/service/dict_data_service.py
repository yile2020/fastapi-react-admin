from collections.abc import Sequence
from typing import Any

from msgspec import json as msgjson
from sqlalchemy.ext.asyncio import AsyncSession

from backend.common.cache.decorator import cache_invalidate, cached
from backend.common.cache.local import local_cache_manager
from backend.common.exception import errors
from backend.common.i18n import t
from backend.common.log import log
from backend.common.pagination import paging_data
from backend.core.conf import settings
from backend.database.redis import redis_client
from backend.plugin.dict.crud.crud_dict_data import dict_data_dao
from backend.plugin.dict.crud.crud_dict_type import dict_type_dao
from backend.plugin.dict.model import DictData, DictType
from backend.plugin.dict.schema.dict_data import CreateDictDataParam, DeleteDictDataParam, UpdateDictDataParam


class DictDataService:
    """字典数据服务类"""

    @staticmethod
    @cached(namespace=settings.CACHE_DICT_REDIS_PREFIX, key='pk')
    async def get(*, db: AsyncSession, pk: int) -> DictData:
        """
        获取字典数据详情

        :param db: 数据库会话
        :param pk: 字典数据 ID
        :return:
        """
        dict_data = await dict_data_dao.get(db, pk)
        if not dict_data:
            raise errors.NotFoundError(msg=t('error.dict.data_not_found'))
        return dict_data

    @staticmethod
    @cached(
        namespace=settings.CACHE_DICT_REDIS_PREFIX,
        key_builder=lambda *, db, code: f'type:{code}',
    )
    async def get_by_type_code(*, db: AsyncSession, code: str) -> Sequence[DictData]:
        """
        获取字典数据详情

        :param db: 数据库会话
        :param code: 字典类型编码
        :return:
        """
        dict_datas = await dict_data_dao.get_by_type_code(db, code)
        if not dict_datas:
            raise errors.NotFoundError(msg=t('error.dict.data_not_found'))
        return dict_datas

    @staticmethod
    async def get_options(*, db: AsyncSession, codes: Sequence[str]) -> dict[str, list[dict[str, str | None]]]:
        """
        批量取字典选项（`GET /dict-datas/options`）：每个请求的编码都有一个键，没有选项的是 `[]`

        和 `get_by_type_code` 的区别：后者对空 / 不存在 / 全停用一律抛 404，调用方分不出是哪一种，
        而「这个字典还没有选项」对一个下拉来说是正常状态（显示「暂无选项」），不是错误

        缓存（键 `<CACHE_DICT_REDIS_PREFIX>:options:<编码>`，和 `@cached` 同一套 L1 + Redis、同样的序列化）：
        本地缓存 → Redis `MGET` → **剩下没命中的编码合成一条 `IN` 查询**。不套 `@cached` 逐个调，是因为那样冷缓存时
        20 个编码就是 20 次串行查询，而查无的编码（下面那条）每次请求都要重查 —— 任何登录用户反复请求 20 个乱写的编码，
        每次都是 20 条 SQL；合成一条之后最多一条。

        🔴 **查无（类型不存在 / 没有启用的项）的编码不写缓存。** 这个接口任何登录用户都能调、编码随便填，
        缓存空列表就等于让他往 Redis 里刷任意多个 `options:<随便写>` 键（每个活两小时）。
        键在 `CACHE_DICT_REDIS_PREFIX` 命名空间下，字典数据 / 类型的增删改和导入
        整个命名空间一起清（含提交之后那次），不用另接失效

        :param db: 数据库会话
        :param codes: 字典类型编码
        :return:
        """
        wanted = list(dict.fromkeys(codes))  # 去重、保序
        keys = {code: f'{settings.CACHE_DICT_REDIS_PREFIX}:options:{code}' for code in wanted}
        found = await DictDataService._read_cached_options(keys)
        missing = [code for code in wanted if code not in found]
        if missing:
            found.update(await DictDataService._load_and_cache_options(db, missing, keys))
        return {code: found.get(code, []) for code in wanted}

    @staticmethod
    async def _read_cached_options(keys: dict[str, str]) -> dict[str, list[dict[str, str | None]]]:
        """先本地缓存，剩下的一次 Redis `MGET`；Redis 出错按未命中处理（同 `@cached`）"""
        found: dict[str, list[dict[str, str | None]]] = {}
        if settings.CACHE_LOCAL_ENABLED:
            for code, key in keys.items():
                value = local_cache_manager.get(key)
                if value is not None:
                    found[code] = value
        rest = [code for code in keys if code not in found]
        if not rest:
            return found
        try:
            raw = await redis_client.mget([keys[code] for code in rest])
        except Exception as e:
            log.warning(f'[Cache] MGET error: {e}')
            return found
        for code, value in zip(rest, raw, strict=True):
            if value is None:
                continue
            found[code] = msgjson.decode(value)
            if settings.CACHE_LOCAL_ENABLED:
                local_cache_manager.set(keys[code], found[code])
        return found

    @staticmethod
    async def _load_and_cache_options(
        db: AsyncSession, missing: list[str], keys: dict[str, str]
    ) -> dict[str, list[dict[str, str | None]]]:
        """没命中的编码合成**一条** `IN` 查询；只回填真有选项的编码（查无的不写缓存，见 `get_options`）"""
        grouped: dict[str, list[dict[str, str | None]]] = {}
        for row in await dict_data_dao.get_options_by_type_codes(db, missing):
            grouped.setdefault(row.type_code, []).append({'label': row.label, 'value': row.value, 'color': row.color})
        for code, items in grouped.items():
            try:
                encoded = msgjson.encode(items)
                if settings.CACHE_REDIS_TTL:
                    await redis_client.set(keys[code], encoded, ex=settings.CACHE_REDIS_TTL)
                else:
                    await redis_client.set(keys[code], encoded)
                if settings.CACHE_LOCAL_ENABLED:
                    local_cache_manager.set(keys[code], items)
            except Exception as e:
                log.warning(f'[Cache] SET error: {e}')
        return grouped

    @staticmethod
    async def get_all(*, db: AsyncSession) -> Sequence[DictData]:
        """
        获取所有字典数据

        :param db: 数据库会话
        :return:
        """
        dict_datas = await dict_data_dao.get_all(db)
        return dict_datas

    @staticmethod
    async def get_list(
        *,
        db: AsyncSession,
        type_code: str | None,
        label: str | None,
        value: str | None,
        status: int | None,
        type_id: int | None,
    ) -> dict[str, Any]:
        """
        获取字典数据列表

        :param db: 数据库会话
        :param type_code: 字典类型编码
        :param label: 字典数据标签
        :param value: 字典数据键值
        :param status: 状态
        :param type_id: 字典类型 ID
        :return:
        """
        dict_data_select = await dict_data_dao.get_select(
            type_code=type_code,
            label=label,
            value=value,
            status=status,
            type_id=type_id,
        )
        return await paging_data(db, dict_data_select)

    @staticmethod
    async def check_create(*, db: AsyncSession, obj: CreateDictDataParam) -> DictType:
        """
        创建前的业务校验（只读）。`create` 和字典数据导入共用这一份

        :param db: 数据库会话
        :param obj: 字典数据创建参数
        :return: 所属的字典类型
        """
        dict_type = await dict_type_dao.get(db, obj.type_id)
        if not dict_type:
            raise errors.NotFoundError(msg=t('error.dict.type_not_found'))
        if await dict_data_dao.get_by_label_and_type_code(db, obj.label, dict_type.code):
            raise errors.ConflictError(msg=t('error.dict.data_exists'))
        return dict_type

    @staticmethod
    async def check_update(*, db: AsyncSession, pk: int, obj: UpdateDictDataParam) -> DictType:
        """
        更新前的业务校验（只读）。`update` 和字典数据导入共用这一份

        :param db: 数据库会话
        :param pk: 字典数据 ID
        :param obj: 字典数据更新参数
        :return: 改完之后所属的字典类型
        """
        dict_data = await dict_data_dao.get(db, pk)
        if not dict_data:
            raise errors.NotFoundError(msg=t('error.dict.data_not_found'))
        dict_type = await dict_type_dao.get(db, obj.type_id)
        if not dict_type:
            raise errors.NotFoundError(msg=t('error.dict.type_not_found'))
        if dict_data.label != obj.label or dict_data.type_code != dict_type.code:
            new_dict_data = await dict_data_dao.get_by_label_and_type_code(db, obj.label, dict_type.code)
            if new_dict_data and new_dict_data.id != pk:
                raise errors.ConflictError(msg=t('error.dict.data_exists'))
        return dict_type

    @staticmethod
    @cache_invalidate(namespace=settings.CACHE_DICT_REDIS_PREFIX)
    async def create(*, db: AsyncSession, obj: CreateDictDataParam) -> None:
        """
        创建字典数据

        :param db: 数据库会话
        :param obj: 字典数据创建参数
        :return:
        """
        dict_type = await DictDataService.check_create(db=db, obj=obj)
        await dict_data_dao.create(db, obj, dict_type.code)

    @staticmethod
    @cache_invalidate(namespace=settings.CACHE_DICT_REDIS_PREFIX)
    async def update(*, db: AsyncSession, pk: int, obj: UpdateDictDataParam) -> int:
        """
        更新字典数据

        :param db: 数据库会话
        :param pk: 字典数据 ID
        :param obj: 字典数据更新参数
        :return:
        """
        dict_type = await DictDataService.check_update(db=db, pk=pk, obj=obj)
        count = await dict_data_dao.update(db, pk, obj, dict_type.code)
        return count

    @staticmethod
    @cache_invalidate(namespace=settings.CACHE_DICT_REDIS_PREFIX)
    async def delete(*, db: AsyncSession, obj: DeleteDictDataParam) -> int:
        """
        批量删除字典数据

        :param db: 数据库会话
        :param obj: 字典数据 ID 列表
        :return:
        """
        count = await dict_data_dao.delete(db, obj.pks)
        return count


dict_data_service: DictDataService = DictDataService()
