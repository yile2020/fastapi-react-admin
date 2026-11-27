#!/usr/bin/env node
/**
 * release.yml 的安卓 job 用（#460）。两件事：
 *
 *   node scripts/mobile-version.mjs <版本> <app.json>                 把 tag 版本写进 app.json（version + android.versionCode）
 *   node scripts/mobile-version.mjs --manifest <版本> <apk 路径>       打印更新清单 latest-android.json
 *
 * 清单的形状由 App 那一侧读（apps/mobile/src/lib/app-update.ts 的 parseManifest）：
 * `apk` 写**文件名**，App 按清单所在目录解析 —— 清单和 APK 拷到自己服务器上原样能用。
 */
import { createHash } from "node:crypto"
import { readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/

/**
 * Android 的 versionCode 必须一路递增（小于已装的那个，系统直接拒绝覆盖安装，只说「应用未安装」）。
 * major·1000000 + minor·1000 + patch：minor / patch 各留到 999；上限 2100000000 → major 最大 2099。
 * 预发布和同号正式版是同一个 code（同号允许覆盖安装）。
 */
export function versionCode(version) {
  const m = SEMVER.exec(version)
  if (!m) throw new Error(`版本号格式不对：${version}`)
  const [major, minor, patch] = m.slice(1, 4).map(Number)
  if (minor > 999 || patch > 999) throw new Error(`minor / patch 超过 999，versionCode 会和下一段撞上：${version}`)
  const code = major * 1_000_000 + minor * 1_000 + patch
  if (code < 1 || code > 2_100_000_000) throw new Error(`versionCode 超出 Android 允许的范围：${code}`)
  return code
}

export function writeAppJson(version, file) {
  const json = JSON.parse(readFileSync(file, "utf8"))
  json.expo.version = version
  json.expo.android = { ...json.expo.android, versionCode: versionCode(version) }
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n")
  return json.expo
}

export function manifest(version, apkPath) {
  versionCode(version) // 同一套格式校验
  const buf = readFileSync(apkPath)
  return {
    version,
    apk: path.basename(apkPath),
    size: statSync(apkPath).size,
    sha256: createHash("sha256").update(buf).digest("hex"),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = process.argv.slice(2)
    if (args[0] === "--manifest") {
      const [, version, apk] = args
      process.stdout.write(JSON.stringify(manifest(version, apk), null, 2) + "\n")
    } else {
      const [version, file] = args
      if (!version || !file) throw new Error("用法：mobile-version.mjs <版本> <app.json> | --manifest <版本> <apk>")
      const expo = writeAppJson(version, file)
      console.error(`移动端版本号 → ${expo.version}（versionCode ${expo.android.versionCode}）`)
    }
  } catch (e) {
    console.error(`::error::${e.message}`)
    process.exit(1)
  }
}
