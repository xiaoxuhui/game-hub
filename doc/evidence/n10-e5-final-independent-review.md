# N10-E5 最终发行前实测独立审阅（2026-10-11）

受审提交：`848d1d12ed89359eea1c5e513cb28d0747ffcce1`。审阅范围为最终验收报告、归档日志、正式设备测试控制器及本地固定 APK 身份。仅只读；未调用线上 API、运行脚本或设备测试、读取凭证/原始存档、提交或发布。受审 HEAD 干净，`git show --check` 无错误。

## 结论

**CLOSED：最终正式设备发行前验收通过，可以进入已审发行器的实际执行阶段。** 此结论不表示 v0.4.1 已发布，也不代替发行后匿名 API、标签、APK 全字节核验和后续限定范围清理。

## 可复核证据

- 正式 APK 本地复算为 **2,654,159 字节**、SHA-256 `9f57c90af42efea54e4e079d637d964346a78e7e880493eac7887f9aaac323da`，与报告固定候选一致；`e4-release-intent.json` 和 `e4-release-ready.json` 在审阅时均不存在，发行器尚未运行。构建源固定 `fc9da9be6a238018d86f2085facd5b8085e68cf8`，E4/E5a 既有独立审阅记录对同证书升级、五页面存档、启动/手动查询、冷离线与 future 预验设定了清楚边界。
- 严格绿跑 `e4-online-to-offline.log` 为 **10.693 秒、OK (1 test)**。`e4-online-before-disconnect.log` 在外部断网前记录 `WAITING_FOR_OWN_DEVICE_DISCONNECT`；`e4-offline-control.log` 随后记录仅 own AVD 的 wifi/data 关闭、`wifi_on=0`、`Active default network: none`，在 runner 结束后 finally 恢复为 `wifi_on=1`。`e4-offline-actual-sources.log` 在恢复前记录 production offline PASS，以及五个正式源历史版本/时间、Abel 无正式发布的 null 值与全部六项明确离线 issue。四份公开日志与本地私有原始日志在 CRLF/末尾空白规范化后内容一致，不误称逐字节相同。
- `ProductionHallUpdateDeviceTest` 在发出 WAITING 前要求真实五个正式发布版本的 `checkedAt >= startedAt`、六源结果、Abel 404、非空动态目录 offer；固定迭代顺序中 Abel 位于最后一个 Lambda 正式源之前。外部断网后测试逐项比较断网前后六源 `publication`、`checkedAt` 原值（包括 Abel 的 null），要求各自显式离线历史 issue、三个 remembered 标志及两类 offer 清空。因而“保留六项”是保留六项各自原值，不表示 Abel 曾有正式版本或非空时间戳。
- 先前匿名配额耗尽 FAIL1 和 60 秒 helper 提前恢复网络的竞态绿日志仍保留且未计作最终门禁。最终 helper 采用经 E5b 独立审阅的 120 秒等待，实际在断网状态等 runner 正常完成后才 finally 恢复，消除了该次计数的先前竞态。
- Lambda 旧 checkpoint 的归档 XML 可见“已恢复保存时的状态”、`1` 步及 `λy.y`；截图是补充 UI 证据，报告没有将其加算为独立自动测试。

发行前仍须将本次 CLOSED 归档于精确已推送干净接受提交，按已审脚本生成与核实 release-ready，再执行固定 fc9 标签与草稿/资产检查。执行后须按已审匿名验证器复核正式发布与下载字节；任何未知结果保留现场只读核查。N10-F 清理未执行。
