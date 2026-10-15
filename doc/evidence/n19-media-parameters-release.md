# N19 灵感积木0.3.0发行证据

2026-10-16。mini-scratch 0.3.0/contentCode5 已进入动态资源目录序列12；现有游戏ID、存储合同、公钥及手柄图标保持，其他四游戏完整描述与字节一致。

## 固定来源与验证

- 源码e98545924338d66d716b44f3c1f75bf3f32f5556，dist完整18文件，来源56测试通过，[来源CI成功](https://github.com/xiaoxuhui/mini-scratch/actions/runs/38778272520)。真实Chrome桌面、手机、图像绘图与具名参数验收见[来源报告](https://github.com/xiaoxuhui/mini-scratch/blob/main/doc/v0.3-测试报告.md)。
- 大厅生产提交27344b185f8c50d4114bb86dc5f20f138dfbd815，本机85测试通过，[大厅CI成功](https://github.com/xiaoxuhui/game-hub/actions/runs/38778484158)。首次沙箱临时目录rename遇EPERM，同套本机重跑通过；[完整输出](n19/hall-tests.txt)。
- 独立检出D:/soft/.ci-tmp/game-hub-n19/work，两个dynamic-resources生产轮次的5ZIP与unsigned共6文件摘要完全一致，--verify核对源字节通过。[第一次](n19/production-first.json)、[第二次](n19/production-second.json)。

## 线上身份

| 对象 | 身份与摘要 |
| --- | --- |
| Release | 407394942 / game-resources-v2，标签保持 |
| 新目录 | asset644646912 / sequence12 / SHA256 6aede403cda76fb941ed6680823aaae5a438aa3b9a6f58ce66636bc15818037c |
| 资源ZIP | asset644643800 / 274032字节 / SHA256 ebb50a24d9f573256d31fd810617951b7e13944ca7b52f863d3ab21e2f74b1c1 |
| 前序目录 | asset644539134保留为catalog-seq11-f5dcbee0336e.signed.json / SHA256 f5dcbee0336ef19c9c1b08816a309a2e743a66f226c67ef772f328db5afa99a4 |

匿名最终输出：`Verified online sequence 12, 13 cumulative resources across 12 signed catalogs`。全部历史资源均下载核对，见[在线结果](n19/online-verified.json)、[发行事实及完整描述](n19/issuance-facts.json)。

## 上传缓存与安全续行

首次上传后，GitHub公开资产快照暂未匹配新ZIP，包装器在payload前停止，旧目录未动。读取新快照后，用validateUploadedResume与successorPayload核对已有上传及旧目录无变，[只读审核PASS](n19/post-upload-review.json)。仅使用同一证据目录ResumeAfterUploads续行，签名一次，保留前序再上传新目录。

首次匿名下载仍返回旧目录，已发布身份与摘要另行核对后，仅重跑online只读验证，取得上述PASS；没有重签、覆盖或删除历史。签名材料及凭据仅在包装器内存使用，无敏感材料进入证据。

## 使用与边界

大厅“立即检查”→更新灵感积木→重新打开激活。本次不更新APK。原APK尚未开放麦克风时，声音管理支持导入系统录音文件；不能宣称大厅真人录音已验收。未连接Android设备，浏览器原生拖拽自动化受扩展错误影响，文件选择器往返与真实麦克风未列为通过；点击具名参数放入、绘图保存与状态数值运行已验证。
