# M6 四下载游戏离线重启切片独立审阅

- 受审提交：`47a8f93f1c731b1d9c5c7431c1bfeca0c9f995d9`，基线 `18d744e87471435bbcc5f81f87389538a856da99`。只读核查时本地主仓库 HEAD 与 `origin/main` 均为受审提交，工作树干净；`git diff --check` 退出 0。未在主仓库或四个原游戏仓库构建、修改。
- **结论：无阻塞问题，本切片提交后独立审阅闭环，可进入下一切片。** 这是临时签名资源的 prepared 会话离线重启实证，不是生产公钥在线更新、启动 cacheguard 或最终发行候选验收。

## 已核查的控制流与证据

1. `android/app/src/androidTest/java/com/xiaoxuhui/gamehub/ResourceOfflineRestartDeviceTest.kt:38-85,90-119`：首轮在断网断言后安装四个签名 code2 夹具资源，逐页打开生产 `MainActivity.openGamePrepared`、`GameContentResolver` 与 WebView；四个登记入口通过 `fetch(location.href,{cache:'no-store'})` 检查夹具特有注释字节。Conway、EML、Light 和 Turing 主页面及 campaign 共五页在 `seed=true` 时写入并即读，关闭后断言无会话且 active 编号为 2。cutpoint 前复制已激活 store、只持久保存公钥；恢复用例只新建 `GameResourceStore`、打开会话并读取五页，没有安装、写入或再次 seed。测试直接调用各游戏存储 API/页面事件，不等同真实用户逐项触摸保存；文档将其限定为实际页面与持久存档验证，未扩大为人工 UI 操作验收。
2. `scripts/resource_offline_restart_smoke.ps1:30-62`：外部脚本先关任务 AVD 无线与移动数据；cutpoint 与 `pidof` 旧 PID 一致后执行 `am force-stop`，确认包进程消失，再启动第二次仪器。恢复日志需 `OK (1 test)` 且无失败词，随后检查同 runId、不同新旧 PID、四资源和五页计数。`finally` 恢复进入脚本时的网络开关。随机 32 位十六进制 runId 同时在测试和脚本中约束，旧日志不能轻易冒充本轮标记。
3. `doc/evidence/m6-offline-four-20261009.md` 与其子目录：`cutpoint.json` 旧 PID 8279、`recovered.json` 新 PID 8651；`after-restart.txt` 为 `OK (1 test)`、21.274 秒。首轮 `before-kill.txt` 的 `Process crashed` 是外部 force-stop 后的仪器结尾，文档没有冒称首轮 JUnit 通过。`compile.txt` 为独立目录 release 仪器构建成功。`source-hashes.json` 的测试和控制脚本两条主仓库/独立检出 SHA-256 均重新计算匹配；仓库外 `offline-four-test-signed.apk` 重新计算为文档所列 `f3435619...04fd70e29`。未读取私钥、口令或原始存档。
4. `ResourceDeviceFixture.kt:19-21,38-54,70,80,91` 与 `GameResourceStore.kt:149-180,183-204`：夹具私钥用于内存签名，落盘复制的是安装后的 store 与公开验证公钥，重启后的 store 仍按已安装证明与文件 SHA 核验。`ResourceDeviceFixture.close()` 删除夹具目录；源码注释“key destroyed”不能证明 JVM 堆清零，证据文档已经明确限定为不持久私钥。这一限定准确。

## 非阻塞建议

- **P3 测试控制器防误用**：`scripts/resource_offline_restart_smoke.ps1:9` 的 `^emulator-[0-9]+$` 仅确认 Android 模拟器序列号格式，无法证实“本任务自有模拟器”。当前执行明确使用 `emulator-5564`，结果不受影响。若脚本将来作为常规回归入口，建议加入任务 AVD 名称/特征核验或在调用前要求操作者明确确认 serial，并把报错文案改成“只允许模拟器序列号”，避免把格式校验表述为所有权校验。

审阅方式：只读提交差异、生产资源会话与夹具代码、日志及摘要文件；没有重新运行设备测试，没有读取 `m6-actual-exports` 原始存档或任何密钥/口令。历史构建目录清理不影响此审阅，所需的当前独立检出源码已复算。
