# N10-D3 v1 上传后限定恢复独立首审（2026-10-11）

受审已推送提交 `c7ff66adbf7f8179813ed0589368f75447cb52b5`，工作检出干净。结论：**产品恢复门禁可接受；P3 证据格式 OPEN，批改后复审 CLOSED 才执行续行。** 审阅只读代码、候选和公开证据；没有执行发行器、签名、上传或读取密钥。

## 待批改

- **P3，公开日志格式。** `git diff c7ff66ad^ c7ff66ad --check` 报 `doc/evidence/n10-d3-recovery/d3-companion-build.log:2` 行尾空格及 `d3-seed.log:7` EOF 额外空行。只将公开副本规范为逐行末尾无空格、单个末尾换行；保留私有原始输出及其摘要，并在批改记录说明文本结果没有变。重跑 `git diff --check` 退出 0。此项不改变恢复控制流或设备结论。

## 控制流核对

- PowerShell `-ResumeAfterUploads` 仅接受同一任务 evidence 根下已有 `before-snapshot.json`、`previous.signed.json`、`uploaded-resources.json`，拒绝任何已到 payload、signing snapshot、signed catalog、activation intent、published 或既有 resume snapshot 的证据。它先要求精确 clean、已推送源码与固定正式标签，再运行匿名 `resume`；匿名检查失败不会取得凭据。进入恢复分支后不再调用 ZIP 上传，随后复用原 `payload`、首次签名、历史目录改名、最后发布当前目录及 strict online 验证流程。
- Node `resume` 用生产 DER 验证 `previous.signed.json` 的完整预期 SHA 和签名；重新匿名获取固定 release 的完整分页资产，确认初始记录中的原 current 目录 ID/摘要与当前 current 的同一 ID/摘要、状态 uploaded，原 catalog 的四个历史游戏资源仍按 ID/大小/摘要绑定。四条已上传记录要求唯一名称、恰好四条，逐条与当前候选及新匿名资产 ID、状态、大小和摘要匹配；`v1SuccessorPayload` 再验证精确下一序号、合同、同 contentCode 不可更换元数据及防回滚。`captureReleaseSnapshot` 本次加 `Cache-Control: no-cache`，未放宽分页、字节预算或下载 URL 约束。
- `resume` 认证后写入一次性 `resume-snapshot.json`；如果之后凭据或第二次匿名 payload 查询失败，脚本会保守拒绝再次自动续行，需要人工只读核对并另行制定恢复步骤。这个一试即停的活性限制与“未知结果不重签/不重传”的安全边界一致，本轮未把它误称为任意失败均可自动重试。

## 证据与边界

- 实际候选依然绑定 `6345e4cbf3bfe9769d34d2227855092e2c2ca7e0`；我逐项复算 `final-candidate-hashes.json` 中 **12/12** 当前文件大小和 SHA 全匹配。D3 已推送报告提交不是可直接发行的 producer SHA；复审 CLOSED 后须按新的干净精确 HEAD 重新生产并普通验证，才能在同一证据目录使用恢复入口。此审阅未把旧候选认作可发布资产。
- 公开首轮发行日志显示匿名 preflight 成功、随后 `Asset identity mismatch` 停止；只读 reconcile 日志显示四 ZIP 的公开 ID/大小/SHA 与上传记录相同，新光学 ID `628400804`、图灵 ID `628400874`，原 current 目录仍 ID `623110620`、SHA `e7f017b35cbb2fad04f5a521c47508f3616fea0ef471f4bd7245f42cd02f7d62`。失败时未留下快照，无法证明当时的具体不可见条目；报告把“资产可见性延迟”保留为符合观察的推断，未作确定根因陈述。
- Node 日志 **52/52、0 失败/跳过**，新增负例覆盖 current ID/摘要、上传记录数量及 ID/大小/状态/摘要变化；这仍不是一次真实续行演练。旧正式 0.4.0 设备 seed 日志 `OK (1 test)`，另三条游戏真实存档 PASS；这些证据只属于发行前旧版种档，不代表新版正式资源已激活或升级通过。正式 v1 seq2、设备升级及 0.4.1 均保持待执行。
