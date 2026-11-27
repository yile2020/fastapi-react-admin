/**
 * 产品标识 —— **抄自 `apps/web/src/lib/brand.ts`，那边是唯一真相源。**
 * 抄而不是 import：`apps/mobile` 不在 `i18n ← ui ← platform ← apps/web` 那条箭头上。
 *
 * ⚠️ 那边改了名字，这里要跟着改，不会自己报错。
 *
 * 🔴 **版本号从 `app.json` 读**，不在这里手写 —— 原来手写过一份 `'v0.0.1'`，和 `app.json` 是同一个 App 里的两份真相源，
 * 改一处忘一处时设置页 / 登录页显示的版本和安装包对不上（web 那边 `hardcoded-version` 守的是同一件事）。
 * 正式包里那个值是发版时 `release.yml` 按 tag 写进去的（#460，同桌面端），仓库里提交的 `0.0.0-dev` 只是开发包的占位（带 `-dev` 的包启动时不自动检查更新）；
 * 检查更新拿它和 GitHub Release 上的清单比（`lib/use-app-update.ts`）。原来（#234）是手动单独编号，
 * 每个 Release 都带 APK 之后，手动编号漏改一次，已装的 App 就永远不提示更新。
 */
import appJson from '../../app.json'

export const BRAND = {
  /** 挂在榫卯标记旁边的那个名字。web 端侧边栏顶部、登录页角标读的是同一个 */
  wordmark: 'fastapi-react-admin',
  tagline: 'FastAPI + React 19 中后台底座',
  version: `v${appJson.expo.version}`,
  /** 应用显示名（launcher / 任务切换器）。`app.json` 的 `name` 也是它 */
  appName: '中后台',
  /** 底座里真正承重的那几样。登录页页脚会把它列出来 —— 和 web 端同一份 */
  stack: ['REACT 19', 'TANSTACK', 'SHADCN', 'TAILWIND', 'FASTAPI'],
} as const
