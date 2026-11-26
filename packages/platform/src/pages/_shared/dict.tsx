import * as React from 'react'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@admin/ui/components/select'
import { Skeleton } from '@admin/ui/components/skeleton'
import { cn } from '@admin/ui/lib/utils'

import { api } from '../../api-client/client'
import { dictColorClass } from './dict-color'
import { OptionsError } from './options-error'

/**
 * 数据字典的**前端消费者**：业务页面里的状态 / 分类 / 级别这类枚举，值和标签由字典页维护，
 * 页面只写字典类型编码。
 *
 * 哪些该接、哪些不该接，见 [`_shared` 分册](AGENTS.md)「字典」一节 —— 先看那一节再用：
 * **和后端代码里的枚举绑死的值（菜单类型、登录状态……）不要接**，改字典不会让后端跟着变。
 */

export type DictOption = { label: string; value: string; color: string | null }

// ─── 取数 ─────────────────────────────────────────────────────────────────────

/**
 * 🔴 **必须挂在 `['sys', 'dict']` 下面**（`dict/api.ts` 的 `dictKeys.all`）：字典页的增删改都
 * `invalidateQueries({ queryKey: dictKeys.all })`，挂在别处，管理员改完字典、同一会话里的业务页面还是旧标签。
 * `dict.test.ts` 钉着这个前缀。
 */
export const DICT_OPTIONS_ROOT = ['sys', 'dict', 'options'] as const
export const dictOptionsKey = (code: string) => [...DICT_OPTIONS_ROOT, code] as const

/** 字典几乎不变，5 分钟内不重取；字典页改了会按上面那个前缀主动失效 */
const STALE_MS = 5 * 60_000

async function fetchDictOptions(codes: readonly string[]): Promise<Record<string, DictOption[]>> {
  const s = new URLSearchParams()
  for (const c of codes) s.append('codes', c)
  return api.GET<Record<string, DictOption[]>>(`/api/v1/sys/dict-datas/options?${s}`)
}

export const dictOptionsQuery = (code: string) =>
  queryOptions({
    queryKey: dictOptionsKey(code),
    queryFn: async () => (await fetchDictOptions([code]))[code] ?? [],
    staleTime: STALE_MS,
    enabled: code !== '',
  })

// ─── 模型（纯函数，好测） ─────────────────────────────────────────────────────

export type Dict = {
  /** 原样的选项（标签没翻译） */
  items: readonly DictOption[]
  /** 给下拉 / 查询区用：标签已经过 `t()` */
  options: { value: string; label: string }[]
  /** 值 → 标签。**字典里没有这个值就原样返回值本身**（被停用 / 删掉的项，历史数据里还在） */
  labelOf: (value: string | number | boolean | null | undefined) => string
  find: (value: string | number | boolean | null | undefined) => DictOption | undefined
  /** `SelectFilter` 的 `items`：`{ all: 「全部…」, 值: 标签 }`。⚠️ 数字样的值会被 JS 按数值顺序排，不跟 `sort`；要严格按 sort 用 `options` 喂 QueryBar */
  filterItems: (allLabel: string) => Record<string, string>
}

/**
 * 字典值永远是**字符串**（`'1'`、`'true'`），而业务字段常常是数字 / 布尔 —— 比较前一律 `String()`，
 * 调用方不用管。反过来，`DictSelect` 的 `onChange` 给的也是字符串，要数字自己 `Number()`（ID 不要，硬纪律 6）
 */
const key = (v: string | number | boolean | null | undefined): string => (v == null ? '' : String(v))

export function buildDict(items: readonly DictOption[], translate: (s: string) => string): Dict {
  const byValue = new Map(items.map((i) => [i.value, i]))
  // 标签是库里的中文：仓库里写的（种子）在语言包里有 → 译；管理员自己敲的没有 → 原样（见 i18n 分册「谁写的」判据）
  const options = items.map((i) => ({ value: i.value, label: translate(i.label) }))
  return {
    items,
    options,
    find: (v) => byValue.get(key(v)),
    labelOf: (v) => {
      const hit = byValue.get(key(v))
      return hit ? translate(hit.label) : key(v)
    },
    filterItems: (allLabel) => ({ all: allLabel, ...Object.fromEntries(options.map((o) => [o.value, o.label])) }),
  }
}

// ─── hooks ───────────────────────────────────────────────────────────────────

export type DictState = {
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => void
}

/**
 * 一个字典。同一个编码在一页里用多少次都只发一次请求（同 query key）。
 * 取不到时 `isError` 为真、`options` 是空 —— **调用方要把失败画出来**（`DictTag` / `DictSelect` 已经画了；
 * 自己拿 `options` 喂别的控件时配 `OptionsError`），别让它长得像「这个字典没有选项」（硬纪律 9）。
 */
export function useDict(code: string): Dict & DictState {
  const { t } = useTranslation()
  const q = useQuery(dictOptionsQuery(code))
  const dict = React.useMemo(() => buildDict(q.data ?? [], (s) => t(s)), [q.data, t])
  return {
    ...dict,
    // 没传编码（enabled=false）时 isPending 永远是 true，不能让它转圈
    isPending: code !== '' && q.isPending,
    isError: q.isError,
    error: q.error,
    refetch: () => void q.refetch(),
  }
}

