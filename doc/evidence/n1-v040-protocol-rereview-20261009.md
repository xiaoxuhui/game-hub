# N1 第一切片批改独立复审（2026-10-09）

受审批改提交：`81bdef33331fefedbb858b1ce109ebc437759bb6`，父提交 `a1e58a7bb73384009080084a214901f5d8b4ecd5`。检查时主仓库 HEAD、origin/main 均为批改提交，工作树干净；`git diff --check` 无输出。只读复核产品差异、红绿日志及独立检出的既有 XML，不在主仓库或四原仓库构建/修改。

## 三项首审意见

1. **P2 整数词法：闭合。** `scripts/resource-protocol.mjs:40-50` 现在在严格原始 JSON 解析中拒绝会被 JS 折叠成整数的小数/指数词法；`tests/dynamic-protocol.test.mjs:29-36` 用 `10.0`、`10e0`、`1e1` 手工改 payload 后重新 RSA 签名，验证 `verifyEnvelope` 拒绝。`DynamicGamePolicyTest.kt:41-43` 对相同词法验证 Android 拒绝。回退日志 `n1-integer-red.log` 精确显示旧 Node 解析未抛预期异常；修复日志 28/0。正常整数签名路径和 v1 测试仍通过。
2. **P2 导入失败误报：闭合。** `examples/memory-demo/app.js:18,27` 的 `save()` 返回写入结果，导入按结果区分“已导入并保存”和“仅当前会话有效，重启后不会保留”。`tests/memory-demo.test.cjs:12-26` 执行实际 `app.js` 导入处理，分别注入配额写入失败与成功；失败时断言可见状态、清空 input 及明确提示。`n1-import-red.log` 证明旧处理在失败时错误显示“已导入存档”，修复日志通过。受控 DOM 不等于真实浏览器或 WebView，后者仍按 N3 验证。
3. **P3 矛盾计数：闭合。** `examples/memory-demo/core.js:9` 拒绝步数低于配对数、完整胜局为零；新增相应 JSON 负例。已完成状态的正常 3 步 1 胜及重启流程仍由测试覆盖。

归档 `n1-v040-protocol-corrections-20261009.md` 对上述红绿过程、隔离检出与未完成范围的表述一致。最终 Node 日志 28 通过、0 失败；独立检出 JVM XML 13 套件共 65 测试、0 失败、0 错误、0 跳过，Gradle 日志 BUILD SUCCESSFUL（23 项中 3 实际执行、20 up-to-date）。没有发现批改引入新的 N1 阻塞项。

**结论：N1 第一切片的三项意见均已批改并留痕，独立审阅闭环。** 可将此已提交修复源码的完整 SHA 用作下一资源生产来源锁；`available=false` 首装/更新资格、动态调用方传预期合同及真实浏览器/设备仍按既定 N2–N4 门禁验证。
