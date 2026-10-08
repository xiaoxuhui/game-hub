# N1 v0.4 动态资源生产切片独立审阅

- 受审提交：`dc46646dcbb687f308d0f4a2f297d36bd9bd2c5c`，核查时 `HEAD=origin/main`、主仓库干净。
- 方式：只读检查产品源码、锁定提交的真实五文件清单、设计要求及已归档 Node 30/0 日志。未在主仓库或四个原游戏仓库构建、修改，也未读取密钥或用户存档。
- **结论：有一项来源真实性阻塞，需批改复审后进入 N2。** `prepareDynamicResources` 当次固定 SHA 独立克隆与原子产物路径设计合理，但独立 `--verify` 不能证明候选字节仍来自该 SHA。

## 阻塞项

**[P1] `scripts/dynamic-resources.mjs:43-54` 的候选复核没有重新绑定源文件字节。** `candidate.sourceLockSha256` 和 `bundleCommit` 只核对锁文件及大厅提交；`packDynamic(source, readStoredZip(archive))` 会根据 ZIP 当前字节重新计算摘要/长度，再与可同步修改的 `games.unsigned.json` 比较。它没有读取 `.build/dynamic-sources/<id>` 的固定 SHA 工作树并逐项比较文件字节，也未在此入口拒绝候选输出目录符号链接。因此，若在准备后、签署前改变 ZIP 中 `app.js` 并同步更新清单/ZIP 摘要，`--verify` 可通过，却仍标称 `sourceRevision=81bdef33331fefedbb858b1ce109ebc437759bb6`。这不影响刚由 `prepare` 直接生成的正确候选，但无法作为后续签署/发行的独立来源复核。

**建议批改**：在 `verifyDynamicResources` 中要求每个独立源克隆存在、origin 等于锁定 URL、`HEAD` 等于完整 SHA、工作树干净；对源目录及每个文件拒绝符号链接，要求精确五文件集合，逐文件比对候选 ZIP 的路径与字节，且输出目录本身不是链接。或在签署前从固定 SHA 重新确定性生成产物并逐字节比较已有候选。没有源克隆或任一字节不符时失败关闭。新增一个候选 ZIP/清单一起篡改但来源工作树不变的负例，确认 `--verify` 拒绝；保留正常两次重复摘要一致测试。

## 已核对且未发现新问题的部分

- `dynamic-sources.lock.json` 固定 `81bdef33331fefedbb858b1ce109ebc437759bb6`；该提交的 `examples/memory-demo` 确有 LICENSE、app.js、core.js、index.html、style.css 五文件。仓库地址固定为 `https://github.com/xiaoxuhui/game-hub.git`，动态 ID 不会与四个内置 ID 重合。
- `prepareDynamicResources` 拒绝脏的独立检出及本地来源快捷配置，在独立 `.build/dynamic-sources` 中远端克隆并检出完整 SHA；对克隆根、源目录及遍历文件做链接检查，源文件集合和 MIT License 首行检查、确定 ZIP、暂存验证和原子切换。失败路径保留先前完整候选，不涉及四个原游戏仓库。
- `dynamic-catalog.mjs` 显式选 `game-resources-v2`；`resource-catalog.mjs` 原默认参数仍是 `game-resources-v1`。v2 快照取固定仓库/枚举 tag 与完整分页，签署前核对发布 ID、每个资产名称、状态、大小、摘要及 assetId；退役条目仍需要其完整 ZIP 归属。工具未创建或上传私钥。
- Node 日志记录 30 项通过、0 失败，覆盖清单缺失/额外、来源 SHA 形式、合同、错误通道及资产缺失；文档明确提交时真实远端克隆和重复摘要仍待执行，没有把纯逻辑测试冒称生产验收。

## 范围限制

本轮没有独立运行远端克隆或签署，未验证真实网络可达性。执行端正在做干净独立检出的两次生产，应将两次 ZIP/清单摘要与 clone 的固定 HEAD、远端来源一并入档；来源真实性问题批改前，不应仅凭 `--verify` 进入 N2。
