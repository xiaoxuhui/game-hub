# N10-D2 正式旧大厅三资源存档控制器

新增显式设备测试`ProductionUpdateSaveDeviceTest`，只有参数`productionUpdateSaves=seed|verify`启用。没有替换存储、production key、目录或网络响应，也没有写原游戏仓库。

- 严格固定原已发布0.4.0/code4/APK完整SHA `c6e071…` 与生产资源DER `649107…`。Seed要求光学/图灵真实builtin、Lambda真实旧code1+已公开ZIP摘要；Verify要求三个真实活动资源code2、完整新ZIP/sourceSHA及原合同，ready不冒充active。
- 通过实际`ResourceRuntime.storeFor` / `openSession`和旧正式MainActivity的原资源resolver加载页面；按真实游戏保存API及界面逻辑产生光学布局/命名工作台、图灵输入项目、Lambda单步/检查点。Seed保持renderer6秒待落盘；Verify实际读取旧布局/输入/检查点并执行旋转撤销/单步/恢复，额外存档键保留。会话以use释放，ActivityScenario仍走真实WebView。
- 首审发现`openSession(id,true)`会在测试内提升ready，无法独立证明正常UI已激活。已批改：任何打开前先检查真实active的完整预期code/SHA/source、selection及ready=null，再使用`openSession(id,false)`，seed也false。测试不再自行激活候选；正常UI下载并打开仍是独立必要步骤。
- 光学布局点击调用实际handleCell（原UI同一逻辑）；独立Chromium的真实pointer点击已在C3验证。本控制器不声称Android触摸坐标验收。没有“只有本地标记就通过”的结论。
- 实际`gradle -p android compileReleaseAndroidTestKotlin -PgameHubTestBuildType=release --no-daemon`退出0，BUILD SUCCESSFUL。此为控制器编译，尚未签同证书伴随testAPK/安装正式旧大厅/seed/verify，不能视作设备升级成功。

审阅CLOSED后先从当前clean SHA生产资源并组装release伴随testAPK、同正式证书签名。自身emulator-5566正常安装原已发布v0.4.0，原v2目录安装旧Lambda1，运行：

```text
adb -s emulator-5566 shell am instrument -w -e class com.xiaoxuhui.gamehub.ProductionUpdateSaveDeviceTest -e productionUpdateSaves seed com.xiaoxuhui.gamehub.test/androidx.test.runner.AndroidJUnitRunner
```

正常目录发布v1seq2/v2seq5及真实UI下载并打开新版本后，用同命令`productionUpdateSaves verify`在联网及断网force-stop重启后分别验收。具体资产/证书/控制器SHA/命令/退出码必须随后归档。
