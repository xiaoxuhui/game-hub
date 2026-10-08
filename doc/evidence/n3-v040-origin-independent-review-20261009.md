# N3 动态 origin 与统一桥基础切片独立审阅

- 受审提交：`e1efdf214a08f546722dd1e22f7dc451ef995bea`，核查时 `HEAD=origin/main`、主仓库干净。
- 审阅方式：只读核查生产源码、测试断言及归档日志；未在主仓库或四个原游戏仓库构建、修改，未读取密钥或用户存档。
- **结论：存在一项动态错误路径 P1，需批改复审后继续 N3 下一切片。** 动态 origin/缓存/Cookie 基础行为的设备证据成立，但已接通的动态 `openGame` 失败回调仍会误走 v1 store。

## 阻塞项

**[P1] 动态资源失败隔离误写四内置游戏存储。** `MainActivity.kt:543-548` 已从 `runtime.storeFor(game.id)` 打开动态会话并读取其失败 identity；但 `showError` 的 `MainActivity.kt:721-728` 仍调用 `resourceRuntime?.store?.blockFailedIdentity(failedGame, failedIdentity)`。v1 store 的 `GameResourceStore.kt:268-270` 要求内置 ID，动态 ID 在这里抛 `IllegalArgumentException`，发生在 `navigationSerial++`、`clearWebView()` 和错误面板之前，可能使 UI 回调崩溃或保留失败会话。`UpdateCoordinator.kt:240-255` 后续 `reportResourceFailure` 仍用 `resourceStore`（v1）执行持久隔离；即便前段错误被捕获，动态失败也不会进入动态状态区。

**复现与修法**：在隔离设备/测试中以已安装动态 `memory-demo` 会话触发实际必需资源 I/O 或校验失败并传入非 builtin identity；检查旧代码在 `showError` 误调用 v1 后中断，或协调器把隔离提交到错误 store。按游戏 ID 统一路由到 `runtime.storeFor(id)`；协调器在生产环境用动态 store、测试环境保留可注入的 v1 fixture store。门禁预约、后台持久隔离、失败时释放 busy 和 UI 错误关闭顺序均需回归。不要把未接发现 UI 当成不修该已接路径的理由。

## 已核对范围

1. `AssetAccessPolicy.kt:4-31` 旧四游戏仍用 `appassets.androidplatform.net`；合法动态 ID 派生独立子域，resolver 需精确 HTTPS host、无显式端口、无编码/反斜杠路径且路径在当前会话清单内。`GameContentResolver.kt:10-22` 要求动态游戏有同 ID、非空 root 的已安装 session；动态元数据限制实际资源路径。跨游戏 appassets 主框架跳转不会作为外部浏览器链接发出。
2. `MainActivity.kt:559-637,669-672,801-865` 从所选会话使用实际版本、来源和入口；恢复历史页需仍属当前 resolver 的注册 HTML，否则加载所选入口。旧四桥名保留，合法动态 ID 接 `GameHubBridge` 及已有 Blob 导出适配器。真正示范页面与系统 SAF 流程留下一切片，当前设备测试尚不证明其端到端成功。
3. `WebViewCookiePolicy.kt` 在 Activity 及每个检查/游戏 WebView 创建前禁用全局 Cookie，各 WebView 禁用第三方 Cookie。设备测试先原生写父域 Cookie 并确认兄弟子域可读取，再禁用并确认两个动态域与旧 Light 域的 DOM Cookie 读写为空；同名 localStorage/IndexedDB key 在三个 origin 分别写入并由新 WebView 读回不同值。测试清理只作用于 fixture key、数据库和测试 Cookie。
4. `ResourceCacheGuard.kt` 在当前 origin 检查 Service Worker/CacheStorage；已登记响应可删除，未知缓存保留。动态未知缓存返回 `canPlay=false`，旧 v1 路径仍用 `strict=false` 且不改变既有可玩门禁。设备测试覆盖已知缓存删除、未知缓存及存档标记保留、动态拒绝进入，旧四 WebView 用例含真实 Light/SW 代理和伪造检查页拒绝。
5. 归档显示独立 JVM 77/0/0/0（38 秒），实际 Chromium 设备 `DynamicOriginWebViewTest` 2 项与旧 `ResourceWebViewTest` 4 项合计 6 项通过（5.232 秒）；开发候选 APK 与测试 APK 是同发行证书 `44e92…`、目标 code4/0.4.0。`git diff --check` 通过。候选使用上一基底素材清单，文档没有把它声称为最终干净源码绑定 APK。

## 下一切片边界

完整示范游戏 UI、SAF 导出导入、动态 Service Worker 故障、移除重装、旧四五页实际存档回归，以及动态发现/注册 UI 仍待后续 N3/N4；本审阅没有把这些未实现事项当作当前基础切片的阻塞。用户新增两游戏打包与发布后临时目录清理待办已记录，不应在本切片提前清理。

## P1 批改后独立复审闭环

- 批改提交：`01d7478a84c787f31efad642614fabca7160c7df`；核查时 `HEAD=origin/main`，主仓库干净。`MainActivity.kt:724` 现在同步调用 `resourceRuntime.storeFor(failedGame).blockFailedIdentity`；`UpdateCoordinator.kt:248-249` 对合法动态 ID 用 `runtime.dynamicStore`，四旧 ID 仍用原 `resourceStore`，保留旧测试注入语义。串行 gate 的预约、finally 释放和旧四本地操作路径未改变。
- 新真实设备负例 `DynamicErrorDeviceTest` 用仅测试的合成会话模拟验证后入口文件丢失，经过生产 MainActivity、resolver、真实 WebView HTTP 错误回调。未修复同证书候选的归档日志出现 `GameResourceStore.blockFailedIdentity → MainActivity.showError` 崩溃；尽管 `INSTRUMENTATION_CODE: 0`，审阅按 `Process crashed` 判失败。修复候选同一用例确认 session 关闭、`webView=null`、`loadFailed=true`、错误面板存在；加两项动态 origin 与四项旧 WebView 共 7 项通过（7.99 秒）。
- JVM 新用例以即时签名 ZIP 测试首个动态 code1：同步阻止及持久隔离后重建 store 仍 pinned/quarantine1，拒绝打开；明确恢复/重试1后重装并安全打开。全量强制构建 78 项通过、0 失败/错误/跳过，98 Gradle 任务实际执行、55 秒，lint 0 错误（16 告警）；`git diff --check` 通过。修复开发 APK/仪器包签名日志为固定发行证书，均是独立检出中间候选。
- **结论：本切片 P1 已闭环，N3 origin/统一桥基础切片放行进入后续 N3。** 设备负例使用合成会话，不证明真实签名 ZIP 安装；协调器对真实动态安装状态的异步持久提交、完整示范游戏、SAF、动态注册 UI 等仍须后续切片实际验证。未把本次中间 APK 作为最终发行候选。
