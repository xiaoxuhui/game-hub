# N20 EML 资源兼容更新实施计划

- Status: IN_PROGRESS
- Approved: 2026-10-31 用户要求完善并发布可发布游戏资源；明确不发布 APK。
- Type: resource release
- Source checkout: independent checkout at fixed upstream SHA; original EML repository remains read-only.

## A 需求、设计和门禁 `[COMPLETE]`

- Files: `N20-EML资源兼容更新需求与测试用例.md`、`N20-EML资源兼容更新设计.md`、本计划。
- DoD: 需求、设计、实施计划均已写入，`git diff --check` 通过。
- State: 文档已提交为 `d38f7eb`。

## A2 首轮独立审阅与批改记录 `[COMPLETE]`

- DoD: 独立审阅 `d38f7eb`，将意见和批改记录存入 `doc/evidence/n20-eml-plan-review.md`。
- [x] 审阅无范围/兼容阻断；修正了文档阶段状态矛盾。修订提交后的复审已单独记录。

## A3 修订提交复审 `[VERIFIED]`

- DoD: 独立审阅本次修订提交；若无阻断，记录归档在 `doc/evidence/n20-eml-plan-review.md`。
- [x] `5c15dd2` 独立复审 CLOSED，无阻断意见；记录已追加。

## B 上游适配与交叉读取验证 `[VERIFIED]`

- Files: EML resource lock、EML integration scripts、固定夹具、targeted tests。
- DoD: U01–U05 通过；旧版直接读取和兼容封套读取均由真实固定读取器验证；原仓状态不变。
- Evidence: 36 项 EML 定向测试通过；全仓 `node --test` 237 项通过；精确源输入锁为 `cb408648`，单独源码克隆 HEAD 一致且工作树清洁。

## B1 阶段 B 独立审阅与批改 `[VERIFIED]`

- Commit reviewed: `a65a90197130c9aa929de6a26fd0e92389ec4001`。
- Independent result: CLOSED，无阻断项；审阅意见与批改记录见 `doc/evidence/n20-eml-adaptation-review.md`。
- Correction: 将 EML 递增断言从图灵机测试移入 EML 专属测试；两组相关测试 7 项通过。

## B2 EML 函数重命名兼容复核 `[VERIFIED]`

- Commits: `f339b34` 初审 OPEN，`ca16307` 批改后复审 CLOSED。
- 独立审阅与批改记录已追加至 `doc/evidence/n20-eml-adaptation-review.md`；U03 重命名状态、定义 AST 的完整往返均有断言。

## C ZIP 生产与范围核验 `[VERIFIED]`

- Files: EML resource candidate, issuance facts, deterministic build report。
- DoD: U06 通过；仅 EML contentCode 递增，其他静态游戏描述和 ZIP 字节与已发布当前值完全一致；双构建相同。
- Evidence: `doc/evidence/n20-eml-resource-candidate.md`（索引）；逐次构建摘要、预检输出和上游巡检分别在同目录下的 `n20-eml-resource-builds.json`、`n20-eml-v1-preflight.json`、`n20-eml-upstream-watch.json`。
- Independent result: CLOSED；审阅确认 U06 达标。D 将在最终 producer commit 重新构建并在线预检。

## D 签名发行与线上验证 `[IN_PROGRESS]`

- DoD: U07 通过；资源目录历史连续可验；新 ZIP 公网摘要与候选相符；不构建或发布 APK。

## E 归档与最终独立复核 `[PENDING]`

- DoD: 代码/发行各阶段按逻辑切片提交；每次提交后独立审阅并记录批改；最终原仓只读状态、主分支及资源目录状态都可复核。



