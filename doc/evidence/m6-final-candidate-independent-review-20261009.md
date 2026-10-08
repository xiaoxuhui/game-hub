# v0.3.0 最终 APK 候选独立审阅

- 受审源码：`e694efaed707bd852cc48ea78e31c3ed198731c0`。只读核查时主仓库 HEAD、远端 main 与独立检出 `D:\soft\.ci-tmp\game-hub-work\v030-final` 均为该完整 SHA；两工作树干净。未在主仓库或四原仓库构建、修改，未读取密钥、口令或原始存档。
- **固定可发布 APK：`D:\soft\.ci-tmp\game-hub-work\v030-evidence\game-hub.apk`，2621167 字节，SHA-256 `61751251fa878523186a879c3c73ae9fef722a163cbf1e00f343c6c17736d73d`。独立复算匹配。结论：本 APK 字节通过最终候选审阅，无阻塞，可以作为 v0.3.0 正式 APK 资产发布。** 资源目录/ZIP 的线上签署与匿名核验仍须按发布流程执行，不能由本 APK 审阅代替。

## APK、源码和签名

1. 使用本机只读 `apksigner verify --verbose --print-certs` 独立核验产品 APK 与 `final-release-test.apk`：两者均 v2、v3 验签成功、单签名者，证书 SHA-256 `44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2`，与已发布 v0.2.0 发行证书记录一致；没有读取签名私钥。仪器 APK 实算 SHA-256 `f79a085a27bc8b8972ce0050f5b4a7444e541c98e0b4e306cfd428388b986b2b`，与 `final-apk-hashes.json` 一致。
2. 独立 `aapt dump badging/permissions`：`com.xiaoxuhui.gamehub`、`versionCode=3`、`versionName=0.3.0`、min SDK 24、target SDK 34；权限为 INTERNET、ACCESS_NETWORK_STATE、REQUEST_INSTALL_PACKAGES 及签名级动态接收器权限。安装后 `final-upgrade-package.txt` 也显示 code3/name0.3.0，未见 DEBUGGABLE 标志。
3. 签名 APK 与该独立检出的 `app-release-unsigned.apk` 有 166 个共同 ZIP 条目，逐项 SHA-256 完全相同；签名 APK 仅多 3 个签名条目。`classes.dex` 与 `assets/bundle-manifest.json` 字节一致；包内 `bundleCommit` 为完整 `e694efa...`、四来源、40 文件。`final-signed-assets.txt` 对固定签名包验证四来源/40 资源。四个关键生产源码的 Git blob 均与主仓库受审提交相同；其中两个磁盘文件的原始哈希差异只由主仓库 CRLF 与独立检出 LF 换行造成，正规化内容和 Git blob 相同。

## 构建、升级与来源证据

1. 最终证据 `node-check.txt` 为 22/22；`android-jvm-rerun.txt` 记录 38 秒、23 项任务执行且 BUILD SUCCESSFUL，独立检出 12 份 JVM XML 重新汇总为 62 测试/0 失败/0 错误，与 `jvm-counts.json` 一致。其后的 `android-unit-release-lint.txt` 有缓存复用并如实记录成功，不冒充再次全量编译。`android-release-instrument.txt` 为 release 仪器构建成功。精确源码 SHA 的公开 GitHub Actions 运行 `37848837696` 经 API 确认为 `completed/success`、HEAD `e694efa...`。
2. `final-upgrade-seed-v020.txt`、`final-upgrade-read-v020.txt`、`final-upgrade-read-v030.txt` 分别为 `OK (1 test)`、4.548/3.890/4.058 秒。测试源码 `UpgradeSaveDeviceTest.kt:54,60-78` 只有 `saveMode=seed` 写五页，`verify` 只读；对应公开 v0.2.0 安装和最终 APK 覆盖安装记录均为 Success，最终设备包为 code3/name0.3.0。保存状态涵盖 Conway、EML、Light、Turing 主页面与 campaign；不依赖重新 seed 冒充升级保留。证据未单独保留 force-stop 命令/PID transcript，因此本独立审阅直接确认三次独立仪器读写和覆盖安装的留存结果，不额外声称从这些文件可复核 force-stop 的精确时点；历史实际进程终止专项另有独立证据。
3. 最终资源构建、验包、重建日志均指向 `e694efa...`；四 ZIP 摘要与 `doc/evidence/resource-sources-repeat.txt` 的早期独立重复结果一致。`originals-after-build.json` 与原来源快照一致：三仓库干净，EML 原有 22 条工作树变化保留，四个 HEAD 未移动。
4. 正确的 `:app:dependencies` 任务在 `release-runtime-dependencies.txt` 中 BUILD SUCCESSFUL；153 条依赖解析树与历史发行许可基线无差异。初次根项目错误调用保留在 `release-runtime-root-task-failed.txt`，没有计作成功。独立整文比较只有旧 CI 日志尾部路径一行差异，不影响依赖树。`publisher-preflight-negative.json` 与 `publisher-wrong-apk-negative.json` 记录对移动提交和错误 APK 路径/哈希的拒绝，未放宽固定资产门禁。

## 发行边界

- 本结论固定于上列 APK 的完整 SHA-256；文件字节变化即须重新审阅。正式 tag、Release 资产、资源目录签名/ZIP 上传与匿名在线核验仍须实际执行并存证，不能先标为完成。
- 用户已授权 APK 与资源密钥异机备份及恢复延后至待办，当前不据此阻止本轮发布；真机安装、TalkBack 与厂商启动器按授权留发行后验收。不得将临时测试资源密钥或受控 HTTP 设备结果写作生产资源线上发行验收。

**审阅结果：无阻塞项；准许发布固定 SHA `61751251fa878523186a879c3c73ae9fef722a163cbf1e00f343c6c17736d73d` 的 `game-hub.apk`。**
