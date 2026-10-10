# N10-E1 0.4.1 版本与未来升级夹具独立首审

- 受审提交：`e13a6f5007f958a25ae208c7c92cc0948403b4b4`。
- 首审结论：**OPEN，1 项 P1 设备门禁遗漏需批改复审。** 本切片只准备 0.4.1/code5 与受控未来夹具；正式 APK、同证书升级和 D 阶段旧正式资源现场仍待后续验收。

## P1：另一个未来主机不兼容测试仍使用 minHost=5

`android/app/src/androidTest/java/com/xiaoxuhui/gamehub/DynamicCoordinatorDeviceTest.kt:178` 的 `incompatibleNewGameIsVisibleButCannotDownloadAndCorruptInstalledUpdateKeepsOld` 仍构造 `dynamicRelease(minHost=5)`，而当前 `build.gradle.kts` 已升至 `versionCode=5`，两者兼容。该测试随后要求资源不进入可下载列表、下载被拒，和夹具目标相反；本次只编译 AndroidTest，未运行完整设备套件，因此没有捕获此漏改。`DynamicLobbyDeviceTest` 同类负例已改为 `minHost=6`。请将此处也提高到 6，保留后续拒下载及损坏更新保旧资源的断言；批改提交后独立复审。否则完整 connected 测试预计会失败，且未来主机门禁覆盖会失真。

## 其余核查

1. `android/app/build.gradle.kts` 与 `package.json` 同步为 `0.4.1`/code5，Android check 和 release-candidate 的 aapt 门禁精确检查包名、code5/name0.4.1。`android-update-upgrade-smoke.yml` 先断言源码为5/0.4.1，再只在 CI 工作树生成6/0.4.2夹具；`UpdateFixtureTest` 对该新版本执行候选预检，shell 脚本检查安装后的 code6 与原数据标记。没有降低同签名/版本递增要求。
2. 协调器未来APK伪远端、`DynamicLobbyDeviceTest` 未来 host 及其断言已更新。`ProductionResourceIdentityDeviceTest`、`ProductionUpdateSaveDeviceTest` 和 `UpgradeFixtureStageTest` 保持旧正式0.4.0身份硬断言；它们只在显式正式验收路径运行，未被本次版本替换影响。
3. Node红日志为53项中52通过/1失败，失败准确指向旧 `android-shell` code4 断言；修订后严格检查应用ID、minSdk、code5、0.4.1且53/53通过。Gradle日志为 `testDebugUnitTest assembleDebug assembleDebugAndroidTest` BUILD SUCCESSFUL；独立读取17份 JUnit XML 汇总为95项/0失败/0错误/0跳过，并对现有debug APK只读执行aapt得到`com.xiaoxuhui.gamehub`/code5/0.4.1。编译 AndroidTest 不能替代其实际设备运行。
4. 实施计划和E1报告明确：旧正式 v0.4.0 D 场景仍保留，D 实际验收是 E 正式发行前置；当前debug构建使用此前bundle，不当作精确E1正式候选，未宣称已签发或升级。

审阅未执行构建、安装、签名、发布或密钥读取；只新增本审阅文件，不修改原游戏或主仓库。
