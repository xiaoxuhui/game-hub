# v0.4.0 N2 动态资源仓库核心切片独立首审

- 受审提交：`2251dba8a8340d3b90fed8ed26a835babcaf7fce`。
- 审阅方式：只读检查生产代码、8 项动态 JVM 用例、原始失败/红绿日志及阶段说明；未在主仓库或四原游戏仓库构建或修改文件。检查时主仓库工作树干净。

## 阻塞进入设备集成的缺陷

**P1：退役目录没有阻止已经排队的 ready 资源激活。** [`GameResourceStore.kt` 第 129–139 行](D:/soft/game-hub/android/app/src/main/java/com/xiaoxuhui/gamehub/GameResourceStore.kt) 接受 `available=false` 的新签名目录时只更新内容水位和哈希，没有保存当前可用性；第 211–228 行 `openSession()` 若 ready 的旧证明仍在有效期，就会激活该 ready，而没有核对最新目录的 `available`。复现顺序：目录序号 1 `available=true`，下载安装但尚未进入游戏（`ready=code2`）；序号 2 将同 ID 退役 `available=false`；下一次打开游戏仍可把 code2 激活。它违背 v0.4 设计 D1 的“退役禁止更新”，而现有测试先完成激活再退役，未覆盖该交错。建议将每 ID 最新 `available` 及其签名目录序号作为可信持久选择状态，或在激活 ready 前以当前最高签名目录证明判定退役；退役时清除/隔离 ready 但保留已 active 资源供离线游玩。加入活进程与重启后“ready→退役→打开”的负例，确认旧 active 不变。若退役后重新提供允许相同编号，也应在协议文档明确；如要求新编号，则同时测试退役→同编号复供拒绝。

## 后续切片必须兑现的边界

- **P2：共享预算当前只有双向读盘，没有跨 store 原子预留。** [`ResourceRuntime.kt` 第 28–32 行](D:/soft/game-hub/android/app/src/main/java/com/xiaoxuhui/gamehub/ResourceRuntime.kt) 给两个 `GameResourceStore` 互相提供 `usedBytes`，但各 store 只有自己的锁，两个并发 `install()` 均可先看到对方未写入而通过 300 MiB 检查。N4 的单任务门禁若保证所有生产安装入口共享一把串行锁即可闭合；设备集成和后续 coordinator 测试需验证该前提，不能把当前 JVM 的顺序容量负例称为并发额度保证。
- **P2：证明文件读取前的路径边界仍需统一。** `GameResourceStore.journalCatalogs()` 第 107–115 行直接对 `catalog-history` 和日志文件调用 `listFiles`/`readProof`，`verifyVersion()` 第 200–208 行在递归 `ResourcePathGuard.requireUnlinked` 前先读取 `catalog.signed.json`。新 `ResourcePathGuard` 防止删除/读盘预算跟随 junction，测试覆盖的是回收父目录；签名证明读取可在链接目标处先发生。建议对目录及证明文件在读取前调用同一逐级 guard，并加外部哨兵链接读拒绝用例。由于证明仍需有效签名且读取不写目标，此项是安全边界加固，不是本次已证明的数据删除漏洞。

## 核实的通过范围

- 固定 `BUILTIN/DYNAMIC` 策略、动态 schema2/初始水位0、累计ID、签名目录双日志及错误通道隔离有对应代码和 JVM 测试；旧默认构造仍固定四游戏。`ResourcePathGuard` 生产分支使用 Android API21 已有的 `Os.lstat`，最低 API24 无静态版本障碍；SDK0 的 NIO 分支仅用于宿主 JVM。测试对 Windows junction 确认外部哨兵保留。
- 日志记录首次错误、专用红灯及最终 `--rerun-tasks` 73 项全过；证据没有把磁盘哨兵说成真实 WebView 存档，也未把对象重建说成实际进程死亡。`removeResources` 先持久撤销选择再回收，若回收失败不触及 WebView 数据，后续可重试；活动会话会阻止移除。
- 本切片仍未接动态大厅、WebView、实际进程终止或最终发行签名资源；阶段报告对这些边界如实标为后续。

**首审结论：** 有一项 P1 退役与 ready 激活交错缺陷，修复并增回归后再进入下一设备集成切片。P2 项需在后续协调器及路径安全测试中闭合。
