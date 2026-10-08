# M6 四下载游戏断网后的实际进程重启

- 开发基线18d744e87471435bbcc5f81f87389538a856da99；构建只在D:\soft\game-hub-upgrade-20261009。编译release仪器包成功；同发行证书签署本地offline-four-test-signed.apk，SHA-256 f3435619a4c43cf7d8c70e7ea5b85a3654c292f3f0fc42d73acf24404fd70e29，使用此前同证书v0.3.0/code3 UI候选。未发布候选或测试APK。
- 独立外部PowerShell控制器只在本任务emulator-5564调用两次仪器。首次断网，真实临时签名四code2包安装并激活、五页保存与即读通过；等待标记后外部检查当前PID、force-stop、确认旧进程不存在，再启动第二仪器。无线/移动数据设置在finally恢复其进入脚本时的开关。
- runId 074efe509a274cf9b590767b7cefe3e5；实际旧PID8279→新PID8651。after-restart.txt真实OK(1 test)，21.274秒；recovered.json记录4下载游戏/5实际存档页。before-kill.txt的Process crashed是外部真实force-stop预期结果，不作为首轮JUnit通过；保存及页面断言须全部执行后才写cutpoint日志。

## 实際执行范围

1. 使用生产GameResourceStore、签名/ZIP验证、全文件校验、ResourceSession、MainActivity.openGamePrepared、生产GameContentResolver/WebViewClient/原有桥。每页session.game.contentCode=2且root非空，关闭后无会话，持久active编号2。
2. 四个入口各fetch真实登记入口URL，返回原签名夹具附加的`signed compatibility candidate`字节标记。网络activeNetwork必须为null；因此实际资源字节来自私有已安装下载资源，不用内置版本假称更新后可用。入口追加注释是测试差异，不是正式资源版本。
3. Conway真实PatternLibrary自定义图案“下载资源重启存档-20261009”；EML真实选择inputX=null、inputY/selectedValue为首初始值；Light实际level-1二星；Turing主编辑input110101及campaign草稿。仅首次写入，重启验证分支不seed，实际五页全部读回。
4. 首轮夹具active store复制到任务自有files/offline-four-verification/store，保存公开验证公钥与PID/runId。关闭夹具后其cache源目录删除；没有将私钥字节写文件，恢复只用公钥。源码注释的“private key destroyed”仅指夹具作用域结束，不提供JVM堆内存清零保证，本文与计划据实限定为不持久私钥。原始实际存档不公开，公开日志只有PID/编号/用例结果。
5. 单例ResourceRuntime仍使用生产公钥，测试经明确prepared会话加载临时签名资源；不改生产公钥/下载端点。这项验证已安装会话在不同实际进程离线读取文件/存档，不覆盖大厅启动缓存迁移门禁（既有ResourceWebView/生命周期夹具另已验证），也不等于正式线上公钥目录下载或用户真机。

命令：在独立目录运行`scripts/resource_offline_restart_smoke.ps1 -Adb <SDK adb> -TestApk <同证书release仪器副本> -EvidenceDirectory <本任务新证据目录> -Serial emulator-5564`。不能运行真实用户手机；测试参数offlineRun不传默认Assume跳过，普通OK不代替外部控制器实证。五个中断点的半成品恢复已有另一个独立闭环切片，此项只补四已激活资源/五页实际存档的完整离线重启。首次运行即通过，未改生产代码以绕过断言。提交推送后独立审阅闭环，再准备最终clean SHA候选及发行文档。
