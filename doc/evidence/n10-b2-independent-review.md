# N10-B2 固定六源元数据客户端独立首审（2026-10-10）

受审提交 `3a0ad289553b17cfc1975d9088723f9aa629aaa7`。只读核对新增 Kotlin、原有 HTTP 客户端及测试/日志；没有构建主目录、改原仓库、提交、推送或发布。检查时 N10 独立检出 HEAD 为受审提交且干净。

## 结论：OPEN，一项 P1 需批改后复审

**P1：Release ID 及 JSON 解析不满足本切片声明的严格元数据约束。** `android/app/src/main/java/com/xiaoxuhui/gamehub/UpstreamReleaseClient.kt:33,39` 以 `JSONObject(raw)` 解析并用 `getLong("id")`。`org.json` 的 `getLong` 可把数字字符串、非整数数值强制转换为 Long；直接 JSONObject 解析还会丢失重复键检查，并可能接受 UTF-8 解码替换字符。当前单测只拒绝 `id=0`，没有覆盖 `"id":"42"`、`42.5`、重复 `id` 或无效 UTF-8。即使本通道只用于提示，错误的正式 ID 也会进入状态发布；设计和报告明确称“严格正 ReleaseID”。建议直接复用已有 `StrictJson.parse(response.bytes, 1_000_000)` 与 `ResourcePolicy.integer(release,"id",1)`，对 `tag_name`/`html_url` 也用现有严格字符串取值，并补对应负例。批改后再接协调器/UI。

## 其它核查

- 注册表为六个字面固定游戏 ID→固定 `https://api.github.com/repos/xiaoxuhui/<repo>/releases/latest`，未知 ID 在创建连接前拒绝；大厅示范和红绿不在表内。`PublicReleaseHttp.metadata` 原有大厅路径限制仍在，上游只能通过固定 ID 入口查询；资产下载入口无变化，没有将源 APK/URL 交给安装器。
- `draft`/`prerelease` 用实际布尔 `false` 比较，错误仓库 `html_url`、非规范 `vX.Y.Z`、前导零及超过 Long 范围的版本均拒绝。404 转成“未找到正式发布，待检查”，与阿贝尔无正式 latest 的设计相符；版本比较按三个数字分量进行，不按字典序。
- 上游入口调用现有 `queryMetadata`，故共用 1 MB 实际字节预算、总 deadline、每次读的取消检查、无 HTTP 缓存、ETag/304 内存重验证与 403/429 退避；禁止自动重定向。新增测试直接覆盖固定 URL、未知源和 404；时限/取消/ETag 的底层逻辑未改，但 N10-B3 接入时仍需验证单项超时不妨碍其它源和两条更新通道。
- 归档报告的 JVM 87/0/0/0 和 Node 46/0 与日志相符；文档如实标本切片尚未接协调/UI、未发行。此审阅不把底层接口通过当整项 N10-B 或设备行为通过。

## P1 批改复审（2026-10-10）

修订提交 `3de9c8a29ca1455d459b317e65f2cf4936cf03b0` 已推送；复审时独立检出 HEAD 对应此提交且工作树干净。`UpstreamReleaseClient.kt` 生产查询现在把原始 `ByteArray` 直接交给 `StrictJson.parse(bytes, 1_000_000)`，以 `ResourcePolicy.integer(...,"id",1)` 和有界严格字符串读取 tag/URL；没有宽松 UTF-8 转换。测试增加字符串/小数 ID、坏 UTF-8、重复键、尾部 JSON、数组根和超预算负例。归档红日志为旧实现 3 项中 2 个断言失败，绿日志为全量 JVM 88 项、0 失败/错误/跳过；`git diff --check` 无问题。

**首审 P1 已闭合，复审结论 CLOSED。** 可进入 N10-B3 协调器/UI 集成；本结论不将六源查询、隔离、设备表现或新版本发行视为已完成。

## 实施者批改记录

- 先扩展受审代码回归：字符串/小数ID、坏UTF-8。执行 gradle -p android testDebugUnitTest --tests com.xiaoxuhui.gamehub.UpstreamReleaseClientTest --console=plain，实际3项2断言失败exit1，见 [批改红日志](n10-b2-review-red.log)。
- 复用 StrictJson.parse 原始ByteArray（1MB预算、严格UTF-8、重复键与尾部数据/深度校验），ResourcePolicy.integer正Long/Int、ResourcePolicy.string严格有界tag/URL；删除先宽松UTF-8解码的路径。
- 加重复键/尾部JSON/数组根/超字节预算负例，保留原六源/404/版本测试。
- 全量 gradle -p android testDebugUnitTest --console=plain exit0；XML汇总88项、0失败/错误/跳过，见 [批改绿日志](n10-b2-review-green.log)。原Node46项全绿仍保留，原生严格解析调用不改Node资源工具；git diff --check exit0。
- 尚待提交后独立复审CLOSED，未接入协调器/UI。
