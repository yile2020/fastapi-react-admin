import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import vm from 'node:vm'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import ts from 'typescript'

/**
 * #461 评审第 1 条：会话结束清缓存时，检查新版本那份查询要留着（`src/lib/session-cache.ts`）。
 * 用真的 QueryClient（query-core）：启动提示的观察者挂着、去清单的请求还在路上，这时会话判死、清缓存。
 */
function load() {
  const filename = path.resolve(import.meta.dirname, '../src/lib/session-cache.ts')
  const js = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(js, { exports, require: () => ({}) })
  return exports
}

const { clearSessionCache } = load()
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

function inFlightUpdateCheck() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const observer = new QueryObserver(qc, {
    queryKey: ['app-update', 'https://example.com/latest-android.json'],
    queryFn: () => delay(40).then(() => ({ kind: 'available' })),
  })
  const unsubscribe = observer.subscribe(() => {})
  qc.setQueryData(['users', 'list'], ['A 的用户列表'])
  return { qc, observer, unsubscribe }
}

test('清会话缓存：账号相关的数据清掉，路上的检查更新照样落地', async () => {
  const { qc, observer, unsubscribe } = inFlightUpdateCheck()
  await delay(5)
  clearSessionCache(qc)
  assert.equal(qc.getQueryData(['users', 'list']), undefined)
  await delay(80)
  assert.deepEqual(observer.getCurrentResult().data, { kind: 'available' })
  assert.equal(observer.getCurrentResult().fetchStatus, 'idle')
  unsubscribe()
})

// 对照组：原来的 qc.clear() —— 观察者停在「加载中」，结果永远不来（这就是登录屏上提示不出现的原因）
test('对照：qc.clear() 会让路上的检查更新永远停在加载中', async () => {
  const { qc, observer, unsubscribe } = inFlightUpdateCheck()
  await delay(5)
  qc.clear()
  await delay(80)
  assert.equal(observer.getCurrentResult().data, undefined)
  assert.equal(observer.getCurrentResult().fetchStatus, 'fetching')
  unsubscribe()
})
