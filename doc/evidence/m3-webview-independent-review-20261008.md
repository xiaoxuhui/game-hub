# M3 WebView 接入切片独立审核（2026-10-08）

- 受审提交：`e73ad6d267edd8301652cf85a47983e86bd2e3e5`
- 范围：稳定 origin 的内置/下载资源 resolver、会话绑定、Service Worker 拦截、缓存盘点、MainActivity 生命周期，以及内置版本和 CI 元数据同步。
- 结论：**可继续同一 M3 阶段的针对性批改与验收，但当前切片有一项 P1 阻止把 WebView 接入标为安全完成，更不能进入发行。** 仓库证据记录独立 JVM 30、Node 22、两项真实 WebView 仪器通过；这些实测仅覆盖内置光学页、已登记缓存与一个真实 light 存档键，不覆盖旧 Service Worker 控制器、四游戏完整存档、下载版动态资源或进程死亡。

## 发现

1. **P1 未解除代理时内置页仍被放行。** `MainActivity.kt:384-392` 在 `ResourceCacheGuard` 返回 false 后只拦截 `session.game != null`，内置版继续启动。失败可能表示旧同 origin Service Worker 仍控制页面，或未知 CacheStorage 无法安全处理；它可以直接从缓存响应脚本而绕过 `GameContentResolver`/`ServiceWorkerClientCompat` 网络拦截，因而内置页也不一定是已验证字节。建议返回结构化“SW 已无控制 / 可安全游玩旧版 / 可激活新版 / 原因”，任何相关 SW 检查或解除失败时对全部游戏 fail closed；未知 CacheStorage 不删除，只有确认无相关 SW 且当前游戏 JS 不会主动读取该缓存时才允许旧版。注入实际控制游戏路径的 SW/缓存，销毁旧受控 WebView、unregister 后用新视图断言无 controller 且资源确来自 resolver。不要清空 localStorage/IndexedDB。
2. **P2 已登记的非 JS/CSS/HTML 资源失败未触发恢复错误。** `MainActivity.kt:516-523` 只将已登记 `.js/.css/.html` 的 4xx 当作故障，已登记 `.json/.png/.svg` 等仅记日志，页面仍可能隐藏加载层。签名文件清单并未标记这些文件为可选；会话期间被删或读取失败应提示故障并提供恢复路径。建议对所有已登记资源失败统一处理，或在协议中显式区分可选文件，并加 JSON/图片缺失的 WebView 负例。
3. **P2 完整 M3 恢复验收待补。** `MainActivity.kt` 当前错误面板只有“返回大厅”，已激活下载版页面/子资源出错没有可见的“恢复上一个/内置版本”入口及失败编号隔离。`GameResourceStore` 有对应基础能力，但尚未接 UI。此切片不能据两项仪器通过声称 U35/U36 已完成；后续需四游戏真实存档 old→new→old、原生导入导出、下载版 Worker/关卡页及故障恢复证据。

## 已核对的正向边界

- `GameContentResolver` 用当前不可变 `ResourceSession` 的文件清单和根目录响应，不逐请求读取可变 active 指针；`AssetAccessPolicy` 限制 HTTPS 固定域名、无端口/编码路径、游戏专属登记路径，跨游戏或外网子资源返回 404。WebView 设 `LOAD_NO_CACHE`、响应 `no-store`，会话关闭时通过引用计数释放。
- `ResourceCacheGuard` 只删登记资源 URL 的 CacheStorage 请求，未知缓存保留并返回失败；测试显示实际 light 存档键在该操作后仍存在。全局 Service Worker 拦截器不持有 Activity，导航序号阻止旧异步回调把旧 session 绑定到新页面；具体旧 SW 控制器场景仍缺设备证明。
- bundle manifest 为四源增加内置 contentCode/protocol/storageContract，Android 版本 code3/name0.3.0 与 package.json、常规 CI、候选 CI 和升级夹具同步；`verify_apk.py` 更新精确源数组检查。此为候选版本，未发布。

对目标提交执行 `git diff e73ad6d^ e73ad6d --check` 无输出。审阅期间主仓库开始出现并行未提交批改，本报告仅评价上述已提交 SHA，不把后续工作树内容混入结论；未修改主仓库、四原仓库或任何密钥。

## fc9eb502 修订提交复审（2026-10-08）

