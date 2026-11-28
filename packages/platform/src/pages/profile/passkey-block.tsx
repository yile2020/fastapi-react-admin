import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { formatDateTime } from '@admin/i18n'
import { Alert } from '@admin/ui/components/alert'
import { Button } from '@admin/ui/components/button'
import { Input } from '@admin/ui/components/input'
import { QueryError } from '@admin/ui/components/query-error'
import { Skeleton } from '@admin/ui/components/skeleton'

import { passkeyEnabledQuery, passkeyErrorMessage, passkeySupported } from '../../auth/passkey'
import { ConfirmDialog } from '../../shell/confirm-dialog'
import { StatusPill } from '../_shared/status'
import { passkeysQuery, useAddPasskey, useDeletePasskey, useRenamePasskey, type Passkey } from './api'

/**
 * 个人中心「安全」里的通行密钥：添加 · 改名 · 删除。登录页那一侧在 `apps/web/src/routes/_guest/-passkey-sign-in.tsx`。
 *
 * - 浏览器不支持 / 服务端没开时**照样列出已有的**（能删），只是不给「添加」—— 别让人以为钥匙没了
 * - 浏览器那一步被取消不是错误，提示用普通语气（`passkeyErrorMessage` 已经区分）
 */
export function PasskeyBlock() {
  const { t } = useTranslation()
  const list = useQuery(passkeysQuery)
  const enabled = useQuery(passkeyEnabledQuery)
  const add = useAddPasskey()
  const rename = useRenamePasskey()
  const del = useDeletePasskey()
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<{ id: string; name: string } | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<Passkey | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const supported = passkeySupported()

  if (list.error) return <QueryError error={list.error} onRetry={() => void list.refetch()} />
  if (!list.data) return <Skeleton className="h-16" />

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await add.mutateAsync(name.trim() || t('我的设备'))
      setName('')
    } catch (err) {
      setError(passkeyErrorMessage(err, t))
    }
  }

  async function onRename(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setError(null)
    try {
      await rename.mutateAsync({ id: editing.id, name: editing.name.trim() })
      setEditing(null)
    } catch (err) {
      setError(passkeyErrorMessage(err, t))
    }
  }

  const canAdd = supported && enabled.data?.enabled !== false

  return (
    <div className="flex flex-col gap-3" data-testid="passkey-block">
      {list.data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="passkey-empty">
          {t('还没有添加通行密钥。')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 rounded-md border" data-testid="passkey-list">
          {list.data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5" data-testid="passkey-row">
              {editing?.id === p.id ? (
                <form onSubmit={onRename} className="flex flex-1 gap-2">
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ id: p.id, name: e.target.value })}
                    maxLength={64}
                    autoFocus
                    className="h-8"
                    data-testid="passkey-rename-input"
                  />
                  <Button type="submit" size="sm" disabled={rename.isPending || !editing.name.trim()}>
                    {t('保存')}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    {t('取消')}
                  </Button>
                </form>
              ) : (
                <>
                  <span className="font-medium" data-testid="passkey-name">
                    {p.name}
                  </span>
                  <StatusPill tone={p.backed_up ? 'success' : 'muted'}>
                    {p.backed_up ? t('已同步到云端') : t('只在这台设备上')}
                  </StatusPill>
                  <span className="text-xs text-muted-foreground">
                    {t('添加于 {{time}}', { time: formatDateTime(p.created_time) })}
                    {' · '}
                    {p.last_used_time
                      ? t('最近使用 {{time}}', { time: formatDateTime(p.last_used_time) })
                      : t('还没用它登录过')}
                  </span>
                  <span className="ms-auto flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: p.id, name: p.name })}>
                      {t('改名')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        setDeleteError(null)
                        setPendingDelete(p)
                      }}
                      data-testid="passkey-delete"
                    >
                      {t('删除')}
                    </Button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!supported ? (
        <p className="text-sm text-muted-foreground" data-testid="passkey-unsupported">
          {t('当前浏览器或客户端不支持通行密钥。请用较新的 Chrome、Edge、Safari 或 Firefox 打开网页版。')}
        </p>
      ) : enabled.data?.enabled === false ? (
        <p className="text-sm text-muted-foreground" data-testid="passkey-disabled">
          {t('系统还没有开启通行密钥登录，请联系管理员。')}
        </p>
      ) : null}

      {canAdd ? (
        <form onSubmit={onAdd} className="flex max-w-md gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            placeholder={t('起个名字，比如「我的手机」')}
            data-testid="passkey-name-input"
          />
          <Button type="submit" disabled={add.isPending} data-testid="passkey-add">
            {t('添加通行密钥')}
          </Button>
        </form>
      ) : null}

      {error ? (
        <Alert tone="danger" data-testid="passkey-error">
          {error}
        </Alert>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={t('删除通行密钥')}
        description={
          pendingDelete ? t('确定删除「{{name}}」吗？删掉之后就不能再用它登录了。', { name: pendingDelete.name }) : ''
        }
        error={deleteError}
        confirmText={t('删除')}
        destructive
        pending={del.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          try {
            await del.mutateAsync(pendingDelete.id)
            setPendingDelete(null)
          } catch (err) {
            setDeleteError(passkeyErrorMessage(err, t))
          }
        }}
      />
    </div>
  )
}
