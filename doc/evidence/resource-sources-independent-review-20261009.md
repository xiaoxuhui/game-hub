# 独立资源生产切片审阅（2026-10-09）

- 受审提交：`898fa6a5c6705adc0bc14fc3ddbd91d7d11c426a`；主仓库只读，未在主仓库或四原游戏仓库构建或修改。
- **结论：固定来源、APK 基线隔离和 unsigned 手动工作流的主要边界成立；实际干净检出 CLI 自验又发现一项 P1 死锁，候选核验另有一项 P2 缺口。两项均应批改并在新提交的干净独立检出复跑 `prepare:resources`，然后再放行下一开发切片。** 目前 Node 22 项通过；先前真实四远端固定 SHA 的 40 文件构建和四 ZIP 重复哈希属于开发 `00b53f1` 检出的 `assemble` API 实测，不能替代当前提交的 CLI 验收。

## 需要批改

1. **P1 新 CLI 的异步循环导入造成实际命令卡死。** 主执行端在干净 `898fa6a` 独立检出运行 `prepare:resources`，四源 40 文件已构建后进程以 exit 13 结束，未生成完成的四 ZIP 候选。`scripts/resource-sources.mjs:34,41` 的 `prepareResources()` 动态导入 `resource-bundle.mjs`，而 `resource-bundle.mjs:7` 静态导入仍在顶层 `await prepareResources()` 的 `resource-sources.mjs`，形成未解决的模块求值循环。Node 单测直接调用 `buildResources`，未走该 CLI 路径；此前 CI 成功也不能证明手动工作流的命令可运行。建议去掉入口顶层 await，改以 promise `.catch()` 设置非零退出码，或打破循环依赖；在全新干净独立检出复跑命令，归档退出码、四 ZIP 和 `verify:resources` 结果。该发现由主执行端实测提供，本审阅没有另行复跑。
2. **P2 候选目录的额外文件未被拒绝。** `scripts/resource-bundle.mjs:98-115` 只读取 `candidate.json`、`games.unsigned.json` 和四个由 `assetName(game)` 推导的 ZIP，未核对 `output` 顶层文件集合。向下载的候选目录加入任意额外文件（包括未审阅 ZIP 或敏感文件）后 `verify:resources` 仍会打印验证成功；这与手册所述“候选包含四 ZIP、games.unsigned.json 和 candidate.json”的可核查内容范围不符。建议对目录项做精确集合比较，拒绝子目录、链接、其他普通文件，并加“多一个文件/目录/链接”负例。生成器新 staging 当前只写六项，风险主要在后续手动下载/复核 artifact 的完整性门禁。

## 已核对的正向边界

- `resource-sources.lock.json` 保留四固定 ID 的完整 40 位 SHA；本次值与 APK `sources.lock.json` 的固定四基线相同。`resourceInputs()` 同时读取不可移动 APK 锁、独立资源来源锁、发行编号锁，以严格 JSON 解析；仓库、构建类型、入口合同不得漂移，编号 1 不能换源，发行编号与来源 SHA/存储合同绑定。三个锁的原始字节 SHA-256 写入候选，验证时须匹配同一大厅完整提交。
- `prepareResources()` 要求干净 checkout、拒绝 `GAME_HUB_LOCAL_SOURCES`，通过现有 `assemble` 对四个指定远端提交分别 clone、detach 并再次核对 HEAD；源码构建和复制发生在 checkout 内 `.build` 的独立子目录，资源候选使用 `.build/resource-source-assets`，没有写入 APK 的 `android/app/src/main/assets`。原游戏仓库不被用作构建目录。
- `buildResources()` 对资源清单、固定入口、图灵机关卡/Worker、许可、存储清空与 SW/CacheStorage 模式、逐文件 SHA 和 stored ZIP 做核验； staging 失败保留旧候选，成功再目录替换。新增 Node 负例覆盖资源锁/编号不一致、编号 1 换源、仓库替换、元数据更改使旧候选失效。静态扫描不等于真实存档兼容验收，手册也已注明。
- `.github/workflows/resource-candidate.yml` 仅 `workflow_dispatch`、`contents: read`，在 Actions 独立 checkout 中执行检查、准备、验证并上传 unsigned artifact；没有私钥、签名、tag 或 Release 步骤。手册把签署、发布、异机备份与兼容验收保留为独立门槛，未授予本切片自动发布能力。
- 证据 `resource-sources-original-state-20261009.txt` 记录四原仓库 HEAD/工作树（EML 原有 22 条变化保留），重复 ZIP 摘要一致；`resource-sources-20261009.md` 明确当前尚未运行新提交的真实 CLI/远端手动工作流、也未签署或发布。`git diff 898fa6a^ 898fa6a --check` 无输出。

