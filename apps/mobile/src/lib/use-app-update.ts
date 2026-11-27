/**
 * 检查新版本的 React 那一半（#461）：一份查询，启动时的提示和设置页那一行共用。
 *
 * - 只在 **Android** 上查：iOS 没有商店外分发，清单里也只有 APK
 * - 🔴 失败要看得见（硬纪律 9）：设置页那一行显示「检查失败」+ 点按重试。桌面端踩过反例：
 *   没配源时一直显示「已是最新版本」（`apps/desktop/src/main/updater.ts` 头注释），用户永远收不到更新也看不出坏了
 * - 启动提示（`components/update-prompt.tsx`）只在正式包里自动查；开发包的版本号是 `app.json` 里的占位值，
 *   自动查的话每次启动都弹「有新版」。设置页的手动检查开发包里也能点，用来看这条链路通不通
 */
import { useQuery } from '@tanstack/react-query'
import { Platform } from 'react-native'

import appJson from '../../app.json'
import { fetchManifest, judge, UPDATE_MANIFEST_URL } from './app-update'

/** 当前装着的版本。正式包里是发版时写进 `app.json` 的 tag 版本（`release.yml`），见 `lib/brand.ts` */
export const CURRENT_VERSION = appJson.expo.version

export const UPDATE_SUPPORTED = Platform.OS === 'android'

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
