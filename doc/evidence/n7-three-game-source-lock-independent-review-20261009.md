# N7 三游戏来源锁独立审阅

- 日期：2026-10-09
- 受审提交：`802c8af9da6f4dbd9614fe691950e2c8497aa340`，本地 `HEAD=origin/main` 且工作树干净；`git show --check` 无格式错误。
- 范围：`dynamic-sources.lock.json` 的两款新增游戏、N7 计划状态和 Node 证据。只读审阅；未修改或构建主仓库、上游原仓库，未生产、签署或发布资源。

## 结论

**CLOSED，无阻塞，可进入干净独立检出的 seq3 资源生产切片。** 新游戏均引用先前已提交且经独立审阅的大厅集成来源完整 SHA `c46ec6d3cabc6df9ecd90409649b89d765a0a5a9`，不是本次锁提交或浮动分支。已发行 `memory-demo` #2 的锁对象与父提交逐字段完全相同。

## 核查

1. `abelian-sandpile` 为 `0.1.2` / 内容编号 1 / `puzzle` / `index.html`，锁定 14 个文件；`lambda-diagram-game` 为 `0.3.0` / 内容编号 1 / `logic` / `lambda-lab.html`，锁定 3 个文件。对固定 `c46ec6d…` 运行只读 `git ls-tree -r`，两者的全部路径集合分别与锁完全一致，入口和 MIT `LICENSE` 都包含在内；两个 `revision` 均解析为现有 Git commit，且该提交是受审锁提交的祖先。两者来源仓库都是固定 `https://github.com/xiaoxuhui/game-hub.git`，包内 `upstream-source.json` 另保留原上游完整 SHA、版本、输入及产物摘要。
2. 原上游分别固定 `d58e2b1d06c3dfdf6cd25b65986c1d494759ed7f`、`11b0aef6dcac9a37abdc08cde25ea0efd1f8f6a2`；包内证明的版本与锁的 `0.1.2` / `0.3.0` 一致。集成来源已经在 `n7-integration-source-independent-review-20261009.md` 独立审阅 CLOSED，包括构建输入 Git blob 字节、MIT、重复生成和真实浏览器玩法。本次来源锁未重新定义上游身份，也没有把原仓库当前 HEAD 当成资源来源。
3. 两条新锁记录均为 `available:true`、合同 `<id>-dynamic-v1`。现有 `packDynamic` 生成协议 2、桥 1、最小宿主 code4，并用动态目录校验器及精确合同规则拒绝不合规条目。锁的 `releaseNotes` 没有声明游戏已发行；N7 计划仍把 ZIP 生产、签署、发布、正式客户端用户主动安装/SAF 列为后续门禁。
4. 独立检出上的 `three-source-lock-node-check.txt` 记录 Node `42/42`、失败 0、跳过 0、约 9.73 秒。日志中的预期负例 `fatal: unable to read tree (ffff…)` 隶属锁拒绝测试，最终测试总数通过。`memory-demo` 原完整 SHA `80898b3ba78ea51a62533c42362f00a4e37421f1`、版本 `1.0.1`、内容编号 2、文件、入口和合同均未改变。

## 下一切片边界

本次没有将三游戏锁解析成功等同于产出可发布 ZIP。后续应在干净独立检出按固定来源 SHA 生产两次并逐字节比较候选，核包内完整文件/许可/证明，再单独审阅 seq3 发行工具和实际公网/正式客户端验收。固定 v0.4.0 APK 与旧序列/资产不得因本锁提交移动。
