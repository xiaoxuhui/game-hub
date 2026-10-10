# N10-D3 匿名资产可见性延迟与限定续行

已审生产/控制器源码 `6345e4cbf3bfe9769d34d2227855092e2c2ca7e0`：两普通严格producer12/12候选一致；同正式证书伴随APK `0ba53ba859920c10a79937d8585901905a182d2990e61f1b75f3e775ec222c3f` 组装成功。真实正式旧0.4.0正常目录下载/打开Lambda0.3.0/code1后，三真实旧存档seed `OK (1 test)`，三游戏独立PASS日志留存。

v1seq2首次发行：匿名preflight验原seq1/完整候选通过；两个新ZIP成功上传（light asset628400804、turing628400874），另两原ZIP重用。随后新匿名snapshot的payload校验`Asset identity mismatch`，工具在任何密钥解密/签名/目录激活前停下。只读核对稍后匿名四资产ID/大小/SHA全部与已上传记录一致，旧catalog仍asset623110620/完整SHA e7f017…；表现符合短暂资产可见性延迟。首次失败快照未落盘，无法逐项证明当时是哪一资产尚未匹配，故原因保留推断边界。没有重传ZIP或重新执行初始发行器。

修订：公共snapshot请求声明no-cache；v1加入仅`-ResumeAfterUploads`入口，要求三个已成功记录及禁止已有payload/signing-snapshot/catalog/activation/published/resume记录。匿名resume认证原生产签名、当前原catalog精确ID/摘要、旧完整asset绑定、四唯一已上传记录与当前候选精确ID/大小/SHA、nextseq和合同，再读凭据。跳过ZIP上传，继续原已审payload→首次签名→旧catalog历史改名→新catalog最后激活→匿名全历史实际字节验收。任何已签/已激活/未知后续状态不得用此入口重复执行。

工具修订需提交后独立审阅；CLOSED后从新的clean完整SHA普通重生产，再展开续行同一已核对证据目录：

```powershell
./scripts/publish-resource-v1-successor.ps1 -TaskScope n10 -ResumeAfterUploads -Commit <新已审clean完整SHA> -ExpectedPreviousSha e7f017b35cbb2fad04f5a521c47508f3616fea0ef471f4bd7245f42cd02f7d62 -NextSequence 2 -EvidenceDirectory D:\soft\.ci-tmp\game-hub-n10\evidence\publication\v1-seq2
```

该记录不将上传完成冒称目录发行或设备升级通过。新资源的正式UI激活、存档verify、离线restart与APK0.4.1仍待后续执行。见本次原始publisher/reconcile/seed与生产摘要日志。
