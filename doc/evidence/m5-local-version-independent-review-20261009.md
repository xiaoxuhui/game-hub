# M5 本地实际版本与候选证明续期独立审阅

- 受审提交：`70d90d3e7515f368778cd9a7db5d2419f153b349`（父提交 `6638bd443510bf1869f19dc75ad22a703536f358`）。
- 方法：只读检查主仓库差异、完整相关类、测试与归档输出；核对本地 `HEAD`、远端 `main` 均为受审 SHA，主仓库工作树为空。未修改主仓库或四个原游戏仓库，未在主仓库构建。
- 已有证据：归档的 JVM XML 汇总 48 项、失败/错误 0；设备生命周期 6 项通过，含临时签名候选的实际渲染映射。最后补入的 `localDiagnostic` 字段与文字仅有编译通过证据，错误态布局未单独设备验证。该设备测试未覆盖生产公钥和真实联网下载。

## 审阅意见（按严重度）

1. **P1，首次或进程重启期间把未知实际版本显示为内置。** `UpdateSnapshot.localResources` 初始为空（`UpdateCoordinator.kt:15`），本地逐文件描述排入后台线程（`:48-52`）；`MainActivity.kt:310-312` 却把 `local == null` 与已确认 `active == builtin` 合并，立即显示内置版本。已安装下载资源时，哈希扫描完成前的卡片和无障碍文字都是错误的实际版本，用户可以在这段时间点击进入。`buildLobby` 的初始静态文案也直接写内置版本（`MainActivity.kt:274-279`）。请将未知状态显示为“本地资源核验中”，仅在 `LocalResourceInfo` 明确报告 builtin 后显示内置；加入从空快照到完成扫描的 UI 测试，并覆盖扫描失败。

2. **P1，续期允许同一 ZIP 身份改写来源版本标签。** `GameResourceStore.kt:129-135` 比较身份、文件表、入口和存档合同，但没有比较 `version`、`sourceRepository`、`sourceRevision`。身份仅由内容编号和归档摘要构成（`ResourcePolicy.kt:14-19`）。因此下一份有效签名目录可沿用相同 ZIP 与文件表，却声称不同版本或源提交；续期会覆盖已安装证明，`describeAll` 随即把新声明当作本地实际版本和来源显示，尽管没有重新下载/安装。应冻结已安装的版本与来源元数据，或在续期前逐项要求相等；增加同身份但版本/源提交变动的已签名目录负例。

3. **P2，单候选续期失败的诊断不会随成功清除。** `GameResourceStore.kt:136` 失败时写入唯一的 `candidateFailure`，成功路径 `:132-135` 不清除它；`failure()`（`:63`）继续返回旧错误，`UpdateCoordinator.kt:223-227` 又将其作为当前本地诊断展示。下次同候选续期成功、`readyFresh=true` 后，详情仍会显示“续期失败”，多候选时也无法从该消息定位失败游戏。请按游戏记录诊断，成功续期后清除对应旧错误；补失败→成功及四游戏中一项失败、其余成功的测试。

## 通过的边界与后续

- `describeAll` 的完整文件哈希与签名核验运行在单工作线程，且单项校验异常作为 `activeError`/`readyError` 返回；UI 渲染不做哈希。
- `refreshReadyProof` 只针对当前已接受序号和负载、同 ready 身份、未隔离且兼容的候选；`verifyVersion` 复核完整文件，空间检查后由生产 `AtomicFile` 写证明。该方法没有修改 active/previous/ready、创建会话、下载 ZIP 或激活资源。预算按每次写入前重算，允许某候选失败而继续后续候选；真实断电/进程终止中途写入及跨进程缓存仍未验收。
- 卡片与详情把远端候选和已核验本地版本分开；临时候选 UI 用例只证明状态映射。真实在线目录、生产公钥、文件选择/导出、系统安装及全阶段 M4/M5 验收继续 `PENDING`。

以上两项 P1 建议批改并补针对性测试后再进入下一切片；本文件保留提交后独立审阅痕迹。

## 74b7da3 批改独立复审（2026-10-09）

- 批改提交 `74b7da326864188ad08482770ab93589681be4a3` 已推送；本地 `HEAD` 与远端 `main` 相同，主仓库工作树为空。只读核对完整差异、相关生产控制流、测试夹具和归档输出；`git diff 70d90d3 74b7da3 --check` 无输出。未在主仓库构建，也未修改四个原游戏仓库。当前 EML 原仓库有 22 条工作树状态输出，其余三仓库为 0；这些是只读快照，本次复审没有清理或归因。
- **原 P1“未知误报内置”已闭合。** `MainActivity.kt:254-278` 初始卡片和无障碍文案使用“本地资源核验中”；`:310-326` 仅在非空 `LocalResourceInfo` 明确选择 builtin 后显示内置。`UpdateCoordinator.kt:224-229` 成功时置 `localLoaded=true` 并清空读取错误，失败时清空旧本地映射、置错误，避免旧版本继续冒充实际状态。设备 `unknownAndFailedLocalScanNeverClaimBuiltinOrRemoteUpdates` 经过空快照、失败、已核验三次真实渲染，失败和未知状态均无“内置/可更新”文字。
- **原 P1“续期改写版本来源”已闭合。** `GameResourceStore.kt:132-136` 先 `verifyVersion` 全文件哈希，再要求已安装 `ResourceGame` 与新签名目录的 `ResourceGame` 完全相等，之后才检查空间并写 AtomicFile；完整相等覆盖版本、源仓库、完整提交、兼容范围、入口、文件表及其他元数据。JVM 新用例使用同 archive 身份但更改版本或来源 SHA 的有效签名目录，证明旧 ready 说明保持，随后有效目录才可续期。`refreshReadyProof` 未修改 active/previous/ready 或会话引用。
- **原 P2“诊断成功后不清除”已闭合。** `renewalFailures` 按游戏 ID 保留续期错误；成功写入证明后只清除该游戏记录，当前目录不再对应 ready 时剔除过期记录。原候选激活错误仍由单独 `candidateFailure` 保留。设备夹具先对四个真实完整候选中的 light 注入签名元数据差异，其余三份续期成功；下一次有效目录让 light 成功并清空诊断。测试使用临时 RSA 密钥和独立候选，不代表生产公钥下的联网发行。
- 验证证据：独立检出目录 JVM XML 共 49 项、0 失败、0 错误；归档日志显示 `UpdateLifecycleTest` 设备 8 项通过、`BUILD SUCCESSFUL`（2 分 42 秒）；Node 22 项通过。对应 `doc/evidence/m5-local-version-review-fixed-tests.txt`、`m5-local-version-review-fixed-node.txt`。本次为只读复审，未另起构建。
- **结论：本轮三条意见均已批改，未发现阻止进入恢复切片的新问题。** 全阶段 M4/M5 仍为 `PENDING`；真实联网、生产资源公钥、断电/跨进程恢复、错误态布局专项和发布验收仍需按后续计划验证，不因本次夹具通过而标完成。
