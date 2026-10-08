# N2 Android 实际进程恢复切片批改独立复审（2026-10-09）

受审批改提交 `144dfa36f45575b43965ef02e1cfdc4b8ba74d0a`，父提交 `07487a42ea56c7122ad0f582f9349c6e15c174ad`。检查时 HEAD 与 origin/main 均为批改提交，工作树干净，`git diff --check` 无输出；批改仅含两处证据归档及首审原件，没有改产品或测试代码。

1. **state-before 描述已闭合。** `doc/evidence/n2-v040-device-slice-20261009.md:22` 现在明确“内容水位 1 保留，active=builtin、ready 为空、installed=false，首次打开拒绝；夹具没有已激活旧资源”。与测试断言及 `state-before-recovered.json` 一致，不再把水位误称为旧完整选择。
2. **APK 摘要和证书证据已闭合。** 新归档 `doc/evidence/n2-v040-device-20261009/n2-device-signature-hashes.txt` 包含两个开发 APK 的 `apksigner` 证书、`aapt` badging 和 SHA256 输出。只读独立复算两个仓库外 APK SHA 分别为 `41f2effea39770684c95e3b7c706cec9c63cfb5aba1bfe05574b8e89d4cc45dd` 与 `2dd2f43a9ebdb2d7a0e6487591ff38901294283ff6a9a27722e02285f989690f`；独立运行 `apksigner verify --print-certs` 对二者均退出 0，证书 SHA256 均为 `44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2`。开发 APK badging code4/0.4.0，测试 APK 包名 `.test`。归档不含私钥或口令。

首审意见原件准确收入 `doc/evidence/n2-v040-process-independent-review-20261009.md`。三次外部 force-stop、新 PID 与恢复断言的产品结论保持成立；开发 APK 仍非最终发行候选，磁盘哨兵仍非 WebView 存档，N2 全阶段仍 PENDING。双 store 并发预算门禁按计划在 N4 验证，真实 origin/桥在 N3 验证。

**结论：两项证据 P2 已提交批改并复审闭环；本设备切片无剩余阻塞，可进入下一已规划切片。**
