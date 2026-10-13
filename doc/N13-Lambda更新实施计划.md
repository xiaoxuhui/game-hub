# N13 Lambda 更新实施计划

- **Status**: COMPLETE
- **Approved**: 2026-10-13 用户要求启动服务并上传大厅
- **Type**: release

## A 来源适配 `[VERIFIED]`
- **Objective**：固定最新源码并保护旧存档。
- **Definition of Done**：适配/来源证明测试、真实浏览器旧→新→旧→新、162 上游检查、重复产物摘要与大厅检查通过。
- **Files**：migration/集成脚本、动态上游锁、Lambda examples、需求/设计/证据。
- **Verification**：上游162、大厅85、两视口及存储不可用浏览器11项通过，最终重复适配三文件SHA相等；详见evidence/n13-preparation.md。

## B 候选与发布工具 `[VERIFIED]`
- **Objective**：固定contentCode3，独立生产并严格发行。
- **Definition of Done**：干净独立生产、四 ZIP 重复一致、其它3资源不变；发布器n13门禁与本地检查、开源审计完成。
- **Files**：动态来源锁、发行器、新测试、报告。
- **Verification**：独立精确主分支ff8ec076两次资源构建/verify均通过，四ZIP及unsigned描述重复相等；其它3资源字节与描述未变。Lambda云端38406282183、修复浅检出后的Android38406745755均SUCCESS，失败复现见evidence/n13-ci-triage.md。

## C 公网发行 `[COMPLETE]`
- **Objective**：大厅联网获得当前Lambda资源，保留历史。
- **Definition of Done**：精确当前签名下一序列、完整公网历史/ZIP/新目录签名校验、正式宿主验收可行范围记录；主分支推送核对、本次分支清理。
- **Files**：发行证据、README/CHANGELOG、报告和计划。
- **Verification**：发行代码和门禁已提交；当前执行固定生产提交、上一目录摘要、序列7与独立证据目录的生产发行。公网最终结果核验后再标VERIFIED。本轮正式设备验收未执行，按范围如实记录。
