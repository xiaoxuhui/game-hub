# M4 下载任务门禁首切片独立审核（2026-10-09）

- 受审提交：`d407236429a89b98bc756f30c2bc463292411e48`。
- 范围：纯策略 `UpdateTaskGate.kt`、五组 JVM 单测及切片证据。只读审查已提交内容，未独立重跑测试；未修改主仓库、四原仓库或密钥。
- **结论：未发现阻止接入 Android 应用范围生命周期适配器的问题。** 该结论只覆盖状态机，不代表 M4 下载/自动更新已经接入或验收。

## 核对结果

- `UpdateTaskGate.kt:40-44,53-65` 用同一门禁互斥元数据检查与 APK/资源下载；取消只置 token 标志，不提前释放占用，需工作线程完成连接/临时文件清理后调用 `finish(token)`。`finish` 和 `valid` 采用对象身份比较，旧 token 不能释放或授权新任务。JVM `cancellationKeepsMutexUntilCleanupAndStaleWorkerCannotReleaseNewTask` 覆盖此序列。
- `UpdateTaskGate.kt:25-36,52-63` 在后台、离开大厅、断网或切到未经允许的计费网络时取消在途下载；已取消 token 在网络恢复后仍无效。默认仅非计费 Wi-Fi 自动下载资源，计费网络需要当次手动确认或设置开启；APK 的 `manual=false` 始终被拒绝。手动任务不因自动下载开关关闭而被追溯取消。
- 冷进程首次检查、并发检查合并、旋转/短时返回抑制与 30 分钟到期由单一内存 `lastCheck` 决策；对同一应用进程内持有的门禁成立。通道退避分开保存，`rateLimited` 只延长、不缩短截止时间，手动资源下载同样受退避限制。构造需要显式 `saveBackoff`，真实跨进程持久化仍需下一切片提供并验证。
- `doc/evidence/m4-task-gate-final-tests.txt` 显示 `testDebugUnitTest` 与 `assembleDebug` 成功，文档报告 JVM 41 项、失败/错误 0；`git diff d407236^ d407236 --check` 无输出。证据没有把纯策略测试写成 Android 后台更新实测。

## 下一切片验证点

- 应用范围协调器需保证**只有工作线程完全清理后**才调用 `finish(token)`；Activity 重建不能重建门禁或丢失占用。`beginCheck` 的网络/通道退避应用由调用方负责，查询的两通道请求要各自检查 `channelAllowed`。
- 使用真实持久化适配器做重启测试：先持久写入退避，再恢复 `initialBackoff`，验证手动检查/下载均不绕过；保存失败应清楚报告或保持内存限制，不能把显式回调参数本身当作已持久化证据。
- 每轮每游戏一次尝试、自动下载队列、网络监听、取消后的 `.part` 清理、Activity 订阅释放与 UI 尚未实现，M4 继续 PENDING。
