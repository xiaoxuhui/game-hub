# N1 生产切片独立审阅批改

首审dc46646，review_p1；P1来源证明不足已批改。

- verify现在必须有真实独立源码克隆，固定remote/完整HEAD/干净状态/根目录与内容目录非链接；每个工作文件还与`git show SHA:path`原始blob逐字节比较，再从这些源码确定性打包，与候选ZIP和metadata完全比较。缺源克隆、输出目录链接、同步篡改均失败关闭。
- dc46646真实干净独立检出从远端81bdef33331fefedbb858b1ce109ebc437759bb6克隆生产两次，候选3文件摘要完全一致。示范ZIP8490字节、SHA27f1df3b689e6b4592cbfcae4a80e759a274cfd7857e2764ac2203d27bb0876b。源码及生产检出当次状态干净。
- 修改验证实现后实际`--verify`正例通过。控制器同步篡改ZIP与games.unsigned.json所有摘要，真实verify报`Dynamic candidate differs from immutable source bytes`；finally恢复后正例再次通过。
- 将独立源码app.js换CRLF，Git状态实际报告M，真实verify因dirty拒绝，finally恢复。此实验不能声称命中blob差异分支；代码另逐字节比对Git blob。原始控制器归档，可核查具体动作。
- 隔离Node31/0，包括纯函数同步篡改回归。工具批改后完整干净提交的再生产及提交后独立复审待执行，N1整体不提前标VERIFIED。

四原游戏仓库未参与本切片克隆或构建，不改变原来源锁。本轮尚未签署/上传动态资源或发布v0.4.0。
