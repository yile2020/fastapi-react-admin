/**
 * 「项目结构」页开头那张请求流向图（DiagramRequestFlow.astro）的文字，中英文各一份。
 *
 * 放在单独的文件里、页面只写一行 `<DiagramRequestFlow {...requestFlow.zh} />`：
 * `src/lib/markdown.ts` 导出给 AI 读的 `.md` 时只去掉**独占一行**的组件标签，跨多行的 props 会原样漏进去（原来就漏过）。
 */
export const requestFlow = {
  zh: {
    bands: [
      { label: '浏览器 · apps/web + packages/platform + packages/api', hop: 'GET /api/v1/sys/users · Authorization: Bearer <token>', nodes: [
        { name: '路由文件', sub: '声明 URL 参数与守卫，不渲染' },
        { name: '页面注册表', sub: '路由 → 页面组件' },
        { name: '页面的 api.ts', sub: '拼查询串，发请求' },
        { name: '请求客户端', sub: '带令牌 · 判定成败' },
      ] },
      { label: '服务端 · apps/api/backend', hop: 'SQL · 已带上数据范围条件', nodes: [
        { name: 'JWT 中间件', sub: '解出当前用户' },
        { name: '权限依赖', sub: '核对权限码' },
        { name: 'api', sub: '收参数，调 service' },
        { name: 'service', sub: '业务规则 · 分页' },
        { name: 'crud', sub: '自动追加数据范围', hl: true },
      ] },
      { label: '数据库', nodes: [{ name: 'PostgreSQL · SQL Server · MySQL', sub: '三选一，同一套代码' }] },
    ],
    caption: '箭头是请求方向。高亮的那一环：行级数据范围由 crud 的基类自动加进查询，不用在每个方法里手写',
  },
  en: {
    bands: [
      { label: 'Browser · apps/web + packages/platform + packages/api', hop: 'GET /api/v1/sys/users · Authorization: Bearer <token>', nodes: [
        { name: 'Route file', sub: 'declares URL params and the guard; renders nothing' },
        { name: 'Page registry', sub: 'route → page component' },
        { name: "The page's api.ts", sub: 'builds the query string, sends the request' },
        { name: 'Request client', sub: 'attaches the token · decides success or failure' },
      ] },
      { label: 'Server · apps/api/backend', hop: 'SQL · data-scope condition already attached', nodes: [
        { name: 'JWT middleware', sub: 'resolves the current user' },
        { name: 'Permission dependency', sub: 'checks the permission code' },
        { name: 'api', sub: 'reads params, calls the service' },
        { name: 'service', sub: 'business rules · pagination' },
        { name: 'crud', sub: 'adds the data scope automatically', hl: true },
      ] },
      { label: 'Database', nodes: [{ name: 'PostgreSQL · SQL Server · MySQL', sub: 'pick one; same code' }] },
    ],
    caption: 'Arrows show the request direction. The highlighted hop: row-level data scope is added to the query by the crud base class, not written by hand in each method',
  },
}
