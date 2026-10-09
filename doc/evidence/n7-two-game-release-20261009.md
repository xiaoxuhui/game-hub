# N7 两新游戏资源发行与正式客户端验收

- 日期：2026-10-09；发行来源锁提交 `802c8af9da6f4dbd9614fe691950e2c8497aa340`，已推送；CI run `37944905173` completed/success。
- 状态：发行与客户端验收完成，提交c5caf46fb11021a60838d3441c369e37af4d3496独立发行复审CLOSED，见[审阅记录](n7-two-game-release-independent-review-20261009.md)；N8清理尚未执行。
- 前序计划、集成、来源锁分别独立审阅CLOSED，来源锁意见见 [独立审阅](n7-three-game-source-lock-independent-review-20261009.md)。

## 不可移动来源与重复生产

所有生产均在复用独立检出 `D:\soft\.ci-tmp\game-hub-work\v030-final`，HEAD固定802c8af。两上游仍分别冻结d58e2b1d06c3dfdf6cd25b65986c1d494759ed7f和11b0aef6dcac9a37abdc08cde25ea0efd1f8f6a2；公开资源的真实集成来源为已审 `c46ec6d3cabc6df9ecd90409649b89d765a0a5a9`，完整上游证明和MIT随包。

连续两次实际 `prepare:dynamic` 后，比较候选目录全部五文件的路径、长度和SHA256，完全一致；包括两个新ZIP、原示范#2 ZIP、未签名清单及candidate.json。见 [完整摘要](n7-resource-release/three-game-production-hashes.json)。原示范#2 ZIP仍9510字节/178d01e9ee05f66cf22d4dd8c77fd3ddd47cb94bfce20e6e38fe406f9fde8442。

| 游戏 | 固定版本/code | 正式资产ID | ZIP字节 | SHA256 |
| --- | --- | --- | --- | --- |
| 阿贝尔沙滩 | 0.1.2 / 1 | 625246315 | 83690 | 8e9db7fc872072b43ed035673107d58e86bd6e486f83b05d44f57bb392f369e5 |
| Lambda线路实验室 | 0.3.0 / 1 | 625246403 | 89571 | 5e418cdff45e84ea6ed0b3b1d29d99e0ebb4d1841bc5f2171d48b20f1bf81bb8 |

## 正式发行及实际失败恢复

