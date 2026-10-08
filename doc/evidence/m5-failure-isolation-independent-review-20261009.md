# M5 失败关闭与资源隔离切片：独立审阅

- 日期：2026-10-09
- 受审提交：`fb71a451521664a1102776bf9e5b46a6bb3e0ae2`（父提交 `aa5eb2bac60c01b968f4240355b864d014ebb7fe` 已另行审阅）
- 方法：只读检查主仓库差异、失败入口、存储事务、任务门禁、JVM/设备/Node 日志和独立构建目录中的源码与测试 XML；不在主仓库构建，不修改主仓库或四个来源仓库。
- 结果：**一项 P1 阻塞**，修复并经提交后独立复审前不进入跨进程缓存切片。M5 整体仍 `PENDING`。

## P1：被阻止的跨项目导航会误隔离有效下载资源

`MainActivity.kt:645-658` 的 `shouldOverrideUrlLoading` 在检测到同一 `appassets.androidplatform.net` 下未登记或跨项目的主页面路径时调用 `showError("已阻止未登记或跨项目的页面跳转")`。新默认重载 `MainActivity.kt:704` 会把当前 `resourceSession?.game?.identity` 作为失败身份传入；`:706-713` 随即把该身份加入内存禁止集合、关闭会话并排队持久隔离。被安全策略阻止的导航不是下载资源的主入口或必需文件加载失败；`doc/设计文档-v0.3.0.md:126` 对加载故障有明确限定。因此一次用户点击、页面生成的跨项目链接或错误路径即可将本来完整有效的 active 下载版本固定并隔离，且之后需手动恢复/明确重试才能再次使用。

复现步骤：在某游戏已激活签名资源版本时，从其页面发起到 `https://appassets.androidplatform.net/assets/games/<另一游戏>/index.html` 的主框架导航。观察拦截器拒绝请求，随后 `showError` 以当前有效资源 identity 调用 `blockFailedIdentity` 和 `reportResourceFailure`，异步 `quarantineFailedIdentity` 将其编号写入状态。现有设备测试直接反射调用 `showError` 注入故障，未覆盖此误归因路径。

建议：把“显示/关闭错误页”与“可归因的资源加载失败隔离”拆成显式调用；策略拦截路径只拒绝导航并给用户反馈，不传失败 identity。只有当前游戏主入口或已登记必需资源的实际加载失败、经存储完整性校验失败等才隔离对应 identity。增加设备或受控 WebView 负例：下载版页面发起跨项目导航后，当前版本编号不进入 quarantine、不变 pinned，且原游戏可继续使用或安全返回大厅。

## 已核对

- `showError` 对真实错误先递增导航代次，再将 `webView` 置空、移除并销毁旧视图、解除 `ResourceRuntime` 的 Worker resolver 绑定并关闭 session；旧视图导航回调因 `view !== webView` 被拒绝。`SaveBridge` 捕获导航代次，失败后旧桥调用返回 `false`。
- `GameResourceStore` 使用内存失败身份集合立即阻止 `openSession`，worker 在会话关闭后持久化 `pinned` 与隔离编号。`restore` 拒绝已隔离目标；`resumeAutomatic` 不隐式清除隔离，只有指定编号 `RETRY` 持久提交后移除该编号的内存禁止项。版本引用使用 `ConcurrentHashMap.compute`，关闭会话不用等待存储锁内的完整哈希；垃圾回收仍在存储锁下检查引用，并保护 active/previous/ready。
- `UpdateTaskGate.pendingRepairs` 在既有网络任务清理前预约修复优先级，阻止新查询、下载和本地事务抢位；`REPAIR` 可在后台、离线完成。协调器将修复排入单 worker，正常路径 `finally` 重读本地状态、完成 token、更新 busy 并考虑下一次自动任务。补充的取消状态与保留目录同 identity 元数据更改负例有相应代码和测试。
- `doc/evidence/m5-failure-isolation-tests.txt` 记录首轮设备生命周期 10 项、0 失败；最终 `m5-failure-isolation-final-tests.txt` 只重跑 2 个专项设备用例，不能当作最终全 10 项重跑。独立构建目录 JVM XML 汇总 54 项、0 失败/错误；Node 日志记录 22 项通过。主仓库与独立目录五个关键源码/测试文件 SHA-256 相同，`git diff aa5eb2b fb71a45 --check` 无输出。
- 四来源只读复核：康威、光学、图灵机 HEAD 与 2026-10-08 快照一致且工作树干净；EML HEAD 为快照中的 `76cdd75bc26fc7d1dc23a2a4b19e74857c9c430c`，其 10 个旧测试删除、10 个新测试未跟踪和两个 JSON 未跟踪合计 22 项也与快照一致。未对这些用户改动执行清理或构建。
- 设备注入使用内置光学真实存档，证明错误关闭后存档仍在；下载版隔离由临时签名密钥和 ZIP 的 JVM 夹具证明。生产密钥在线下载安装、真实进程终止、SAF 与跨进程通知缓存均未验收，不能据此标记 M5 完成。

## 结论

失败关闭、隔离持久化与修复队列的主路径有可核查证据；跨项目导航的故障误归因必须批改后复审。本记录位于主仓库外，主仓库受审时 `HEAD` 与 `origin/main` 均为 `fb71a451521664a1102776bf9e5b46a6bb3e0ae2`，工作树干净。
