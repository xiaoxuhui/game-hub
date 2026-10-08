# M5 启动提示与详情首切片：独立审阅

- 日期：2026-10-09
- 受审提交：`529a9884e22fc370a00e35c2a8477c128d76f28b`（父提交 `052751740055f0d32e4d5a7f92b0e5aa4586b750` 已单独审阅）
- 方法：只读检查提交差异、`MainActivity`、`UpdateCoordinator`、任务门禁、偏好适配器、设计/验收文档、设备及 Node 日志，并查看普通手机两张实际截图。未在主仓库或四个原游戏仓库构建、运行测试或修改文件。本记录存放在主仓库外。
- 范围：只评价启动提示和详情首切片；实际资源版本、恢复 UI、跨进程通知缓存、联网及故障完整验收仍属 M4/M5 待办。

## 阻塞意见

### P1：设置持久化在 UI 线程执行磁盘提交

`MainActivity.kt:356-362` 的两个 `CheckBox` 点击回调直接调用 `UpdateCoordinator.settings()`；后者 `UpdateCoordinator.kt:88-91` 同步调用 `UpdatePreferences.settings()`，该函数在 `UpdatePreferences.kt:13` 执行 `SharedPreferences.Editor.commit()`。这是 UI 线程上的同步磁盘写入，与 `doc/设计文档-v0.3.0.md:32` 的“网络和磁盘工作不在 UI 线程”不符，磁盘拥堵时会冻结详情界面。现有 14 项设备测试没有操作这两个控件或模拟提交延迟。

复现：在详情中切换自动更新或计费下载选项，同时让设备存储写入变慢，主线程会等待 `commit()` 返回。批改建议：将持久化放入协调器的串行 worker；关闭自动资源/计费许可应先立即撤销对应自动下载 token，开启许可须在持久化成功后才生效；将成功或失败结果发布回主线程并更新控件，增加可控阻塞/失败测试。

### P1：外部文件/安装流程返回时自动下载门禁过早放开

`MainActivity.kt:152-158` 在 `filePathCallback`、`pendingExport` 或 `pendingInstallApk` 非空时传入 `allowCheck=false`，但 `UpdateCoordinator.presence()` 在 `UpdateCoordinator.kt:69-75` 仍把任务门禁设为“前台大厅”，并无条件调用 `automaticNext()`。`UpdateTaskGate.kt:52-60` 只根据前台、大厅、网络和设置判断能否自动下载，不读取 `allowCheck`。因此 Activity 从文件选择器、保存窗口、安装授权或系统安装器回到前台，外部结果仍待处理时，可抢占下载槽并启动自动资源下载。随后 `MainActivity.kt:72-108` 清空待处理对象时也未重新发布 presence，若之前自动检查被取消，`checkEligible` 会一直为 false，直到下一次大厅导航或生命周期切换。

复现：使有效资源 offer 已就绪且自动下载尚未尝试，打开文件选择器或系统安装授权，再回到大厅；在 Activity result 回调尚未交付时观察 `automaticNext()`。批改建议：用统一的 `externalFlowPending` 状态同时约束自动检查和自动下载；结果回调清空状态后重新发布 presence；旋转和后台返回分别测试门禁占用、无重复任务及恢复资格。由于实际联网/下载路径尚待完整验收，此处可先用注入门禁或受控夹具验证。

### P2：两类确认对话框未受生命周期管理

`MainActivity.kt:161-169` 只 dismiss `updateDialogs` 集合中的对话框。详情框在 `:294-309` 被登记，但安装二次确认框在 `:338-341`、计费网络确认框在 `:366-370` 直接 `show()`，没有登记。旋转或退后台后，它们仍关联旧 Activity；迟到的确认回调可能在非前台 Activity 发起下载或安装，旧窗口也可能泄漏。新增 `UpdateLifecycleTest.kt:19-55` 仅覆盖旋转后仍为同一协调器和正常光学入口，没有覆盖打开确认框后的旋转/后台及点击回调。

复现：让详情出现可下载项或已验证 APK，打开相应确认框，然后旋转或切后台；检查旧确认框是否关闭、旧 Activity 是否仍可执行回调。批改建议：所有更新相关的确认框统一登记到 `updateDialogs`，dismiss 时移除；确认回调执行前再次核对前台、当前任务、文件及 offer 状态；添加旋转/后台设备测试。

