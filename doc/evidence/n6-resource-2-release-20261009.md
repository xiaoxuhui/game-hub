# N6 资源 #2 正式发行及客户端验收

- 日期：2026-10-09（Asia/Shanghai）；资源发行通道 [game-resources-v2](https://github.com/xiaoxuhui/game-hub/releases/tag/game-resources-v2)。本阶段不发布新大厅 APK。
- 已审发行工具/生产提交：`868aaf6ebf3802cff17c0f60794e339609248b87`，CI `37939913188` completed/success。公开下载缓存键修正提交 `17037cc58be11526daa5cac4c590880e1ae71a09`，独立审阅 CLOSED。
- 示范来源 `80898b3ba78ea51a62533c42362f00a4e37421f1`；内容 #2、版本 1.0.1，原五文件、入口、存档合同保持。资源两次独立生产相同 ZIP；最终发行工具提交重新生产两次，仍为已审 ZIP。

## 公开资产

固定 Release `407394942`、标签 peeled `4aacb1f81b7fc381d2ca7fd725fd93dd109e390e` 不移动。

| 资产 | ID | 字节 / SHA-256 |
| --- | --- | --- |
| 新 ZIP `game-memory-demo-2-178d01e9ee05.zip` | 625120403 | 9510 / `178d01e9ee05f66cf22d4dd8c77fd3ddd47cb94bfce20e6e38fe406f9fde8442` |
| 新 `catalog.signed.json`，序列 2 | 625125622 | 2659 / `0428dedaa4dd8abdd5299cf1db52a0f3f8bbbbfb381bd0ec20ad58be16b31915` |
| 原目录同资产改名 `catalog-seq1-0bc8cf66fe67.signed.json` | 623482430 | 2599 / `0bc8cf66fe67f030b6628bc7e761b466ea8b53d8bf4d3c46d29788178dcfba68` |
| 原 #1 ZIP 保留 | 623482293 | 8490 / `27f1df3b689e6b4592cbfcae4a80e759a274cfd7857e2764ac2203d27bb0876b` |

匿名在线实跑核全部两份目录签名、连续序列、真实完整快照绑定及两个新旧 ZIP 原字节。结果见 `n6-successor-tool/seq2-online-verified.json`。

## 失败及处置记录

首次新 ZIP 上传后，匿名完整资产快照绑定失败，工具在签署/改名之前停止。只读重新抓取快照，确认旧 current ID/摘要未变、新 ZIP ID/大小/摘要匹配后，在新证据目录继续同一个序列 2，复用匹配 ZIP。未覆盖、删除或重复编号。

发行成功后固定同名 CDN 目录下载短时返回旧字节，在线精确比对失败。匿名独立请求加缓存区分后 SHA 与新 API 资产一致；据此修正匿名工具，使缓存键包含不可变资产 ID，保持固定 origin/路径、大小/摘要及本次已签字节断言。Node 40/40 和实际在线审计通过，修正提交后独立审阅 CLOSED。所有失败输出保留；未把失败当通过。

页面首次 uiautomator 快照为空或仅含 WebView 外壳，改取稳定截图确认，不从空快照断言功能。真实 SAF 创建文件后首次拉取为 0 字节，精确摘要断言失败；只读等待写入完成、核远端 stat 为 144 后重新拉取，原摘要断言通过。没有改小验收条件。

## 正式客户端实际验收

仅操作本任务 `emulator-5562 / gamehub-resource-20261008`，安装既有正式 APK。启动时尚处于发行前目录，之后从真实游戏目录点击“检查新游戏与更新”；未点击下载按钮，已安装示范按既有自动更新设置下载，页面显示“资源已就绪，下次进入生效”、候选 v1.0.1。点击真实“打开配对练习 · 示范”后激活，新页面显示键盘提示及 `已找到0/3对 · 1步 · 累计0胜局`。截图已实际查看。

从 #2 实际系统 SAF 导出同一自身进度，更新前后都为144字节，SHA-256同为 `5dd0b7e0147736ab08693a8032661c82de834284bb0d3d61d7a6760b66e14c05`。原始存档不公开；只归档形状/摘要。

显式生产身份仪器实际 `OK (1 test)`、0.235s：生产 ResourceRuntime 单例 active=`2-178d01e9ee05f66cf22d4dd8c77fd3ddd47cb94bfce20e6e38fe406f9fde8442`、ready=null、来源80898b3、合同memory-demo-dynamic-v1。安装 base.apk 仍 `c6e071e18eac1cb97f3d898d6eb4dab2c790b8d9310a907a7e44e3c34a78ee39`、hostCode4。真实 Chromium 六组键盘/焦点/存档交互已在功能切片验收，并以同来源 ZIP 字节绑定。

四原仓库完整 SHA/工作树状态与原冻结记录一致，包括 EML 的22项既有用户改动，不构建或修改原仓库。用户真机验收按授权留发布后人工执行，异机密钥备份仍为明确待办。

本记录提交后独立发行复审，闭环后进入 N7 两新游戏；N8 全部发布验收后集中清理，继续保留总览勾选框。
