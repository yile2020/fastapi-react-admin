import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

import { manifest, versionCode } from "../mobile-version.mjs"

// release.yml 安卓 job 的版本号 / 更新清单（#460）。清单的读法在 apps/mobile/tests/app-update.test.mjs。
const script = fileURLToPath(new URL("../mobile-version.mjs", import.meta.url))

function tmp(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "fra-mobile-version-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

test("versionCode 一路递增：数字段按数值，不按字符串", () => {
  assert.equal(versionCode("1.2.0"), 1_002_000)
  assert.ok(versionCode("1.10.0") > versionCode("1.9.9"))
  assert.ok(versionCode("2.0.0") > versionCode("1.999.999"))
  // 预发布和同号正式版同一个 code：同号允许覆盖安装，rc 之后装正式版不会被拒
  assert.equal(versionCode("1.3.0-rc.1"), versionCode("1.3.0"))
})

test("versionCode 拒绝认不出的版本号和会撞段的数字", () => {
  assert.throws(() => versionCode("v1.2.0"), /格式不对/)
  assert.throws(() => versionCode("1.2"), /格式不对/)
  assert.throws(() => versionCode("1.1000.0"), /超过 999/)
  assert.throws(() => versionCode("0.0.0"), /超出/)
})

test("写 app.json：只动 version 和 android.versionCode，其余原样", (t) => {
  const dir = tmp(t)
  const file = path.join(dir, "app.json")
  writeFileSync(file, JSON.stringify({ expo: { name: "x", version: "0.0.1", android: { package: "com.x" } } }))
  const r = spawnSync(process.execPath, [script, "1.3.0-rc.2", file], { encoding: "utf8" })
  assert.equal(r.status, 0, r.stderr)
  const json = JSON.parse(readFileSync(file, "utf8"))
  assert.deepEqual(json.expo, { name: "x", version: "1.3.0-rc.2", android: { package: "com.x", versionCode: 1_003_000 } })
})

test("格式不对的版本号让这一步红，不写文件", (t) => {
  const dir = tmp(t)
  const file = path.join(dir, "app.json")
  const before = JSON.stringify({ expo: { version: "0.0.1" } })
  writeFileSync(file, before)
  const r = spawnSync(process.execPath, [script, "latest", file], { encoding: "utf8" })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /::error::版本号格式不对/)
  assert.equal(readFileSync(file, "utf8"), before)
})

test("清单：apk 写文件名（App 按清单目录解析），带大小和 sha256", (t) => {
  const dir = tmp(t)
  const apk = path.join(dir, "admin-mobile-1.3.0.apk")
  writeFileSync(apk, "fake apk")
  assert.deepEqual(manifest("1.3.0", apk), {
    version: "1.3.0",
    apk: "admin-mobile-1.3.0.apk",
    size: 8,
    sha256: createHash("sha256").update("fake apk").digest("hex"),
  })
  assert.match(manifest("1.3.0", apk).sha256, /^[0-9a-f]{64}$/)
})
