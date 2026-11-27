> **fastapi-react-admin** 的桌面客户端 —— 把 web 后台装进 Electron 外壳，
> 提供浏览器给不了的四件事：静默打印、本地硬件、凭据托管、自动更新。
> 后台本身（页面、权限、多页签）和浏览器版是同一份代码。

## 下哪个

| 平台 | 文件 | 说明 |
|---|---|---|
| Windows 10/11 x64 | `admin-desktop-<版本>-setup.exe` | NSIS 安装向导，**装到当前用户**（`%LOCALAPPDATA%\Programs`），不需要管理员 |
| macOS Apple Silicon | `...-arm64.dmg` | M1 及以后 |
| macOS Intel | `...-x64.dmg`（文件名不带 arm64） | |
| Linux x64 | `...-x86_64.AppImage` | `chmod +x` 后直接运行，不用装 |
| Android 手机 | `admin-mobile-<版本>.apk` | 手机 App（原生界面，不是网页套壳）。用浏览器下载后点开安装，首次要允许「安装未知应用」 |

`.blockmap`、`latest*.yml` 与 `latest-android.json` 是**自动更新 / 检查更新**用的，人不需要下载。

## 装完第一件事：填后端地址

首次启动会让你填**服务器地址**（如 `https://admin.example.com`）。它是**运行期配置**，
存在用户目录里 —— 所以同一个安装包可以连不同环境，不用为每个环境各打一版。

## 已知限制（都是刻意的取舍，不是漏做）

- 🔴 **桌面端的包都没有代码签名**（Android 的 APK 用正式证书签了名，不受下面这几条影响）。
  - Windows：SmartScreen 会拦一次 →「更多信息」→「仍要运行」
  - macOS：Gatekeeper 会说**「已损坏，应移到废纸篓」**。这不是包坏了，是没有公证：
    右键 →「打开」，或者 `xattr -dr com.apple.quarantine /Applications/Admin\ Desktop.app`
  - Linux：AppImage 不需要签名
  - 想去掉这些提示：Windows 侧有面向开源项目的免费证书方案（SignPath Foundation），
    macOS 侧没有免费路，需要 Apple Developer Program（$99/年）
- 🔴 **macOS 上的自动更新不工作**（未签名）。electron-updater 要校验运行中应用的代码签名，
  拿不到就拒绝安装更新，所以 macOS 版不自动检查。Windows 与 Linux(AppImage)：启动约 30 秒后检查一次、之后每 4 小时一次，
  有新版就在后台下载，**下次退出时**静默安装（不会在使用中弹重启）
- **读卡器等本地硬件是桩模式**：厂商的原生助手不在仓库里（那是现场的东西），
  所以这个包里没有。界面上相关功能会走模拟数据
- **打印**：Windows 上是真的静默打印；macOS/Linux 上打印链路能跑，但没有在真机标签机上验过

## 更新从哪来

默认读这个仓库的 Release。内网部署（客户出不去公网）可以在客户机的 `config.json` 里
填 `updateUrl`，指向自己的静态目录 —— **不用为内网单独打一版**。
不想让某台机器自动升级（要钉版本），在它的 `config.json` 里写 `"autoUpdate": false`。

## 手机 App

Android 正式包启动时读这个仓库最新正式版里的 `latest-android.json`，有新版就提示用浏览器下载、下载完点开覆盖安装
（设置 →「检查更新」也能手动查）。更新地址是**打包时**定的，装好之后不能改；要指向自己的服务器得用仓库变量
`MOBILE_UPDATE_MANIFEST_URL` 重新打包。iOS 暂无安装包。

---
