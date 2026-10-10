# N10-F4 真实归档索引与清理前独立复审

- 受审提交：`e020f314e82e0082d673e1cd9a07d332ba0c33c8`。
- 永久归档：`D:\soft\game-hub-archives\n10-20261010`。
- 结论：**CLOSED，可进入提交归档审阅、主仓同步及默认只读清理门禁。** 本结论不表示 `cleanup-n10.ps1` 已运行或任务根已删除；实际默认验证与 `-Execute` 的结果仍须另审。

## 独立复核

1. 永久 **原始** `cleanup-index.json` 重新计算 SHA-256 为 `e3ded2b9f419879ef094d4478814db42073f34ec202c26ceaef535a1d6cf926b`。公开索引副本的 SHA 为 `63415233…6764`，因换行规范化不同，不能作为 `-ExpectedIndexSha256`。索引固定任务根、永久归档根及 `sourceCommit=b46d90ef1d428898d32c94f258141694f90d671d`。
2. 独立重算索引列出的 **469** 个归档文件全长、SHA，合计 **46,216,490** 逻辑字节，差异 0。归档实际文件集合恰为这 469 项加原始索引与只读验证 JSON 两项，无额外或缺失文件。**456** 条 evidence 原相对路径与现场原文件集合相同，原文件和归档别名的长短、SHA 全同；按 UTF-8 原路径重算安全别名，重复/逃逸/绑定错误均为 0。空格与括号原文件名通过索引映射保留。
3. 其余 **12** 项是两组各六个候选文件；其名称、大小、完整 SHA 同固定生产者 `fc9da9be6a238018d86f2085facd5b8085e68cf8` 的已审候选清单及当前 `.build` 原文件逐项一致。最终本地候选 APK、匿名下载 APK、Release/tag 回执和签名/版本日志都作为证据被索引；两个 APK 原字节的既审摘要均为 `9f57c90a…323da`、2,654,159 字节，公开资产 digest 与之相同，签名日志为原证书 `44e92c1a…07125ae2`、版本 5/0.4.1。
4. `git bundle verify` 成功并报告 **complete history**；bundle `refs/heads/main`、HEAD 指向索引源 `b46d90e…`，包含 annotated `v0.4.1` 标签对象 `d33b0503…`，固定 APK 源码 `fc9da9b…` 是该主线祖先。现场 `fixture-producer` 唯一未提交修改是测试专用 code 6/name 0.4.2 两行覆盖；已索引的 `e4-private-future-fixture.patch` 与其 `git diff` 文本一致，基底 `b71d14a…` 在完整 bundle 历史中。`repeat-producer` 干净；不需保存其可再生构建缓存或已停止的专用 AVD 磁盘。
5. 索引内 `f3-originals-before-archive.json` 逐列七个原仓完整 SHA/状态均与基线匹配，EML 既有 22 项保留；`f3-own-emulator-stopped.json` 固定专用 `emulator-5566` / `gamehub-n10-20261010`、停止回执、serial 消失与剩余 own 进程 0。它们是停机时证据；删除前后的现场检查仍由清理门禁及结果阶段执行。
6. 已审 `scripts/cleanup-n10.ps1` 静态解析 0 错，唯一递归删除是显式 `-Execute` 对固定 `D:\soft\.ci-tmp\game-hub-n10` 的 `Remove-Item -LiteralPath`。脚本在此之前要求原始索引完整 SHA、469 项逐字节、456 原 evidence 集合/映射、完整 bundle、主仓及 work 同一干净已推送 HEAD、无 own 进程/AVD、保护目录与旧正式 APK 摘要、无既有结果；默认模式不删除。受审 F4 提交只含报告、索引公开副本和验证回执，`git diff --check` 通过。

## 执行前提

审阅时主仓 HEAD `adb400cbb52a57041333d973b617ea77cfd3590c`，独立 work HEAD `e020f314e82e0082d673e1cd9a07d332ba0c33c8`，所以现在执行清理器应被同 HEAD 门禁拒绝。请先把本审阅记录归档并推送、将主仓快进至同一干净远端 HEAD，使用上述**原始**索引 SHA 和当时完整 HEAD 先执行默认只读门禁，确认退出 0 后才允许 `-Execute`；真实删除结果另行独立审阅。本次没有调用 API、操作设备、读取密钥或执行清理。
