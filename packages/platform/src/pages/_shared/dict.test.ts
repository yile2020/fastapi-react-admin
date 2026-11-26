import { describe, expect, it } from 'vitest'

import { dictKeys } from '../dict/api'
import { buildDict, dictOptionsKey, dictOptionsQuery, failedWithoutData, type DictOption } from './dict'

const ITEMS: DictOption[] = [
  { label: '正常', value: '1', color: 'green' },
  { label: '停用', value: '0', color: 'red' },
  { label: '待定', value: 'true', color: null },
]
const upper = (s: string) => `«${s}»`

describe('缓存键', () => {
  it('🔴 挂在字典页的失效前缀下 —— 管理员改完字典，同一会话里的业务页面才会刷新', () => {
    const prefix = [...dictKeys.all]
    expect(dictOptionsKey('sys_status').slice(0, prefix.length)).toEqual(prefix)
  })

  it('没传编码时查询不启用（不然会发一个必定 422 的请求）', () => {
    expect(dictOptionsQuery('').enabled).toBe(false)
    expect(dictOptionsQuery('sys_status').enabled).toBe(true)
  })
})

describe('buildDict', () => {
  const d = buildDict(ITEMS, upper)

  it('options 的标签过翻译函数，items 保持原样', () => {
    expect(d.options).toEqual([
      { value: '1', label: '«正常»' },
      { value: '0', label: '«停用»' },
      { value: 'true', label: '«待定»' },
    ])
    expect(d.items[0]!.label).toBe('正常')
  })

  it('业务字段是数字 / 布尔时照样命中（字典值永远是字符串）', () => {
    expect(d.labelOf(1)).toBe('«正常»')
    expect(d.labelOf(0)).toBe('«停用»')
    expect(d.labelOf(true)).toBe('«待定»')
    expect(d.find(1)?.color).toBe('green')
  })

  it('字典里没有的值原样返回，不是空串 —— 被停用 / 删掉的项，历史数据里还带着', () => {
    expect(d.labelOf(9)).toBe('9')
    expect(d.find(9)).toBeUndefined()
  })

  it('空值不命中也不炸', () => {
    expect(d.labelOf(null)).toBe('')
    expect(d.labelOf(undefined)).toBe('')
    expect(d.find(null)).toBeUndefined()
  })

  it('filterItems：带「全部」和各项（标签已翻译）', () => {
    // ⚠️ 不断言键的顺序：JS 对象里数字样的键（'0' / '1'）永远排在 'all' 前面，
    // `SelectFilter` 靠 `orderedEntries()` 把 all 提前 —— 顺序不归这一层管（pages 分册「其他约定」）
    const items = d.filterItems('全部状态')
    expect(items.all).toBe('全部状态')
    expect(items['1']).toBe('«正常»')
    expect(items['0']).toBe('«停用»')
  })

  it('空字典：options 为空、labelOf 退回原值', () => {
    const empty = buildDict([], upper)
    expect(empty.options).toEqual([])
    expect(empty.labelOf('x')).toBe('x')
  })
})

describe('评审跟进（#452）', () => {
  it('🔴 同值只留排序靠前的一项 —— 库里只约束「类型 + 标签」唯一，值可以重复', () => {
    const d = buildDict(
      [
        { label: '重要', value: '1', color: 'red' },
        { label: '重点', value: '1', color: 'green' },
        { label: '普通', value: '0', color: null },
      ],
      upper
    )
    expect(d.options.map((o) => o.value)).toEqual(['1', '0']) // 下拉里不再有两个同 key 的项
    expect(d.labelOf(1)).toBe('«重要»') // 不是后写的「重点」
    expect(d.find('1')?.color).toBe('red')
    expect(d.items).toHaveLength(2)
  })

  it('filterItems 不放值为 all 的项 —— 那是 SelectFilter 的「不筛」哨兵，放进来会顶掉「全部」', () => {
    const d = buildDict(
      [
        { label: '全部门', value: 'all', color: null },
        { label: '本部门', value: 'mine', color: null },
      ],
      upper
    )
    const items = d.filterItems('全部')
    expect(items.all).toBe('全部')
    expect(items.mine).toBe('«本部门»')
    expect(Object.keys(items)).toHaveLength(2)
    expect(d.options).toHaveLength(2) // 下拉 / QueryBar 那边照常有它
  })

  it('🔴 有数据时重取失败不算「取不到」—— 别把用户正在看的标签抽走', () => {
    expect(failedWithoutData({ isError: true, data: undefined })).toBe(true)
    expect(failedWithoutData({ isError: true, data: [] })).toBe(false) // 上次成功拿到的是空字典，也算有数据
    expect(failedWithoutData({ isError: true, data: ITEMS })).toBe(false)
    expect(failedWithoutData({ isError: false, data: undefined })).toBe(false)
  })
})
