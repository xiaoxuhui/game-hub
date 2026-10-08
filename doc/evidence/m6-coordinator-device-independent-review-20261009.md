# M6 协调器受控连接设备切片独立审阅

- 受审提交：`abd0621f7887be06e0d34c4237075950e6bab03c`（父 `b25f978121dd47f5d7f20bec39da2a80b09f7282`）；本地 `HEAD` 与远端 `main` 相同，主仓库工作树为空。
- 方法：只读核对提交差异、生产协调器/网络客户端/资源存储控制流、设备夹具及三份日志。未在主仓库或四个原游戏仓库构建或修改文件。
- 独立检出 JVM XML 实数 62 项，0 失败、0 错误。四个相关文件（`UpdateCoordinator.kt`、`ResourceDeviceFixture.kt`、`UpdateCoordinatorDeviceTest.kt`、`DocumentExportTest.kt`）与独立构建目录的 SHA-256 逐一相同，与仓库证据所列摘要一致。

## 审阅意见

1. **P3，提交日志有行尾空格。** `git diff b25f978 abd0621 --check` 报 `doc/evidence/m6-coordinator-first-compile.txt:2`、`m6-coordinator-first-device.txt:2`、`m6-coordinator-final-tests.txt:2` 的 Daemon 行尾空格。请以单独批改提交仅清理这些归档文本的尾随空格，再复跑 `git diff --check` 并在审阅记录保留原始日志已做格式清理的说明。日志结论和数值不应改写。

## 控制流与证据核对

- `CoordinatorVerificationEnvironment` 只由 `createForVerification` 创建独立协调器；生产 `get(context)` 仍使用固定仓库 HTTP、内置公钥和 `ResourceRuntime.store`。协调器查询、历史目录读取、安装、恢复、隔离及本地描述均改由同一个 `resourceStore` 入口访问；资源客户端统一用注入公钥/HTTP，测试没有在部分路径混入生产存储。夹具隔离 files/cache/preferences；`closeVerification` 明确拒绝关闭生产单例并在非 UI 线程等待私有 worker 排空。
- 受控 `HttpURLConnection` 可返回临时 RSA3072 签名目录和四个完整 ZIP 的实际字节，实际下载只针对 Light。生产 `PublicReleaseHttp`、`ResourceCatalogClient`、门禁、摘要核验、AtomicFile 与存储选择逻辑仍执行原代码；夹具绕开真实 TLS 和系统网络读取，文档已明确。夹具隔离 files/cache/preferences，部分正例检查已打开的连接均被关闭。只允许 Light code2 进入 ready；APK 只查询不自动下载。计费确认、自动关闭持久化、取消保留 busy 直到清理、坏 ZIP 后手动重试、APK/资源通道限流分离均有设备路径断言。
- 首轮设备 6 项中 1 项因测试 `assertOnlyLight` 读取旧 `GameResourceStore` 对象而空指针；批改后断言从实际提交文件重建存储读取。首轮失败日志未删除。最终日志明确显示 11 项、0 失败和 `BUILD SUCCESSFUL`：协调器 6 项加导出复验 5 项。命令中无效的旧生命周期方法名未被 runner 选入，文档没有把它计为第 12 项。
- 文档把对象/文件重建与真实进程杀死区分，且不宣称生产公钥、线上下载、TLS、系统 read 立刻可取消或最终发行候选已验证。独立目录内资产仍属开发基线。

**结论：未发现本提交的功能或隔离阻塞。** 清理三处日志尾随空格后再做一次只读复审即可进入下一切片；M6 的生产网络和真实进程终止验收仍待后续证据。
