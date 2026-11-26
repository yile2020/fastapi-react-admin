---
name: new-module
description: 从零加一个业务模块（后端表 + 三层接口 + 迁移 + 菜单权限 + 前端列表页 + 测试）。用户说「加一个 xx 管理」「新建模块 / 业务模块 / CRUD 页」「照客户管理那样做一个」时使用。不用于给已有模块加字段或改页面。
---

# 加一个业务模块

这个仓库**刻意没有代码生成器**（`fba codegen` 已删，#180）。新模块照着现有代码手写，而每一层都有几条
「漏了不报错、功能照样能跑，但权限 / 数据范围 / 迁移会静默出错」的规则。这份技能管的就是**别漏**：
代码长什么样看指南和真实文件，这里只列每一步必须做到的事和当步怎么验收。

**完整的可运行代码**在 [`first-module.md`](../../../apps/docs/src/content/docs/guides/first-module.md)
（以「客户管理」为例，每一步都有代码），动手前把它和根 `CLAUDE.md` 的硬纪律 1–6 读一遍。
指南的代码会过期，**以仓库里的真实文件为准**：每一步都写了照哪份抄。

## 一、先问清楚（问不到就用默认值，并在交付时说明）

| 问题 | 默认值 | 影响什么 |
|---|---|---|
| 模块 / 实体叫什么（中文名、英文名、表名） | 表名 `<app>_<实体>`，如 `crm_customer` | 目录、权限码前缀、菜单 name |
| 字段清单（名字、类型、长度、必填） | —— 必须问 | 模型、schema、表单、导入导出 |
| 放 app 还是插件 | **app**（`backend/app/<app>/`） | 插件多一套 `plugin.toml` + 安装卸载，普通业务用不上 |
| 要不要数据权限（按部门 / 仅本人） | 要：表上带 `dept_id` + `created_by` | 没这两列，「本部门」「仅本人」规则会被跳过 = **放行全部** |
| 哪些字段是运营会改的选项 | 级别 / 类别这类走[数据字典](../../../packages/platform/src/pages/_shared/dict.tsx) | 和后端代码里的枚举绑死的（`status` 0/1）**不要**走字典 |
| 菜单挂在哪个目录下、图标 | 新建一个目录 | 种子 SQL 和数据迁移里的父菜单 |

## 二、按顺序做（每步做完先过当步验收再往下）

### 1. 模型 `backend/app/<app>/model/`

照抄：[`app/task/`](../../../apps/api/backend/app/task) 的目录形状 · 指南第 1 步。
- 继承 `Base`，主键 `Mapped[id_key]`（雪花）；存中文的列用 `UniversalStr` / `UniversalText`，**不用 `sa.String`**（SQL Server 要 NVARCHAR）
- 模型必须在 `backend/app/<app>/model/` 下 —— 数据权限按这个路径找模型

### 2. 迁移

```bash
pnpm db:revision '新增 <表名>'   # 生成后必须读一遍再继续
pnpm db:upgrade
```
- 生成的文件里**只能有这一张表**；出现一串 `drop_table` = `alembic/env.py` 的 `import backend.main` 被删了，不要提交
- `id` 列必须有 `autoincrement=False`（手写迁移时自己写），否则 SQL Server 把雪花主键建成 IDENTITY
- 先读 [`alembic` 分册](../../../apps/api/backend/alembic/AGENTS.md)：基线 / 幂等 / 守卫测试都在那里

验收：`pnpm db:current` 在新版本上；`downgrade -1` 后表没了、`upgrade` 后又回来。

### 3–5. schema · crud · service

照抄：指南第 3–5 步 · [`plugin/dict/`](../../../apps/api/backend/plugin/dict) 是一个完整的简单三层。
- 写入参数混入 `ColumnLengthChecked` 并设 `__sa_model__`（[`common/schema.py`](../../../apps/api/backend/common/schema.py)）：否则超长值直达数据库、报一句裸 SQL 错误 500
- 🔴 crud 基类用 **`DataScopedCRUD`**，不用 `CRUDPlus`。数据范围**只管读**：改 / 删之前先用 `get()` / `get_visible_ids()` 收窄，否则用户看不见的行能按 ID 改掉（没有闸门）
- 🔴 更新用 `model_dump(exclude_unset=True)`：不传的字段不能被默认值覆盖（没有闸门）
- 🔴 新建时给 `dept_id` / `created_by` 默认值（当前用户）：`dept_id` 为 NULL 时「本部门」规则匹配不到，除超管外谁都看不见（没有闸门）
- 分页的 `Select` 必须带排序（SQL Server 的 OFFSET 要 ORDER BY），且**不能 join 多对多表**
- 错误消息走 `t('error.<模块>.<slug>')`，键在 `backend/locale/zh-CN.yml` **和** `en-US.yml` 里各加一份（`test_i18n.py` 核对对称）

### 6. 接口并注册路由

照抄：指南第 6 步 · [`app/task/api/`](../../../apps/api/backend/app/task/api)。
- 每个接口（**读接口也一样**）挂 `Depends(RequestPermission('<app>:<实体>:list'))` + `DependsRBAC`，前者写在前面。没声明权限码的路由 `rbac_verify` 直接放行
- 读用 `CurrentSession`，写用 `CurrentSessionTransaction`
- 🔴 **在 [`app/router.py`](../../../apps/api/backend/app/router.py) 里 `include_router` 新 app 的 v1 路由** —— 它是手工逐个挂的，漏了接口全是 404（没有闸门）
- 一段路径的路由（`/import`、`/options`）要声明在 `GET /{pk}` **之前**，否则被当成 pk 报 422

