/**
 * 检查新版本（#461）—— 纯逻辑：清单地址、读清单、比版本。React / RN 那一半在 `use-app-update.ts`。
 *
 * 清单是发版时和 APK 一起传进 GitHub Release 的 `latest-android.json`（`.github/workflows/release.yml`）：
 *
 *     { "version": "1.3.0", "apk": "admin-mobile-1.3.0.apk", "size": 31457280, "sha256": "…" }
 *
 * - 默认读 `releases/latest/download/latest-android.json`：GitHub 把它跳到最新的**正式** Release
 *   （草稿和预发布不算），不走 API，没有每小时 60 次的限额
 * - `EXPO_PUBLIC_UPDATE_MANIFEST_URL` 换成自己服务器上的同名文件（国内连 GitHub 不稳、内网部署）。
 *   🔴 `apk` 按**清单所在目录**解析相对路径，所以把清单和 APK 两个文件原样拷到自己服务器上就能用，不用改清单
 *
 * 这个文件不 import 任何东西：`tests/app-update.test.mjs` 在 Node 里直接转译它跑。
 */

const DEFAULT_MANIFEST_URL =
  'https://github.com/yile2020/fastapi-react-admin/releases/latest/download/latest-android.json'

/** 构建期替换的字符串；空串当没配 */
export const UPDATE_MANIFEST_URL = process.env.EXPO_PUBLIC_UPDATE_MANIFEST_URL || DEFAULT_MANIFEST_URL

export interface UpdateManifest {
  /** 不带 v 的版本号，如 `1.3.0` */
  version: string
  /** APK 的绝对地址（已按清单地址解析过） */
  apkUrl: string
  /** 字节数；清单里没有就是 null */
  size: number | null
}

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/**
 * 比两个版本号：a 比 b 新返回正数，旧返回负数，一样返回 0。认不出的返回 null（调用方当「不知道」处理，
 * 不能当「一样」—— 那会把清单写坏的情况显示成「已是最新版本」）。
 *
 * 预发布按 semver：`1.3.0-rc.1` < `1.3.0`；两个预发布之间逐段比，数字段按数值、其余按字符串。
 */
export function compareVersions(a: string, b: string): number | null {
  const ma = SEMVER.exec(a.trim())
  const mb = SEMVER.exec(b.trim())
  if (!ma || !mb) return null
  for (let i = 1; i <= 3; i++) {
    const d = Number(ma[i]) - Number(mb[i])
    if (d !== 0) return d
  }
  const pa = ma[4]
  const pb = mb[4]
  if (pa === pb) return 0
  if (pa === undefined) return 1
  if (pb === undefined) return -1
  const sa = pa.split('.')
  const sb = pb.split('.')
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    if (sa[i] === undefined) return -1
    if (sb[i] === undefined) return 1
    const na = /^\d+$/.test(sa[i]) ? Number(sa[i]) : null
    const nb = /^\d+$/.test(sb[i]) ? Number(sb[i]) : null
    if (na !== null && nb !== null) {
      if (na !== nb) return na - nb
    } else if (na !== null) {
      return -1
    } else if (nb !== null) {
      return 1
    } else if (sa[i] !== sb[i]) {
      return sa[i] < sb[i] ? -1 : 1
    }
  }
  return 0
}

/**
 * 相对地址按清单所在目录解析。刻意不用 `new URL(rel, base)`：RN 的 URL 实现历史上缺方法
 * （`lib/server-url.ts` 同样没用它），这里只需要「绝对的原样用，否则拼到最后一个 / 后面」。
 */
export function resolveApkUrl(apk: string, manifestUrl: string): string {
  if (/^https?:\/\//i.test(apk)) return apk
  const dir = manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1)
  return dir + apk.replace(/^\.?\//, '')
}

/** 清单的形状不对就抛 —— 一份写坏的清单要报成「检查失败」，不能静默当成「没有新版」 */
export function parseManifest(raw: unknown, manifestUrl: string): UpdateManifest {
  if (!raw || typeof raw !== 'object') throw new Error('更新清单不是 JSON 对象')
  const m = raw as Record<string, unknown>
  if (typeof m.version !== 'string' || !SEMVER.test(m.version.trim())) throw new Error('更新清单里的版本号不对')
  if (typeof m.apk !== 'string' || !m.apk.trim()) throw new Error('更新清单里没有安装包地址')
  return {
    version: m.version.trim().replace(/^v/, ''),
    apkUrl: resolveApkUrl(m.apk.trim(), manifestUrl),
    size: typeof m.size === 'number' && m.size > 0 ? m.size : null,
  }
}

/**
 * 开发包 / 试跑包：版本号带 `-dev`（仓库里 `app.json` 的占位是 `0.0.0-dev`，Run workflow 试跑默认也是它）。
 * 这种包启动时不自动检查：它们是调试证书签的，提示去下的正式包装不上去（签名不一致，系统只说「应用未安装」）；
 * 手机端 E2E 打的也是这种包，启动弹窗会挡住 Maestro 的点击。设置页的手动检查照常能用。
 */
export function isDevVersion(version: string): boolean {
  return /-dev(?:[.-]|$)/.test(version.trim())
}

export type UpdateCheck =
  | { kind: 'latest'; latest: UpdateManifest }
  | { kind: 'available'; latest: UpdateManifest }

/** 现在装着的版本 vs 清单：只有清单**更新**才算有新版（当前是更新的预发布版时不往回推） */
export function judge(current: string, latest: UpdateManifest): UpdateCheck {
  const d = compareVersions(latest.version, current)
  if (d === null) throw new Error(`认不出当前版本号：${current}`)
  return d > 0 ? { kind: 'available', latest } : { kind: 'latest', latest }
}

/**
 * 读清单。`fetchImpl` 由调用方给（App 里是全局 fetch，测试里是桩）。
 * 10 秒超时：连 GitHub 不通时常常是挂住而不是立刻失败，没有超时的话设置页一直转圈。
 */
export async function fetchManifest(
  fetchImpl: (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<{
    ok: boolean
    status: number
    json: () => Promise<unknown>
  }>,
  manifestUrl: string = UPDATE_MANIFEST_URL,
  timeoutMs = 10_000,
): Promise<UpdateManifest> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(manifestUrl, { signal: ctrl.signal, headers: { 'Cache-Control': 'no-cache' } })
    // 404 = 还没发过带 APK 的正式版（或者自己服务器上没放清单），照样是「检查失败」，不是「已是最新」
    if (!res.ok) throw new Error(`更新清单返回 HTTP ${res.status}`)
    return parseManifest(await res.json(), manifestUrl)
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error('检查更新超时', { cause: e })
    throw e
  } finally {
    clearTimeout(timer)
  }
}
