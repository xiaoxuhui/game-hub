# N20 EML 资源兼容更新实施计划

- Status: PENDING
- Approved: 2026-10-31 用户要求完善并发布可发布游戏资源；明确不发布 APK。
- Type: resource release
- Source checkout: independent checkout at fixed upstream SHA; original EML repository remains read-only.

## A 需求、设计和门禁 `[COMPLETE]`

- Files: `N20-EML资源兼容更新需求与测试用例.md`、`N20-EML资源兼容更新设计.md`、本计划。
- DoD: 独立审阅无阻断意见，审阅和批改记录归档。
- State: 首次文档已写；等待文档阶段提交后的独立审阅。

## B 上游适配与交叉读取验证 `[PENDING]`

- Files: EML resource lock、EML integration scripts、固定夹具、targeted tests。
- DoD: U01–U05 通过；旧版直接读取和兼容封套读取均由真实固定读取器验证；原仓状态不变。

## C ZIP 生产与范围核验 `[PENDING]`

- Files: EML resource candidate, issuance facts, deterministic build report。
- DoD: U06 通过；仅 EML contentCode 递增，其他静态游戏描述和 ZIP 字节不变；双构建相同。

## D 签名发行与线上验证 `[PENDING]`

- DoD: U07 通过；资源目录历史连续可验；新 ZIP 公网摘要与候选相符；不构建或发布 APK。

## E 归档与最终独立复核 `[PENDING]`

- DoD: 代码/发行各阶段按逻辑切片提交；每次提交后独立审阅并记录批改；最终原仓只读状态、主分支及资源目录状态都可复核。