- 受审提交：`fc9eb50223b10f4c2913492d5d440accc1938ed9`。复核提交代码、9 项仪器测试成功日志和 `doc/evidence/m3-webview-20261008.md`；本轮没有独立重跑设备测试。
- **结论：原 P1/P2 的目标行为已落实，但发现新的 P1 信任边界缺陷，暂不建议进入 M4 代码切片。** M3 也未标完整 VERIFIED；恢复 UI、原生文件导入导出和进程死亡仍待后续验收。

### 新阻塞

1. **P1 缓存检查页可被旧根作用域 Service Worker 伪造并给出假通过。** `ResourceCacheGuard.kt:44-49` 设置了可信的 `shouldInterceptRequest` 响应，但没有记录主框架请求确实到达该拦截器。旧 SW 可以从 CacheStorage 直接响应 `/runtime/cache-check`，页面内预置 `window.__gameHubCacheStarted=true` 和 `window.__gameHubCacheCheck={ok:true,safe:true}`；注入脚本在 `ResourceCacheGuard.kt:56` 直接返回，原生轮询在 `ResourceCacheGuard.kt:32-39` 接受该结果，未执行注销、controller 核验或缓存检查。现有 `ResourceWebViewTest.kt:99-145` 的真实 SW 夹具仅缓存游戏入口，检查页仍走原生拦截，因此不覆盖这一情形。建议原生守卫在接受 JS 结果前，要求本次检查页**主框架**响应命中过可信拦截器；未命中则 fail closed。增加缓存伪检查页的根作用域 SW 负例，断言所有游戏被阻止，且不会把 `ok/safe` 伪结果用于激活。

### 已闭合与边界

- 原 P1：`MainActivity.kt:384-386` 现在按 `canPlay` 拦截全部游戏，`ResourceCacheGuard.kt:63-73` 先注销相关注册并检查 controller；首次受控时销毁检查视图，重建后仍受控或超时会停止。未知缓存仅在这一路径确认无代理后返回 `canActivate=false, canPlay=true`，旧资源可用且不删除未知数据。真实 SW 夹具先证明 `OLD_PROXY` 命中，再在新 WebView 断言 controller 为 null 和实际 LightStorage 函数。
- 原 P2：`MainActivity.kt:516-523` 对所有已登记资源 4xx 统一显示加载错误，已去掉扩展名限制。
- 设备证据 `m3-final-device-tests.txt` 显示 connectedDebugAndroidTest 9/9、零失败/跳过及 BUILD SUCCESSFUL；文档将完整恢复 UI、桥接和进程死亡留待后续，没有把临时测试签名候选当作发行。该成功日志不证明上述伪检查页场景安全。

## 9a42d2a 可信检查页复审（2026-10-08）

- 受审提交：`9a42d2a9742415fe73fee99f389224e44d455f2d`。只读检查提交代码、真实 SW 测试及 `doc/evidence/m3-trusted-guard-final-tests.txt`；本轮未独立重跑模拟器。
- **判定：上一轮 P1 已闭合，可进入 M4 代码切片。** `ResourceCacheGuard.kt:46-55` 仅对精确检查 URL 且 `request.isForMainFrame` 的主文档请求设置原生 `AtomicBoolean`；没有该可信响应时，在执行或采信页面 JS 前返回 `canActivate=false, canPlay=false`。Worker 子请求与 iframe 即使请求相同 URL 也不能置位。
- `ResourceWebViewTest.kt:147-169` 用根 scope 的真实 SW 缓存伪造检查页，预置 `ok:true,safe:true`；测试确认激活和游玩均拒绝且原因指向旧代理。游戏 scope 的正例仍先命中 `OLD_PROXY`，之后新视图无 controller，实际 LightStorage 可用。设备日志显示 10/10、零失败/跳过、BUILD SUCCESSFUL in 1m 11s；`git diff 9a42d2a^ 9a42d2a --check` 无输出。
- 后续硬化建议（不阻挡 M4 切片）：可信标记目前按整个检查 WebView 保存；若出现第二次主框架导航，可在 `onPageStarted` 重置，并在 `onPageFinished` 校验精确 URL，使证明与当前导航周期绑定。现有伪页负例已覆盖本次 P1 的直接攻击路径。
- 本结论仅批准继续切片开发，不表示完整 M3/M6 或发行验收：恢复 UI、原生文件导入导出、进程死亡和同证书完整验证仍待执行。未修改主仓库、四原仓库或密钥。
