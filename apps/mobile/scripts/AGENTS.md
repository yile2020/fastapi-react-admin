# apps/mobile/scripts —— 起服务 · 打包 · 连设备

> 这份文件是 [`apps/mobile` 分册](../AGENTS.md) 的**子分册**，Claude Code 读到本目录下的
> 文件时才把它加载进上下文（惰性加载）。跨模块的硬纪律只在根 `CLAUDE.md` 里有一份；
> **新增结论请追加到离代码最近的那一份**。

```
dev.mjs   `pnpm mobile:dev` —— 挑一个能连的地址 · adb reverse · 探活后端
apk.mjs   `pnpm --filter @admin/mobile apk` —— 打 release APK（流程只跑到一半）
```

这两个脚本存在的理由是一样的：**Expo 官方那条路在 WSL 里都断了一截**，而断的地方不报错。下面每一条都是实测出来的。

## 打 APK：`pnpm --filter @admin/mobile apk`（流程跑到一半，见下）

```bash
pnpm --filter @admin/mobile apk     # = node scripts/apk.mjs
```

### 🔴 原生工程重建命令不能叫 `prebuild`（#321）

普通构建原本会先清空 android 原生目录，再导出 JS；签名文件和手工 Gradle 配置
随之丢失，构建却仍然成功。原因是 pnpm 把同名脚本自动当成 build 的前置钩子。
现在重建只通过 `pnpm --filter @admin/mobile native:prebuild` 显式执行。
APK 脚本仍在原生目录缺失时直接调用 Expo，无需经过这个带 `--clean` 的重建入口。

实测（pnpm 11.21.0，使用仓库实际脚本清单、用记录桩代替 Expo）：旧清单的 build
依次运行 `prebuild --platform android --clean` 和 export，标记文件被删除；改名后
只运行 export，标记文件保留。显式执行新命令仍会调用原生重建。未执行真实 APK 编译。

⚠️ **2026-09-02 这条只验到「原生模块逐个编 .aar」那一步就按用户要求停了**，
没有产出过一个真的 APK。下面三条是这一轮**实测出来的**，不是推测。

### ✅ `expo prebuild` 在 pnpm 隔离布局下能过

这是挂了很久的一个未知项：分册里一直写着「一旦需要 prebuild 就得评估
`nodeLinker: hoisted` 的代价」。**实测不需要** —— `expo prebuild --platform android`
一次通过，autolinking 正常。那个整仓开关（会连带影响 web 与 desktop 的依赖隔离）
的成本**不用付**。

### 🔴 JVM 不认 `http_proxy` 环境变量

这台机器上有 `http_proxy=http://172.17.96.1:18080`（指向 Windows 宿主）。
**`curl` 认这些环境变量，JVM 不认** —— Java 只看 `-Dhttp.proxyHost` 那类系统属性。

于是 gradle wrapper 去直连，10 秒超时：

    Downloading https://…/gradle-9.3.1-bin.zip failed: timeout (10000ms)

**一个字不提代理**，而同一个 URL `curl` 是 200 —— 看着像「gradle 的服务器挂了」。
我据此误判成「307 跳转被墙」、换了镜像，照样超时。

`scripts/apk.mjs` 现在把 shell 的代理翻译成 JVM 系统属性，**两处都要喂**：

| 喂给谁 | 怎么喂 | 为什么 |
|---|---|---|
| wrapper 那个 JVM | `GRADLE_OPTS` | 它负责下载 gradle 发行版 |
| gradle **daemon** | `android/gradle.properties` 的 `systemProp.*` | daemon 是**另一个进程**，`GRADLE_OPTS` 管不到它；Maven 依赖解析在它里面跑 |

⚠️ `no_proxy` 也要翻译：Java 的 `nonProxyHosts` 用 `|` 分隔、`*` 通配，
和 shell 的逗号分隔不一样。

### 🔴 `babel-preset-expo` 必须显式声明，否则**只有打包会炸**

`babel.config.js` 写着 `presets: ['babel-preset-expo']`，而 babel 是
**相对配置文件所在目录**解析预设的 —— pnpm 隔离布局下 `apps/mobile/node_modules`
里根本没有这个包（它只在 store 里）。

