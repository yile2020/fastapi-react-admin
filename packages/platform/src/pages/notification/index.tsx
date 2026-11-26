import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useTable, type ColumnVisibilityState, type RowSelectionState } from '@tanstack/react-table'
import { IconChecks, IconTrashX } from '@tabler/icons-react'

import { Button } from '@admin/ui/components/button'
import { DataTable, DataTableColumnVisibility } from '@admin/ui/components/data-table'
import { QueryBar, countActive, type FilterField } from '@admin/ui/components/query-bar'
import { toast } from '@admin/ui/components/toast'

import { ConfirmDialog } from '../../shell/confirm-dialog'
import { NoticeReaderSheet } from '../notice/reader-sheet'
import { PageHeader } from '../../shell/page-header'
import { BulkBar, RefreshButton } from '../_shared/filters'
import { listState, usePageRecovery } from '../_shared/list-query'
import { DEFAULT_PAGE_SIZE } from '../_shared/pagination'
import { useQuerySearch } from '../_shared/use-query-search'
import {
  CATEGORY,
  markableUnread,
  notificationKeys,
  notificationsQuery,
  unreadCountQuery,
  useDeleteNotification,
  useDeleteNotifications,
  useDeleteReadNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type Notification,
  type NotificationListParams,
} from './api'
import { buildColumns, COLUMN_LABELS } from './columns'
import { features } from './table-features'
import { useNotificationOpen } from './use-open'
import { ListBody, PageShell } from '../_shared/page-shell'

/**
 * 可筛字段。`key` 是**地址栏参数名**，恰好和接口入参同名，所以不用 `param` 映射。
 *
 * 「状态」这一栏的语义是**已读 / 未读**，不是系统通用的正常 / 停用 ——
 * 所以不能用 `_shared/status` 的 `STATUS_FILTER_ITEMS`。
 * 值用 `1` / `0` 而不是布尔：`QueryBar` 的选项值进 URL 之后是字符串，
 * 布尔 `false` 会被写成 `'false'` 再被 zod 的 `coerce.boolean()` 判成 `true`
 * （非空字符串一律真）—— 那是个静默反转，不如一开始就用数字。
 */
const FIELDS: FilterField[] = [
  {
    key: 'title',
    label: '标题',
    type: 'text',
    group: '内容',
    defaultVisible: true,
    placeholder: '模糊匹配',
  },
  {
    key: 'category',
    label: '分类',
    type: 'select',
    group: '内容',
    defaultVisible: true,
    options: [
      { value: CATEGORY.SYSTEM, label: '系统' },
      { value: CATEGORY.ANNOUNCEMENT, label: '公告' },
      { value: CATEGORY.TASK, label: '任务' },
    ],
  },
  {
    key: 'unread',
    label: '状态',
    type: 'select',
    group: '状态',
    defaultVisible: true,
    options: [
      { value: 1, label: '未读' },
      { value: 0, label: '已读' },
    ],
  },
]

export type NotificationPageSearch = {
  page?: number
  size?: number
  /** 摆开但还没填值的格子（见 `_shared/use-query-search`） */
  f?: string
  title?: string
  /** 见 `api.ts` 的 `CATEGORY` */
  category?: number
  /** 1 未读 · 0 已读 */
  unread?: number
  /**
   * 正在读的公告（雪花 ID，字符串）。开在 URL 上：刷新还在，
   * 群机器人卡片 / 收件箱的 `link`（`/notification?notice=…`）也靠它直接打开那一条
   */
  notice?: string
}

/**
 * 消息中心 —— 收件箱的完整视图（翻历史 / 筛已读未读 / 全部已读）。
 *
 * 顶栏那枚铃铛（`./bell.tsx`）是同一份数据的「最近几条」预览，两者共用
 * `api.ts` 的 query key —— 在任一处标记已读，另一处立刻跟着变，不用互相通知。
 *
 * 硬纪律：组件 router-独立（search 走 props，内部不读 `Route.useSearch()`），
 * 筛选与分页全进 URL。
 */
