# N10-E6 正式发行提交后独立复审

- 受审发行记录提交：`4e22de87fdd023a4c76bd821ff9ab048745224c9`；匿名 annotated tag 回执补档：`890ebaeb94ebe4cb6bf5a435ed960718c1319e66`。
- 固定 APK 源码：`fc9da9be6a238018d86f2085facd5b8085e68cf8`。
- 结论：**CLOSED**。发行身份、公开资产全字节、原签名与发行后正式大厅启动检查相互吻合。N10-E 可在审阅归档后标为 VERIFIED；N10-F 归档与限定根清理仍 PENDING。

## 独立核对

1. 发行前独立报告 `n10-e5-final-independent-review.md` 已对正式设备验收给出 CLOSED，发行准备记录指向其接受提交 `b860acda409fe9592d3fb0d0a366e78198e5bff3`。受审提交与补档提交只改文档和公开证据；从固定源码至当前检出的 Android、资源、示例产品文件无变化，两个提交 `git diff --check` 无错误。
2. 匿名 Release 原始回执与预期元数据逐字段比较：`tag_name=v0.4.1`、标题及正文完全相同、`target_commitish=fc9da9b…`、`draft=false`、`prerelease=false`、唯一资产 `game-hub.apk`。Release ID `409126183`，资产 ID `628680251`、状态 uploaded、大小 `2,654,159` 字节、平台 digest `sha256:9f57c90af42efea54e4e079d637d964346a78e7e880493eac7887f9aaac323da`。本地 annotated tag 对象 `d33b0503…` 和匿名 Git tag 回执一致，均 peel 到固定源码 `fc9da9b…`；补档公开回执与私有原始回执 SHA 一致。
3. 对本地正式候选和匿名下载文件分别重新计算：两者都是 **2,654,159 字节**，SHA-256 都是 `9f57c90af42efea54e4e079d637d964346a78e7e880493eac7887f9aaac323da`。归档的匿名验证结果记录 exit 0，且匿名 Release 全文和 tag 回执支持其结论。公开下载包的 `verify_apk.py` 记录固定源码四个来源、40 个资源通过；`apksigner` 显示原发行证书 SHA-256 `44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2`；`aapt` 显示 versionCode 5 / versionName 0.4.1。
4. 发行后 own 设备的 `ProductionHallUpdateDeviceTest` startup 输出 `8.401` 秒、`OK (1 test)`，实际日志显示“已安装大厅 0.4.1；正式发布 0.4.1，已核对”。五个有正式发布的游戏均有版本和新鲜 `checkedAt`，Abel 为无正式发布、版本/时间空且明确“待检查”；报告没有把它算为第六个成功版本。
5. 发行报告、CHANGELOG 和计划明确正式发行已完成、用户真机验收与异机密钥备份仍待办，F 的永久归档、只读清理验证和删除尚未执行。本次复审未新增线上请求、未操作设备、凭据或清理目录。

没有发行身份或报告范围的阻塞问题。
