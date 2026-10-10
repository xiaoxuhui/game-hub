# N10-E5a 正式覆盖升级、真实查询及限流批改记录

Status: COMPLETE（本切片提交后独立复审待归档；E整体仍PENDING）。源码与APK固定fc9/9f57完整身份见E4，不重建、不重签。

E4独立CLOSED归档437b394后，关闭专属debug AVD正常重启原正式AVD（PID33176、相同serial5566、原磁盘）。系统boot_completed1，原APK4/0.4.0；pull实际安装APK完整SHA c6e071…与原正式包相同。原UpgradeSave控制器seed四builtin真实存档与图灵campaign32.145秒OK1。安装-r原证书正式候选5/0.4.1及同证书测试包成功；verify真实五页面3.498秒OK1。控制器不以字符串版本模拟升级。

正式ProductionHall控制器manual（包括真实启动自动查询和正常立即检查二次查询）13.647秒OK1：实际APK全SHA/版本/证书/DER门禁、三个active2/ready空、five实时源正式版本逐一与已安装来源核对，两轮checkedAt严格递增；第六Abelian latest404明确未正式发布/null时间。正式5版本当时远端Hall仍0.4.0，实际状态“已安装大厅0.4.1；正式发布0.4.0，已核对”，没有安装未来夹具。六源原始发布/时间见actual-sources日志；上游仍只读提示。

下一offline控制器必须先取得真实新鲜六结果和非空目录offer，再等WAITING信号才外部断网。实际请求耗尽60匿名配额，真实更新弹窗显示限流/旧结果待检查、未成功源尚无成功检查；未到WAITING，不执行断网步骤。181.43秒startup fresh断言超时FAIL1保存，不冒称通过、不放宽断言。一次只读rate_limit记录remaining0/reset1791656171，北京时间2026-10-11 02:16:11恢复；候选仍需届时补齐此项，不能发布。

旧结果在新的冷进程不会假称新鲜。独立不依赖API的coldOffline门禁：只关闭own wifi/data，wifi_on0且dumpsys Active default network:none；正常旧PID3595→force-stop→正常新PID3645，ProductionHall coldOffline1.829秒OK1（实际缓存历史、空源map），UpgradeSave offline3.657秒OK1。finally恢复wifi/data及wifi_on1；控制转录附录。

真实正式5的stageFuture0.055秒OK1确认原APK全SHA/证书/生产公钥，把privatefuture6/0.4.2同证书APK完整6f266c…放cache。UpdateFixtureTest0.016秒OK1完成真实包名/版本递增/签名与安装Intent预检；没有安装future6，dumpsys仍5/0.4.1。future正文为历史夹具，非正式功能候选。

OSS当前437b394扫描1101文件，指定秘密/禁跟踪构建项0、README30链接0失效，治理文件齐备；扫描只覆盖指定模式。E5剩余fresh→offline及正式发行/匿名复核保留未完成。

待审私有发行器 publish-e4-apk.ps1：要求精确reviewed/pushed clean接受提交、fc9为祖先、e4-release-ready实际PASS/CLOSED及exactCI、APK尺寸/全SHA；无旧发行意图/新tag才运行，内存wincred认证，记录意图、固定fc9 annotated tag、新draft→上传唯一game-hub.apk及平台digest/size/state核对→publish。任何未知结果停止只读协调。verify-e4-public.mjs匿名实际latest身份/元数据与可接受TLS重定向主机、完整APK字节SHA核对。脚本语法通过；尚未执行写远端，须本切片审阅与E5最终实测CLOSED后执行。原始助手启动/参数错误留E4，不用外部限流改产品代码。

## 发行设计OPEN后的批改

首审意见与实际验收CLOSED/发行器OPEN分开保留。发行器在读取凭证/意图前严格固定origin=https://github.com/xiaoxuhui/game-hub.git及已推送ReviewedCommit。匿名复核要求Release资产总集恰一，并匿名读公开annotated tag/ref对象，peeled commit必须fc9。公开前新增auth GET同一draft：release ID/tag/draft true/prerelease false、资产全集恰1及APK id/name/size/state/full平台digest与已审上传项完全绑定，不符停止保留draft，不公开。公开代码副本及私有原始完整hash见controls/control-hashes；仅语法检查通过，未创建tag/Release、未取发行凭证。本批改提交后复审，不能代替fresh→offline最终验收。

第二次复审资产全集门禁已CLOSED，但发行说明name/body一致性为OPEN；已进一步固定名称、完整body及target_commitish，在POST回执和公开前GET逐项比对（body仅允许CRLF归一），匿名公开复核也对照执行前生成的expected文案。任何变更停在draft或只读失败，不盲目重复发行。完整脚本副本及摘要已更新，待提交后复审。
