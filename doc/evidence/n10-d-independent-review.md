# N10-D 正式资源发行与旧大厅验收：独立复审

受审记录提交 `09dc01c`、`c734a00462e30042c080c2547e0af92c65ee1d67`；资源生产提交 `fc9da9be6a238018d86f2085facd5b8085e68cf8`。仅检查本地公开和私有证据；没有调用 GitHub API、安装 APK、操作模拟器、读原始存档或密钥。

## 结论：OPEN，需批改证据边界和过期计划文字

1. **P1：离线控制步骤缺少可复核记录。** `doc/evidence/n10-d-complete.md` 称关闭 wifi/data、force-stop、离线冷启动后测试通过；但现有 `evidence/d4-three-save-offline.log` 只包含 `Time: 28.538 / OK (1 test)`，`evidence/d4-three-save-all-pass.log` 的离线轮只有三个游戏 PASS。`ProductionUpdateSaveDeviceTest.kt:35-44,51-115` 验证旧 APK、已激活资源及游戏存档，但不检测网络状态或进程重启。现有归档未见 `adb svc wifi/data`、网络状态回读、force-stop 与新 PID、finally 恢复的当时命令/结果。请归档既有原始控制转录（含实际命令退出码、断网回读、旧/新 PID 与恢复）；若无可追溯原件，重跑并捕获这些控制证据。此前 OK1 和三游戏 PASS 应保留，但仅凭它们不能独立证明“离线冷启动”。
2. **P2：实施计划保留过期状态。** `doc/N10-更新检查修复实施计划.md:47` 仍写 D4 匿名配额耗尽、“尚未签名”，与本次 `v2-seq5/catalog.signed.json` 已签名、`published.json` 和 seq5 严格在线验证相矛盾。将该句改为历史故障及其已恢复时间线，或移入历史记录；D 状态须待本轮复审 CLOSED 后才满足该节 Definition of Done。

## 已确认的结果

- `candidate-hashes.json` 的 producer 为完整 `fc9da9b…`。本地逐文件重算 `work/.build` 与 `repeat-producer/.build` 两套各 12 文件的长度及 SHA，24/24 匹配；私有 `e4-candidate-hashes.json` 同样列出这 12 项。较早的 `d4-reviewed-candidate-hashes.json` 属于 `9d205cb…`，不能用作最终 producer 证据；报告没有把它冒充最终候选。
- v1 seq2 本地签名目录 SHA 为 `972f5806…d3b86de`；v2 seq5 当前 SHA 为 `d4b8382d…7ad848`，旧 seq4 签名原字节 SHA 为 `7a031285…17ac`。使用仓库生产公钥只读验证本地 seq4/seq5 签名通过。公开 `v2-published.json`、`v2-online-verified.json` 与私有发行目录中的对应文件逐字节一致；后者记录 seq1–5 连续历史和六累计 ZIP。初次 online 的 `Public asset bytes mismatch` 与后来只读严格 online PASS 均有记录，未看到第二次发布证据。
- 测试代码固定正式旧 APK SHA、版本 0.4.0/code4、公钥 SHA；verify 轮先断言三个实际 active 为 code2、正确来源与 ZIP 摘要、ready 为空，再 `openSession(id,false)`。存档与实际玩法断言覆盖 light、turing、Lambda；在线及所称离线轮分别 `OK (1 test)`，私有 logcat 各有三项 PASS。私有 UI XML 显示正常大厅下载状态与 Lambda 页面。测试使用反射调用生产 `openGamePrepared` 作 WebView 断言，故其页面断言本身不代表三次普通卡片点击；正常 UI 激活另由现场 XML/操作记录和 active/ready 约束支撑。
- 文档把 E 新 APK 覆盖升级及新版状态查询保持 PENDING，未将 D 的旧包结果冒称 E 完成。正式 0.4.1 尚未安装，旧 AVD 现场仍应保留到本轮问题闭环。

待上述两项批改后复审。此审阅未修改产品代码或发布资产。

## 复审：`056a77ca127031e2cff61975732579744a742c86`、`34a9a6f72addbf291fdc544a16d35fe72aa79c19`

**结论：CLOSED，前述 P1/P2 已闭环；可进入 E 旧 APK 现场切换。** 本轮仍只读本地证据，没有操作 AVD 或请求 GitHub API。

- 新的 `d5-offline-control.log` 和私有同名原始转录在去 CRLF、行尾空格及末尾换行后逐行一致；`d5-three-save-offline.log`、`d5-three-save-pass.log` 也同样逐行一致。转录固定 own AVD 名称，旧 PID 11349；关闭 wifi/data 后 `wifi_on=0`、`Active default network: none`；force-stop 后正常 Activity 冷启动 PID 11439。严格 verify 运行 12.552 秒、`OK (1 test)`，同轮 logcat 三游戏 PASS；finally 开启 wifi/data 后 `wifi_on=1`，后续默认 Wi-Fi 网络 ID 104。不同 PID、无默认网络和测试结果共同补足了原先缺失的离线控制链。`mobile_data` 设置仍为 1，文档已明确不以该字段声称蜂窝断开；恢复后 telephony 回读只作恢复诊断。转录没有逐命令退出码，但有效网络状态、进程切换与最终结果足以支持本次狭义离线验收。
- `doc/evidence/n10-d-complete.md` 把原 d4 结果保留为历史，并单独记录 d5 补跑，没有追认原 d4 已有控制证据。恢复网络 ID 曾误写 100，已在 `34a9a6f` 改为转录所示 104。
- `doc/N10-更新检查修复实施计划.md` 删除了“尚未签名/等待配额”的过期叙述，改为实际 seq5 已签名发行、在线完整验收和补跑待复审的事实；E 仍保持 PENDING。两批改提交格式检查无问题。

此 CLOSED 限于 N10-D：旧 0.4.0 真实资源更新与存档验收。新版 0.4.1 的覆盖升级、在线版本状态、公开 APK 发行与用户真机验收仍按 E 阶段分别验证。
