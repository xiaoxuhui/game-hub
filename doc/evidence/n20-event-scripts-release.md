# N20 灵感积木0.4.0独立事件发行证据

2026-10-16。mini-scratch 0.4.0/contentCode6已进入动态资源目录序列13，保留generic手柄图标、原游戏ID、存储合同、公钥及其他四游戏完整描述。

## 来源、回归与重复生产

- 最终源码3e3e2567289db8a6b740f5e01605b7a72bf3b778，dist完整19文件，63测试通过，[来源CI成功](https://github.com/xiaoxuhui/mini-scratch/actions/runs/38783342585)。[Chrome桌面/手机报告](https://github.com/xiaoxuhui/mini-scratch/blob/main/doc/v0.4-测试报告.md)包含独立按键/点击启动、绿旗隔离、删除/撤销/重载与游离动作不运行证据。
- 大厅生产提交5659a25ff2fde0542c85b2eb45cbd11575695c84，[大厅CI成功](https://github.com/xiaoxuhui/game-hub/actions/runs/38783454970)，[本机85测试通过](n20/hall-tests.txt)。CI在Gradle缓存收尾后成功，发布前已等待完成。
- 初候选edd3149尚未发布时，新增回归复现旧顶层脚本与显式绿旗共享变量的结果1≠3，修正迁移优先级后63/63通过。旧生产记录保留superseded前缀，没有上传旧候选。
- 独立检出D:/soft/.ci-tmp/game-hub-n20/work更新为最终固定提交后重新两轮生产，5ZIP与unsigned共6文件摘要一致，--verify核对来源字节通过。[第一次](n20/production-first.json)、[第二次](n20/production-second.json)。

## 公开身份与验证

| 对象 | 身份 |
| --- | --- |
| Release | 407394942 / game-resources-v2，固定标签保持 |
| 目录 | sequence13 / asset644739909 / SHA256 ae09f97361e368482f13111f9dbf47ccc36d62c3e31b3fed2ea61daaa8e1535f |
| ZIP | asset644737060 / 282205字节 / SHA256 18bacdca60bbf0620778172d20f9ccd2204e8e64d3f0f7d73e78f634e61a4426 |
| 前序 | asset644646912保留为catalog-seq12-6aede403cda7.signed.json，SHA256 6aede403cda76fb941ed6680823aaae5a438aa3b9a6f58ce66636bc15818037c |

匿名最终输出：`Verified online sequence 13, 14 cumulative resources across 13 signed catalogs`。全部历史签名目录与ZIP均下载核对，[在线结果](n20/online-verified.json)、[完整发行事实](n20/issuance-facts.json)。旧四游戏完整描述逐字段相等，旧资源和历史目录没有覆盖或删除。

## GitHub缓存处理

上传后第一次公开快照未匹配新资产，包装器在payload前停止，旧目录仍保持。读取新快照后validateUploadedResume/successorPayload只读核对PASS，[审核记录](n20/post-upload-review.json)，沿用同一上传证据ResumeAfterUploads续行，仅签名一次。

激活后首次匿名下载仍返回旧目录；先核验已发布身份，再仅重跑online只读检查，取得最终PASS，没有重签或重复激活。凭据与签名材料仅在包装器内存，不进入证据文件。

## 使用与边界

大厅“立即检查”→更新灵感积木→重新打开激活，无需更新APK。旧作品显示为可删除绿旗组，按键与角色点击也可独立启动；v4存档保护v3/v2/v1原槽和备份。未连接Android设备，未新增原生积木拖拽、文件选择器或真人录音验收；素材与参数沿用上一版，既有APK的麦克风限制保持。
