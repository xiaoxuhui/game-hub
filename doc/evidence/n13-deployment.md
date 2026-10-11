# N13 八仓部署及云端验收

日期：2026-10-12。每仓默认分支推送后用 git ls-remote 确认完整SHA，八次workflow_dispatch全部success；八份artifact ZIP摘要与GitHub digest一致，JSON对象/私有性/默认分支/调用SHA/实现SHA/checked及未发行状态逐一验证。

| 仓库 | 分支 | 北京时间 | 部署提交 | 实际运行 |
| --- | --- | --- | --- | --- |
| game-hub | main | 09:17 | f8ef2ba9f99b31f4e18b7c1b2caf3b0d20ea3cb8 | [success](https://github.com/xiaoxuhui/game-hub/actions/runs/38176846593) |
| conway-life-game | main | 09:18 | f1e357f2a1c2618241ed58985101da6beb00d263 | [success](https://github.com/xiaoxuhui/conway-life-game/actions/runs/38176849740) |
| EML | main | 09:19 | 6a1cfc4b7ab5655a28e474a944e6c57aec2babd4 | [success](https://github.com/xiaoxuhui/EML/actions/runs/38176853567) |
| light_game | main | 09:20 | 4a789cd6a43bcbb4db1e481c5cf9ae3896b89d7f | [success](https://github.com/xiaoxuhui/light_game/actions/runs/38176856941) |
| turing-machine-simulator | main | 09:21 | c54f38324f831c5ff5fbc19faf6fd910e984ca84 | [success](https://github.com/xiaoxuhui/turing-machine-simulator/actions/runs/38176860309) |
| abelian-sandpile | main | 09:22 | 6db1198ed878b502b4e6e6bae1f49ceb4ef7b3ba | [success](https://github.com/xiaoxuhui/abelian-sandpile/actions/runs/38176863390) |
| lambda-diagram-game | master | 09:23 | fd0be3741c537454a7f16a38354359ba36973d6c | [success](https://github.com/xiaoxuhui/lambda-diagram-game/actions/runs/38176866447) |
| mini-app-harness | main | 09:24 | 私有归档保留完整SHA | 私有Actions success，report已核验 |

所有包装器和公共实现均为contents:read，不传递secrets:inherit。公开仓仅保存七个公开报告；私有第八份报告、执行ID、完整SHA和artifact保留在本机私有恢复归档及其自身私有Actions。

首次实际schedule触发尚未到时，未声称已观测；已确认八个默认分支工作流active，并验收同一工作流的手动触发。GitHub可能延迟/禁用长期无活动任务。

本轮未打游戏/大厅版本标签、未更换发行证书、未更改已签资源目录。每仓发布状态明确blocked/release-contract-not-configured，自动候选、迁移与签名发行仍列后续待办。
