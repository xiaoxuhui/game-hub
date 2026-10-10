# N10-E6 v0.4.1 正式发行记录

Status: COMPLETE（提交后发行独立复审待归档，F仍PENDING）。E5最终实测848d1d1独立p1 CLOSED，归档并推送接受提交b860acd后才生成release-ready与执行已审publisher。

实际命令：private publish-e4-apk.ps1 -ReviewedCommit b860acda409fe9592d3fb0d0a366e78198e5bff3（完整值见n10-e6-release/e4-release-ready.json）。来源仍fc9da9be6a238018d86f2085facd5b8085e68cf8，annotated v0.4.1 tag不移动；草稿发布前按已审脚本GET核对元数据/文案/target/唯一资产集合及平台完整摘要，然后公开。publisher退出0，无重试、无未知写入结果。

[正式发行](https://github.com/xiaoxuhui/game-hub/releases/tag/v0.4.1)，Release ID409126183，APK asset ID628680251。[APK](https://github.com/xiaoxuhui/game-hub/releases/download/v0.4.1/game-hub.apk)，2654159字节，SHA-256 9f57c90af42efea54e4e079d637d964346a78e7e880493eac7887f9aaac323da。仅此一资产，平台digest与匿名实际下载全摘要一致；匿名latest、文案、target、annotated tag peeled fc9均通过。没有凭证附加到公共下载。

node private verify-e4-public.mjs exit0，随后 python scripts/verify_apk.py <e4-anonymous-game-hub.apk> fc9da9be6a238018d86f2085facd5b8085e68cf8 exit0，4sources/40资源；apksigner verify --print-certs exit0、原证书44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2；aapt dump badging exit0确认5/0.4.1。

发布后 own emulator5566 真实ProductionHallUpdateDeviceTest，formalHallMode startup/formalApkSha256完整9f57值：8.401秒OK1，原APK/证书/生产公钥/三资源active2门禁通过，日志显示“已安装大厅0.4.1；正式发布0.4.1，已核对”；五源实际checkedAt新鲜、Abel404明确未正式发布/null时间。未修改源仓库，未安装future6。运行/元数据回执公开副本见n10-e6-release/，原始私有证据将在F归档。

README/CHANGELOG/测试报告/OSS与计划已同步实际发布；E整体COMPLETE，发行后独立CLOSED归档才VERIFIED。真机安装验收由用户随后完成，异机密钥备份仍既有待办。当前未运行永久归档、dry run或删除。
