/**
 * 项目介绍页「系统架构」图的文字（DiagramArchitecture.astro），中英文各一份。
 *
 * 放在单独的文件、页面里用一行 `<DiagramArchitecture {...architecture.zh} />` 引用，而不是把 props 直接写进 MDX：
 * `src/lib/markdown.ts` 导出给 AI 读的 `.md` 时只去掉**独占一行**的组件标签，跨多行的 props 会原样漏进去。
 *
 * 每个模块都对得上仓库里的真实目录（2026-11-26 核对）：客户端 = apps/web · desktop · mobile + packages/*；
 * 接入层 = apps/web/nginx.conf（/api、/ws、/uploads）、Vite 开发服务器、/api/open/v1；
 * 应用层 = backend/app/admin/api/v1/{auth,sys,log,monitor} + backend/app/task，插件 = backend/plugin/*（plugin.toml 的 summary）；
 * 基础设施 / 公共层 = backend/common/*；数据层 = 三种数据库 + Redis（缓存 · 会话 · 默认的 Celery broker）+ OpenDAL 对象存储。
 * 加了 / 删了模块或插件时一起改这里。
 */
const URL = 'github.com/yile2020/fastapi-react-admin'

export const architecture = {
  zh: {
    label: 'fastapi-react-admin 系统架构分层图',
    brand: 'fastapi-react-admin',
    title: '系统架构',
    legend: { core: '核心模块', plugin: '可插拔插件', flow: '请求方向' },
    caption: '一个 monorepo：四层自上而下，前后端契约由后端生成，依赖方向由 CI 把关。',
    url: URL,
    layers: [
      {
        index: '01', label: '客户端', sub: 'apps/*', flow: 'HTTPS · WebSocket',
        cards: [
          { code: 'web', title: 'Web 后台', icon: 'monitor', tags: ['工作台', '多页签', 'React 19'] },
          { code: 'desktop', title: '桌面端', icon: 'laptop', tags: ['静默打印', '本地硬件', '自动更新'] },
          { code: 'mobile', title: '手机端', icon: 'phone', tags: ['审批', '通知', 'Expo'] },
          { code: 'packages', title: '共享包', icon: 'package', tags: ['api 契约', 'ui', 'platform', 'i18n'] },
        ],
      },
      {
        index: '02', label: '接入层', sub: 'Nginx · Vite', flow: 'ASGI · FastAPI',
        cards: [
          { code: 'Nginx', title: '生产环境', icon: 'server', tags: ['静态资源', '/api 反代', '/ws 推送'] },
          { code: 'Vite', title: '开发环境', icon: 'zap', tags: ['热更新', '端口 8888'] },
          { code: '/api/open/v1', title: '开放接口', icon: 'key', tags: ['AK/SK 签名', 'Webhook'] },
        ],
      },
      {
        index: '03', label: '应用层', sub: 'apps/api', flow: 'SQL · Redis · S3', feature: true,
        cards: [
          { code: 'sys', title: '系统管理', icon: 'settings', core: true, tags: ['用户 · 部门', '角色 · 菜单', '数据权限', '文件', '导入导出'] },
          { code: 'auth', title: '认证', icon: 'lock', core: true, tags: ['登录', 'JWT 与会话', '二次验证'] },
          { code: 'log', title: '日志审计', icon: 'file', core: true, tags: ['操作日志', '登录日志', '数据变更'] },
          { code: 'task', title: '定时任务', icon: 'clock', core: true, tags: ['Celery', 'beat 调度', '执行记录'] },
          { code: 'monitor', title: '系统监控', icon: 'activity', core: true, tags: ['在线用户', '服务器', 'Redis'] },
        ],
        plugins: {
          label: '插件 · 按需装卸',
          items: [
            { code: 'workflow', title: '审批流' },
            { code: 'ai', title: 'AI 助手' },
            { code: 'open', title: '能力开放' },
            { code: 'notification', title: '消息通知' },
            { code: 'notice', title: '通知公告' },
            { code: 'oauth2', title: '第三方登录' },
            { code: 'sms', title: '短信' },
            { code: 'email', title: '邮件' },
            { code: 'config', title: '参数配置' },
            { code: 'dict', title: '数据字典' },
          ],
        },
        bars: [
          { label: '基础设施', tags: ['RBAC 鉴权', '数据范围', '变更审计', '缓存', '限流', 'Socket.IO', 'OpenTelemetry'] },
          { label: '公共层', tags: ['统一响应', '异常处理', '分页', '国际化', '雪花 ID'] },
        ],
      },
      {
        index: '04', label: '数据层', sub: '不对浏览器开放',
        cards: [
          { code: 'SQL', title: '数据库', icon: 'database', tags: ['PostgreSQL', 'SQL Server', 'MySQL'] },
          { code: 'Redis', title: '缓存与队列', icon: 'layers', tags: ['缓存', '会话与令牌', 'Celery 队列'] },
          { code: 'OpenDAL', title: '文件存储', icon: 'drive', tags: ['本地磁盘', 'S3 兼容'] },
        ],
      },
    ],
  },
  en: {
    label: 'fastapi-react-admin layered system architecture',
    brand: 'fastapi-react-admin',
    title: 'System architecture',
    legend: { core: 'Core module', plugin: 'Pluggable plugin', flow: 'Request flow' },
    caption: 'One monorepo, four layers top to bottom; the frontend/backend contract is generated from the backend, and CI holds the dependency direction.',
    url: URL,
    layers: [
      {
        index: '01', label: 'Clients', sub: 'apps/*', flow: 'HTTPS · WebSocket',
        cards: [
          { code: 'web', title: 'Web console', icon: 'monitor', tags: ['Workspace', 'Multi-tab', 'React 19'] },
          { code: 'desktop', title: 'Desktop', icon: 'laptop', tags: ['Silent print', 'Local hardware', 'Auto-update'] },
          { code: 'mobile', title: 'Mobile', icon: 'phone', tags: ['Approvals', 'Notifications', 'Expo'] },
          { code: 'packages', title: 'Shared', icon: 'package', tags: ['api contract', 'ui', 'platform', 'i18n'] },
        ],
      },
      {
        index: '02', label: 'Gateway', sub: 'Nginx · Vite', flow: 'ASGI · FastAPI',
        cards: [
          { code: 'Nginx', title: 'Production', icon: 'server', tags: ['Static assets', '/api proxy', '/ws push'] },
          { code: 'Vite', title: 'Development', icon: 'zap', tags: ['Hot reload', 'Port 8888'] },
          { code: '/api/open/v1', title: 'Open API', icon: 'key', tags: ['AK/SK signing', 'Webhooks'] },
        ],
      },
      {
        index: '03', label: 'Application', sub: 'apps/api', flow: 'SQL · Redis · S3', feature: true,
        cards: [
          { code: 'sys', title: 'System admin', icon: 'settings', core: true, tags: ['Users · depts', 'Roles · menus', 'Data scopes', 'Files', 'Import/export'] },
          { code: 'auth', title: 'Auth', icon: 'lock', core: true, tags: ['Sign-in', 'JWT and sessions', 'Two-factor'] },
          { code: 'log', title: 'Logs and audit', icon: 'file', core: true, tags: ['Operations', 'Sign-ins', 'Data changes'] },
          { code: 'task', title: 'Scheduler', icon: 'clock', core: true, tags: ['Celery', 'beat', 'Run history'] },
          { code: 'monitor', title: 'Monitoring', icon: 'activity', core: true, tags: ['Online users', 'Server', 'Redis'] },
        ],
        plugins: {
          label: 'Plugins · install as needed',
          items: [
            { code: 'workflow', title: 'Approvals' },
            { code: 'ai', title: 'AI assistant' },
            { code: 'open', title: 'Open API' },
            { code: 'notification', title: 'Notifications' },
            { code: 'notice', title: 'Notices' },
            { code: 'oauth2', title: 'Third-party login' },
            { code: 'sms', title: 'SMS' },
            { code: 'email', title: 'Email' },
            { code: 'config', title: 'Config' },
            { code: 'dict', title: 'Dictionary' },
          ],
        },
        bars: [
          { label: 'Infrastructure', tags: ['RBAC', 'Data scopes', 'Change audit', 'Cache', 'Rate limits', 'Socket.IO', 'OpenTelemetry'] },
          { label: 'Common', tags: ['Unified response', 'Errors', 'Pagination', 'i18n', 'Snowflake IDs'] },
        ],
      },
      {
        index: '04', label: 'Data', sub: 'Not exposed to browsers',
        cards: [
          { code: 'SQL', title: 'Database', icon: 'database', tags: ['PostgreSQL', 'SQL Server', 'MySQL'] },
          { code: 'Redis', title: 'Cache and queue', icon: 'layers', tags: ['Cache', 'Sessions and tokens', 'Celery queue'] },
          { code: 'OpenDAL', title: 'File storage', icon: 'drive', tags: ['Local disk', 'S3-compatible'] },
        ],
      },
    ],
  },
} as const
