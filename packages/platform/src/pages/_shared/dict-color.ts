import { TONE_CLASS } from './status'

/**
 * 字典项的颜色。
 *
 * 🔴 **后端的 `color` 是自由文本，种子里写的是 Ant Design 的色名，前端只有一套自己的色板。**
 * 种子 36 个字典项里 27 个用的是 `green` / `processing` / `magenta` / `volcano` / `cyan` …，
 * 原来的映射表只有 6 个键，其余一律查不到、静默回落成灰色 —— 字典页上「通用状态」的「正常」
 * 本该是绿的、却和「停用」一样是灰的（2026-11-26 读种子 SQL 统计）。
 *
 * 做法：前端认一份**规范色名**（下拉里能挑的就是这些），再给 Ant Design 的色名做**别名**映射，
 * 不改种子、不写迁移（改了种子，已经装好的库不会跟着变）。
 * 新增别名只加在 `ALIASES`；`dict-color.test.ts` 会读种子 SQL，种子里出现没映射的色名就红。
 */
export const DICT_COLORS = ['default', 'primary', 'success', 'info', 'warning', 'red', 'gray'] as const
export type DictColor = (typeof DICT_COLORS)[number]

const ALIASES: Record<string, DictColor> = {
  // 成功
  green: 'success',
  // 危险
  error: 'red',
  danger: 'red',
  // 警示（Ant Design 的暖色一律归到琥珀）
  orange: 'warning',
  gold: 'warning',
  volcano: 'warning',
  yellow: 'warning',
  lime: 'warning',
  // 信息（冷色）
  cyan: 'info',
  blue: 'info',
  geekblue: 'info',
  processing: 'info',
  // 品牌紫
  purple: 'primary',
  magenta: 'primary',
  pink: 'primary',
  // 灰
  grey: 'gray',
}

const CANONICAL = new Set<string>(DICT_COLORS)

function normalize(color: string | null | undefined): string {
  return (color ?? '').trim().toLowerCase()
}

/**
 * 🔴 **只认 `ALIASES` 自己的键，不能用 `in` / 直接下标。** `color` 是后端的自由文本（导入 xlsx 能写任意值），
 * `'constructor' in ALIASES` 是 true、`ALIASES['constructor']` 是个函数 —— 原型链上的属性会被当成别名，
 * 标签的 class 变成 `undefined`。色名先转了小写，所以能撞上的是 `constructor` / `__proto__` 这类全小写的原型属性
 * （`toString` 转成 `tostring` 就不在原型链上了）
 */
function alias(c: string): DictColor | undefined {
  return Object.hasOwn(ALIASES, c) ? ALIASES[c] : undefined
}

/** 这个色名前端认不认（规范名或别名）。空值算认 —— 空就是「默认」 */
export function isKnownDictColor(color: string | null | undefined): boolean {
  const c = normalize(color)
  return c === '' || CANONICAL.has(c) || alias(c) !== undefined
}

/** 任意色名 → 规范色名。认不出的落回 `default`（灰底），不会报错 */
export function canonicalDictColor(color: string | null | undefined): DictColor {
  const c = normalize(color)
  if (CANONICAL.has(c)) return c as DictColor
  return alias(c) ?? 'default'
}

/**
 * 药丸的 class。四个语义色直接取 `_shared/status` 的 `TONE_CLASS`（同一个语义在字典标签、
 * 状态药丸、提示条上得是同一个颜色），只有 default / primary 是字典自己的。
 */
export const DICT_COLOR_CLASS: Record<DictColor, string> = {
  default: 'bg-muted text-foreground ring-border',
  primary: 'bg-primary/10 text-primary ring-primary/25',
  success: TONE_CLASS.success,
  info: TONE_CLASS.info,
  warning: TONE_CLASS.warning,
  red: TONE_CLASS.danger,
  gray: TONE_CLASS.muted,
}

export function dictColorClass(color: string | null | undefined): string {
  return DICT_COLOR_CLASS[canonicalDictColor(color)]
}
