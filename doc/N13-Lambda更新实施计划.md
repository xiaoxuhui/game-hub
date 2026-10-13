# N13 Lambda 更新实施计划

- **Status**: VERIFIED
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

## C 公网发行 `[VERIFIED]`
- **Objective**：大厅联网获得当前Lambda资源，保留历史。
- **Definition of Done**：精确当前签名下一序列、完整公网历史/ZIP/新目录签名校验、正式宿主验收可行范围记录；主分支推送核对、本次分支清理。
- **Files**：发行证据、README/CHANGELOG、报告和计划。
- **Verification**：固定生产ff8ec076发行序列7成功；当前目录asset637160386、Lambda资源asset637155800。`resource-successor.mjs online`匿名下载验证7份签名目录/8累计引用ZIP通过；原其它3资源保持，旧序列6保留。源码及文档主分支已提交，远端最终SHA另行回读核对；本次功能分支在已合入后安全删除。见evidence/n13-lambda-release.md及n13-release/公开原始证据。本轮正式设备验收未执行，按范围如实记录。
