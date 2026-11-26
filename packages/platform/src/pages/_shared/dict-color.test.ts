import { describe, expect, it } from 'vitest'
// 种子 SQL 用 Vite 的 `?raw` 读 —— platform 的 tsconfig 没有 node 类型，`node:fs` 过不了 typecheck
import seed from '../../../../../apps/api/backend/plugin/dict/sql/postgresql/init_snowflake.sql?raw'

import {
  canonicalDictColor,
  DICT_COLORS,
  DICT_COLOR_CLASS,
  dictColorClass,
  isKnownDictColor,
} from './dict-color'

describe('canonicalDictColor', () => {
  it('规范色名原样', () => {
    for (const c of DICT_COLORS) expect(canonicalDictColor(c)).toBe(c)
  })

  it('Ant Design 色名按语义归到规范色', () => {
    expect(canonicalDictColor('green')).toBe('success')
    expect(canonicalDictColor('error')).toBe('red')
    expect(canonicalDictColor('processing')).toBe('info')
    expect(canonicalDictColor('cyan')).toBe('info')
    expect(canonicalDictColor('purple')).toBe('primary')
    expect(canonicalDictColor('magenta')).toBe('primary')
    for (const warm of ['orange', 'gold', 'volcano']) expect(canonicalDictColor(warm)).toBe('warning')
  })

  it('大小写和空白不影响；空值与认不出的落回 default', () => {
    expect(canonicalDictColor('  Green ')).toBe('success')
    expect(canonicalDictColor(null)).toBe('default')
    expect(canonicalDictColor(undefined)).toBe('default')
    expect(canonicalDictColor('')).toBe('default')
    expect(canonicalDictColor('chartreuse')).toBe('default')
  })
})

describe('isKnownDictColor', () => {
  it('规范名 / 别名 / 空值认，其余不认', () => {
    expect(isKnownDictColor('success')).toBe(true)
    expect(isKnownDictColor('volcano')).toBe(true)
    expect(isKnownDictColor(null)).toBe(true)
    expect(isKnownDictColor('chartreuse')).toBe(false)
  })
})

describe('dictColorClass', () => {
  it('每个规范色都有 class，语义色互不相同（不会全是灰）', () => {
    const classes = DICT_COLORS.map((c) => DICT_COLOR_CLASS[c])
    expect(classes.every(Boolean)).toBe(true)
    expect(new Set(classes).size).toBe(DICT_COLORS.length)
  })

  it('green 和 default 长得不一样 —— 修之前「正常」和「停用」都是灰色', () => {
    expect(dictColorClass('green')).not.toBe(dictColorClass('default'))
    expect(dictColorClass('green')).toBe(dictColorClass('success'))
  })
})

describe('种子字典里的色名', () => {
  /**
   * 🔴 种子 SQL 是后端那边的数据，前端的映射表是这边的：两边各自改、谁也不报错。
   * 种子里新写一个色名而这里没映射，字典页上它就悄悄变灰 —— 所以读种子核对。
   * （三个方言的种子同源，读 PostgreSQL 那份）
   */
  const rows = [...seed.matchAll(/\(\d+, '(\w+)', '[^']*', '[^']*', '(\w+)', \d+, \d,/g)].map((m) => ({
    type: m[1]!,
    color: m[2]!,
  }))

  it('先断言「有」：真读到了种子里的字典项（正则失效时下面的循环天然通过）', () => {
    expect(rows.length).toBeGreaterThanOrEqual(30)
  })

  it('每一个色名前端都认', () => {
    const unknown = rows.filter((r) => !isKnownDictColor(r.color))
    expect(unknown).toEqual([])
  })
})