沿用已审发布器，显式旧目录SHA0428dedaa4dd8abdd5299cf1db52a0f3f8bbbbfb381bd0ec20ad58be16b31915、nextSequence3；固定v04/v2标签仍4aacb1f81b7fc381d2ca7fd725fd93dd109e390e，未移动。发布位置：[game-resources-v2](https://github.com/xiaoxuhui/game-hub/releases/tag/game-resources-v2)。

第一次执行上传两个新ZIP后，在fresh asset-bound payload校验报Asset identity mismatch，止于签署之前。只读API逐项核对两新ID/尺寸/摘要，以及旧current ID625125622及SHA0428...仍原值，保存 [上传后只读状态](n7-resource-release/n7-upload-outcome-readonly.json)。不能把失败的具体缓存根因当作已经证明。

从已核实状态使用新的证据目录恢复，精确复用同两资产，没有重复上传或删除；签署seq3一次。旧seq2目录以同ID625125622改名 `catalog-seq2-0428dedaa4dd.signed.json`，最后上传新current ID625249539，SHA **69a34e189c352ec7bfc4e47be2ba2b08711c46264036277e8de9e2be30d3b5f4**。首次发布后匿名读取报Online signed bytes differ，停止写操作；仅执行只读复核后通过。失败输出与恢复输出均归档，未重签、删除资产或降低摘要条件。

最终生产公钥验证完整seq1/2/3累计历史链、分页/资产绑定，并实际下载比四个历史/当前ZIP原字节。见 [公网实际结果](n7-resource-release/online-verified.json)、[新目录原字节](n7-resource-release/catalog.signed.json)、[完整资产快照](n7-resource-release/online-snapshot.json)。三个签名目录及四个ZIP保留，共七资产。seq3当前累计三个游戏；四资源包含历史示范#1和当前示范#2。

## 现有正式APK客户端

仅自有AVD emulator-5562，正式生产v0.4.0 APK；本阶段未重建或重新安装大厅。冷启动自动显示“发现2个目录游戏（2个可安装）”，见 [实际启动提醒](n7-resource-release/n7-startup-reminder.png)。实际打开游戏目录，分别主动安装和打开两游戏，下次进入校验激活。

- 阿贝尔：真实触摸棋盘投入1粒，实际截图当前粒数/累计投入均1。强停、重启后显示“已恢复本机存档”。真实导出启动系统CreateDocument，保存94231字节测试JSON；实际OpenDocument选择本任务文件并确认，页面显示“导入完成，已暂停”。另在无活动默认网络下重开，仍恢复棋盘。证据包括play、footer-1（冷启动恢复）、saf-create、import-confirm-stable、saf-imported、offline-stable截图，均实际查看。
- Lambda：真实转换默认表达式，点击单步，结果为1步/λy.y。强停、重启后通过CreateDocument实际导出551字节JSON，session.steps为1。重新转换后实际OpenDocument选择该测试文件，显示计算状态和进度均已恢复；再次真实导出，session字段与导入前完全相同，steps均1。文件整体SHA不同，包含变化的savedAt；没有声称整个JSON逐字节相等。关闭Wi-Fi及数据后冷启动并按End滚到页面末尾，实际截图与XML再次显示1步/λy.y。
- 两游戏分别通过已安装测试伴随APK的 `ProductionResourceIdentityDeviceTest`，阿贝尔0.231秒、Lambda0.278秒，实际各 **OK (1 test)**，不是Assume跳过。读取正式ResourceRuntime/生产公钥、实际签名active元数据；分别验证contentCode1、完整ZIP SHA、真实c46来源及各自 `<id>-dynamic-v1` 合同，ready均null。均核安装base.apk **c6e071e18eac1cb97f3d898d6eb4dab2c790b8d9310a907a7e44e3c34a78ee39**、hostCode4和生产DER649107...。日志见各production-identity文件。
- 固定原生路由使用各ID独立origin，集成来源真实Chromium的独立origin隔离与往返验证已在前序归档；本次没有通过调试脚本伪造正式客户端状态。新增后实际打开原示范，仍0/3对、1步、0胜局，见 [原示范仍保留进度](n7-resource-release/n7-existing-demo-final.png)。原四游戏仍在正式首页。
- 离线证据 `n7-offline-connectivity.txt` 为 **Active default network: none**。实验完成恢复测试AVD Wi-Fi/数据，global设置均为开始观测值1；保存恢复网络快照。

部分首次uiautomator输出为空/仅WebView、首次截图仍校验中或白屏；只从随后真实稳定截图/XML及实际JSON断言验收，未以空快照声称成功。中间失败/空输出留在私有过程归档，不伪装为稳定证据。

原始存档均为本任务在自有AVD生成，**未上传仓库**；公开仅存 [结构、长度、摘要和步数验收](n7-resource-release/saf-shape-and-hashes.json)。公开证据索引记录每文件SHA/长度，私有过程资料在N8清理前归档。

## 原六仓库与边界

[阶段末只读状态](n7-resource-release/n7-original-source-state-final.json)逐项比较原四完整HEAD和工作树与初始v04基线完全一致；EML原有22项用户改动保持，未读/清理用户原始JSON。两新增原仓库当前外部HEAD分别c4290283b1109e13e37d6f696b83fefd3b7a6855、06dee48e0fe319cc72448fadf7ae9783cb441408，均clean，未被本任务写入；本轮资源仍取已冻结d58e/11b，未静默包含外部后续改进。

用户真机安装验收按授权在发布后人工完成；本记录仅声称自有模拟器实际验收。密钥异机备份待办仍未完成。发行复审闭环后才进入N8集中清理。