## 已核对且不构成当前阻塞

- 启动先构建本地四卡，再在 `onStart` 订阅单例协调器。自动检查本身没有弹窗；顶栏摘要与详情展示 APK、资源两条独立状态及最后成功检查时间。
- `UpdateCoordinator.subscribe/publish` 的投递以订阅集合复核有效性；详情框 dismiss 会取消订阅。进度仅改变时不重建详情控件，避免每个进度百分比重置焦点。
- 手动非非计费 Wi-Fi 下载要求本次流量确认，默认自动资源下载与计费许可分离；APK 只在明确点击、验证后再次确认才进入系统安装流程。资源下载 worker 在占用槽后重新调用 `requireDownload()` 检查 offer 时效。
- `doc/evidence/m5-startup-final-device-tests.txt` 显示 JVM 42 项、模拟器 14 项通过，Node 日志显示 22 项通过；两张普通手机截图中四卡可见、详情能打开，资源通道显示未发布。截图明确标注为旧开发资源 stamp，不作本提交 APK 源码一致性证明。
- M4/M5 的完整验收仍为 `PENDING`。320dp 大字体、平板横屏、实际下载/恢复、后台及进程终止场景没有在本切片证据中宣称通过。

## 结论

当前首切片的基本展示与离线打开证据可信；上述 UI 线程磁盘提交、外部流程门禁与确认框生命周期问题需批改并在提交后复审，再进入下一切片。主仓库受审时 `HEAD` 为 `529a9884e22fc370a00e35c2a8477c128d76f28b`，工作树干净。

## 797eac9 批改复审（2026-10-09）

- 批改提交：`797eac905be8b76f7da40dd0a2b591778a2037bb`，已推送；主仓库工作树干净。只读比较主仓库与独立构建目录的 `MainActivity`、`UpdateCoordinator`、`UpdateTaskGate`、两份新增/修改测试，五个文件的 SHA-256 均一致。独立目录的 JVM XML 汇总 43 项、0 失败/错误；设备日志显示 6 项、0 失败与 `BUILD SUCCESSFUL`。没有把这 6 项当作真实 SAF、系统安装或移动网络端到端证据。
- 原 P1 同步写盘：**主路径已修**。`UpdateCoordinator.kt:89-105` 先保守撤销权限，在单工作线程做 `SharedPreferences.commit()`，成功后才赋予新增许可；失败恢复旧设置。详情保存期间禁用两项控件。StrictMode 设备测试在 Activity 主线程调用设置未记录同步写盘违规。
- 原 P1 外部流程门禁：**同一 Activity 的主路径已修**。`UpdateTaskGate.kt:25-28` 的 `externalFlowPending` 使大厅下载门禁关闭并取消在途 token；`MainActivity.kt:72-111,176-179,395-427,520-530,718-730` 在建立和释放 pending 时刷新 presence。JVM 负例覆盖 pending 时三类下载入口拒绝和释放后恢复。真实 SAF/安装结果与旋转组合仍待 M6 验证。
- 原 P2 确认框生命周期：**已修**。`MainActivity.kt:181-185,353-358,386-392` 将安装/计费确认框登记并在 onStop dismiss；点击回调复核 Activity 前台状态，APK 安装还复核当前 ready 文件。设备测试通过旋转验证统一登记的确认框关闭、重建 Activity 不重开。真实确认流程仍待 M6。

### 新发现的残余 P2：保存桥晚回调可能报告成功却不启动保存

`MainActivity.kt:711-732` 中 `SaveBridge.saveFile()` 在 WebView 线程把 `pendingExport` 设为非空并立即返回 `true`。如果 `runOnUiThread` 里的任务轮到执行时 Activity 已停止或销毁，`:719` 将它清空后直接返回。网页已经得到 `true`（光学游戏按此判断保存请求已受理），但 SAF 没打开、文件没写入，也没有失败反馈。可通过在桥调用后、UI runnable 执行前切后台/切游戏来触发。建议桥入口用线程安全的活动状态先拒绝并返回 `false`；更稳妥的是等主线程确认已成功发起 SAF 后再向 WebView 返回受理结果，同时保留晚回调防护。这个问题应在声明保存桥生命周期闭环前批改；真实文件选择/安装的组合测试仍可保留给 M6。
