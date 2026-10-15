# N15 灵感积木 v0.2 发行记录

2026-10-15。已在既有 [game-resources-v2](https://github.com/xiaoxuhui/game-hub/releases/tag/game-resources-v2) 发布目录序列9，「灵感积木」0.2.0 / 资源 #2。大厅v0.4.0及以上点“立即检查”，已安装的游戏按更新设置处理；尚未安装的在“游戏目录”安装。无需更换APK。

## 来源与资产

- 公开来源：[mini-scratch@10d7d056](https://github.com/xiaoxuhui/mini-scratch/commit/10d7d0566693764d2de2d83c828f0fabd2fd7102)，dist全部14文件和MIT，逐字节对照Git提交。
- 大厅生产提交：`484470a25f14a0d4bfa5c342e99156a1806e1b93`。
- ZIP：`game-mini-scratch-2-12d3953b9369.zip`，asset `644169215`，188863字节，SHA-256 `12d3953b9369755e246e1a3859a506f86cf9db2f120a29efbae13e125a5aadec`。
- 新签名目录：固定Release `407394942`，asset `644172022`，14027字节，SHA-256 `d4970f1be88b4afc02878cfa0a0eb92617b241ee1642b031e8696c7851056a9e`。
- 原序列8 asset `644025209` 原样保留为 `catalog-seq8-0158a1e8f613.signed.json`。此前mini-scratch资源#1仍被历史目录引用；其他四游戏完整描述保持相等。
- 生产公钥、resources-20261008 keyId、正式APK、既有标签保持原身份。

## 验证

来源42/42、build和verify-build通过；真实Chrome桌面、390×844手机和单文件入口验证见[来源测试报告](https://github.com/xiaoxuhui/mini-scratch/blob/main/doc/v0.2-测试报告.md)。[来源精确提交CI](https://github.com/xiaoxuhui/mini-scratch/actions/runs/38753577199)成功。

大厅`node --test`为85/85，0失败；[完整日志](n15-release/hall-tests.txt)。[大厅精确生产提交CI](https://github.com/xiaoxuhui/game-hub/actions/runs/38753819685)成功。

独立公开远端检出，`node scripts/dynamic-resources.mjs`两次与`--verify`均通过。5份ZIP和unsigned描述两次摘要完全一致，见[第一次](n15-release/production-first.json)和[第二次](n15-release/production-second.json)。预先克隆的no-checkout来源曾被干净工作树检查拒绝；完成固定SHA检出后才生产，没有跳过门禁。

发布上传时遇到GitHub公开资产列表缓存延迟，首次payload检查失败，未签名；取得新鲜快照并通过[上传复核](n15-release/post-upload-review.json)后，从同一目录签名前续行。序列9只签署上传一次。上传后的第一次匿名检查仍读取旧目录；确认新旧资产身份后只重跑online，无再次签署或上传。

最终执行：

```text
node scripts/resource-successor.mjs online <本轮发行目录> 0158a1e8f61302f9928722c84716bbcfb3c4eeb5731436806397527c526d088b 9
Verified online sequence 9, 10 cumulative resources across 9 signed catalogs
```

匿名下载核验全部1–9代目录的签名、完整资产分页、10份累计ZIP大小与SHA。见[online结果](n15-release/online-verified.json)、[发布身份](n15-release/published.json)及[来源/旧描述核对](n15-release/issuance-facts.json)。

## 存档与设备范围

资源origin与`mini-scratch-dynamic-v1`合同保持。新版首次读取v1作品后写入独立`inspiration-blocks-v2`，旧槽不被改写，并保留首次升级原始备份。回退0.1继续读旧作品，再升级0.2恢复新版作品；旧版后续编辑不会合并入新版。

本轮没有Android设备实测、没有在用户设备安装。新增返回值的原生拖拽在自动控制中未替换参数，点击◇编辑路径已通过。文件导入导出往返、人工听音未验收；没有修改浏览器权限。上述范围与来源报告一致。
