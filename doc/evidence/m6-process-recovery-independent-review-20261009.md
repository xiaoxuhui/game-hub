# M6 实际 Android 进程终止恢复切片独立审阅（2026-10-09）

- 受审提交：`b58f165d6664557f66ad33b243e19be484ffef70`，基线 `4652b87f83ef5dd585090f4a4d3cd056007e5169`。只读检查主仓库和独立构建证据；未在主仓库或四原仓库构建、修改或重复杀进程。
- **结论：未发现阻止进入同证书覆盖升级切片的缺陷。** 这组证据支持所列五个 Android 34 进程终止点的文件恢复，不支持任意断电、真实网络、正式签名或四游戏真实存档覆盖升级；M6 尚不能整体标 VERIFIED。

## 代码与控制链

- `GameResourceStore.kt:18-23,34-55` 将构造参数改名 `trustedDirectory`，初始化块现使用已 canonical 化的成员 `directory` 查找和清理 staging。此前同名构造参数遮蔽使 `/data/user/0` 子项传入以 `/data/data` 为根的 `deletePrivate` 而被拒绝。此次未放宽 `deletePrivate` 的子路径/链接检查；默认 stateFile/freeSpace 仍通过同一 Android 私有目录别名访问。首次 extract 失败栈在档，可对应上述生产缺陷。
- `resource_process_smoke.ps1:22-54` 对每个 phase 启动明确的仪器准备测试，轮询私有持久 cutpoint，核对 marker PID 属于当前目标应用，再 `am force-stop`、确认 PID 消失、运行恢复测试、要求 `OK (1 test)`，并核对恢复 JSON 的新旧 PID 不同。`WaitForExit` 返回值虽未使用，后续 `pidof` 与恢复断言足以防止“只停 adb 客户端”的误报。
- `ResourceProcessRecoveryTest.kt:48-167` 将临时测试公钥、已签目录和从真实 bundled Light 文件生成的 stored ZIP 置于独立私有验证目录；临时私钥只在夹具内存中使用，cutpoint 前关闭夹具。下载使用生产客户端/HTTP 处理逻辑与受控连接；state-before 实际调用 Android `AtomicFile.startWrite()` 写 `.new` 并 fsync 而不 finish；state-after 在已提交 state 但尚未更新内存的边界停住；journal-half 的两份签名记录分别为 seq3/seq2。未传 `phase` 时两个控制测试通过 Assume 跳过，不会在常规设备测试中悬停 120 秒。

## 证据核对

- `m6-process-fixed-run.txt` 明列 download、extract、state-before、state-after、journal-half 五次 PASS；每项 cutpoint/recovered JSON 的 PID 对不同，恢复输出均 `OK (1 test)`。下载阶段确有 65536 字节 `.part`；extract 暂存已有 1 文件；state-before `.new` 存在；state-after 已提交 ready `2-...`，新进程显式打开才激活 code2；journal-half 取最高 seq3 并拒绝旧 seq2。五轮隔离存档哨兵 SHA 相同。
- 首轮 `extract-recovery.txt` 的 `GameResourceStore.deletePrivate` 失败、随后修订后的五轮成功均保留，没有抹去失败。`m6-process-fixed-compile.txt` 显示 JVM/assembleDebug/assembleDebugAndroidTest 构建成功；文档报告 JVM 62 项零失败。报告明确受控 HTTP、临时 RSA、隔离存档哨兵及 Android 34 限定，没有称为真实用户存档或断电实验。
- 我对 `GameResourceStore.kt`、`ResourceProcessRecoveryTest.kt`、`resource_process_smoke.ps1` 计算的主仓库与独立构建检出 SHA-256 均逐项等于 `m6-process-source-hashes.json`；主仓库 HEAD 是受审提交且工作树空。`git diff 4652b87 b58f165 --check` 无输出。

## 后续精度与验收

- 文档“源码与独立构建文件逐字节一致”由三份关键受审文件摘要支持；建议今后明确写“这三份受审文件”，避免被读作整个源树逐文件比对。此为文字精度建议，不影响本切片放行。
- 真实覆盖升级仍需以同发行证书、保留应用数据目录的 APK 安装过程验证四游戏实际存档读写；本次只验证私有夹具哨兵。进程终止之外的物理断电/存储故障、在线 TLS 与正式密钥也仍未测。
