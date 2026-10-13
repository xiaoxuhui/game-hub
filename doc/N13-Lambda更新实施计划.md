# N13 Lambda 更新实施计划

- **Status**: PENDING
- **Approved**: 2026-10-13 用户要求启动服务并上传大厅
- **Type**: release

## A 来源适配 `[COMPLETE]`
- **Objective**：固定最新源码并保护旧存档。
- **Definition of Done**：适配/来源证明测试、真实浏览器旧→新→旧→新、162 上游检查、重复产物摘要与大厅检查通过。
- **Files**：migration/集成脚本、动态上游锁、Lambda examples、需求/设计/证据。

## B 候选与发布工具 `[COMPLETE]`
- **Objective**：固定contentCode3，独立生产并严格发行。
- **Definition of Done**：干净独立生产、四 ZIP 重复一致、其它3资源不变；发布器n13门禁与本地检查、开源审计完成。
- **Files**：动态来源锁、发行器、新测试、报告。

## C 公网发行 `[PENDING]`
- **Objective**：大厅联网获得当前Lambda资源，保留历史。
- **Definition of Done**：精确当前签名下一序列、完整公网历史/ZIP/新目录签名校验、正式宿主验收可行范围记录；主分支推送核对、本次分支清理。
- **Files**：发行证据、README/CHANGELOG、报告和计划。