**`expo export` 一路都是绿的**（验了十几次）：Expo CLI 从**自己的位置**解析
transformer，在 store 里看得见。gradle 的 `createBundleReleaseJsAndAssets`
走的是另一条路径、解析起点不同，就炸了 —— 而且是**跑了 19 分钟原生编译之后**
才炸在最后那个 JS 打包步骤上：

    Failed to construct transformer: Error: Cannot find module 'babel-preset-expo'

和根 `CLAUDE.md`「结构」一节那条硬纪律同一个物种（`apps/web` 漏声明
`@admin/platform`）：**用到什么就在 `package.json` 里声明什么**，
别指望「别人顺带装上了」。

### 其他

- android 原生目录和 `local.properties` 都是 gitignore 的（CNG：原生工程可再生）。
  所以 gradle 镜像、代理、SDK 路径这些**只能在 `scripts/apk.mjs` 里每次重写** ——
  改完提交不进版本库，下一次 `prebuild --clean` 就回到原样
- `release` 用的是模板自带的 **debug keystore**，所以能直接出可安装的包。
  🔴 真发版用 CI 那条路（下一节），它会用正式证书重签；本地这个脚本出的包只给自己装着试
- 🔴 `EXPO_PUBLIC_API_BASE` 要在打包时显式给成生产地址。它是**构建期替换的
  字符串**，不给就是 dev 的 `http://127.0.0.1:8088` —— 装到手机上第一个请求
  就连不上，而报错只说「连不上服务器」。（App 里能改，见
  [`src/app/` 分册](../src/app/AGENTS.md) 的设置一节，但一个装上就连不通的包不该发出去）
- `app.json` 里 `android.edgeToEdgeEnabled` 已删：Android 16 起 edge-to-edge
  是强制的，那个键被 Expo 废弃了，prebuild 会警告

## 发版：GitHub Release 上的 APK（#460）

打 `v*` tag 时 `.github/workflows/release.yml` 的 `android` job 出 `admin-mobile-<版本>.apk` 和更新清单
`latest-android.json`，和桌面安装包进同一个草稿 Release。App 的「检查更新」读这份清单（#461，`src/lib/app-update.ts`）。

| 步骤 | 为什么这么做 |
|---|---|
| 版本号取自 tag，`scripts/mobile-version.mjs` 写进 `app.json`（不提交） | 同桌面端。原来（#234）手动单独编号，每个 Release 都带 APK 之后漏改一次，已装的 App 就永远不提示更新 |
| `versionCode` = major·1000000 + minor·1000 + patch | 必须一路递增：比已装的小，系统拒绝覆盖安装，只说「应用未安装」 |
| prebuild → `assembleRelease`（只出 arm64-v8a / armeabi-v7a） | x86 只有模拟器用，四个架构全带安装包大一倍 |
| 🔴 正式 tag 用正式证书 `apksigner` 重签，缺 secret 直接红 | 模板配的是调试证书，那份是公开的（谁都能签一个「升级包」）；以后再换正式证书，已装的用户得先卸载才能升级 |
| 清单**最后**传 | 同桌面端 `latest*.yml`：先落地的话那几秒里 App 读到新版、点下载拿到 404 |
| 试跑（Run workflow）出调试签名的包，作为 artifact | 证书只给过了闸门的 tag 构建（同桌面端，`release-workflow.test.mjs` 核对接线） |

**证书只生成一次**（JDK 自带 `keytool`，在自己电脑上跑，别在 CI 里生成）：

```bash
keytool -genkeypair -v -keystore fra-release.jks -alias fra -keyalg RSA -keysize 4096 -validity 36500
base64 -w0 fra-release.jks > fra-release.jks.b64     # macOS：base64 -i fra-release.jks
```

仓库 Settings → Secrets → Actions 里配四个：`ANDROID_KEYSTORE_BASE64`（上面那个 .b64 的内容）·
`ANDROID_KEYSTORE_PASSWORD` · `ANDROID_KEY_ALIAS`（上面是 `fra`）· `ANDROID_KEY_PASSWORD`。
🔴 **`fra-release.jks` 和两个密码另外备份**（密码管理器 + 离线一份）：丢了就再也发不出能覆盖安装的升级包，
所有用户都得卸载重装；也别提交进仓库。

