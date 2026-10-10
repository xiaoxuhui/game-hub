# N10-D4 v2 上传后限定恢复：独立只读审阅

受审产品提交 `392679503556185926d92af03a970a12109ba179`；日志归档提交 `c5c2dcc5124703b2ee2e2e39312414c4115745c3`。**结论：CLOSED，可在新的已审、干净且已推送的完整 SHA 上普通重生产后，按限定入口继续。**本次没有执行恢复、签名、上传或发布，也没有读取私钥。

## 已核对的门禁

- `scripts/publish-resource-successor.ps1:26-34,49-57,77-87`：`-ResumeAfterUploads` 仅接受 N10；须有旧快照、旧签名目录和完整上传记录，任何 payload、签名、激活、发布或旧 resume 记录存在均拒绝。通过后读取新的匿名快照，整个 ZIP 上传分支跳过，旧 `uploaded-resources.json` 不被覆盖。恢复检查写出唯一 `resume-snapshot.json`；随后失败不能直接再次进入恢复入口。
- `scripts/resource-successor.mjs:17-24,36-47,78-85`：旧目录原字节必须匹配指定 SHA 并通过生产 DER 签名；真实固定 Release 完整分页经匿名获取，当前目录精确匹配原 ID、SHA 和 `uploaded` 状态；旧目录全部资产按 ID、名称、长度和摘要绑定。四候选由当前固定来源锁及原字节验证，四份上传记录必须唯一且与实际 Release 的 ID、长度、摘要、状态逐一相同；精确下一序号和累计身份策略由 `successorPayload` 验证。
- `scripts/publish-resource-successor.ps1:35-45,86-110`：仍要求完整 commit、干净独立检出、远端 main 同 SHA 和两个固定标签未移动。恢复后沿用 fresh payload、首次签名、旧 current 按 ID 再检查、历史改名、新目录最后上传及严格匿名 online 验证；没有重新上传 ZIP 的路径。签署前后失败不会自动重试远端写入。
- `tests/resource-successor.test.mjs:59-73` 对当前 ID/摘要变化、上传记录缺失或重复、伪造 ID/大小/状态/摘要、实际资产缺失均有拒绝断言。归档 Node 结果为 53 通过、0 失败、0 跳过；PowerShell 语法和 diff 检查记录与受审改动相符。

## 证据边界与非阻塞观察

- `doc/evidence/n10-d4-v2-recovery.md` 与 `n10-d4/d3-v2-publisher.log` 一致：v2 首次仅上传 Lambda ZIP 后在 payload 阶段因 `Asset identity mismatch` 停止；未产生 payload、签名或激活记录。`d4-v2-reconcile.log` 给出四份资产的 ID/大小/摘要及旧 seq4 未变的结论。首次失败时的 API 快照未保存，文档明确此限制。尚不能声称 v2 恢复或发行已经完成。
- `n10-d4/v1-online-verified.json` 记载 v1 seq2、两份目录历史与六份累计资源；文档如实保留首次在线字节检查失败和后来只读核对成功的区别。归档日志是结果副本，不是完整终端原始记录；原始记录由主执行端私有保存。
- 恢复入口将实际候选的 ZIP 和资源元数据绑定到**本次**已审来源锁与上传记录；旧失败目录没有保存完整旧候选清单，所以无法仅凭该目录独立证明首次尝试的全部展示文案等非 ZIP 字段。当前来源锁从首次尝试的 `c79b231a` 到受审 HEAD 未变化，且新 SHA 仍须审阅并重生产；此处不构成本次放行阻塞。建议最终发行记录写明新 SHA 与重生产候选摘要。
- 本轮只静态核对恢复分支和已归档单元结果，未实测真实 `-ResumeAfterUploads` 的网络竞态、凭据或 GitHub 写入结果；这些仍以恢复实际输出和最终匿名 online 验证为门禁。

本报告仅写审阅文件，未修改主仓库、原游戏仓库或任何发布资产。
