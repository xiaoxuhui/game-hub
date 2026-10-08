# M4 应用范围协调器首切片独立审核（2026-10-09）

- 受审提交：`a83e77bc94694b39e61db3ee698d1ed366f344d5`。
- 只读核对 `UpdateCoordinator`、`UpdatePreferences`、APK 共用 HTTP、Manifest/CI 及 Android 仪器证据；未在主目录构建，未修改主仓库、四原仓库或密钥。
- **结论：单例、互斥和两通道持久退避的基础合理，但有一项 P2 策略缺口，应在将协调器接入 MainActivity 前批改。** 本提交尚未接线，不能标 M4 VERIFIED。

## 需要批改

1. **P2 过期签名目录仍会触发新 ZIP 下载。** `UpdateCoordinator.kt:128-150` 的 `automaticNext()` 和 `downloadResource()` 直接使用内存 `offer`，未在占用下载槽或发起网络前重新验证目录时效。进程长驻到目录过期后，返回大厅、网络变化或设置更改可启动旧 offer 的自动下载；`GameResourceStore.install` 之后会拒绝过期目录，但流量和临时文件已产生，违反 `doc/设计文档-v0.3.0.md:85`“已接受目录过期时不自动下载新包”。建议在统一 `startResource` 入口、`gate.beginDownload` 之前核对 `current.catalog.requireFresh(now)`，过期时保留旧版、清除或停用本轮 offer 并提示重新查询；手动入口同样不能把过期目录用于安装。用可控时钟测试长驻进程跨过 `expiresAt` 后的自动和手动行为。

## 已核对的正向边界

- `UpdateCoordinator.kt:20-40,193-196` 只持有 application context，用单进程单例、单线程 worker 和同一 `UpdateTaskGate`；`check`、两类下载的预留与完成均通过 `stateLock` + 门禁互斥。查询尚未结束时 `gate.checking=true`，因此 `offer` 和 `state.resources` 相邻两次写入之间，网络回调不能启动旧游戏资产下载。任务取消仍占槽至下载/安装及文件清理后的 `finish(token)`；旧 token 不能释放新任务。
- 网络回调根据当前 active network 的 `VALIDATED`、Wi-Fi 与非计费能力更新门禁；入后台、进入游戏、断网或网络转计费均由门禁持续取消，快速恢复不会把已取消 token 变回有效。资源每轮 `id/identity` 仅自动尝试一次；手动操作可显式重试。APK 下载只能手动触发，返回已验文件等待用户安装确认。
- APK/资源查询分别核对自己的限流截止时间；`UpdatePreferences` 用同步 SharedPreferences `commit` 保存两个通道和设置，失败时门禁当前进程内的限制仍在。HTTP 保持匿名固定 API/资产 ID，APK 复用已审阅的 HTTPS 重定向和实际字节检查，签名仍对比当前已安装 APK 证书。
- Android 仪器两项确认真实 SharedPreferences 适配器重建后恢复退避/设置，以及取消订阅的 callback 不再投递；日志显示 connectedDebugAndroidTest 2 项通过、BUILD SUCCESSFUL。此证据不等于真实进程死亡、Activity 旋转/后台、联网下载或 UI 的端到端测试。

## 后续验证与轻微问题

- `UpdateCoordinator.kt:64-65` 在持有 `stateLock` 时调用外部订阅者。当前测试仅用轻量回调；接入 Activity 时宜先确认订阅有效，再在锁外调用，避免 UI 回调阻塞工作线程状态发布。Activity 实际解绑和旋转需设备测试。
- CI 的权限白名单已加入 `ACCESS_NETWORK_STATE`，Manifest 也已声明；发行候选 CI 目前仅正向要求 `INTERNET`/`REQUEST_INSTALL_PACKAGES`，可增加 `ACCESS_NETWORK_STATE` 必备断言，防止未来误删导致运行时网络状态读取失败。
- `git diff a83e77b^ a83e77b --check` 对归档的 `doc/evidence/m4-coordinator-final-tests.txt:2` 报一处行尾空格；仅证据格式问题，不影响代码或测试结论。仓库文档如实保持 M4 PENDING。

## 0527517 批改复审（2026-10-09）

- 受审提交：`052751740055f0d32e4d5a7f92b0e5aa4586b750`。只读检查新门禁、JVM 负例、权限断言和构建日志；未独立重跑构建。
- **结论：原 P2 已闭合，当前协调器切片无阻塞，可以接入 MainActivity。** `ResourceOffer.requireDownload()` 在占用下载槽之前检查目录时效与游戏完整身份；`UpdateCoordinator.startResource()` 是自动、手动两路的共同入口，拒绝时不占用门禁并提示重查。`GameResourceStore.install` 仍在安装时重新验签和检查时效，作为后续防线。
- 新测试用可控时间覆盖到期前、到期点、异常时钟、资产 ID 改变，以及自动/手动拒绝后 `gate.busy()==false`；日志记录 JVM 42 项、失败/错误 0，`assembleDebug` 成功。候选 CI 和 Node 清单测试已正向要求 `ACCESS_NETWORK_STATE`；旧日志行尾空格已清理，`git diff 0527517^ 0527517 --check` 无输出。
- 非阻塞精度提醒：测试里通过 `offer.copy(catalog=...)` 模拟“新证明”只验证纯门禁接受新时效，不是签名目录重新验签的证据；真实查询与安装的签名验证由既有路径覆盖。工作线程若在预留后排队至目录到期，可能仍读取 ZIP，但安装时的时效复核会拒绝；若要严格避免这部分流量，可在工作线程发起 HTTP 前再调用 `requireDownload()`。
- M4 的 MainActivity 接线、真实旋转/后台/网络变化、进程死亡、自动提醒与安装确认仍待后续验收；本结论不标整个阶段 VERIFIED。
