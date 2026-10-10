# N10-E2 正式 0.4.1 检查控制器独立首审（2026-10-11）

受审已推送提交 `819d6adc3b882e01ad5d98dfd9fd82b709d324b2`。结论：**OPEN（1 项 P2 测试可空通过）**。本次只读审查仪器测试与已归档编译证据；没有安装 APK、运行设备、发布或读取密钥。

## 待批改

- **P2 — offline 用例没有证明“成功检查后断网撤回历史结果”。** `ProductionHallUpdateDeviceTest.kt:82-87` 的 offline 分支只在冷启动后等待 `upstreamStatus` 含“离线”，而 `upstreamResults.values.all { it.issue != null }` 在空 map 上直接为 true；`resources`/`dynamicResources` 初始为空、`apkRemembered` 等在离线初始化时即为 true。因此完全没有先取得五项成功源发布和 Abel 显式 404，该用例也能通过，无法证明成功线上结果/下载 offer 被撤回、已核对时间与旧版本保留。建议在同一进程中先在线完成 `fresh(startedAt)`，记录五项版本、checkedAt 与可用资源，然后受控断网并断言仍有六项源键、五项原版本/时间戳仍保留但全部带历史 issue，候选列表与 offer 不再可用；或将此分支准确命名为“离线冷启动”并另补在线→离线测试。实际执行时还须证明网络确实处于断开状态并恢复原设置。批改后才能把本控制器作为 N10-E 离线验收门禁。

## 已核查的设计边界

- 测试需显式 `formalHallMode`，常规 suite 中跳过；各模式先对实际安装 APK 全字节 SHA、`0.4.1/code5`、原发行证书指纹和生产 DER 完整摘要作断言。`ResourceRuntime` 的 `describeAll()` 会按签名 proof、文件清单及每文件 SHA 重新验证 active；三游戏的 code2/完整 archive SHA、selection.active 和无 ready 被逐一核对。测试没有调用游戏 session 或资源激活入口。
- startup 的 `fresh(startedAt)` 要求六个源结果且五项正式版本/成功时间不早于本次启动，随后核 Abel 404 原因、大厅 APK 新鲜状态和真实 `sourceMessage` 中五个已装版本。manual 实际点击首页摘要、Dialog 的“立即检查”按钮，并要求五项成功时间戳严格增加；不会仅凭静态 fixture 文本判通过。源码反射只读取当前 Activity 的私有视图/展示结果，没注入传输或签名状态。
- `stageFuture` 仅把测试 APK asset 复制到应用私有 `updates/fixture.apk` 并核预期全 SHA，立即返回；证书、`0.4.2/code6`、包名和系统安装 Intent 由后续既有 `UpdateFixtureTest` 验证，E2 没把复制当作预检已通过。报告也明确三资源玩法/存档和 0.4.0→0.4.1 覆盖升级另属 D/E 门禁。
- 归档日志只证明 `assembleDebugAndroidTest` **BUILD SUCCESSFUL in 30s**，未声称正式设备测试已运行。受审提交 `git diff --check` 通过。当前旧正式现场和 D 限额等待均未被本审阅改变。

批改该离线覆盖缺口并再次编译/运行相应设备门禁后复审；此控制器仍须在正式同证书 0.4.1 候选上实际执行，才能证明运行时结果。