export function NotificationPage({
  search = {},
  onSearchChange,
}: {
  search?: NotificationPageSearch
  onSearchChange?: (next: NotificationPageSearch) => void
}) {
  const { t } = useTranslation()
  const page = search.page ?? 1
  const size = search.size ?? DEFAULT_PAGE_SIZE

  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({})
  const [markAllOpen, setMarkAllOpen] = React.useState(false)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [pendingDelete, setPendingDelete] = React.useState<Notification | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = React.useState(false)
  const [clearReadOpen, setClearReadOpen] = React.useState(false)

  // 换页 / 换筛选清掉选中：分页在服务端，留着的选中项已不在可见行里，批量删除会打到看不见的记录上
  const patch = React.useCallback(
    (next: Partial<NotificationPageSearch>) => {
      setRowSelection({})
      onSearchChange?.({ ...search, ...next })
    },
    [onSearchChange, search]
  )

  const q = useQuerySearch({ fields: FIELDS, search, onSearchChange, refreshKey: notificationKeys.all })
  const submitQuery = React.useCallback(
    (v: Parameters<typeof q.submit>[0]) => {
      setRowSelection({})
      q.submit(v)
    },
    [q]
  )
  const resetQuery = React.useCallback(() => {
    setRowSelection({})
    q.reset()
  }, [q])

  const raw = q.params as { title?: string; category?: number; unread?: number }
  const params: NotificationListParams = {
    page,
    size,
    title: raw.title,
    category: raw.category,
    // 1/0 → true/false。`undefined` 保持 undefined（= 不筛），
    // 不能写成 `raw.unread === 1`：那会把「不限」变成「只看已读」
    unread: raw.unread === undefined ? undefined : raw.unread === 1,
  }

  const listQuery = useQuery(notificationsQuery(params))
  const { data, isFetching } = listQuery
  const list = listState(listQuery)
  usePageRecovery(listQuery, { page, size, onPageChange: (page) => patch({ page: page === 1 ? undefined : page }) })
  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  const unread = useQuery(unreadCountQuery)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const delOne = useDeleteNotification()
  const delMany = useDeleteNotifications()
  const delRead = useDeleteReadNotifications()

  const { linkOf, readIfUnread } = useNotificationOpen()
  const handleMarkRead = React.useCallback((n: Notification) => markRead.mutate(n.id), [markRead])
  // 只改 `notice` 一个键，筛选 / 分页原样留着 —— 关掉详情回到的还是刚才那一页
  const openNotice = React.useCallback(
    (id: string | undefined) => onSearchChange?.({ ...search, notice: id }),
    [onSearchChange, search]
  )
  // 标已读一律由抽屉做（点那一行 / 地址栏深链都一样）：它看得到这条是不是「必须确认」（#190）。
  // 原来点行时先 `readIfUnread`、抽屉再按 `rowAlreadyMarked` 跳过，必须确认的就被那一下替人确认了
  const columns = React.useMemo(
    () => buildColumns(linkOf, readIfUnread, handleMarkRead, openNotice, setPendingDelete, t),
    [linkOf, readIfUnread, handleMarkRead, openNotice, t]
  )

  const table = useTable({
    features,
    data: rows,
    // v9 的列定义数组混用不同 TValue 会形成联合类型，与 useTable 期望的
    // ColumnDef<..., unknown>[] 不兼容（库的类型方差限制）
    columns: columns as never,
    state: { columnVisibility, rowSelection },
    getRowId: (row) => row.id,
    manualPagination: true,
    rowCount: total,
    // 只有发给我本人的能删（#449）。「全选本页」也认它 —— 只在复选框上禁用的话，表头一勾就把公告也勾进去了
    enableRowSelection: (row) => row.original.deletable,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  })
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])

  // 「全部已读」标得掉的条数：必须确认的公告后端会跳过（#190），按总数判的话只剩它们时按钮还亮着、点了什么都不变
  const markable = markableUnread(unread.data)
  const mustAck = unread.data?.requires_ack_count ?? 0
  const hasFilter = countActive(q.applied, FIELDS) > 0

  return (
    <PageShell fill="always">
      <PageHeader
        title={t('消息中心')}
        description={t('系统消息与公告的收件箱。已读和删除只影响你自己；公告和全员通知不能删除。')}
      />

      <ListBody>
        <QueryBar
          fields={FIELDS}
          value={q.value}
          onChange={q.setValue}
          onSearch={submitQuery}
          onReset={resetQuery}
          applied={q.applied}
          loading={isFetching}
          viewsStorageKey="qb:notification"
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={markable === 0 || markAll.isPending}
                onClick={() => setMarkAllOpen(true)}
                data-testid="notification-mark-all-page"
              >
                <IconChecks className="size-4" />
                {markable > 0 ? t('全部已读（{{n}}）', { n: markable }) : t('全部已读')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={delRead.isPending}
                onClick={() => setClearReadOpen(true)}
                data-testid="notification-clear-read"
              >
                <IconTrashX className="size-4" />
                {t('清空已读')}
              </Button>
              <RefreshButton busy={isFetching} onClick={list.onRetry} />
              <DataTableColumnVisibility table={table} columnLabels={COLUMN_LABELS} />
              {/* 批量条放左组末尾：它随选中行出现 / 消失，放右组会让「搜索 / 重置」横向位移 */}
              <BulkBar count={selectedIds.length} pending={delMany.isPending} onDelete={() => setBulkOpen(true)} />
            </>
          }
        />

        <div
          data-testid="notification-table"
          data-fetching={isFetching}
          className="content-scroll:flex content-scroll:min-h-0 content-scroll:flex-1 content-scroll:flex-col"
        >
          <DataTable
            table={table}
            showColumnVisibility={false}
            rows={table.getRowModel().rows}
            columnCount={columns.length}
            columnLabels={COLUMN_LABELS}
            emptyMessage={hasFilter ? t('没有匹配的通知') : t('暂无通知')}
            // 未读行整行加一点底色 —— 和铃铛下拉里的处理保持一致
            rowAttributes={(row) => ({ 'data-unread': row.original.read_time ? undefined : 'true' })}
            tableBodyClassName="[&_tr[data-unread=true]]:bg-muted/30"
            {...list}
            pagination={{
              pageIndex: page - 1,
              pageCount: totalPages,
              pageSize: size,
              selectedCount: selectedIds.length,
              totalCount: total,
              onPageChange: (i) => patch({ page: i === 0 ? undefined : i + 1 }),
              onPageSizeChange: (s) => patch({ size: s, page: undefined }),
            }}
          />
        </div>
      </ListBody>

      {/* 开在 URL 上 → 抽屉里用的是本 tab 的 portal 容器（reader-sheet 的注释） */}
      <NoticeReaderSheet
        noticeId={search.notice ?? null}
        onOpenChange={(o) => {
          if (!o) openNotice(undefined)
        }}
      />

      <ConfirmDialog
        open={markAllOpen}
        onOpenChange={setMarkAllOpen}
        title={t('标记全部已读')}
        description={
          mustAck > 0
            ? t(
                '会把 {{n}} 条未读通知标记为已读，此操作不可撤销。另有 {{m}} 条必须确认的公告不会被标记，要打开读完后点「我已阅读」。',
                { n: markable, m: mustAck }
              )
            : t('会把你当前全部 {{n}} 条未读通知标记为已读，此操作不可撤销。', { n: markable })
        }
        confirmText={t('全部已读')}
        pending={markAll.isPending}
        onConfirm={async () => {
          await markAll.mutateAsync()
          setMarkAllOpen(false)
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (o) return
          setPendingDelete(null)
          setDeleteError(null)
        }}
        title={t('删除通知')}
        description={pendingDelete ? t('确定删除「{{title}}」吗？此操作不可撤销。', { title: pendingDelete.title }) : ''}
        error={deleteError}
        confirmText={t('删除')}
        destructive
        pending={delOne.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          setDeleteError(null)
          try {
            await delOne.mutateAsync(pendingDelete.id)
            setRowSelection((s) => {
              const { [pendingDelete.id]: _, ...rest } = s
              return rest
            })
            setPendingDelete(null)
          } catch (e) {
            setDeleteError(e instanceof Error ? e.message : t('删除失败'))
          }
        }}
      />

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={t('批量删除通知')}
        description={t('确定删除选中的 {{n}} 条通知吗？此操作不可撤销。', { n: selectedIds.length })}
        confirmText={t('删除')}
        destructive
        pending={delMany.isPending}
        onConfirm={async () => {
          try {
            const n = await delMany.mutateAsync(selectedIds)
            setRowSelection({})
            toast.success(t('已删除 {{n}} 条通知', { n }))
          } finally {
            setBulkOpen(false)
          }
        }}
      />

      {/* 清空前不知道会删几条（已读的可能在别的页），说清范围就够了：只动发给你个人的，公告不动 */}
      <ConfirmDialog
        open={clearReadOpen}
        onOpenChange={setClearReadOpen}
        title={t('清空已读')}
        description={t('会删除发给你个人的全部已读通知，公告和全员通知不受影响。此操作不可撤销。')}
        confirmText={t('清空')}
        destructive
        pending={delRead.isPending}
        onConfirm={async () => {
          try {
            const n = await delRead.mutateAsync()
            setRowSelection({})
            toast.success(n > 0 ? t('已删除 {{n}} 条通知', { n }) : t('没有可清空的已读通知'))
          } finally {
            setClearReadOpen(false)
          }
        }}
      />
    </PageShell>
  )
}
