import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

/**
 * #461：检查新版本的纯逻辑（`src/lib/app-update.ts`）。写法同 `server-switch.test.mjs`：TS 现场转成 CommonJS 在 vm 里跑。
 * 「启动时弹不弹、设置页那一行显示什么」是 React 那一半，这里不测。
 */
function load(env = {}) {
  const filename = path.resolve(import.meta.dirname, '../src/lib/app-update.ts')
  const js = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(js, { exports, AbortController, setTimeout, clearTimeout, process: { env } })
  return exports
}

const m = load()
const MANIFEST = 'https://github.com/yile2020/fastapi-react-admin/releases/latest/download/latest-android.json'

test('版本比较：数字段按数值比，不按字符串', () => {
  assert.ok(m.compareVersions('1.10.0', '1.9.9') > 0)
  assert.ok(m.compareVersions('2.0.0', '1.99.99') > 0)
  assert.equal(m.compareVersions('v1.2.0', '1.2.0'), 0)
})

test('版本比较：预发布比正式版旧，预发布之间逐段比', () => {
  assert.ok(m.compareVersions('1.3.0-rc.1', '1.3.0') < 0)
  assert.ok(m.compareVersions('1.3.0', '1.3.0-rc.1') > 0)
  assert.ok(m.compareVersions('1.3.0-rc.2', '1.3.0-rc.10') < 0)
  assert.ok(m.compareVersions('1.3.0-alpha', '1.3.0-beta') < 0)
  assert.ok(m.compareVersions('1.3.0-rc', '1.3.0-rc.1') < 0)
})

test('版本比较：认不出的返回 null，不当成一样', () => {
  assert.equal(m.compareVersions('1.2', '1.2.0'), null)
  assert.equal(m.compareVersions('latest', '1.2.0'), null)
})

test('judge：清单更新才算有新版；当前是更新的预发布版时不往回推', () => {
  const latest = { version: '1.3.0', apkUrl: 'x', size: null }
  assert.equal(m.judge('1.2.0', latest).kind, 'available')
  assert.equal(m.judge('1.3.0', latest).kind, 'latest')
  assert.equal(m.judge('1.3.0-rc.1', latest).kind, 'available')
  assert.equal(m.judge('1.4.0-rc.1', latest).kind, 'latest')
  assert.throws(() => m.judge('dev', latest), /认不出当前版本号/)
})

test('APK 地址按清单所在目录解析：清单和 APK 拷到自己服务器上原样能用', () => {
  assert.equal(
    m.resolveApkUrl('admin-mobile-1.3.0.apk', MANIFEST),
    'https://github.com/yile2020/fastapi-react-admin/releases/latest/download/admin-mobile-1.3.0.apk',
  )
  assert.equal(m.resolveApkUrl('./a.apk', 'https://intra.example.com/app/latest-android.json'), 'https://intra.example.com/app/a.apk')
  assert.equal(m.resolveApkUrl('https://cdn.example.com/a.apk', MANIFEST), 'https://cdn.example.com/a.apk')
})

test('清单形状不对就抛，不静默当成「没有新版」', () => {
  assert.throws(() => m.parseManifest(null, MANIFEST), /不是 JSON 对象/)
  assert.throws(() => m.parseManifest({ version: '1.3', apk: 'a.apk' }, MANIFEST), /版本号不对/)
  assert.throws(() => m.parseManifest({ version: '1.3.0' }, MANIFEST), /没有安装包地址/)
  const ok = m.parseManifest({ version: 'v1.3.0', apk: 'a.apk', size: 1024 }, MANIFEST)
  assert.equal(ok.version, '1.3.0')
  assert.equal(ok.size, 1024)
  assert.equal(m.parseManifest({ version: '1.3.0', apk: 'a.apk', size: 'big' }, MANIFEST).size, null)
})

test('读清单：404 是「检查失败」，不是「已是最新」', async () => {
  const fetch404 = async () => ({ ok: false, status: 404, json: async () => ({}) })
  await assert.rejects(m.fetchManifest(fetch404, MANIFEST), /HTTP 404/)
})

test('读清单：挂住不返回时按超时报错', async () => {
  const hang = (_url, init) =>
    new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
  await assert.rejects(m.fetchManifest(hang, MANIFEST, 20), /检查更新超时/)
})

test('读清单：成功时带上解析好的 APK 地址', async () => {
  const ok = async (url) => {
    assert.equal(url, MANIFEST)
    return { ok: true, status: 200, json: async () => ({ version: '1.3.0', apk: 'admin-mobile-1.3.0.apk' }) }
  }
  const r = await m.fetchManifest(ok, MANIFEST)
  assert.equal(r.apkUrl.endsWith('/latest/download/admin-mobile-1.3.0.apk'), true)
})

test('清单地址：EXPO_PUBLIC_UPDATE_MANIFEST_URL 覆盖默认值，空串当没配', () => {
  assert.equal(load().UPDATE_MANIFEST_URL, MANIFEST)
  assert.equal(load({ EXPO_PUBLIC_UPDATE_MANIFEST_URL: '' }).UPDATE_MANIFEST_URL, MANIFEST)
  assert.equal(
    load({ EXPO_PUBLIC_UPDATE_MANIFEST_URL: 'https://intra.example.com/app/latest-android.json' }).UPDATE_MANIFEST_URL,
    'https://intra.example.com/app/latest-android.json',
  )
})
