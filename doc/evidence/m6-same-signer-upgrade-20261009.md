# M6 真实发行证书覆盖升级验证

- 开发基线 b58f165d6664557f66ad33b243e19be484ffef70；独立检出 D:\soft\game-hub-upgrade-20261009。先在干净detached基线实际构建固定四源，40资源与清单验证成功；随后只加入本切片仪器代码/测试配置和本地较新测试资产。四原仓库未修改。
- 新专用 Android34 模拟器 gamehub-upgrade-20261009 / emulator-5564；原模拟器和用户真机不变。首次启动55s等待超时，随后系统启动完成；安装/验收在boot_completed=1后执行。
- 线上真实 v0.2.0 APK 匿名下载，SHA-256=2a7c61881b22af64aae16c06bfa250d958a7d6b7bd30bec9a44fe06b38a161e4，2526679bytes，包名com.xiaoxuhui.gamehub/code2/version0.2.0。apksigner验证证书SHA-256=44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2。

## 已执行

1. 独立assembleRelease及assembleDebugAndroidTest退出0，2m14s；用仓库外原发行p12为v0.3.0候选和仪器包签名，证书与线上旧包完全相同。密码只在内存和临时子进程环境使用，结束清除，无新增公开密钥、密码或CI secrets。
2. 安装真实线上v0.2.0和同证书仪器包均Success。UpgradeSaveDeviceTest在目标应用默认WebView持久化目录、相同HTTPS origin加载旧APK里的五个实际页面，并用实际游戏接口/编辑器操作保存：Conway图案、EML inputX选择、Light level-1三星、Turing input=101101、campaign草稿。每个保存后同页面读取断言通过，整项OK(1test)，4.319s。
3. adb am force-stop后重新启动仪器进程，在真实v0.2.0再次读取上述实际状态，OK(1test)，3.701s。此处是真正应用进程停止；本测试未记录前后PID，五中断点PID精确证据另见上切片。
4. adb install -r覆盖同证书非调试v0.3.0候选Success；包code3/version0.3.0，dumpsys无DEBUGGABLE标志。再次加载五实际页面读取，OK(1test)，3.829s。没有重新seed，也没有清除应用数据。
5. 独立检出临时改为0.3.1/code4，assembleRelease退出0，52s；同发行证书签名较新APK，嵌入独立仪器APK的androidTest/assets（不进入产品APK或仓库）。UpgradeFixtureStageTest写入非调试目标app私有cache并核对传入SHA，OK(1test)。
6. 首次使用debug仪器调用release目标的内部方法时失败：Kotlin生成verifyArchive$app_debug与实际$app_release不匹配，NoSuchMethodError。保留失败栈；增加显式gameHubTestBuildType=release（默认debug、只接受debug/release），独立assembleReleaseAndroidTest退出0，48s。签名并安装匹配release仪器后，原生产UpdateFixtureTest预验版本/包名/大小/摘要/签名和content URI安装意图均通过，OK(1test)，0.026s。没有改变预验逻辑或使用反射绕过检查。
7. 新release仪器包最后复验v0.3.0五页面真实存档，OK(1test)，3.901s。模拟器保持v0.3.0，较新0.3.1只作预验，未安装也未发布。
8. 修正原Linux升级脚本：仪器只运行UpdateFixtureTest，不再跑整个扩大后的测试集；实际升级断言改code4。Git Bash bash -n退出0；完整该工作流运行在提交后独立审阅闭环后另行记录，不能称为本轮已执行。
9. 独立配置恢复0.3.0/code3，默认debug testDebugUnitTest退出0，20s；任务FROM-CACHE，恢复XML为62 tests /0 failures/0 errors。候选verify_apk.py退出0，证明b58f165四源/40包内资源。

## 摘要与证据

- 本地升级候选v0.3.0 SHA-256=5a6b9b612c397f7e4b8d0914a58ab050c2b57e4072556023b9a53e5a71a37a4f，2621167bytes。
- 本地较新测试v0.3.1 SHA-256=f24d26519f520ffa9713ffeaf4c4a9a507d6b559364d6badbb2da9fe184ecfec，2621167bytes。
- 所有包与三次测试仪器签名均校对上述同一公开发行证书；独立构建基线/清单/签名/失败和修订日志为本目录upgrade-*.txt。四份受审源码与独立检出逐字节一致，源码及四关键APK字节摘要见m6-upgrade-hashes-20261009.json。

## 边界

这些是实际游戏格式与接口写出的模拟器测试存档，不是用户手机存档；自定义只读asset拦截器加载真实包内页面和同稳定origin，没有验证旧/新大厅全部原生UI操作。主候选基于b58f165、随后补充的是测试源码/配置，不能直接作为最终clean SHA发行包。默认未提供saveMode/stageFixture时新测试Assume跳过。此轮没有原生安装器人工点击、API24真机、外部密钥备份/恢复或新版本发布。正式候选将在完整最终提交独立重建，发行后用户真机验收。

生产进程恢复修复b58f165 CI运行37835637457已success。独立进程恢复审阅无阻塞，已归档m6-process-recovery-independent-review-20261009.md；本切片提交后另行独立审阅。