验收：后端起着时 `curl` 列表接口拿到 `{"code":200,…}`；契约 `pnpm --filter @admin/api gen:api`，`git diff packages/api/src/schema.d.ts` 只多出新接口。

### 7. 菜单与权限码 —— 种子 SQL 和数据迁移**两边都加**

照抄：指南第 7 步 · [`utils/data_migration.py`](../../../apps/api/backend/utils/data_migration.py) 的 `add_menu` / `seeded_pk_mode`。

| 库是怎么来的 | 菜单从哪来 |
|---|---|
| 全新环境 `fba init` | 种子 SQL（数据迁移被 stamp 掉，不跑） |
| 已在跑的库 `pnpm db:upgrade` | 数据迁移（种子不重跑） |

- 种子：`backend/sql/{postgresql,mysql,sqlserver}/init_snowflake_test_data.sql` **三份都加**，菜单 ID 三份一致；SQL Server 那份中文前加 `N`
- 种子 SQL 里**不能写 `--` 注释块**（`sql_parser.py` 白名单会判非法，`test_sql_scripts.py` 守着）
- 改完种子：`cd apps/api && pnpm seed:manifest --write`
- 菜单 `path` 必须和前端路由文件的路径一致，否则菜单管理标成死链、侧边栏不显示
- 要随代码交付字典项（第 8 步的选项）时，同样种子 + 数据迁移两边加；只在自己环境试就在页面里建

验收：`app/admin/tests/security/test_permission_codes.py`（后端 `RequestPermission` / 前端 `<Can perm>` / 种子菜单三方对账）· `test_seed_dialects.py` · `test_sql_scripts.py` 全绿。

### 8. 前端列表页

照抄：[`pages/user/`](../../../packages/platform/src/pages/user)（带 QueryBar 的列表）· 指南第 8 步 · [`pages` 分册](../../../packages/platform/src/pages/AGENTS.md)。
文件：`packages/platform/src/pages/<实体>/{api.ts,columns.tsx,form.tsx,index.tsx,table-features.ts}`。
- 页面组件 **router 独立**：`search` / `onSearchChange` 走 props，不调 `Route.useSearch()` / `useNavigate()`（硬纪律 1，`arch:check` 守着）
- 取数状态走 `listState()`，`{...list}` 传给 `DataTable` —— 手写会漏 `error`，失败长成「暂无数据」（硬纪律 9）
- 🔴 雪花 ID 一律字符串，**永远不 `Number()`**；search 里放 ID 用 `z.coerce.string()`（硬纪律 6，没有闸门）
- 运营会改的选项用 `DictTag` / `DictSelect`（[`_shared/dict.tsx`](../../../packages/platform/src/pages/_shared/dict.tsx)），`DictSelect` 的 `onChange` 给字符串，数字字段自己 `Number()`
- 路由文件 `apps/web/src/routes/_auth/<路径>.tsx` 只声明 `validateSearch` / `beforeLoad: requirePerm(...)` / `staticData`，`component: () => null`（硬纪律 3）；起一次 `pnpm --filter web dev` 让它重新生成 `routeTree.gen.ts`
- 在 [`page-registry.tsx`](../../../apps/web/src/lib/page-registry.tsx) 注册，和路由文件成对
- 文案：两个语言包都加，菜单标题加一条 `"menu:<路径>"`；跑 `pnpm i18n:fix`

验收：`pnpm typecheck --force`（不带 force 会打印缓存里的旧结果，硬纪律 12）· `pnpm arch:check` · `pnpm i18n:check` · `pnpm i18n:jsx` · `pnpm lint`。

### 9. 数据权限

不写代码，`DataScopedCRUD` 已经接上了。用一个非超管账号实际登录验一遍（指南第 9 步那张表）：
看不见别的部门的行、按 ID 读 / 改 / 删别部门的行是 404 或不生效。
⚠️ 非超管的写请求还要用户打开「后台登录」（`is_staff`），否则一律 403「已被禁止后台管理操作」。

### 10. 测试 `backend/app/<app>/tests/`

照抄：指南第 10 步 · [`backend/tests` 分册](../../../apps/api/backend/tests/AGENTS.md)。
- 放在 `backend/app/<app>/tests/` 下（带 `__init__.py`）就会被收集：`testpaths` 是通配 `backend/app/*/tests`，不用改 `pyproject.toml`
- 测试建的数据收尾**硬删**（接口的删除是逻辑删除，行会留在共享的 `fba_test` 里），清理写进 fixture 的 teardown，不放测试体最后一行
- 断言「看不见 / 没有」之前先断言「有」—— 否则在功能完全没生效时也是绿的
- 至少覆盖：权限码（无权限账号 403）· 数据范围（别部门的行看不见、改不动）· 超长字段 422

## 三、收尾：全部跑一遍再交付

```bash
pnpm typecheck --force
pnpm lint
pnpm arch:check
pnpm i18n:check
pnpm i18n:jsx
pnpm ctx:check
cd apps/api && uv run --no-sync pytest backend/app/<app>/tests backend/app/admin/tests/security -q
```

交付说明里写清：
1. 第一步里用了哪些默认值（用户没回答的那几个）
2. 哪些**没有闸门的规则**是靠人核对过的：`include_router` · 写操作收窄数据范围 · `exclude_unset` · `dept_id` 默认值 · ID 不 `Number()`
3. 哪些没验证：浏览器里点过没有、非超管账号登录验过没有、三个方言的种子是不是只过了静态检查

**踩到这份技能没写到的坑**：修好之后用 `/ctx` 记进最近的分册，并回来补进这份技能对应的那一步。
