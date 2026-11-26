import {
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
} from '@tanstack/react-table'

/**
 * TanStack Table v9 是 tree-shaken 的 —— 用到哪个特性就要显式注册。
 *
 * 注册 `rowSelectionFeature`：批量删除（#449）。只有 `deletable` 的行能勾（`index.tsx` 的
 * `enableRowSelection`）—— 公告和全员广播删不掉，让人勾上再被后端静默跳过是个骗人的控件。
 *
 * 也不注册排序：`crud_notification.py` 固定 `select_order('id', 'desc')`，
 * 接口没有排序入参。
 */
export const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
})
