# N10-B4 完整设备门禁与测试夹具批改

## 修订

完整门禁首次暴露 `UpdateLifecycleTest.kt:209` 的夹具不确定性：从真实联网单例复制的 `apkRemembered` 已为 true，却在后续模拟新鲜结果时期待下载按钮。只明确设置受控初始 `apkRemembered=false, resourcesRemembered=false`；后续 history=true、不兼容、固定、候选/active和远端99.0.0不得冒充本地的全部断言保持。产品代码没有放宽。

## 两次失败留痕

1. `gradle -p android testDebugUnitTest connectedDebugAndroidTest --no-daemon`：XML **68项 / 1失败 / 11显式跳过**，失败位于上述209行。日志 `b-full-device.log`、XML `b-full-red.xml`。
2. 同命令：新鲜度测试通过，但 `UpdateFixtureTest` 失败“CI must copy the second APK into the app cache”。上轮结束Gradle卸载宿主，缓存被删除；控制器忘记再次注入。日志 `b-full-fixed-device.log`、XML `b-full-controller-red.xml`。没有把它当产品故障，也没有禁用测试。

## 测试输入

仅使用本轮自有 Android34 default x86_64 AVD `gamehub-n10-20261010 / emulator-5566`；四内置资源仍为 APK固定来源。

- 示范ZIP由独立历史检出 `b71d14ae2d554ed38eda72480d15d06b2c02fafd` 的普通生产器和 `prepare-dynamic-device-fixture.mjs` 真实生成并verify，来源 `81bdef33331fefedbb858b1ce109ebc437759bb6`，ZIP SHA `27f1df3b689e6b4592cbfcae4a80e759a274cfd7857e2764ac2203d27bb0876b`；只复制到 instrumentation APK generated assets。没有改当前动态来源锁回旧版。
- 同签名新APK也仅在此历史独立夹具检出先干净bundle，再显式改 version5/0.4.1、assembleDebug；3,202,667字节，SHA `7e0c8417d36c05ca0f93094f6f76fd4b674bee1ae10ddcf44e985e9cf684eb3f`。只是调试测试输入，不是正式候选或公开资产。
- 最后一轮每次门禁前执行 `adb -s emulator-5566 install -r <当前debug APK>`、push上述新APK到`/data/local/tmp/n10-fixture.apk`、`run-as com.xiaoxuhui.gamehub mkdir -p cache/updates`及`cp ... cache/updates/fixture.apk`；实际 `ls -l`读回3,202,667字节，随后执行同一完整Gradle门禁。

正式0.4.0/0.4.1同证书升级、三新资源安装/真实存档与单独控制器项目仍留N10-D/E。本记录不替代真实手机验收。
## 最终结果

同一完整 Gradle 门禁退出0，BUILD SUCCESSFUL，XML68项 / 0失败 / 0错误 / 11显式跳过（57实际执行）。Gradle控制台 Finished79包含重复累计跳过，报告按实际XML而非控制台总数计。JVM XML95项 / 0失败 / 0错误 / 0跳过；Node46项先前已在B3完整通过，本修订仅测试输入不改Node代码。B3精确CI38061376399 success。完整设备日志 b-full-green-device.log。

显式跳过名单：
- com.xiaoxuhui.gamehub.DownloadedDocumentBridgeTest#fourVerifiedDownloadedGamesImportAndExportThroughActualSystemPicker
- com.xiaoxuhui.gamehub.DynamicResourceProcessRecoveryTest#verifyAfterActualProcessRestart
- com.xiaoxuhui.gamehub.DynamicResourceProcessRecoveryTest#prepareInterruptedOperation
- com.xiaoxuhui.gamehub.LobbyAccessibilityDeviceTest#realLobbyAndUpdateDetailsRemainReachableAndCancellationActionReachesTaskGate
- com.xiaoxuhui.gamehub.ProductionResourceIdentityDeviceTest#installedProductionIdentityMatchesReviewedRelease
- com.xiaoxuhui.gamehub.ResourceOfflineRestartDeviceTest#readFourDownloadedGamesAndActualSavesAfterProcessRestart
- com.xiaoxuhui.gamehub.ResourceOfflineRestartDeviceTest#prepareFourDownloadedOfflineSessionsAndPause
- com.xiaoxuhui.gamehub.ResourceProcessRecoveryTest#verifyAfterActualProcessRestart
- com.xiaoxuhui.gamehub.ResourceProcessRecoveryTest#prepareInterruptedOperation
- com.xiaoxuhui.gamehub.UpgradeFixtureStageTest#stageSameSignerFixtureForPrivatePreflight
- com.xiaoxuhui.gamehub.UpgradeSaveDeviceTest#fourRealGameSavesSurviveSameSignerApkUpgrade
