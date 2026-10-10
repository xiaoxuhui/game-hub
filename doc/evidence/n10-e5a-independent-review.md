# N10-E5a 独立审阅（2026-10-11）

受审提交：`3d70bb6c4a9af2041338939e8bf553b878c184d6`。仅只读核对工作区、公开报告、原始日志、设备控制器及私有发行辅助脚本；未构建、装机、读取凭证或原始存档、调用线上 API、执行发行脚本。工作区在核查时干净，`git show --check` 无空白错误。

## 结论

**设备验收证据 CLOSED；发行器设计 OPEN；N10-E 整体 PENDING。** 正式 0.4.0/code4 同证书覆盖到候选 0.4.1/code5 后，五页面真实存档恢复、正式自动与手动查询、冷离线历史及离线存档、同证书 future 夹具预验的成功日志与报告对应。在线取得新鲜结果再断网的控制器确实因匿名配额耗尽而在取得 `WAITING_FOR_OWN_DEVICE_DISCONNECT` 前失败；报告保留 FAIL1 且没有把未执行的断网步骤记为通过。这项仍是正式发行前置。

## 证据核对

- `e5-old-save-seed.log` OK1/32.145 秒，`e5-new-save-verify.log` OK1/3.498 秒；旧安装身份 code4/0.4.0、安装候选 code5/0.4.1 与报告一致。`UpgradeSaveDeviceTest` 使用真实 `WebView`/资源拦截器及真实存储键验证五页面，不能据此单独宣称五次保存均由普通 `MainActivity` 导航触发；报告未作此宣称。
- `e5-production-startup-manual.log` OK1/13.647 秒；`e5-startup-manual-actual-sources.log` 有两轮五个已发布来源的版本与时间、第六 Abelian 404/空正式版本，`checkedAt` 递增。控制器核候选 APK、发行证书和生产 DER，并检查三个资源的实际 active2/ready 空。
- `e4-online-to-offline-quota-red.log` FAIL1/181.43 秒，失败点为真实 startup 新鲜六源及非空目录等待超时；`e5-anonymous-quota.json` 记录匿名额度 0。没有 `WAITING` 信号，故 `e4-offline-control-quota-red.log` 未断网。
- `e5-cold-offline-control.log` 记录 own AVD wifi 关闭、默认网络为空、force-stop 后 PID3595→3645，以及 finally 恢复；对应 coldOffline OK1/1.829 秒、离线五页面存档 OK1/3.657 秒。future stage OK1/0.055 秒和包签名安装预验 OK1/0.016 秒；未安装 code6。
- 公开日志与本地私有日志在 CRLF/LF 和末尾空白规范化后内容一致；不把两组文件称为逐字节相同。OSS 扫描范围与报告注明的指定模式一致。

## 发行辅助脚本静审

`publish-e4-apk.ps1` 的 PowerShell AST 解析 0 错误，`verify-e4-public.mjs` 的 `node --check` 退出 0；均未执行。脚本已在凭证读取和意图写入前固定 origin URL、精确已推送干净 `ReviewedCommit`、fc9 祖先、ready/CI 状态、APK 全 SHA/字节数及新 tag。失败或未知结果由意图文件阻止盲目重试。匿名复核脚本现要求 Release 总资产恰好一个，并核注释标签解引用到固定 fc9，下载完整 APK 后验哈希。

**P1 批改：发布前复核 draft 的资产全集。** 当前 `publish-e4-apk.ps1` 只核本次上传返回的 `$taskAsset`，随后直接 `PATCH draft=false`。若 draft 在创建或上传期间出现另一资产，或返回资产与 draft 当前列表不一致，脚本会先公开，匿名脚本才发现异常。应在 `PATCH` 前对同一 release ID 再 `GET`，要求仍为 `draft=true`、tag/name/id 正确、资产总数恰好 1，且唯一资产的 id/name/state/size/digest 与已审核 APK 和上传回执一致；任一不符停在 draft 供只读核查。此门禁修正后再复审发行器，且仍须等待在线新鲜→断网控制器实际通过，才可把 E 的发行前置记为完成。

首审时发现的 origin 目标、匿名资产全集与标签目标核验缺口，已由审阅期间的私有脚本修订补齐；上述 P1 是当前尚存阻断。脚本当前不在受审提交内，发行前需把最终脚本哈希与静审版本及执行版本对应存档。
