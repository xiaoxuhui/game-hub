# M4 资源 Release 客户端首切片独立审核（2026-10-08）

- 受审提交：`35307cac50c9fcfcae0e8529cecf7a8759269fed`。
- 范围：`PublicReleaseHttp`、`ResourceCatalogClient`、严格 JSON 数组、JVM 夹具及切片证据。只读检查提交；本轮未独立重跑 JVM/Android，也未触碰主仓库、四原仓库或密钥。
- **结论：安全归属与校验未见 P1，但客户端时限、无进展和退避默认值偏离已批准设计 §3.7；应先批改并复审，再把客户端作为 M4 协调器的基线。** 这是查询与下载客户端，尚无 MainActivity 接入、自动提醒、限流持久调度、网络策略或单下载协调，不能标整个 M4/自动更新完成。

## 已核对

- `ResourceCatalogClient.kt:13-49` 固定查询公开 `game-resources-v1` 的非 draft/prerelease Release；分页 URL 使用当前 releaseId，`next` 限制为同仓库、同 releaseId、连续页号及 `per_page=100`。累计资产字节和页数有界，重复 ID/名称拒绝。唯一目录资产的大小、SHA、上传状态与 RSA 签名/时效均核对，签名 payload 的 releaseId 和各 ZIP 的 ID、名称、大小、摘要、状态反绑同一资产表。
- `PublicReleaseHttp.kt:46-73` 使用资产 ID 构造 API URL，禁止自动跳转，逐跳通过既有 HTTPS 主机白名单；无凭据随跳转，实际字节由消费者控制。`ResourceCatalogClient.kt:51-63` 对资源 ZIP 再核对实际大小、SHA，并在下载失败或取消时删除唯一 `.part`。后续安装仍需调用 store 的验签、兼容及 ZIP 校验。
- 元数据单页读入由实际字节预算约束，ETag/304 只复用进程内缓存且 304 无缓存拒绝；403/429 形成带退避时间的异常。设备/服务端速率调度尚未实现，文档对此有明确限制。
- `doc/evidence/m4-client-final-tests.txt` 记录 JVM 35 项、失败 0、错误 0 和 `assembleDebug` 成功；新增五组测试覆盖归属、分页、缓存过期、字节预算、限流、下载 SHA/取消/部分文件清理。证据只支持本切片的 JVM/编译层结论。`git diff 35307ca^ 35307ca --check` 无输出。

## 非阻塞改进

1. **P2 满 100 条且无 `Link` 的分页证据。** `ResourceCatalogClient.kt:24-29` 把缺少 `next` 当作末页，即使该页恰为 100 条。正常 GitHub 分页会提供 `next`，但要在响应异常时严格证明完整资产表，可对满页无 `next` 再请求下一页并要求为空，或明确将该情形判为不确定；同时保留整 100 条合法末页。此项不影响已签名四个 ZIP 的逐项同 Release 归属与 SHA 校验，不阻挡协调器开发。

## 进入协调器前应批改

1. **P2 时限与默认退避不符合 `doc/设计文档-v0.3.0.md:42`。** `PublicReleaseHttp.kt:91` / `ResourceCatalogClient.kt:12,56` 当前元数据总预算 120 秒、资源下载 300 秒，设计要求每通道 30 秒、资源下载 10 分钟；`PublicReleaseHttp.kt:87` 无有效限流头默认 15 分钟，设计要求 1 小时。当前 `readTimeout=15000` 是单次读取 15 秒失败，与设计中的资源下载“无进展 30 秒取消”不是同一窗口。建议按设计改默认值并以可控时钟/流加边界测试，协调器不得允许手动检查绕过退避。
2. **P2 304 响应后的取消/期限复核。** `PublicReleaseHttp.kt:26-28` 在 `responseCode` 阻塞前检查一次，收到 304 后立即返回缓存；若取消或整轮期限在网络等待期间到达，会返回旧数据。建议在 304 返回前再调用 `check(deadline, cancelled)`，并由下一切片协调器用任务代际保护查询结果的消费。200 的 `bounded` 及 ZIP 下载路径已有后续检查。

进入下一切片时应保持查询、下载、安装串行化；持久遵守限流时间，分别处理 APK 与资源通道状态，并在取消、Activity 重建及网络变化时复核代际与部分文件清理。

## f195e227 修订复审（2026-10-09）

- 受审提交：`f195e227cf731877ecef4e6e26649418f333a254`。只读检查提交差异、JVM 夹具、证据日志及设计 §3.7；本轮没有独立重跑构建或设备测试。
- **判定：上一轮需批改的时限、退避、304 取消与满页无 Link 问题已闭合，可作为 M4 协调器开发基线。** `PublicReleaseHttp.deadline()` 现默认 30 秒，资源下载调用 600 秒；下载连接的单次读取超时设 30 秒，与“无进展 30 秒”窗口一致。无有效限流头默认退避 1 小时。元数据及资产请求均在 `responseCode` 返回后再次检查取消与总期限，含 304 缓存命中路径。
- `ResourceCatalogClient.kt:24-38` 遇到满 100 条且无 `next` 时，继续请求相同 releaseId 的固定下一页，直到短页；合法 100 条+空页能接受，隐藏在后页的重复资产会拒绝。显式 Link 的仓库、releaseId、页号限制仍保留。分页页数与累计字节预算仍适用。
- `ResourceCatalogClientTest.kt` 新增 304 等待中取消、无头默认退避、整 100 条末页及隐藏重复资产负例；`doc/evidence/m4-client-complete-pages-tests.txt` 记录 `assembleDebug` 与 `testDebugUnitTest` 成功，文档报告 JVM 36 项、零失败/错误。`git diff f195e22^ f195e22 --check` 无输出。
- 仍只是客户端切片：未接 MainActivity、持久限流、网络策略、单下载协调或生命周期，不能据此标 M4 VERIFIED。继续协调器时应对任务代际、跨进程退避和下载安装串行消费分别验证。未修改主仓库、四原仓库或密钥。
