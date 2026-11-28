import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@admin/ui/globals.css"

import { App } from "@/app"
// 副作用导入：i18next 必须在任何组件渲染前 init 完，
// 否则首帧的 useTranslation() 拿不到语言包
import "@/i18n"
import { api, endSession } from "@admin/platform/api-client/client"
import { tokenStore } from "@admin/platform/api-client/token-store"
import { usePreferences } from "@admin/platform/shell/preferences"
import { applyPreferencesNow } from "@admin/platform/shell/use-apply-preferences"

// 渲染前先把偏好贴到 <html>，否则深色/换过主题色的用户会先吃一帧默认样式。
// zustand 的 persist 走 localStorage，是同步 rehydrate 的，所以这里读得到已存的值。
applyPreferencesNow(usePreferences.getState())

// E2E 钩子：把应用**正在用的那一份** api 客户端和 token 仓库交给用例
// （`presence-reconnect.spec.ts` 要把内存里的 token 改坏、要触发真的会话清理，`refresh-identity.spec.ts` 要用真客户端发一次写请求）。
// 用例原来是按开发服务器的模块地址 `import()` 进来的，CI 改跑构建产物之后模块被打进了包里，那条路走不通。
//
// 🔴 只有构建 / 起服务时显式设了 `VITE_E2E_HOOKS=1` 才有（`e2e/playwright.config.ts` 设的）。
// 这是构建期的静态替换，生产构建里这个分支整个被删掉 —— access token 只放在页面内存里是有意的，
// 不能在生产包里给 `window` 留一个拿得到它的口子。
if (import.meta.env.VITE_E2E_HOOKS === "1") {
  Object.assign(window, { __e2e: { api, endSession, tokenStore } })
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