/**
 * 一次取多个字典（**一个请求**），并把每个字典写进单个编码的缓存 —— 之后任何地方 `useDict(code)` 都是命中。
 * 一个页面要两个以上字典时用它。
 */
export function useDicts<C extends string>(codes: readonly C[]): { dicts: Record<C, Dict> } & DictState {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const joined = codes.join('|')
  const list = React.useMemo(() => [...new Set(joined.split('|'))].filter(Boolean).sort(), [joined])
  const q = useQuery({
    queryKey: [...DICT_OPTIONS_ROOT, 'batch', ...list],
    queryFn: async () => {
      const data = await fetchDictOptions(list)
      for (const c of list) qc.setQueryData(dictOptionsKey(c), data[c] ?? [])
      return data
    },
    staleTime: STALE_MS,
    enabled: list.length > 0,
  })
  const dicts = React.useMemo(
    () =>
      Object.fromEntries(
        joined.split('|').filter(Boolean).map((c) => [c, buildDict(q.data?.[c] ?? [], (s) => t(s))])
      ) as Record<C, Dict>,
    [joined, q.data, t]
  )
  return { dicts, isPending: list.length > 0 && q.isPending, isError: q.isError, error: q.error, refetch: () => void q.refetch() }
}

// ─── 组件 ────────────────────────────────────────────────────────────────────

const PILL = 'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs whitespace-nowrap ring-1'

/**
 * 表格单元格 / 详情里的字典标签：值 → 带色的药丸。
 *
 * 三种「不是正常命中」的情形各自可见，**不会画成空白**：
 * - 加载中：骨架
 * - 取数失败：原值 + 虚线下划线，悬停说明，**点一下重试**（整列都失败时是一排原值，不是一排空格；
 *   同一个编码共用一个 query，点任意一个整列恢复）
 * - 字典里没有这个值（项被停用 / 删了，历史数据还带着）：原值的灰色药丸
 */
export function DictTag({
  code,
  value,
  className,
  testId,
}: {
  code: string
  value: string | number | boolean | null | undefined
  className?: string
  testId?: string
}) {
  const { t } = useTranslation()
  const dict = useDict(code)
  const v = key(value)
  if (v === '') return <span className="text-muted-foreground">—</span>
  if (dict.isPending) return <Skeleton className="h-5 w-12 rounded-full" data-testid={testId} />
  if (dict.isError) {
    // 真按钮：整列都失败时，用户点任意一个就能重取（同一个编码共用一个 query，一次点击全列恢复）。
    // stopPropagation：它常在可点击的行 / 单元格里，不能连带触发「打开详情」
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          dict.refetch()
        }}
        className={cn(
          'cursor-pointer text-xs text-muted-foreground underline decoration-destructive decoration-dotted underline-offset-4',
          className
        )}
        title={t('字典加载失败，点击重试')}
        data-dict-state="error"
        data-testid={testId}
      >
        {v}
      </button>
    )
  }
  const hit = dict.find(v)
  if (!hit) {
    return (
      <span
        className={cn(PILL, dictColorClass(null), className)}
        title={t('字典里没有这个值')}
        data-dict-state="unknown"
        data-testid={testId}
      >
        {v}
      </span>
    )
  }
  return (
    <span className={cn(PILL, dictColorClass(hit.color), className)} data-dict-state="ok" data-testid={testId}>
      {dict.labelOf(v)}
    </span>
  )
}

/**
 * 表单里的字典下拉。值是**字符串**（见 `key` 的说明）。
 *
 * - 当前值不在选项里（项被停用 / 删了）：补一条「原值」选项，**不让编辑表单把它显示成空**再被用户顺手存掉
 * - 取数失败：下拉禁用，下面一行 `OptionsError`（加载失败 · 重试）；不是空下拉
 * - 字典还没有任何启用的选项：禁用，占位写「暂无选项」
 */
export function DictSelect({
  code,
  value,
  onChange,
  disabled,
  placeholder,
  className = 'w-full',
  testId,
  errorTestId,
}: {
  code: string
  value: string | number | boolean | null | undefined
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  testId?: string
  errorTestId?: string
}) {
  const { t } = useTranslation()
  const dict = useDict(code)
  const current = key(value)

  const options = React.useMemo(() => {
    if (current === '' || dict.isPending || dict.isError || dict.options.some((o) => o.value === current)) {
      return dict.options
    }
    return [...dict.options, { value: current, label: current }]
  }, [dict.options, dict.isPending, dict.isError, current])
  const items = React.useMemo(() => Object.fromEntries(options.map((o) => [o.value, o.label])), [options])

  const empty = !dict.isPending && !dict.isError && options.length === 0
  const hint = dict.isPending ? t('加载中…') : empty ? t('暂无选项') : (placeholder ?? t('请选择'))

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={current === '' ? null : current}
        items={items}
        onValueChange={(v) => v != null && onChange(String(v))}
        disabled={disabled || dict.isPending || dict.isError || empty}
      >
        <SelectTrigger className={className} data-testid={testId}>
          <SelectValue placeholder={hint} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {dict.isError && <OptionsError error={dict.error} onRetry={dict.refetch} testId={errorTestId ?? 'dict-options-error'} />}
    </div>
  )
}
