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
