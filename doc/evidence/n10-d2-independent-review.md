# N10-D2 正式旧大厅三资源存档控制器独立首审

- 受审提交：`a1cadc1471f406fce4f6dc6bdb9b8f059142dfc2`。
- 首审结论：**OPEN，1 项 P1 须批改后复审。** 仅核控制器及编译证据；尚未签署伴随测试 APK、安装正式旧大厅、运行 seed/verify 或发布资源。

## P1：verify 可由测试自身激活待生效资源

`android/app/src/androidTest/java/com/xiaoxuhui/gamehub/ProductionUpdateSaveDeviceTest.kt:52-64` 先调用 `store.openSession(id, true)`，再核对 `active` 和 `describeAll().selection.active`。已发行 v0.4.0 同名生产 `GameResourceStore.openSession` 在 `cacheProxyCleared=true`、存在 `ready`、无会话且未固定时，会把该候选提升为 `active`。因此若实际 UI 仅完成下载而未打开/激活，verify 可通过自身调用完成激活后再断言，不能独立证明报告计划的“真实 UI 下载并打开新版本后已 active”。传入 `true` 还代替了本应由正常打开流程提供的缓存清理前提。

建议 seed/verify 都使用 `openSession(id, false)`，并在 verify 打开会话之前只读检查 `describeAll()[id].selection.active`、`active.contentCode=2`、完整 ZIP/source/合同；随后再以 false 打开当前 active 会话检查页面和存档。这样测试不会改变候选/活动选择，UI 激活缺失必然失败。批改后需对精确源码重新编译，实际设备 seed/verify 仍留 D3 正式发行门禁。

## 其它核查

- 控制器只在显式 `productionUpdateSaves=seed|verify` 执行；目标安装包的正式 `0.4.0`/code4/完整 APK SHA 和生产 DER SHA 硬断言，三新 ZIP、来源和原合同与 C3 已审重复生产摘要一致。Lambda seed 要求旧已公开 code1 ZIP，光学/图灵 seed 要求 builtin，未注入假 store/transport/key。
- v0.4.0 Git commit `4aacb1f81b7fc381d2ca7fd725fd93dd109e390e` 的 `MainActivity.Game` 五字符串构造器、`openGamePrepared(Game, Bundle?, ResourceSession, ResourceRuntime)`、`webView` 字段、`ResourceRuntime.storeFor`、`ResourceSession` 与控制器反射签名相符；已有 release 类字节码也只含一个 Game 构造器。原 WebView 的 resolver 路径与本测试调用一致。
- 光学的 `handleCell`、工作台存档键与 DOM 控件，旧 Lambda 的保存/恢复按钮及图灵入口在固定资源源码中可见。脚本断言旧存档、额外键、新玩法；光学以真实 `handleCell` 游戏逻辑播种，并未声称 Android 物理触摸坐标。Lambda 的先前存档在升级后的实际读取仍待设备执行证明。
- 归档的首次 `compileReleaseAndroidTestKotlin` 日志为成功；另只读核对本轮私有 `d2-exact-compile.log`，精确 `a1cadc1` 的最后 `.use` 会话释放版本也实际 `BUILD SUCCESSFUL in 22s`。公开首轮 raw Gradle 日志一处尾空格是原始输出，不涉及产品格式门禁。编译不等于设备通过，报告对此未夸大。

本审阅只写此文件；没有构建、安装、运行设备测试、提交或发布，也未修改主仓库和原游戏仓库。

## P1 批改复审：`5af3bf6a8dd186d800ce8b1d4b0146e279624bef`

**结论：CLOSED。** 批改在打开会话前调用 `store.describeAll()`，verify 先要求实际 active 已是 code2、完整新 ZIP/source 身份与 `selection.active` 一致，且 `selection.ready == null`；然后 seed 和 verify 均使用 `openSession(id, false)`，不会由测试自身提升候选。原有后续 active/合同、真实 WebView 页面、存档和额外键断言均保留。与已发行 v0.4.0 的 `GameResourceStore.openSession` 条件对照，`cacheProxyCleared=false` 排除了先前的 ready→active 自激活路径。

复审时工作检出为精确 `5af3bf6a8dd186d800ce8b1d4b0146e279624bef`，除本审阅文件外无其它工作树变动；`git show --check` 无错误。`a1cadc1` 的精确编译成功证据只属于批改前版本；**5af3bf6 批改后的编译、同证书伴随测试 APK 签署、安装和设备 seed/verify 尚未执行**，须在后续正式门禁分别留证。此次 CLOSED 只放行控制器逻辑，不把未运行的设备验收写为通过。
