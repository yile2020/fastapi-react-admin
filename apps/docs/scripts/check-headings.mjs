#!/usr/bin/env node
/**
 * 标题闸门：正文里的 h2 / h3 / h4 要写成短的名词短语，不写问句。接在 `build` 后面，PR 的 CI 就会红。
 *
 * 为什么要它：2026-11-26 之前标题按「写成人会问的问题」的规矩写，一页十几条「…怎么…？」「…吗？」，
 * 在右侧目录里折成两三行，读者扫一眼读不出这节讲什么（用户原话：长得让人没有读的欲望）。
 * 一次改了全站 698 条；不设闸门的话，下一篇新文档又会照老习惯写回问句。
 *
 * 规则（和 AGENTS.md「写内容」一节同一份）：
 * - 不带问号（？ / ?）
 * - 中文 h2 ≤ 8 字、h3/h4 ≤ 10 字（常见问题页 ≤ 12）；英文单词、数字、括号里的缩写各按 1 个字算，开头的「1. 」不算
 * - 英文 h2 ≤ 4 个词、h3/h4 ≤ 5 个词（常见问题页 ≤ 6）
 * 代码块里的 `#` 行不算标题。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../src/content/docs')
const files = readdirSync(ROOT, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && /\.mdx?$/.test(e.name)).map((e) => join(e.parentPath, e.name))

/** 中文长度：英文词 / 数字 / 括号缩写各算 1，空格不算 */
const zhLength = (t) => t
  .replace(/`([^`]*)`/g, '$1')
  .replace(/（[A-Za-z0-9/+ -]+）/g, 'X')
  .replace(/[A-Za-z0-9][A-Za-z0-9.+/_-]*/g, 'X')
  .replace(/\s+/g, '').length

const problems = []
let count = 0
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/')
  const en = rel.startsWith('en/')
  const faq = rel.endsWith('reference/faq.md')
  let fence = false
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return }
    if (fence) return
    const m = line.match(/^(#{2,4})\s+(.*?)\s*$/)
    if (!m) return
    count++
    const level = m[1].length
    const text = m[2].replace(/^\d+\.\s*/, '')
    const where = `src/content/docs/${rel}:${i + 1}  ${m[1]} ${m[2]}`
    if (/[？?]/.test(text)) { problems.push(`${where}  —— 不写问句`); return }
    if (en) {
      const words = text.split(/\s+/).filter(Boolean).length
      const max = level === 2 ? 4 : faq ? 6 : 5
      if (words > max) problems.push(`${where}  —— ${words} 个词，上限 ${max}`)
    } else {
      const n = zhLength(text)
      const max = level === 2 ? 8 : faq ? 12 : 10
      if (n > max) problems.push(`${where}  —— ${n} 个字，上限 ${max}`)
    }
  })
}

if (problems.length) {
  console.error(`标题检查没过（${problems.length} 处）：标题写成短的名词短语，见 apps/docs/AGENTS.md「写内容」\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`标题：${files.length} 页 · ${count} 条 · 0 处越界`)
