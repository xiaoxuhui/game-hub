# M2 资源存储切片独立审核（2026-10-08）

- 受审提交：`e531399813847658371b00f54ae70a5771f66edf`
- 范围：stored-only ZIP 解析、状态 AtomicFile 接口、安装/ready/会话/恢复/隔离/GC 及新增 JVM 测试。尚未接 UI、真实杀进程和真实四游戏存档。
- 结论：**三项 P1 阻塞进入 M3，需批改并提交后复审。** 仓库证据记录独立 Gradle BUILD SUCCESSFUL、JVM 24/24、Node 资源 9/9；现有测试未覆盖下述状态损坏、多候选失败和同包新证明场景。本审核只读，没有构建或修改四原仓库。

## 阻塞问题

1. **P1 状态损坏后单游戏恢复会重写全局状态和高水位。** `GameResourceStore.kt` 初始化解析任一字段异常时设置 `stateFailure`，但 `selections` 仍可能保留四游戏默认值，`sequence` 可能只解析到一半。`restore(id, builtin=true)` 未要求可信状态，直接 `persist` 整张默认选择表并清除故障。这会把其他游戏已安装 active/ready、最高编号和隔离状态丢失；若 sequence 未读到，高水位回到 0，旧签名目录可重新被接受。须 fail closed，按四游戏逐一验证恢复完整副本和不可回退的高水位，或明确全局恢复流程且在可信高水位重建前停止在线资源接受；不能由单游戏恢复覆盖其余游戏。加多游戏状态损坏点、重启、恢复及目录重放测试。
2. **P1 坏 ready 或旧缓存代理会阻塞完整 active/内置游戏。** `GameResourceStore.kt` 的 `openSession` 在读取现有 ready 时先要求 `cacheProxyCleared`，再直接 `verifyVersion(ready)`；缓存代理未解除或 ready 文件/证明缺失、篡改都会抛错，旧 active/builtin 也无法进入。应仅暂停/隔离 ready 激活，仍验证并启动已完整的旧版。异常候选保留诊断和高水位，不能误删存档。加这三种条件下旧游戏可用的测试。
3. **P1 复用同一版本目录时保留旧过期证明。** `install` 若目标 identity 已存在，只调用 `verifyVersion` 并删掉含新 `catalog.signed.json` 的 staging，随后标 ready。同一 ZIP hash/contentCode 在新 `catalogSequence` 重新签发后，旧目录证明可能已过期；`openSession` 读取旧证明并丢弃 ready，导致合法新目录不能激活。须将已接受的新证明与同一 archive identity 安全绑定/更新，或禁止这种复用并说明发行方式；加旧证明过期、同包新签名目录、重启后可激活测试。

## 其他建议与已核对边界

- **P2 验签状态 API**：`acceptCatalog(ResourceCatalog)` 自身不验签即可持久化 sequence/code/hash。M4 接入时若误传 `parseCatalog` 结果会污染不可回退高水位。建议由 store 接收 envelope 并验签，或以只能由 `verifyEnvelope` 生成的可信类型表示；测试未验签输入不改变状态。
- `ResourceArchive` 在写文件前核对全包 SHA、stored 方法、UTF-8 名称、普通文件属性、CRC、逐文件 SHA/大小及中央目录/EOCD，路径从已验证清单取得。目录、特殊属性、重复名及预算失败不会写入活动版本。`garbageCollect` 保护 active/previous/ready 和被引用会话；实际 Android AtomicFile 与进程杀死场景仍须仪器验证。
- `verifyInstalledProof` 用于已存在目录的完整逐文件校验；安装新包入口调用有时效的 `verifyEnvelope`。这个分界本身正确，问题在已存在目录的证明更新与损坏 ready 处理。

本提交 `git diff --check` 无输出，审核时游戏大厅工作树干净。密钥、口令和四个原仓库工作树均未触碰。

## 修订提交复审：`251f4b53ef5d307fba43e9e4553129e8cbc730fe`

复审结论：**原三项 P1 的直接路径与 P2 不可信目录入口已修正，但新增签名历史恢复仍有两项 P1，暂缓进入 M3。** 仓库证据记录独立 JVM 28/28 与构建成功；本复审只读核对代码和测试，没有运行 Android 模拟器或访问密钥。

