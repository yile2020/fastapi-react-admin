/**
 * 测试里用 Vite 的 `?raw` 读仓库里的 SQL 种子（`pages/_shared/dict-color.test.ts`：种子里的字典色名前端是否都认）。
 * tsc 解析不到这种 import；真正处理它的是 Vite（vitest 也走 Vite）。
 * 只声明 `*.sql?raw` 这一种：apps/web 带着 vite/client（声明了通配的 `*?raw`），两个模式名不同、互不冲突。
 */
declare module '*.sql?raw' {
  const content: string
  export default content
}
