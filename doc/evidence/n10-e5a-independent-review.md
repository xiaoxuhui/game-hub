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

## 批改复审：`0b106864c7dc702a1bbcccb404159f147bc2a158`

**资产全集 P1 已修正；发行器设计仍 OPEN；E5 在线新鲜→断网验收与正式发行 PENDING。** 新版私有 `publish-e4-apk.ps1` 在 APK 上传并验证回执后、`PATCH draft=false` 前，对相同 release ID 做认证 `GET`。它要求 release 的 id/tag/draft/prerelease 正确、资产全集恰好一个、唯一 APK 的 id/name/state/size/完整平台 digest 与上传回执及固定 APK 完全相符；不符抛错并保留 draft。`e4-release-prepublication.json` 记录此时的只读快照。此前 origin 精确目标、匿名资产总数及公开 annotated tag→固定 fc9 的门禁均保留。

重新对私有 PowerShell 脚本做 AST 解析为 0 错误，对私有 Node 脚本 `node --check` 退出 0。独立计算的私有/公开 SHA-256 与 `control-hashes.json` 一致；PowerShell 公开副本仅 CRLF/末尾空白规范化后与私有执行副本内容一致，Node 副本逐字节一致。`git show --check 0b106864` 无错误，复审时工作区干净。公开副本与 hash 清单保存了可复查的发行设计版本。

**P2 待批改：发行文案未固定。** 新 draft 的 POST 回执只核 tag/draft，公开前 GET 未核 `name`、`body` 是否等于脚本构建的正式候选文案，匿名复核也未核公开版的 `name`、`body`。若 draft 在检查前更改名称或正文，当前脚本仍会公开；应在 POST 回执和公开前 GET 比较固定标题与完整正文，匿名复核再将公开版与受审文案比较。更改这两个字段时停在 draft 供核查。该项批改后才能关闭发行器设计。

脚本未执行，未调用 GitHub API、读取凭证或发布；仍须实际 online fresh→offline 控制器通过、最终 ready/CI/独立审核状态满足脚本门禁，并在发行执行及匿名下载后核对实际结果。不能把本次批改复审记作 E 整体完成。

## 文案批改复审：`94e2af588c5c79525eaa0b5e7c6f08ed2b6928ec`

**发行器设计 CLOSED（静态审阅）；E5 fresh→offline 与正式发行仍 PENDING。** 发行脚本将固定 `taskReleaseName`、`taskBody` 和 fc9 `target_commitish` 发给创建 draft 的请求，并对 POST 回执与公开前同一 draft 的 GET 再核这些值。正文只归一 CRLF；大小写及其他正文变化均拒绝。公开前的资产全集与完整 digest 门禁仍在。脚本在创建 draft 前保存 `e4-release-expected.json`；匿名验收要求公开版名称、完整正文与该候选相等，目标提交为固定 fc9，并继续要求唯一 APK 完整 SHA、公开注释标签解引用到 fc9。

重新计算 `control-hashes.json` 的两组私有与公开 SHA-256 均匹配，PowerShell 脚本规范化换行/末尾后内容一致，Node 脚本逐字节一致。PowerShell AST 解析 0 错误、Node `--check` 退出 0，`git show --check 94e2af5` 无错误。没有执行发行脚本、取凭证、访问线上接口或修改设备。若 GitHub 对已有标签返回不同 `target_commitish` 表示，严格检查会安全地保留 draft 并要求人工核查；不能因该可能性放宽固定源提交门禁。

此结论只关闭发行器设计批改。在线取得新鲜结果后断网的正式设备控制器尚未通过，发行与匿名核对均未发生，故 N10-E 不得标为通过或已发布。
