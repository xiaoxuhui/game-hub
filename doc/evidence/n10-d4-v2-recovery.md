# N10-D4 v2 上传后恢复与 v1 在线结果

v1 在已审核 producer `c79b231a7accdfed608c9e8d475a81eec5db6136` 的12/12独立候选一致后完成限定恢复。新当前目录 ID `628440780`、SHA256 `972f58066a0ebf2aad8180318783a0ae33a449a1285cde01239b17886d3b86de`；旧 ID `623110620` 改为 seq1 历史名称、原摘要不变。首次在线验收与紧接只读复核报字节不一致，未重复写入。随后只读诊断当前/历史实际字节均匹配，再执行严格 online 退出0：seq2、两份签名历史、六累计ZIP完整摘要通过。首次失败未存资产字节，不能断言具体 CDN 根因。

v2 普通发行 preflight seq4 通过，Lambda code2 ZIP 上传 ID `628444055`、102362B、SHA `0ee2f0ef41545e2364172a3ec2c74481c9cb16ae3c6361a66786f24d0594cdb9`，其余三ZIP重用。payload阶段 `Asset identity mismatch` 停止，没有 signing-snapshot/payload/catalog/activation/published 文件，未解密私钥或签名。只读 reconcile 四资产ID/大小/摘要/状态完全匹配，原目录 ID `625643138`、SHA `7a0312859ae27ccec42e737006a4deb46d57e7620cdd44dbfb8619a377bb17ac` 与公开字节及生产签名仍为seq4。初次失败快照同样未保存，只能记录停止点与后续状态。

v2修订沿用已审v1的限定恢复：仅N10且原三记录齐全、禁止任何payload/签名/激活/既有resume记录；先匿名认证原生产签名及固定release、当前精确旧ID/摘要、完整原目录资产、四唯一上传记录与实际候选ID/大小/摘要/状态，精确nextseq/累计身份/防回滚策略再验证。通过后一次性写resume snapshot；后面任何失败需只读协调，不能自动重执行。恢复跳过ZIP上传、保留原记录，再走原fresh payload/首次签名/历史归档/新目录最后激活/online。旧legacy/n9范围拒绝恢复。

Node全回归53通过/0失败/0跳过；新增拒绝例覆盖current ID/摘要、记录缺失/重复、资产ID/size/state/digest伪造及实际资产缺失。PowerShell语法与diff --check通过。先提交、独立复审CLOSED，然后从新clean完整SHA普通重生产，展开：

```powershell
./scripts/publish-resource-successor.ps1 -TaskScope n10 -ResumeAfterUploads -Commit <新已审clean完整SHA> -ExpectedPreviousSha 7a0312859ae27ccec42e737006a4deb46d57e7620cdd44dbfb8619a377bb17ac -NextSequence 5 -EvidenceDirectory D:\soft\.ci-tmp\game-hub-n10\evidence\publication\v2-seq5
```

真实旧大厅已有light候选2，但三游戏正常UI激活与正式存档verify尚待执行；v2尚未发行，APK0.4.1仍待开发门禁。
