# M6 覆盖升级 CI 管道修订独立审阅

- 受审提交：`63b9c1d315097450e5d754aee48021bea695031b`；基线 `0a1c07618a626d09b6c2c9a72dfa7ba9940c24be`。核查时 `HEAD=origin/main`，主仓库工作树干净。
- 范围：只读检查 Git 差异、脚本、故障原日志的关键非敏感行、计划与测试记录；未构建或修改主仓库及四个原游戏仓库，未读取密钥或原始存档。
- **结论：无阻塞项，本修订审阅闭环。可以 dispatch 修改后完整 CI；目前尚无修改后完整流水线通过证据。**

## 核对结果

1. 本机原始失败日志 `.build/upgrade-ci-failed-37840684965.txt` 显示构建成功、两次初始安装 `Success`、`UpdateFixtureTest OK (1 test)`、较新 APK 安装 `Success`，输出 `versionCode=4 minSdk=24 targetSdk=34` 后 `/usr/bin/sh` 以 141 退出，未执行 `preserved-data.txt` 检查。与旧 `dumpsys | tee | grep -m1` 在 `set -euo pipefail` 下的提前关管道归因吻合；没有把安装或预验误判为失败。
2. `scripts/update_upgrade_smoke.sh:1-3,15-21` 仍保留 `set -euo pipefail`。修订只把 `dumpsys` 全量重定向到 `package-after-upgrade.txt`，完成命令后再 `grep 'versionCode=4'`：`dumpsys` 失败会因 `set -e` 退出，版本缺失会因 `grep` 非零退出。随后仍通过 `adb shell run-as` 查询升级前写入的私有 `files/upgrade-marker.txt`；原仪器 `OK (1 test)` 门禁和 `adb install -r` 均未改变。版本与数据保留门禁没有弱化。
3. 在本机 `C:\Program Files\Git\bin\bash.exe -n scripts/update_upgrade_smoke.sh` 退出 0；`git diff --check` 无错误。提交的 `m5-ui-lifecycle-regression.txt` 是 `UpdateLifecycleTest OK (11 tests)`，`m6-upgrade-ci-triage-20261009.md` 准确区分先前发行证书模拟器存档验证和本轮尚未完成的调试证书 Linux 流水线。
4. `doc/实施计划-v0.3.0.md` 的该切片虽标 `COMPLETE`，定义仍明确要求独立审阅后 dispatch，并且“真实安装、预验、保留数据文件、流水线全部成功才标 VERIFIED”；证据文档明确承认仅 `bash -n` 通过。下一步必须用本提交完整重跑 CI，保存结果后才能标记流水线已验证。

## 下一步

由执行端 dispatch 完整升级工作流；检查 `package-after-upgrade.txt` 包含 code4、`preserved-data.txt` 确认旧私有标记仍在且 job 退出 0。若再次失败，应保留新日志并按新失败点定位，不能用本次静态审阅替代实际运行。
