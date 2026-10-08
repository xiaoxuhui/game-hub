# N2 Android 实际进程恢复与开发版本切片独立首审（2026-10-09）

受审提交：`07487a42ea56c7122ad0f582f9349c6e15c174ad`。审阅提交时 HEAD 与 origin/main 一致，工作树干净；只读检查代码、版本/CI 改动、归档证据和指定的仓库外 APK，不在主仓库或原游戏仓库构建/修改。N2 核心 `9dd5097` 的先前独立复审结论另有原件，本次聚焦设备切片。

## 待批改（证据精度）

1. **P2：state-before 的状态描述高于测试实际证明。** `doc/evidence/n2-v040-device-slice-20261009.md:22` 写“旧完整选择保留”，但 `DynamicResourceProcessRecoveryTest.kt:58-61,111,123,130-132` 每阶段从空夹具目录开始；此中断发生在首次 `ready` 状态提交前。恢复 JSON 为 `active=builtin`，代码断言 `ready=null`、`installed=false`、首次打开拒绝，仅证实已接受的内容水位 1 保留，没有“旧完整资源”。建议写明水位与选择状态及该夹具没有旧已激活资源。审阅期间开发者已在工作树准备该文字批改，须提交留痕并复审。
2. **P2：签名与 APK 哈希声明缺少提交内原始输出。** 同文档第 12–16 行列两个精确 SHA 与相同发行证书，但受审提交的设备证据只有安装、构建和控制器日志，没有 `apksigner`、`aapt`、哈希输出。只读复算仓库外 `D:/soft/.ci-tmp/game-hub-work/v030-evidence/n2-v040-development.apk` 与 `n2-v040-development-test.apk` 的 SHA，分别确为 `41f2effea39770684c95e3b7c706cec9c63cfb5aba1bfe05574b8e89d4cc45dd`、`2dd2f43a9ebdb2d7a0e6487591ff38901294283ff6a9a27722e02285f989690f`；开发者随后生成的非秘密 `n2-device-signature-hashes.txt` 显示二者证书 SHA256 均为 `44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2`，开发 APK badging 为 code4/0.4.0。请将这份输出提交归档，便于复核者从同一提交追溯声明；该证据文件在首审时尚未提交。

## 已确认的产品与测试边界

- `scripts/dynamic_process_smoke.ps1:11-13` 在任何安装或 force-stop 前限制 emulator serial 并核对专用 AVD 名；场景名固定，私有测试根路径固定。测试删除的是应用私有夹具目录，不触碰生产资源 store。每个 cutpoint 的 PID 与 `pidof` 对照，外部 `am force-stop` 后检查无存活 PID，再运行新 instrumentation 并核对 `previousPid != newPid`。三个 final-process 场景分别为 10244→10296、10340→10390、10435→10484，恢复日志各 `OK (1 test)`，控制器均 PASS。被中断仪器日志显示进程被终止，不能把这轮称作对象重建。
- `state-before` 验证 AtomicFile `.new` 已同步写出、恢复撤销未提交 ready；`state-after` 验证完整资源在新进程安全会话实际读出 HTML；`retirement-half` 验证双签名历史 seq2/seq1 时恢复 seq2 退役、撤 ready、拒绝旧目录及首次激活。三场景均核对 staging 清空、内容水位和独立磁盘哨兵哈希。哨兵不等于 WebView/localStorage 存档，文档已将真实 origin/桥验收留在 N3。
- 首次 Android ZipOutputStream 夹具失败有归档，生产 `ResourceArchive.kt` 仍严格要求 STORED+UTF8；修订夹具对应 `resource-bundle.mjs`/既有设备夹具格式，仅改测试，没有放宽产品解包。最终 Node 31/0；lint 0 error、16 warnings。当前构建 JVM 任务为 UP-TO-DATE，文档正确引用上一核心修复切片的强制 JVM75，而非本次重新执行。
- `android/app/build.gradle.kts`、`package.json`、两 CI badging 断言、升级 smoke 的 code5/0.4.1 夹具及 Android 测试期望已一致调整。旧 v0.3 特定历史脚本仍保留旧版断言，属于既有 v0.3 验证工具。当前 APK 明确是独立检出开发候选，文档未宣称最终干净发行候选；N2 保持 PENDING，双 store 并发预算门禁留 N4、真实 WebView 存档留 N3。新两游戏只加入本轮后的待办，没有冒称已生产。

**首审结论：未发现进程控制器或产品恢复行为的阻塞缺陷；两处证据精度/归档 P2 需提交批改后复审，N2 本切片暂不闭环。**
