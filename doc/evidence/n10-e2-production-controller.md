# N10-E2 正式大厅生产检查控制器

显式参数`formalHallMode=startup|manual|offline|stageFuture`，默认在常规suite中显式跳过。实际目标必须是0.4.1/code5、已指定完整APK SHA256、原正式证书和原资源DER摘要；不注入传输、签名key、运行时或资源状态。

startup由真实MainActivity启动触发自动查询，等待生产协调器实际五个正式源版本/时间戳和阿贝尔无正式版本原因。manual通过真实更新摘要点击打开Dialog及“立即检查”按钮，要求五项成功时间戳全部大于第一次。五个已安装版本与真实sourceMessage必须显示已核对发布，不允许凭缓存、ready候选或未知源默认最新；APK通道也要求非历史、已核对及无待下载大厅。offline要求真实网络离线、各下载offer清空、所有已有源结果为显式issue。

三已激活资源在Activity之前检查实际store code2/完整ZIP SHA及selection.active，ready必须空；控制器不打开资源session、不激活候选。三实际游戏存档由D正式资源控制器验收，四内置页面和图灵campaign由既有UpgradeSaveDeviceTest作0.4.0→0.4.1覆盖升级验收，本控制器不冒称替代这些玩法/存档检查。

stageFuture仅将显式提供的私有testasset复制到正式0.4.1缓存、核对全SHA；其后既有UpdateFixtureTest检查严格更高0.4.2/code6、同证书与系统安装intent。不安装该future、不发布测试资产或引入任意端点配置。原正式0.4.0控制器固定身份保持不变。

必须先编译、提交和独立审阅CLOSED，再从最终干净SHA构建同正式证书伴随测试APK。线上测试只有匿名配额恢复及D三资源生效/存档verify完成后执行；现在尚未运行，不标通过。正式APK发行仍待D与E全部实际门禁。

实际独立检出`gradle -p android assembleDebugAndroidTest -PgameHubTestBuildType=debug --no-daemon` BUILD SUCCESSFUL 30秒。此仅编译本控制器和E1批改，不是正式设备PASS。
