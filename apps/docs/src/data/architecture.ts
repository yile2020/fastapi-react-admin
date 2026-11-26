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
export const architecture = {
  zh: {
    label: '系统架构分层图',
    caption: '自上而下是请求方向；紫色框是核心模块，虚线框里是可插拔的插件。',
    rows: [
      {
        label: '客户端', sub: 'apps/*',
        cards: [
          { title: 'Web 后台', code: 'web', tags: ['工作台', '多页签', 'React 19'] },
          { title: '桌面端', code: 'desktop', tags: ['静默打印', '本地硬件', '自动更新'] },
          { title: '手机端', code: 'mobile', tags: ['审批', '通知', 'Expo'] },
          { title: '共享包', code: 'packages', tags: ['api 契约', 'ui 组件', 'platform', 'i18n'] },
        ],
      },
      {
        label: '接入层', sub: 'HTTP · WebSocket',
        cards: [
          { title: '生产环境', code: 'Nginx', tags: ['静态资源', '/api 反代', '/ws 推送'] },
          { title: '开发环境', code: 'Vite', tags: ['热更新', ':8888'] },
          { title: '开放接口', code: '/api/open/v1', tags: ['AK/SK 签名', 'Webhook'] },
        ],
      },
      {
        label: '应用层', sub: 'apps/api · FastAPI', columns: 2,
        cards: [
          { title: '系统管理', code: 'sys', core: true, tags: ['用户与部门', '角色与菜单', '数据权限', '文件与存储', '导入导出'] },
          { title: '认证', code: 'auth', core: true, tags: ['登录与验证码', 'JWT 与会话', '二次验证'] },
          { title: '日志审计', code: 'log', core: true, tags: ['操作日志', '登录日志', '数据变更'] },
          { title: '定时任务', code: 'task', core: true, tags: ['Celery worker', 'beat 调度', '执行记录'] },
          { title: '系统监控', code: 'monitor', core: true, tags: ['在线用户', '服务器', 'Redis'] },
        ],
        bars: [
          { label: '基础设施', tags: ['RBAC 鉴权', '数据范围', '变更审计', '缓存', '限流', 'Socket.IO', 'OpenTelemetry'] },
          { label: '公共层', tags: ['统一响应', '异常处理', '分页', '国际化', '雪花 ID'] },
        ],
        plugins: {
          label: '插件',
          cards: [
            { title: '审批流', code: 'workflow', tags: [] },
            { title: 'AI 助手', code: 'ai', tags: [] },
            { title: '能力开放', code: 'open', tags: [] },
            { title: '消息通知', code: 'notification', tags: [] },
            { title: '通知公告', code: 'notice', tags: [] },
            { title: '第三方登录', code: 'oauth2', tags: [] },
            { title: '短信 · 邮件', code: 'sms · email', tags: [] },
            { title: '参数 · 字典', code: 'config · dict', tags: [] },
          ],
        },
      },
      {
        label: '数据层', sub: '不对浏览器开放',
        cards: [
          { title: '数据库', code: 'SQL', tags: ['PostgreSQL', 'SQL Server', 'MySQL'] },
          { title: '缓存与队列', code: 'Redis', tags: ['缓存', '会话与令牌', 'Celery 队列'] },
          { title: '文件存储', code: 'OpenDAL', tags: ['本地磁盘', 'S3 兼容'] },
        ],
      },
    ],
  },
  en: {
    label: 'Layered system architecture',
    caption: 'Requests flow top to bottom. Purple boxes are core modules; the dashed box holds pluggable plugins.',
    rows: [
      {
        label: 'Clients', sub: 'apps/*',
        cards: [
          { title: 'Web console', code: 'web', tags: ['Workspace', 'Multi-tab', 'React 19'] },
          { title: 'Desktop', code: 'desktop', tags: ['Silent print', 'Local hardware', 'Auto-update'] },
          { title: 'Mobile', code: 'mobile', tags: ['Approvals', 'Notifications', 'Expo'] },
          { title: 'Shared', code: 'packages', tags: ['api contract', 'ui', 'platform', 'i18n'] },
        ],
      },
      {
        label: 'Gateway', sub: 'HTTP · WebSocket',
        cards: [
          { title: 'Production', code: 'Nginx', tags: ['Static assets', '/api proxy', '/ws push'] },
          { title: 'Development', code: 'Vite', tags: ['Hot reload', ':8888'] },
          { title: 'Open API', code: '/api/open/v1', tags: ['AK/SK signing', 'Webhooks'] },
        ],
      },
      {
        label: 'Application', sub: 'apps/api · FastAPI', columns: 2,
        cards: [
          { title: 'System admin', code: 'sys', core: true, tags: ['Users and depts', 'Roles and menus', 'Data scopes', 'Files', 'Import/export'] },
          { title: 'Auth', code: 'auth', core: true, tags: ['Sign-in and captcha', 'JWT and sessions', 'Two-factor'] },
          { title: 'Logs and audit', code: 'log', core: true, tags: ['Operation log', 'Sign-in log', 'Data changes'] },
          { title: 'Scheduler', code: 'task', core: true, tags: ['Celery worker', 'beat', 'Run history'] },
          { title: 'Monitoring', code: 'monitor', core: true, tags: ['Online users', 'Server', 'Redis'] },
        ],
        bars: [
          { label: 'Infrastructure', tags: ['RBAC', 'Data scopes', 'Change audit', 'Cache', 'Rate limits', 'Socket.IO', 'OpenTelemetry'] },
          { label: 'Common', tags: ['Unified response', 'Errors', 'Pagination', 'i18n', 'Snowflake IDs'] },
        ],
        plugins: {
          label: 'Plugins',
          cards: [
            { title: 'Approvals', code: 'workflow', tags: [] },
            { title: 'AI assistant', code: 'ai', tags: [] },
            { title: 'Open API', code: 'open', tags: [] },
            { title: 'Notifications', code: 'notification', tags: [] },
            { title: 'Notices', code: 'notice', tags: [] },
            { title: 'Third-party login', code: 'oauth2', tags: [] },
            { title: 'SMS · email', code: 'sms · email', tags: [] },
            { title: 'Config · dictionary', code: 'config · dict', tags: [] },
          ],
        },
      },
      {
        label: 'Data', sub: 'Not exposed to browsers',
        cards: [
          { title: 'Database', code: 'SQL', tags: ['PostgreSQL', 'SQL Server', 'MySQL'] },
          { title: 'Cache and queue', code: 'Redis', tags: ['Cache', 'Sessions and tokens', 'Celery queue'] },
          { title: 'File storage', code: 'OpenDAL', tags: ['Local disk', 'S3-compatible'] },
        ],
      },
    ],
  },
}
