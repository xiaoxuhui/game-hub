# N7 两游戏来源与实施规划独立审阅

日期：2026-10-09。受审提交 `9d2f75640381ca860195a3f8f2b419dceead4b8c`，`HEAD=origin/main`、大厅主仓库干净，`git show --check` 无格式错误。只读核对需求、设计、计划、N6 归档和两原游戏仓库；未构建、修改或发布。

## 需批改

1. **P1，冻结基线与当前原仓库状态须分开记。** `doc/evidence/n7-new-game-baselines.json` 记录开始时阿贝尔 `d58e2b1d06c3dfdf6cd25b65986c1d494759ed7f`、Lambda `11b0aef6dcac9a37abdc08cde25ea0efd1f8f6a2`，当时工作树干净。审阅时两个原仓库工作树仍干净，但 HEAD 已分别前进到 `c4290283b1109e13e37d6f696b83fefd3b7a6855`、`06dee48e0fe319cc72448fadf7ae9783cb441408`；两冻结提交均是现 HEAD 祖先，后续上游提交包含玩法/性能变化。`doc/N7-两新游戏接入需求与设计.md` 的 N7-U1 写“原六仓库SHA/完整工作树状态不改变”，已不再是可满足的事实条件。修订应保留带时间戳原始快照，补记当前只读漂移，明确后续独立检出仍使用原冻结完整 SHA、来源锁不读取浮动 HEAD；阶段末证明大厅任务未修改原仓库并记录当前状态，不宣称它们仍等于起始 HEAD。若要纳入新上游代码，必须另行锁定、审阅并更新计划。
2. **P2，区分冻结 Lambda 提交中已跟踪的 dist。** `git ls-tree -r 11b0aef... -- dist` 确有 `dist/lambda-lab.html`；阿贝尔冻结提交的 dist 仅 `.gitkeep`。设计中“未提交 dist 不假称上游 SHA”的原则正确，但应说明 Lambda 冻结提交自带已跟踪成品：独立重建后逐字节比较该 blob，若不同则分别记录固定源码输入与新生成产物摘要，不能把新产物直接称为上游 Git blob。此处是来源证明精度问题，可与 P1 一并修正。

## 已核对

- N6 正式资源 #2 闭环独立审阅归档，计划状态更新为 VERIFIED，仍把 N7/N8 维持未完成。
- 冻结提交的 `package.json` 实际版本分别为 0.1.2、0.3.0，许可均 MIT；阿贝尔具 `check/test/build` 脚本，Lambda 具 `test/build` 等脚本，计划要求在独立检出真实运行并保留日志，没有将当前结果提前标通过。
- 集成方案以 `examples/<id>` 作为大厅已审提交的实际签名来源，包内 `upstream-source.json` 保留原仓库 URL、完整 SHA、输入/产物摘要，不把大厅签名 `sourceRevision` 冒充原仓库提交。保持严格生产器、完整资源集和许可门禁；两个游戏原玩法/schema/键/合同分开，Blob 下载转统一桥是否可用留给真实 SAF 验收。
- 序列 3 明确固定上一目录 SHA `0428dedaa4dd8abdd5299cf1db52a0f3f8bbbbfb381bd0ec20ad58be16b31915`，保留示范 #2、旧签名历史和 ZIP；游戏主动安装、正式 APK 不变、独立 origin、公网验签及发布后审阅均列为待办。N8 清理仍在 N7 后。

**当前结论：规划需先修正来源状态和 Lambda dist 证明措辞，提交后独立复审；在此之前不放行 N7-B 集成构建。**

## 批改复审：`7fa2cb21b9d3d221d295ccc186d3aafc727529f3`、`15b51ba712fd7975ae06caca7b9745b03b621268`

两个提交已推送；最终 `HEAD=origin/main=15b51ba`，大厅主仓库干净，两次 `git show --check` 均无格式错误。`doc/evidence/n7-original-live-observation-20261009.json` 单独记录两原仓库审阅时当前 HEAD、空工作树、冻结提交为祖先及 `resourceRevisionMoves:false`，没有改写起始只读快照。N7-U1 和阶段末门禁已改为本任务不写六原仓库、每次复核当前状态，并严格区分两新游戏当前外部 HEAD 与 d58/11b 不移动资源来源；**原 P1 闭环**。

设计明确 Lambda 冻结 11b 提交已跟踪 `dist/lambda-lab.html`，独立重建须与该 Git blob 逐字节比较；不同时分别记录原 blob、重建产物、固定输入与原因，集成产物归属大厅后续已审提交，不借用当前原仓库 dist。阿贝尔冻结提交 dist 仅 `.gitkeep` 的事实也已说明；**原 P2 闭环**。首审原文已单独归档 `doc/evidence/n7-two-game-plan-independent-review-20261009.md`，保留发现与修订路径。

**复审结论：CLOSED，无剩余规划阻塞，可进入 N7-B 的独立上游构建及可审核集成来源切片。** 此结论仅确认计划，未将两来源测试/构建、资源 ZIP、真实 SAF 或正式序列 3 发行记为已完成。