两个可选的仓库变量（Settings → Variables）：`MOBILE_API_BASE`（App 的默认后端，默认 `https://fra.wubunan.com`）·
`MOBILE_UPDATE_MANIFEST_URL`（清单地址，默认是**跑流水线的那个仓库**的 `releases/latest/download/latest-android.json`，fork 不会去查上游）。
国内 / 内网要自己托管时：把 Release 里的 APK 和 `latest-android.json` **两个文件原样**放到同一个目录，变量指向那个清单 ——
清单里 `apk` 写的是文件名，App 按清单所在目录解析。

🔴 **正式包装到 x86_64 模拟器上一启动就闪退，不是包坏了。** 包里只有 ARM 两种架构（刻意的，见上表），
x86_64 模拟器靠 ARM 转译跑它，而 React Native 的 SoLoader 在转译环境里找不到原生库：
`SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so`（它去 `base.apk!/lib/x86_64` 里找）。
真 ARM 手机不走这条路。要在 x86 模拟器上试正式包，就本地打一个带 x86_64 的（移动端 E2E 那条 workflow 就是只出 x86_64 的包给模拟器）；
发版的架构不为模拟器改（2026-11-27 用户定的）。

**实测证据**（2026-11-27）：Run workflow 试跑（版本 `0.0.0-dev`）产物用 `aapt2 dump badging` 看是 `versionCode='1' versionName='0.0.0-dev'`、
`native-code: 'arm64-v8a' 'armeabi-v7a'`、61.7 MB，清单的 size / sha256 和文件一致，Hermes 包里的清单地址是本仓库的
`releases/latest/download/…`；照 job 里同样的命令用临时证书重签，证书从 `CN=Android Debug` 变成临时证书、v2 / v3 校验通过。
装到 Windows 侧的 x86_64 模拟器（API 37）就是上面那个闪退。

⚠️ **没验的**：真 tag 还没打过（正式证书、传进草稿 Release、清单最后传）；
装到真手机上「旧版 → 提示 → 下载 → 覆盖安装」整条没走过。

## 设备：用**宿主机（Windows）侧**的 Expo Go，不要在 WSL 里跑模拟器

🔴 **WSL 内的 Android 模拟器这条路已经放弃了，不要再往回走。**
它能跑通（两条实测就是在上面跑的），但兼容性代价太高，实测踩到的：

| 症状 | 真因 |
|---|---|
| `libpulse.so.0: cannot open shared object file` | 系统缺库，`-no-audio` 不管用（链接期就死） |
| `ProbeKVM: This user doesn't have permissions` | 不在 `kvm` 组 → 只能 `-accel off`，开机 9 分钟 |
| `no Qt platform plugin could be initialized` | 非交互 shell 里 `DISPLAY` 是空的；设了又只有 `xcb` 插件、没有 `wayland` |
| `screencap` 超时 / 画面全黑 | 软件 GPU 下 SurfaceFlinger 僵死，换 `-gpu guest` 也一样 |
| 装的 App 每次开机都没了 | AVD 的 `disk.dataPartition.path = <temp>`，数据分区是临时的 |
| `pm` / `dumpsys` 返回**空输出**而不是报错 | 机器太慢，「没装」和「服务还没起」长得一模一样 |

每一条都能修，但加起来是一条**长期不稳的验证链路**，而且和被测代码毫无关系。

### 两条外部路径

`scripts/dev.mjs` 会按情况打印**一个**地址，照着填就行。

**① 宿主机（Windows）上的模拟器 —— 现在就能用**

```bash
pnpm --filter api dev:host        # 🔴 后端要绑 0.0.0.0，不是默认的 dev
pnpm mobile:dev                   # 打印 exp://<WSL的eth0>:8800
```

地址用 **WSL 自己的 eth0 地址**（脚本自动探），Windows 侧的模拟器能直接路由到 ——
AVD 是 NAT 在 Windows 后面的，由 Windows 替它路由到 `vEthernet (WSL)`。

🔴 **不要用 `10.0.2.2`，在这台机器上它不通。** 那个别名指向**宿主机的 loopback**，
要靠 WSL2 的 `localhostForwarding` 把 Windows 的 localhost 转进 WSL —— **实测没转**
（Windows 侧的适配器名是 `vEthernet (WSL (Hyper-V firewall))`，Hyper-V 防火墙介入了）。

症状很有迷惑性：Expo Go 报 `Packager is not running at http://10.0.2.2:8800`，
而同一时刻在 WSL 里 `curl 127.0.0.1:8800/status` 是好的 —— 看着像 Metro 没起来。

