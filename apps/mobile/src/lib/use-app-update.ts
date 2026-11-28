/**
 * 检查新版本的 React 那一半（#461）：一份查询，启动时的提示和设置页那一行共用。
 *
 * - 只在 **Android** 上查：iOS 没有商店外分发，清单里也只有 APK
 * - 🔴 失败要看得见（硬纪律 9）：设置页那一行显示「检查失败」+ 点按重试。桌面端踩过反例：
 *   没配源时一直显示「已是最新版本」（`apps/desktop/src/main/updater.ts` 头注释），用户永远收不到更新也看不出坏了
 * - 启动提示（`components/update-prompt.tsx`）只在发版打的正式包里自动查（`AUTO_CHECK`）；开发包 / 本地打的包 / 试跑包的版本号是
 *   `0.0.0-dev`，自动查的话每次启动都弹「有新版」，而它们是调试证书签的，正式包装不上去。设置页的手动检查哪种包都能点
 * - 设置页手动查到新版时，启动提示那个框也会弹出来（两边是同一份查询；「以后再说」过的版本不再弹）。刻意没拦：那是用户自己点的检查
 */
import { useQuery } from '@tanstack/react-query'
import { Platform } from 'react-native'

import appJson from '../../app.json'
import { fetchManifest, isDevVersion, judge, UPDATE_MANIFEST_URL } from './app-update'

/** 当前装着的版本。正式包里是发版时写进 `app.json` 的 tag 版本（`release.yml`），见 `lib/brand.ts` */
export const CURRENT_VERSION = appJson.expo.version

export const UPDATE_SUPPORTED = Platform.OS === 'android'

/** 启动时自动检查：安卓 · 正式模式（不是 Metro 开发包）· 版本号不带 `-dev`（不是本地 / 试跑打的包），理由见 `isDevVersion` */
export const AUTO_CHECK = UPDATE_SUPPORTED && !__DEV__ && !isDevVersion(CURRENT_VERSION)

export const appUpdateKey = ['app-update', UPDATE_MANIFEST_URL] as const

export function useAppUpdate({ auto }: { auto: boolean }) {
  return useQuery({
    queryKey: appUpdateKey,
    queryFn: async () => judge(CURRENT_VERSION, await fetchManifest((url, init) => fetch(url, init))),
    enabled: UPDATE_SUPPORTED && auto,
    // 一次启动查一次就够了：切回前台不重查（默认的 refetchOnWindowFocus 会让它每次回前台都打一次 GitHub）
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}