已落实：`restore` 在全局 stateFailure 时拒绝单游戏改写；坏 ready 校验失败时清除 ready、隔离编号并继续旧版，缓存代理未解除则保留 ready、旧版可玩；同内容目录复用时使用 AtomicFile 写入新签名证明，测试强制进入复用分支并核对 sequence=3；`acceptCatalog` 改收原始 envelope，在 store 内用固定注入公钥验签及检验时效，未验签内容不更新高水位。这些更改覆盖初审的四个直接问题。

剩余阻塞：

1. **P1 最新高水位历史损坏/缺失可降级恢复。** `journalCatalogs()` 只读取名称匹配的 `catalog-history` 文件，忽略名称损坏或丢失的最新一期；历史保留的是最新两期不同 sequence。若 state 在 sequence 读取前损坏，最新一期历史又不可读，次新签名历史仍有效，则内存 sequence=0，`recoverAllBuiltinsFromTrustedHistory()` 可把次新记录当最高，降低目录/内容高水位。建议对历史目录中未知/损坏文件 fail closed，并保留同一最高签名证明的冗余副本或等效高水位锚；测试“state 解析前坏 + 最新历史坏/缺失 + 次新仍有效”必须拒绝联网恢复。
2. **P1 state 文件缺失被当作首次安装。** 初始化 `stateFile.read()?.let { ... }` 在返回 null 时不置故障；即使 `catalog-history` 或已安装版本存在，`recoverWatermark` 只恢复 sequence/highestCode，active/ready/pinned 仍是默认值，允许继续更新。这会静默丢失已安装选择和固定恢复意图。仅空目录应视为首次安装；有历史或版本时缺 state 须标全局损坏并走显式可信恢复，四游戏先 pinned。加缺 state、已有历史/版本、重启负例。

非阻塞后续：`catalog-history` 若出现同一 sequence 的不同有效 hash，恢复流程也应 fail closed；当前 `maxByOrNull` 未明确冲突处置。Android `AtomicFile` 的重启与进程死亡时序仍需仪器测试，不由 JVM 文件适配器证明。

格式核对：修订提交 `git diff 251f4b5^ 251f4b5 --check` 报 `doc/evidence/m2-final-fixed-tests.txt:2` 一处行尾空格，来自归档构建日志；不影响代码安全结论，但提交证据副本应说明或规范化，原始输出可保留在独立检出。

## 高水位复审：`d9b8de904cb48b5144b39066e1ebba8777679a6a`

**结论：两项剩余 P1 已闭合，可进入 M3；M2 的真实 Android 故障注入和存档验收尚未完成。**

- `catalog-history` 改成 `highest-a`、`highest-b` 两份固定 AtomicFile 签名证明。两份均须存在且可验签，目录中未知文件名、坏证明或缺副本均使恢复 fail closed。同序号不同 payload hash 拒绝；写入中断留下有效新旧序号时取较高者。此设计消除了“最新坏后默用次新”的直接路径。测试覆盖最新文件删除、改名、内容损坏且旧副本仍有效的情形。
- state 缺失但 `catalog-history` 或 `versions` 已存在时现在标记全局故障，禁止自动接收目录及单游戏 restore；显式全局可信恢复将四游戏 pinned，并保留验证过的最高编号。纯新目录仍可作为首次安装。新增缺 state + 已装资源的负例。
- 证据记录首轮 30 项有 3 项失败并据此修正初始化顺序与低空间检查前的空 history 副作用；最终归档 BUILD SUCCESSFUL in 36s，JVM 30/30。归档日志的行尾空格已清理，`git diff d9b8de9^ d9b8de9 --check` 无输出。审阅时工作树干净。

剩余非阻塞边界：两份证明同属应用私有存储，若二者和选择状态同时丢失，无法离线证明曾接受的最高序号，应继续停止更新并要求可信备份/人工恢复；真实 Android AtomicFile 的进程死亡、目录同步及四游戏真实存档仍必须按 M3/M6 测试。静态/JVM 复审不能替代设备证据。