**最省事的判据**：在模拟器的浏览器里开这两个，看哪个出 `packager-status:running`：

```
http://10.0.2.2:8800/status
http://<WSL的eth0>:8800/status      # ip -4 addr show eth0 | grep -oP 'inet \K[\d.]+'
```

浏览器测比 Expo Go 干净 —— 只验网络，不掺 SDK / bundle / manifest。

🔴 **用 WSL 的 IP 就必须 `pnpm --filter api dev:host`。**
`pnpm --filter api dev` 绑的是 `127.0.0.1`，从 eth0 那个地址打不进去，而这个失败
**要到你在 App 里点登录时才现形**（`Network request failed`，看着像后端挂了）。
`scripts/dev.mjs` 现在会**主动探一下**后端在选定地址上通不通，直接把结论打出来 ——
不是打一句警告完事。

🔴 **而且打不通时它会把「真凶」指出来**（pid + 那条没有 `--host` 的命令行）。
这一步是**踩两次之后**补的，第二次的样子值得记下来：

| | |
|---|---|
| 症状 | App 里的报错**一字不变**（`Can't reach the server (http://<eth0>:8088)`），看起来像「按提示做了但没用」 |
| 真因 | 后端**确实重启过了**（pid 都换了），但重启时敲的还是 `pnpm dev` —— 手顺。那条脚本没有 `--host` |
| 为什么原来的提示不够 | 「它多半还绑在 127.0.0.1 上，换成 dev:host」是**通用建议**；而人已经以为自己换过了。「你现在这个进程就是那个毛病，pid 在这」才读得进去 |

判据：`ps` 里找 `uvicorn backend.main:app` 且命令行里**没有** `--host`。
⚠️ 找不到时照旧打通用建议 —— 后端压根没起时这里就是空的，那时候「没在跑」本身是答案。

⚠️ **重启要整体停 `pnpm dev` 再起**，不要单杀那个 pid：turbo 的 persistent 任务
被单杀会连带把整条 pipeline 拖崩（另一条实测）。

⚠️ 绑 `0.0.0.0` 在这里**不等于暴露到局域网** —— WSL2 是 NAT 的，只有 Windows 宿主
够得着（这正是当初否掉 mirrored / portproxy 想保住的性质）。

⚠️ eth0 地址**每次 WSL 重启都会变**，所以脚本每次现探，不要写死到任何配置里。

**换地址**：`MOBILE_HOST=<地址> pnpm mobile:dev`

| 地址 | 什么时候用 |
|---|---|
| WSL 的 eth0 地址 | **默认**，标准 AVD 走这个 |
| `10.0.2.2` | 换台机器 localhostForwarding 是好的，或第三方模拟器路由不到 WSL 网段 |
| `127.0.0.1` | USB 真机 / WSL 内设备，配 `adb reverse`。脚本检测到本地设备时自动选 |

不要用 Windows 的局域网地址（`ipconfig` 里 Wi-Fi 那个）—— Windows 上没有进程
监听 8800，要让它转发就得 `netsh portproxy`，那条已经被否掉了。

⚠️ **Expo Go 一个客户端只支持一个 SDK。** 工程是 SDK 57，手机/模拟器上装的
Expo Go 也得是 57（`https://expo.dev/go` 下，或用 `~/.expo/android-apk-cache/`
里 expo 自己下好的那份）。版本不对的表现是一屏「出错了」，不提 SDK 两个字。

### ❌ 局域网那三条解法仍然不能用

| 解法 | 为什么 |
|---|---|
| `expo start --tunnel`（ngrok） | 隧道端点被墙，`CommandError: failed to start tunnel`。所以**刻意不装 `@expo/ngrok`** |
| `.wslconfig` 的 `networkingMode=mirrored` | 🔴 会把 WSL 里监听 `0.0.0.0` 的服务一起暴露到局域网 —— 这台机器上跑着 `fba_mssql`（1433）和 `fba_redis`（6380）。**已被否掉，不要再提议** |
| `netsh interface portproxy` | 同理，显式往局域网开口。**已被否掉** |

上面两条外部路径都**不碰局域网**：走的都是「宿主机 loopback + WSL2 自带的
localhostForwarding」，只有这台 Windows 自己够得着。
