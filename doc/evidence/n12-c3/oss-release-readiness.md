# N12 资源发行就绪度审计（发布前）

受审生产2afbda179f8924d57e029d5cdddb0ca416729c90；资源更新，不重发APK。

| 项 | 实际证据 | 判定 |
|---|---|---|
|1 许可|LICENSE完整MIT、2026 xiaoxuhui；package license=MIT；四内置与四动态ZIP白名单含原许可，生产完整清单验证|PASS|
|2 清单|package name/version0.4.1/description/repository/homepage/bugs/Node>=20.19/pnpm11.19；private=true静态APP不发npm；受影响打包使用原有锁|PASS|
|3 CI|android-check工作流实际Node test、原基线bundle+verify+storage、Android unit/debug；165b CI38158190559success；最终2afb CI38158736828 completed/success已实际确认，ci-producer-2afb.json。本地node check与64/64、双候选/verify及真实浏览器已执行|PASS当前提交CI；资源验收门禁仍不由调试APK CI代替|
|4 测试|64/64大厅；Abel53/53；Conway初158仅156过，独立sync后Android专项9/9，首次失败保留；4/4真实浏览器旧→新。正式宿主seed已32.545s PASS；首次update下载匿名限流失败，激活/离线待服务额度恢复|两目录已签署公开并匿名历史/ZIP全过；正式激活/离线验收仍待|
|5 更新记录|CHANGELOG已有0.4.1/0.4.0与资源序列发布记录；本轮同版本资源修订发布成功后补序列3/6并指向实际验收|PASS现有发行记录，本轮结果待实际追加|
|6 标签/发布|git tag实际v0.2/0.3/0.4/0.4.1与两资源标签；原正式APK下载全SHA9f57…323da匹配；前目录v1seq2 SHA972f…b86de、v2seq5 SHAd4b8…ad848已生产公钥验签。用户已授权资源发行，标签不可移动|PASS发行授权/旧基线；新v1seq3/v2seq6发行及匿名完整历史已验证|
|7 文档|README实际覆盖安装、用法、构建测试、来源/结构/许可；30个本地引用路径逐一Test-Path全部存在，oss-scan.json|PASS；当前资源版本描述发布后更新|
|8 治理|CONTRIBUTING、CODE_OF_CONDUCT、SECURITY真实联系xixuui@qq.com、issue/PR模板、dependabot均存在|PASS|
|9 卫生|主仓clean、git diff --check实际校验；gitignore覆盖.build/node_modules/Android构建/APK/各密钥。4个宽模式命中均为PS内存构造PEM头；锚定实际独立PEM/凭据模式0命中，密钥仅RAM+stdin|PASS；不把模板字符串误报真实私钥|
|10 网页专项|README截图及固定HTTPS/appassets入口与存档origin说明。浏览器实际HTTP源测试，不file双击；PWA/iPad是另需求，未提供此轮网页部署|非阻断建议项|

必须完成：已完成正式0.4.1 seed、两目录签名公开与匿名历史/ZIP验收；仍须额度恢复后实际update/断网force-stop重启offline，全SHA/存档复核与匿名历史验证。

已授权可代办：本机签署上传、证据与更新记录、原仓复核/归档清理；无需用户执行重复发布命令。真机由用户发布后安装或打开大厅检查验证。异机密钥备份保持维护待办，不声称已实现。
