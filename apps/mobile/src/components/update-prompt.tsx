/**
 * 启动时发现新版本就弹一次（#461）。挂在根 `_layout.tsx`、两棵路由树外面 —— 登录屏上也要看得到
 * （桌面端同理：终端机常停在登录页，见 `packages/platform/src/shell/desktop-update-prompt.tsx`）。
 *
 * - 只在 Android 的**正式包**里自动查，理由在 `lib/use-app-update.ts`
 * - 「以后再说」只管这一次启动（模块级记一笔），下次冷启动还会再问；设置页那一行一直能点
 * - 自动检查失败**不弹**：启动时弹一个「检查更新失败」打断用户不值当，失败在设置页那一行看得到（硬纪律 9 的位置在那儿）
 * - 「下载」交给系统浏览器：它下载完由系统安装器接手。应用内下载 + 调起安装要 `REQUEST_INSTALL_PACKAGES`
 *   权限和 FileProvider，#461 里列为不做
 */
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toast'
import { CURRENT_VERSION, UPDATE_SUPPORTED, useAppUpdate } from '@/lib/use-app-update'

/** 这次启动里点过「以后再说」的版本 —— 模块级，屏重挂不会让它再弹 */
const dismissed = new Set<string>()

export function openApkDownload(url: string, t: (key: string) => string) {
  Linking.openURL(url).catch(() => toast.error(t('打不开下载地址'), { description: url }))
}

export function formatSize(bytes: number | null): string | null {
  return bytes === null ? null : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function UpdatePrompt() {
  const { t } = useTranslation()
  const q = useAppUpdate({ auto: UPDATE_SUPPORTED && !__DEV__ })
  const latest = q.data?.kind === 'available' ? q.data.latest : null
  const [, rerender] = React.useReducer((n: number) => n + 1, 0)

  if (!latest || dismissed.has(latest.version)) return null

  const close = () => {
    dismissed.add(latest.version)
    rerender()
  }
  const size = formatSize(latest.size)

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && close()}
      title={t('发现新版本 v{{version}}', { version: latest.version })}
      // 大小拼进同一句：中文两句之间不能有空格，英文要有 —— 分成两个 key 拼接，总有一种语言是错的
      description={
        size
          ? t('当前是 v{{current}}，安装包 {{size}}。用浏览器下载，下载完点开安装，登录和设置都会保留。', { current: CURRENT_VERSION, size })
          : t('当前是 v{{current}}。用浏览器下载安装包，下载完点开安装，登录和设置都会保留。', { current: CURRENT_VERSION })
      }
      // ConfirmDialog 默认是 destructive（红色），那是给删除用的；下载是普通动作
      variant="default"
      confirmLabel={t('下载')}
      cancelLabel={t('以后再说')}
      onConfirm={() => {
        openApkDownload(latest.apkUrl, t)
        close()
      }}
      testID="update-prompt"
    />
  )
}
