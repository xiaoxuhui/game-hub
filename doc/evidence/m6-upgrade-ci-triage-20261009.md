# M6 覆盖升级CI失败定位与管道修正

受审基线 0a1c07618a626d09b6c2c9a72dfa7ba9940c24be；原流水线提交 f6368e29a0d484091ac53a0c8fd0a5ced5aa83d8。

实际失败： https://github.com/xiaoxuhui/game-hub/actions/runs/37840684965 。构建base/code3与fixture/code4、仪器安装、UpdateFixtureTest（OK1）以及新fixture安装均成功；`versionCode=4 minSdk=24 targetSdk=34`已输出，紧接任务退出141，尚未运行保留文件检查。

根因：`set -euo pipefail` 下 `dumpsys|tee|grep -m1` 在grep找到首个版本后提前关闭读端，前级仍写大量包状态时SIGPIPE，导致流水线失败。不是APK安装失败，不弱化pipefail。

批改：先完整重定向dumpsys到package-after-upgrade.txt，再从文件grep版本，若版本缺失仍非零失败。`bash -n`在本机Git Bash通过；修改后完整GitHub流水线须提交后独立审阅闭环再dispatch，当前未声称通过。完整失败任务日志只留本地 .build/upgrade-ci-failed-37840684965.txt；未复制含运行器环境信息的整份日志入公共仓库。

补充UI回归：0a1c076的同发行证书UI候选执行现有UpdateLifecycleTest，实际11项/0失败，73.962秒，日志m5-ui-lifecycle-regression.txt。该测试的loadingError用例明确写入Light一星测试存档；因此此前v02→v03覆盖链在其完成时成立，今后不能用本AVD的原始三星值声称再次通过最终覆盖验收。最终候选应另行建立明确的旧包存档验收链，不能重新seed后假称原值保留。
