# N12 提交后独立审阅与批改

## A 计划与兼容性

- 2026-10-12，review_p0，只读独立视角。初审 c6c26de：OPEN，Lambda 手动归约 snapshot 写version3，已发行旧版只读version2，违反兼容恢复合同；EML新组合函数存档同样旧reader不接受。
- 最小真实模块实验：Lambda手动session.paths新encode=3/newdecode成功，旧decode抛“不支持这个存档版本”；去paths的普通v2仍可读。EML旧存档新reader接受，新组合存档新reader接受而旧reader拒绝。可重复脚本/输出另存。
- 批改 8bd4eef69564db9d4e16aac1b2c8aa884b2b7853：EML/Lambda来源编号冻结，本轮仅康威/阿贝尔更新，T06补阻断依据，迁移列待办。
- 复审 CLOSED：计划与范围一致、主仓干净、diff --check通过；Abel源码只改index interval step=100→1，存储模块未改；康威原存储模块未改，新增两个脚本须进入白名单，缺文件API时先报错不删除，正式WebView仍须实测。

## B 资源候选

- B1 来源集成提交06febcbf7ae9a16ed40cb10aa6507ce6e1ceb4cc，review_p1独立CLOSED：Abel实际源码与集成同字节，仅index step修订，15项输入/13输出证明逐字节及SHA匹配，原存储模块/七原仓HEAD与状态保持，64/64大厅测试；未将来源集成代替B2生产或实际兼容验收。
- B2发行锁提交ef41c24584a970fafcfae635ae7db15d694059de，review_p1独立CLOSED：康威18资源与新增脚本引用顺序匹配，编号2；Abel锁指向06febcb完整适配提交、编号2；六游戏锁与原APK sources.lock保持。此结论只覆盖锁，不代替生产/浏览器验收。
- B3提交8bd82b7ccd75c2504f0ccf4d94225f41c909b804，review_p1只读CLOSED：独立复算12候选size/SHA及六旧ZIP一致，64/64回归、上游失败/专项复验边界如实；4组真实浏览器操作和截图通过，无阻断批改。正式宿主/签名发行留C阶段。

## C 签名发行与正式宿主

- C1提交3ec793f8451164e02de5909fdd1233fadfec72d6，review_p0初审OPEN：offline仅跳过查询，须在测试入口证明真实无默认网络；公开companion构建日志行尾空格须清理。
- 批改165b27e81bafa23516e9e8a980f4aa664b23d676，review_p0复审CLOSED：offline真实activeNetwork=null门禁与ZIP/存档检查同时保留，日志rstrip，完整最终补丁diff --check通过。此结论仅控制器，设备尚未通过。
- C2 首次设备seed在阿贝尔下载ready=null失败，随后实际UI显示“游戏查询限流，旧结果待检查”；公共rate_limit实际remaining=0、reset=2026-10-12 01:30:46+08:00。保留失败日志。控制器批改为每轮复用启动后实得的自动查询：两个checkedAt均不早于本次startedAt、两个remembered=false、idle，禁止读旧缓存当通过，避免每游戏重复查询。自动下载通过真实设置先关闭，下载失败补实际状态诊断。待提交后复审和额度恢复重验。
- C2批改2afbda179f8924d57e029d5cdddb0ca416729c90，review_p0复审CLOSED；生产/发行准备review_p1再次复算12候选/24份size+SHA、8ZIP与B3相同、64/64、最终CI38158736828success、OSS30链接/治理/无私钥、七原仓相同，CLOSED仅准备范围；详细审阅归档n12-c3/prepublish-independent-review.md。
- C3实际两通道签名公开与匿名全历史验证已完成，旧seed32.545s PASS；首次update真实匿名限流失败，实际激活/离线仍待。证据提交后独立审阅待执行，不冒称整个C阶段完成。
- C3证据提交3dce46520af4495eefa6d54942e1ce2a41dbec90，review_p1初审OPEN：四份current/previous目录离线验签、历史9目录/14 ZIP、正式APK绑定与实际失败SHA均匹配；唯一批改为首次update摘要第2行尾空格。批改将SHA合并到标签同行，并通过diff --check；正式下载/离线仍保持待验。
- C3批改32d9e17b757c409d58aee4aea8215ff3c32f1556，review_p1复审CLOSED：正式DER离线验签、2afb八ZIP完整SHA/size、9目录/14 ZIP历史、正式失败原始SHA均匹配；七原仓未变，只有发行证据切片关闭，C整体仍待实测。
- C4追加独立离线执行脚本：在线update真实OK后才允许执行，固定本轮AVD，真实关WiFi/data，记录旧PID/force-stop消失/新PID；未注入网络或资源状态，原控制器检查activeNetwork=null与新code/旧存档。finally恢复自己的网络。仅语法解析已过，提交后独立复审待执行，未冒称已运行成功。
- C4脚本61be3271ec6320fa2d089712f8d22d9338dc5b25，review_p0初审OPEN：finally先写PASS再恢复，且双开会改变原开关。批改为断网前读取实际WiFi service及wifi_on/mobile_data开关、finally逐项按原值恢复并复核；恢复失败写FAIL和errors，全部完成才写终态。语法解析与diff --check通过，真实执行仍待。
- C4批改296992c04c5c7e3d73888540b1a116f60bd3d40e复审仍OPEN：global mobile_data不是telephony实际开关，旧N5和本轮只读AVD均验证global=1/actual=false。追加读取唯一mUserMobileDataState，按实际service原值恢复，终态同时核对原global值及WiFi/mobile实际服务；超时先停止自己的仪器目标进程再恢复网络。语法与diff --check通过，待复审。
