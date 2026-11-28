/**
 * 会话结束时清查询缓存（`session.tsx` 的 `applyAnonymous`）。为什么要清、清了防什么，见那里的注释。
 *
 * 🔴 **跟账号无关的查询要留着**，现在只有一个：检查新版本（`use-app-update.ts`，#461）。
 * 原来是 `qc.clear()` 一刀切：未登录冷启动时 `restoreSession()` 很快 401 → 清缓存，正好落在去 GitHub 读清单
 * （两次跳转）的路上 —— 查询被删、请求被静默取消，而启动提示（挂在 `SessionProvider` 外面）的观察者还挂在那个死掉的
 * 查询上，永远是「加载中」：**登录屏上的新版本提示从来不出现**，也不报错。评审在 query-core 5.101.4 上复现过，
 * 测试见 `tests/session-cache.test.mjs`。
 *
 * 新加跟账号无关、又必须跨登录态活着的查询时，把它的 key 第一段加进下面这个表。
 */
import type { QueryClient } from '@tanstack/react-query'

export const KEEP_ACROSS_SESSIONS: readonly string[] = ['app-update']

export function clearSessionCache(qc: QueryClient) {
  qc.removeQueries({ predicate: (q) => !KEEP_ACROSS_SESSIONS.includes(String(q.queryKey[0])) })
  qc.getMutationCache().clear()
}