## 验收边界

`verifyResources()` 对下载候选的哈希与元数据是自洽检查，不能单独证明字节必来自声明的四个 Git SHA；发行前仍须按手册在干净独立检出重复构建、比较四 ZIP 哈希并做四游戏存档/桥/Worker 兼容验收。本切片不构成资源通道发行许可。

## 35687d8 批改静态复审（2026-10-09，待 CLI 实测）

- 受审提交：`35687d8545f23deed68ba00c8f46988815f782f7`。本轮只读检查代码和新负例；主执行端的新干净检出 CLI 尚在运行，**此时暂不标 P1 端到端闭合或放行下一切片**。
- P1 的静态修订方向正确：`resource-sources.mjs:41` 改为调用 `prepareResources(...).catch(...)`，入口模块可先完成求值，之后动态导入静态反向引用它的 `resource-bundle.mjs`，消除前版顶层 await 形成的求值等待环。失败会打印错误并置非零退出码。旧 clean CLI exit 13 日志已归档，没有冒充其为成功。
- P2 已从代码与负例闭合：`resource-bundle.mjs:105-106` 精确比较候选顶层为四个 `assetName(game)` ZIP 加两 JSON，逐项要求普通文件并拒绝符号链接；测试加入额外普通文件、目录、Windows junction/类 Unix 符号链接三种拒绝。Node 22 项通过；`git diff 35687d8^ 35687d8 --check` 无输出。
- 完整闭环仍取决于在干净 `35687d8` 独立检出实际运行 `prepare:resources` 与 `verify:resources`，记录退出码、40 文件、四 ZIP 哈希及主仓库/四原仓库状态；工作流远端未运行，签名/发布亦未进行。

## 35687d8 干净独立 CLI 实测闭环（2026-10-09）

- 主执行端在 `D:\soft\game-hub-resource-producer-20261009` 的干净 `HEAD=35687d8545f23deed68ba00c8f46988815f782f7` 运行新 `prepare:resources` 与 `verify:resources`，报告总退出码 0。审阅端只读查看原始日志：四源构建 40 文件、四个 ZIP 完成，独立 `verify:resources` 输出 4 ZIP/完整清单成功；我又在同一独立检出**只读重跑验证命令**，退出码 0，未重新构建。审阅前后 `git status --porcelain=v1 --untracked-files=all` 为空。
- 候选恰有 `candidate.json`、`games.unsigned.json`、四 ZIP。`candidate.json` 的 `schemaVersion=2`、`sourceMode=independent`、`bundleCommit=35687d8...` 与检出一致；其中三锁 SHA-256 与我对该检出三个锁文件的只读计算逐一相同。四 ZIP 摘要分别为 conway `77af28d46a71...ed5cc65`、eml `20205b0dfba4...b29f90e6`、light `9df0cadcfc97...30c0`、turing `e633a50595e9...339ce1`，与前次开发检出重复构建的四个摘要一致。
- **最终判定：P1/P2 均闭合，可进入下一开发切片。** 旧失败日志保留，现有证据明确区分开发 `00b53f1` 的 API 实测与 `35687d8` 干净 CLI 实测。手动 Actions 工作流尚未远端运行、候选仍 unsigned；真实四游戏存档兼容、签署和公开发行继续作为后续门禁。
