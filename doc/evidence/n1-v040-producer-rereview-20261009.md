# N1 动态资源生产来源证明批改复审

- 批改提交：`2068a6dbf0896dd3c8905c507fc578a570456961`（父提交 `dc46646dcbb687f308d0f4a2f297d36bd9bd2c5c`）；核查时 `HEAD=origin/main`，主仓库干净。
- 审阅方式：只读检查源码差异、负例控制器及批改记录；未在主仓库或四个原游戏仓库构建、修改，未读取密钥或用户存档。
- **源码结论：首审 P1 已修正。** 批改后精确干净提交的两次实际远端生产正在执行；最终 N1 验收仍应附上该提交的真实摘要及负例日志，不能沿用父提交候选的 `candidate.json` 摘要。

## P1 复核

1. `scripts/dynamic-resources.mjs:43-55` 新增 `lockedSourceEntries`：要求 `.build/dynamic-sources`、源克隆和内容目录的真实路径等于预期，origin 与来源锁仓库 URL 一致、`HEAD` 等于完整固定 SHA、工作树干净；遍历每个源文件时拒绝链接/特殊文件，并用 `git show <固定SHA>:<锁定目录>/<文件>` 的原始 blob 逐字节比较工作文件。缺克隆或不一致均失败关闭。
2. `verifyDynamicResources:63-74` 先拒绝输出目录链接、检查候选提交/锁哈希/精确文件集合，再把 ZIP 逐项解包，并让 `verifyPackedDynamic` 同时从锁定源文件确定性重打包；archive 与候选 metadata 必须同时等于重新打包结果。因此同步修改 ZIP、games.unsigned.json、候选资源摘要也不能伪称锁定 SHA。`prepareDynamicResources` 也复用相同来源证明后才写暂存并原子切换。
3. `tests/dynamic-resources.test.mjs` 新增同步篡改纯函数负例。归档的真实控制器在独立检出里同步伪造 ZIP 与 games.unsigned.json，真实 `--verify` 报 `Dynamic candidate differs from immutable source bytes`，`finally` 恢复后正例重新通过；另把源 app.js 转 CRLF 导致 Git 工作树脏并拒绝，记录没有错误宣称命中 blob 差异分支。代码中的逐字节 `git show` 比对仍覆盖了即使 Git 状态归一化的情况。
4. `git diff dc46646 2068a6d --check` 无错误。锁定 SHA、v2 枚举 tag 和 v1 默认接口未改变，未引入四原仓库写入。

## 待补充实际生产证据

首轮 `dc46646` 独立检出两次真实生产已有同一 8,490 字节 ZIP SHA `27f1df3b689e6b4592cbfcae4a80e759a274cfd7857e2764ac2203d27bb0876b`；该 ZIP 可继续复用，但 `candidate.json` 内的提交号应变为 `2068a6d…`。执行端正在从精确干净 `2068a6d…` 重新生产两次；收到新日志后再确认候选三文件摘要、固定源 clone 身份和真实 `--verify` 负例复跑结果，并把此记录更新为最终放行。

## 批改提交实际生产复核与最终结论

- 独立生产检出 `HEAD=2068a6dbf0896dd3c8905c507fc578a570456961`，工作树状态空；其 `.build/dynamic-sources/memory-demo` 为固定远端 `https://github.com/xiaoxuhui/game-hub.git`、`HEAD=81bdef33331fefedbb858b1ce109ebc437759bb6`、工作树状态空。
- `D:\soft\.ci-tmp\game-hub-work\v030-evidence\n1-clean-node.log` 记录 31 项通过、0 失败。`n1-clean-producer.log` 连续两次实际生产并验证成功。`n1-clean-repeat.json` 三文件摘要与当前候选重新计算全部一致：`candidate.json` 164 字节 SHA `a1254468adceab880b8602f1f3ea9e0b3e55c6c0e707f72ef9382b9d13fd1de0`；ZIP 8490 字节 SHA `27f1df3b689e6b4592cbfcae4a80e759a274cfd7857e2764ac2203d27bb0876b`；`games.unsigned.json` 1685 字节 SHA `878c7c00eef25df39a9ca9664fa9a1b730fc3ba5e06712f34cd62511183f5e30`。
- `n1-clean-negative.log` 真实同步篡改 ZIP 和候选 metadata 后，`--verify` 因 `Dynamic candidate differs from immutable source bytes` 拒绝，恢复后正例通过；把源 app.js 改为 CRLF 时 Git 报 `M` 且来源证明拒绝，恢复后正例再次通过。负例没有污染最终候选。
- **最终结论：首审 P1 已由代码和真实独立生产/负例证据闭环，N1 生产切片放行进入 N2。** 本轮未签署、上传或发布动态资源；后续签署仍须使用同一候选摘要和固定 v2 资产归属检查。
