# N21 灵感积木0.5.0列表发行证据

2026-10-16。mini-scratch 0.5.0/contentCode7进入动态资源目录序列14；保留generic手柄图标、ID、存储合同、公钥和其他四游戏完整描述。

## 来源、测试与生产

- 固定源码f5d9d5b613515c2f8500e76466151127b7500baf，dist完整21文件，70/70、构建及源码字节核验通过，[来源CI成功](https://github.com/xiaoxuhui/mini-scratch/actions/runs/38787176248)。[浏览器报告](https://github.com/xiaoxuhui/mini-scratch/blob/main/doc/v0.5-测试报告.md)包含四操作、类型、取值、错误序号、保存、撤销、26项分页和手机编辑。
- 大厅固定生产327749aa3db67bec4b1a1ec5fb54ecf5b88bcce1，[CI成功](https://github.com/xiaoxuhui/game-hub/actions/runs/38787351220)，发布前已等待收尾成功。[大厅85/85](n21/hall-tests.txt)；首次沙盒临时Git写入与目录重命名被拒绝，[原始失败记录](n21/hall-tests-sandbox.txt)保留，同一套测试正常权限通过。
- 独立目录D:/soft/.ci-tmp/game-hub-n21/work两轮生产5ZIP及unsigned描述，6文件摘要完全相同；--verify核对固定来源字节。[首轮](n21/production-first.json)、[第二轮](n21/production-second.json)。

## 公开身份

| 对象 | 身份 |
| --- | --- |
| Release | 407394942 / game-resources-v2，固定标签保持 |
| 目录 | sequence14 / asset644809132 / SHA256 bdb9889af98e9fed50067c96102f677b31cd5bb187ff47af23be727603d61b2c |
| ZIP | asset644807162 / 312805字节 / SHA256 29548a43c01500b539c009a15b47b869358a60d1fe638999ee3fff7601534593 |
| 前序 | asset644739909保留为catalog-seq13-ae09f97361e3.signed.json，SHA256 ae09f97361e368482f13111f9dbf47ccc36d62c3e31b3fed2ea61daaa8e1535f |

匿名输出：`Verified online sequence 14, 15 cumulative resources across 14 signed catalogs`。全部历史签名目录及累计ZIP均下载核对，[在线结果](n21/online-verified.json)、[发行事实](n21/issuance-facts.json)。其他四游戏完整描述逐字段相等，历史资源未覆盖或删除。

## 缓存与续行

上传后新资产尚未出现在公开快照，包装器在payload前停止。新快照只读validateUploadedResume/successorPayload通过，[审核证据](n21/post-upload-review.json)，沿用同一上传证据ResumeAfterUploads，仅签名一次。激活后首次匿名访问返回旧目录，核对published身份后仅重跑online下载验签通过，没有重签或重复激活。凭据和签名材料仅在包装器内存。

## 使用与边界

大厅“立即检查”→更新灵感积木→重新打开；无需更换APK。变量分类新建列表，点击列表名称编辑初始项，运行值不覆盖初始项。序号从1开始，插入长度+1放末尾，错误序号明确报错。v5存档保护旧槽与备份；没有Android真机、原生拖拽、文件选择器或真人录音新增验收。
