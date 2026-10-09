# N6 公开资源缓存键与序列 2 发行独立审阅

日期：2026-10-09。受审提交 `17037cc58be11526daa5cac4c590880e1ae71a09`，`HEAD=origin/main`、主仓库干净，`git show --check` 无格式错误。仅只读核对源码、证据和 GitHub 匿名公开 API；未改产品/原游戏仓库、未构建、签署或发布。

## 结论

**CLOSED：本切片无阻塞。** 可继续正式 v0.4.0 客户端的资源 #2 更新与旧进度保留验收。资源签署和公开资产核验通过不等于客户端更新已经验收。

## 核查结果

- `scripts/resource-successor.mjs:45-55` 新增 `publicDownloadUrl`：要求正整数安全资产 ID，URL 必须为固定 `https://github.com` origin 和精确 `xiaoxuhui/game-hub/releases/download/game-resources-v2/<asset.name>` 路径，再以同一 API 返回的不可变资产 ID 设置 `verified_asset_id` 查询键。同名 `catalog.signed.json` 的新旧 ID 产生不同缓存键。`download` 仍限制字节数、要求 HTTP 成功、`uploaded` 状态、API 大小及 SHA256 匹配；`online` 还逐字节比较本次已签文件并以生产公钥验签，没有用缓存键代替内容鉴别。新增 Node 负例拒绝外域和无效 ID，归档日志 40/40、0 失败/跳过。
- 首次资源上传后，日志显示新 ZIP 核验通过但 `Asset identity mismatch`，发生在 `Prepared asset-bound successor` 和签署输出之前；没有该次签名或旧目录重命名的成功记录。随后另用新证据目录对仍为序列 1 的 current/旧 SHA 及已上传 ZIP 只读复核，再用同一序列 2 继续。第二次记录签署、生产公钥验签及发布；初次在线复核因同名公开 CDN 返回旧字节而报 `Public asset bytes mismatch` / `Online signed bytes differ from reviewed issuance`，没有当成验收通过。缓存键修订后匿名在线运行以 `Verified online sequence 2, 2 cumulative resources across 2 signed catalogs` 结束，`seq2-online-verified.json` 记录完整序列 1、2 和两 ZIP 身份。
- 当前匿名 GitHub API 的 v2 Release 仍为固定 `407394942`、预发布；旧 ZIP `623482293`、8490 字节、SHA `27f1df3b...b0876b` 保留；旧目录同一资产 ID `623482430` 改历史名 `catalog-seq1-0bc8cf66fe67.signed.json`，摘要仍 `0bc8cf66...178dcfba68`；新 ZIP `625120403`、9510 字节、SHA `178d01e9...de8442`；唯一 current `625125622`、2659 字节、SHA `0428deda...b31915`。两个 ZIP 与两份已签目录都处于 `uploaded`。已归档在线 JSON 的 ID、摘要和大小与当前 API 一致。
- 远端 v2 与 v0.4.0 annotated 标签 peeled 目标仍固定 `4aacb1f81b7fc381d2ca7fd725fd93dd109e390e`。正式 v0.4.0 Release 仍只有原 APK 资产 `623483084`、2,645,967 字节、SHA `c6e071e1...a78ee39`，未更改大厅 APK。操作手册明确缓存键只用于发行匿名验收；正式客户端仍按 API 资产 ID 下载，无 APK 代码变动。本次文档继续把设备局部更新和旧进度验收列为后续工作。

剩余门禁：在正式已安装 v0.4.0 上实际发现、下载、安全激活 #2，并验证旧 1 步/SAF 存档、键盘新功能、运行中会话版本固定及 APK 摘要不变；随后再独立审阅该阶段的提交与证据。
