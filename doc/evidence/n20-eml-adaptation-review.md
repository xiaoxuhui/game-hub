# N20 EML 阶段 B 独立审阅与批改记录

- Reviewed commit: `a65a90197130c9aa929de6a26fd0e92389ec4001`
- Reviewer: 独立审阅视角（只读审查）
- Result: **CLOSED，无阻断项**

## 审阅意见

- EML 固定到 `cb408648…`；40 项构建输入、proof 和 UI 输入哈希互相绑定。
- `function-structure.js` 以内联方式放在依赖模块之后。
- 固定旧版读取器验证新存档不能直接读取、兼容封套可读取；新版恢复完整原文。
- 历史发行证据保持 EML `contentCode: 2`，新候选递增为 3；没有 APK 发布改动。
- 36 项 EML 定向测试、237 项全仓测试通过，独立上游克隆保持清洁。
- 非阻断建议：把 EML 发行递增断言从图灵机测试移到 EML 专属测试，职责更清楚。

## 批改记录

- 已将历史 EML 发行记录与本次递增断言放入 `tests/eml-katex-assets.test.mjs`；图灵机专属测试仅保留其自身与其他既有发行身份断言。
- 复核 `tests/eml-katex-assets.test.mjs` 与 `tests/turing-resource-activation.test.mjs`：7 项通过。
- 未发现兼容、安全、资源范围或发布门禁阻断。

## 补充审阅：EML 函数重命名往返用例

- `f339b34c3cb91af77d7143248b2c19858a6d0395` 初审为 OPEN：用例执行了重命名和完整往返，但未直接断言更新状态中的名称/定义。
- 已在 `ca1630722426f77ed59954b222d17ca4def08489` 增加 `updated.state` 的 `name === 'G'` 与定义文本断言。
- 独立复审 `ca16307` 结论 CLOSED，无阻断；定向兼容测试 12/12、全仓测试 237/237 通过。
