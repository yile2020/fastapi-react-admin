#!/usr/bin/env node
/**
 * 字阶闸门：内页用到的样式里，字号只能取 typography.css 的 7 级（`var(--fs-*)`），
 * 字重只能是 400 / 500 / 600 三档（`var(--fw-*)`）。接在 `build` 后面，所以 PR 的 CI 就会红。
 *
 * 为什么要它：2026-11-26 统一字阶之前，内页实测出现 13 种字号（11.52 / 12.8 / 13 / 14.4 / 16.8 …）
 * 和 6 档字重（含 650 / 700 / 800）—— 每一处都是某个组件里随手写的 `0.8rem`、`font-weight: 650`，
 * 单看都合理，合起来就是「字有大有小、看着累」。这种漂移构建和链接检查全都放行。
 *
 * 只查源码，不渲染页面：漂移的来源就是源码里的字面量，查源码不用在 CI 里装浏览器。
 * 渲染后的实际字号用 ego / Playwright 另外核对过（见 AGENTS.md「字阶与配色」）。
 *
 * 豁免：
 * - 首页专用的展示组件（HOME_ONLY）：落地页有自己的展示字号。脚本同时核对它们**只**被首页引用，
 *   哪天被功能页 import 了，就得先按字阶改掉再移出这张表
 * - 某一行确实不是文字（比如按钮里的 × 图标）：行尾写 `type-ok: 原因`
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOME_ONLY = [
  'Closing', 'DiagramAiGuard', 'DiagramDataScope', 'DiagramMonorepo', 'FeatureLine', 'Hero', 'HomeHeader',
  'ProductTour', 'SectionTitle', 'Showcase', 'TenonStage',
]
const SIZE_OK = /^(var\(--(fs|sl-text)-[\w-]+\)|inherit)$/
const WEIGHT_OK = /^(var\(--fw-[\w-]+\)|400|500|600|normal|inherit)$/
// `font:` 简写能一次写死字号和字重（`font: 600 13px/1.4 …`），只放行 inherit 和整条变量
const FONT_OK = /^(inherit|var\(--[\w-]+\))$/
const RULES = {
  'font-size': [SIZE_OK, '用 var(--fs-*)'],
  'font-weight': [WEIGHT_OK, '只用 400 / 500 / 600（var(--fw-*)）'],
  font: [FONT_OK, '简写只写 inherit，字号和字重分开用 var(--fs-*) / var(--fw-*)'],
}

const files = (dir, ext) => readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && ext.test(e.name)).map((e) => join(e.parentPath, e.name))

const problems = []
const styleFiles = [...files('src/styles', /\.css$/), ...files('src/components', /\.astro$/)]
  .filter((f) => !HOME_ONLY.some((name) => f.endsWith(`/${name}.astro`)))
for (const file of styleFiles) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('type-ok:')) return
    for (const [, prop, value] of line.matchAll(/(?<![\w-])(font-size|font-weight|font)\s*:\s*([^;}]+)/g)) {
      const v = value.trim().replace(/\s*!important$/, '')
      const [ok, hint] = RULES[prop]
      if (!ok.test(v)) problems.push(`${relative(ROOT, file)}:${i + 1}  ${prop}: ${v}  —— ${hint}`)
    }
  })
}

// 首页专用组件不能出现在功能页里（首页是 content/docs 下的 index.mdx 和 en/index.mdx）
for (const file of files('src/content/docs', /\.mdx$/)) {
  const rel = relative(join(ROOT, 'src/content/docs'), file)
  if (rel === 'index.mdx' || rel === 'en/index.mdx') continue
  for (const [, name] of readFileSync(file, 'utf8').matchAll(/^import\s+(\w+)\s+from\s+['"][^'"]*components\//gm)) {
    if (HOME_ONLY.includes(name)) problems.push(`src/content/docs/${rel} 引用了首页专用的 ${name}：先按字阶改掉它，再从 check-type.mjs 的 HOME_ONLY 里移出`)
  }
}

if (problems.length) {
  console.error(`字阶检查没过（${problems.length} 处），字阶见 src/styles/typography.css：\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`字阶：${styleFiles.length} 个样式文件 · 0 处越界`)
