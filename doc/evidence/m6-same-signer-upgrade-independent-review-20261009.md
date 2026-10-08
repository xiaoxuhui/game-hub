# M6 同证书真实 APK 覆盖升级切片独立审阅

- 受审提交：`f6368e29a0d484091ac53a0c8fd0a5ced5aa83d8`；开发基线 `b58f165d6664557f66ad33b243e19be484ffef70`。主仓库 `HEAD=origin/main`，工作树干净。
- 范围：只读复核源码、独立检出、发行证书和 APK 摘要日志、设备测试链、失败批改和声明边界；未在主仓库或四个原游戏仓库构建、修改，未读取私钥或口令。
- **结论：无阻塞项，放行进入下一切片。** 本结论覆盖模拟器上真实公开旧包至同证书候选的存档保留，以及较新版 APK 的预验；不等于最终发行候选、真机或较新版安装验收。

## 逐项核对

1. `android/app/build.gradle.kts:9-12` 的 `gameHubTestBuildType` 默认 `debug`，显式只允许 `debug/release`；release 仪器修复了 Kotlin `verifyArchive$app_debug` 对 release 目标的内部方法名错配。原失败栈在 `upgrade-v031-preflight-debug-variant-failed.txt`，release 编译与 `OK (1 test)` 分别在 `upgrade-release-instrumentation-compile.txt`、`upgrade-v031-preflight-release-intent.txt`，没有修改 `verifyArchive` 生产逻辑。
2. `UpgradeSaveDeviceTest.kt:29-60` 从目标 APK 的真实清单限定资源路径，以同一 `https://appassets.androidplatform.net` origin 加载目标包中的真实页面，禁用网络；`61-81` 调用 PatternLibrary、EMLPersistence、LightStorage 和两个 Turing 编辑器路径。Conway 自定义图案名、EML 非默认 `inputXId`、Light 三星、Turing 输入与 campaign 草稿均有可区分的保存值。`seed` 后先立即读回，force-stop 后 `verify`，再 `adb install -r` v0.3.0 后 `verify`，最后 release 仪器再 `verify`；四次日志均 `OK (1 test)`，没有重新 seed。
3. `UpgradeFixtureStageTest.kt:12-23` 只在显式 `stageFixture=true` 时从仪器本地 asset 复制较新 APK 到目标私有 cache，核对传入 SHA；未把该 APK 加入产品资源。原有 `UpdateFixtureTest.kt:15-29` 使用生产 `ApkUpdateManager.verifyArchive` 检查实际 APK 的大小、摘要、包名、版本名、递增编号和证书，再核对 `content` 安装意图与读取授权。`0.3.1/code4` 的日志只证明该预验成功，没有安装记录；文档对此披露准确。
4. 历史发行文档 `doc/测试报告.md:7-9`、`doc/发布草案-v0.2.0.md:20-21` 已固定线上 `v0.2.0` APK 的 2a7c… SHA、2,526,679 字节与 44e92… 证书；本次 `upgrade-v020-public-signature.txt` 与其一致。`upgrade-v030-signature.txt`、`upgrade-v031-fixture-signature.txt` 和 release 仪器签名日志为同一证书；v0.3.0 安装日志为 `Success`，生产包版本为 `0.3.0/code3`。候选 `verify_apk.py` 日志确认基线四源、40 APK 资源。四个受审源码文件在主仓库、独立检出与 `m6-upgrade-hashes-20261009.json` 的 SHA-256 逐项一致；独立检出 `HEAD` 仍为 detached 基线，只有这四处测试/配置差异。
5. `scripts/update_upgrade_smoke.sh:15-20` 只运行旧 `UpdateFixtureTest`，避免扩大的仪器测试集误触发需要控制参数的新用例，升级断言指向 code4。提交文档明确只做 `bash -n`，没有把整条 Linux 工作流误报为已跑。JVM 62 项标注 `FROM-CACHE`，失败批改及日志保留，`git diff --check` 无格式错误。
6. `git ls-files` 未发现本次 APK、仪器资产、私钥或口令被跟踪。原游戏仓库未被审阅过程修改；四源固定 SHA 与既有基线相同，EML 的既有用户工作树差异仍在。

## 证据边界与后续执行

- 本轮公开证据是 APK 摘要、证书和设备执行日志；仓库没有提交 APK 字节。审核者能独立重算四份受审源码的摘要，不能仅凭日志重新计算本地 APK 字节摘要。v0.2.0 的发行摘要另有此前公开发布记录锚定。最终候选应在干净的最终提交独立重建并留存其 APK 摘要、签名和安装验收。
- 当前测试以独立 WebView 加载真实游戏页面及稳定 origin，验证存档内容跨真实 APK 覆盖仍可读；没有覆盖新版大厅的完整原生 UI，也没有验证真实用户真机、外部安装器点击、API24、异机密钥恢复或较新 0.3.1 的安装。后续按计划继续执行完整脚本、UI 和最终发行候选验收。
