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
