# M4 资源查询/下载客户端切片（2026-10-08）

## 范围

PublicReleaseHttp 使用匿名 HTTPS、固定仓库 API、禁止自动重定向；下载逐跳复用既有 APK 的 HTTPS 主机白名单，不带凭据。连接10秒、元数据单次读取15秒、资源读取无进展30秒；元数据每通道总时限30秒、单资源下载600秒，实际读字节仍受预算约束。ETag/304 缓存仅在进程内，最多8条/8MiB；304无缓存不能显示最新。403/429保留Retry-After/RateLimit-Reset退避时间，无有效头默认1小时，范围1分钟至24小时。

ResourceCatalogClient 查询固定非draft且prerelease的game-resources-v1，严格JSON分页资产全表（累计4MiB、每页100、最多100页）；验证分页固定路径/页号、重复资产id/name、唯一catalog.signed.json、实际大小/摘要、RSA签名和时效、payload所属releaseId、每个ZIP的id/name/size/digest/state全匹配。仅通过上述检查才返回ResourceOffer。

下载按实际字节和SHA核对，不宣称HTTP成功就是有效ZIP；后续GameResourceStore仍必须对同一envelope重新验签并检查高水位、兼容、完整ZIP/文件及会话边界。部分下载失败、取消、越界和不可信重定向均清理本次唯一part。

## 验证

新增ResourceCatalogClientTest五组：

1. 验签目录与完整资产归属、ETag/304复用及缓存目录过期拒绝。
2. 缺资产/重复编号或名称/错误ZIP名称/目录摘要篡改/错误通道拒绝。
3. 两页完整列表、参数顺序兼容、外仓库与畸形Link拒绝。
4. 实际字节超预算、无缓存304、429退避、通道404显式状态、连接关闭。
5. 下载实际内容/大小/摘要、取消、不可信重定向及part清理。

在独立检出首次编译 assembleDebug/JVM原30项成功；新增测试首轮成功（BUILD SUCCESSFUL in 40s）。分页严格化的最终回归正在运行，完成后追加实际数量及结果。

## 尚未包含

此切片未接MainActivity：默认网络策略、生命周期、应用范围单下载协调、APK与资源独立状态、自动提醒/详情/设置仍未完成。PublicReleaseHttp的退避异常需由协调器持久处理，不能单凭异常类型声称已实现限流调度；HTTP缓存需串行消费。下载预算安装峰值与进程死亡验证留M4/M6。没有创建新的Release/tag。

## 前一切片门禁

9a42d2a9742415fe73fee99f389224e44d455f2d 提交后的独立复审已闭合缓存检查页伪造P1，允许进入M4。最终审阅意见归档于m3-webview-independent-review-20261008.md，真实设备10/10通过；M3完整恢复/导入导出等仍待后续。

最终分页修订后 testDebugUnitTest/assembleDebug 通过，BUILD SUCCESSFUL in 40s；实际JVM35项，失败0、错误0。测试与构建日志副本附 m4-client-final-tests.txt，原始输出保留独立检出 .build。

## 提交后审阅与批改

35307cac50c9fcfcae0e8529cecf7a8759269fed 独立审阅确认签名/归属未见P1，但实现默认时限/退避与设计§3.7不一致，且304返回前未复核等待期间取消。已按设计改为每通道30秒、资源600秒/无进展30秒、默认退避1小时；所有responseCode等待之后再复核取消/总deadline，新增模拟等待中取消的304回归。另满100条无Link会主动读取固定下一页直到短页，实际证明完整表，合法100条末页+空页通过、隐藏重复资产拒绝。

修订后JVM36项、0失败/0错误；testDebugUnitTest/assembleDebug成功。原始日志留独立检出 .build\m4-client-review-fixed-tests.txt 及 m4-client-complete-pages-tests.txt。归档副本规范化行尾，不修改实际原始输出。
