# N10-B3 实际六源检查、状态与界面

日期2026-10-10，唯一过程根 `D:\soft\.ci-tmp\game-hub-n10`，基于六源严格客户端复审CLOSED及96bd953cf65be2541fd2604e0bcb3896d7c40c9b。

## 改动

- 启动与手动检查在两签名资源通道之后逐一查询六源；源通道60秒总预算、1MB单响应，单源失败隔离，独立持久upstream限流通道。源版本只作提示，不进入下载资产/资源签名授权。
- 已成功源发布、旧结果待检查、404无正式发布、超时、限流分别可见；资源查询失败撤回旧下载预约，成功后断网撤回新鲜状态；后台/取消最终结果也标历史。已经验证的本地候选与实际存档保留。
- APK提示给出实际安装及核对到的正式版本。源提示比较实际active/内置，ready只显示候选；不可用、不兼容、固定/隔离、历史目录不宣称可安装。未知/格式异常不显示最新版，不使界面崩溃。
- 首页保留三行，将源新发布/签名资源更新/待生效提醒优先显示；更新详情列出六源正式版本与最后成功核对时间；红绿及示例明确由大厅签名目录更新。

## 真实失败回归

设备 `emulator-5566`，本轮自己的 Android34 default x86_64 AVD，1080×1920/density420，hidden无窗口。冻结四基线资源在独立检出干净96bd953构建，清单40文件。为满足生产工具clean gate，只暂存本轮新写的单个设备测试到本轮evidence，构建期间恢复该测试的受审基线，finally还原新增回归；没有修改原仓库，也没有删断言/绕过clean gate。该构建器首次拒绝dirty工作树记录保留。

生产协调器未改时，执行：
`adb -s emulator-5566 shell am instrument -w -r -e class com.xiaoxuhui.gamehub.UpdateCoordinatorDeviceTest#manualAndStartupQueriesIncludeAllRegisteredGameRepositories,com.xiaoxuhui.gamehub.UpdateCoordinatorDeviceTest#goingOfflineMarksSuccessfulResultsAsHistorical com.xiaoxuhui.gamehub.test/androidx.test.runner.AndroidJUnitRunner`

实际 **2项2失败**：conway应请求1次实际0；断网后 remembered 仍false。不是构建失败。[红日志](n10-b3-device-red.log)。

## 修复后验证

1. `D:\soft\game-hub-toolchain\gradle-8.7\bin\gradle.bat -p android testDebugUnitTest assembleDebug assembleDebugAndroidTest --console=plain` exit0；补充生命周期/候选格式负例后，JUnit XML **95项、0失败/错误/跳过**。[最终构建日志](n10-b3-final-green-build.log)。设备包两次实际安装成功。
2. `adb -s emulator-5566 shell am instrument -w -r -e class com.xiaoxuhui.gamehub.UpdateCoordinatorDeviceTest com.xiaoxuhui.gamehub.test/androidx.test.runner.AndroidJUnitRunner` 实际 **OK(10 tests)**、无skip/fail；[设备绿日志](n10-b3-final-device-green.log)。包含原6项保护和新增启动/手动每六源请求、离线历史、404/SocketTimeout仍继续其它源/签名资源、upstream持久限流不阻其它通道。
3. `node --test` exit0，**46项/0失败/0跳过**；[日志](n10-b3-node.log)。`git diff --check` exit0。
4. 真实公网原生候选冷启动：大厅API实际返回0.4.0，两签名目录无新的已装资源，源查询发现光学1.2.1和图灵0.5.1，首页自动提示“2个游戏源仓库有新发布”。实际点击“检查更新”触发第二次查询；详情给出光学已装1.2.0/源1.2.1待制作，图灵已装0.5.0/源0.5.1待制作，Lambda源0.3.1/未安装，Abel未找到正式发布；康威/EML显示双方实际同版本，非默认值。
5. 截图目视发现源提醒第四行被旧maxLines=3裁切（XML有文本不能代替可见性）。批改为提醒第一行、APK第二行、目录入口第三行，再 `gradle -p android testDebugUnitTest assembleDebug` exit0，重装/冷启动再次实查并目视通过，四内置卡全部首屏。[最终首页](../screenshots/n10/b3-home-final.png)，[在线详情](../screenshots/n10/b3-detail-online.png)，[UI重建日志](n10-b3-ui-green-build.log)。
6. 只在自己的模拟器 `svc wifi disable` / `svc data disable`，成功后的首页立即显示源/大厅“离线，历史结果待检查”，不再显示新发布为新鲜结果；[离线截图](../screenshots/n10/b3-home-offline.png)。检查后已 `svc wifi enable` / `svc data enable` 恢复。真实XML与全部私有过程日志留本轮evidence待收尾归档。

## 边界

这是**独立构建的调试候选**，版本仍0.4.0；不是既有线上正式APK，也尚未发布0.4.1。三资源尚待生产/发行、完整新APK升级/多尺寸/实际签名及生产身份在后续阶段。没有运行全部 connectedDebugAndroidTest，不把10项协调器用例称全设备门禁；动态生产夹具及更新到最终0.4.1后测试另记录。真机由用户发布后验收。提交后的独立审阅CLOSED才继续下一切片。
