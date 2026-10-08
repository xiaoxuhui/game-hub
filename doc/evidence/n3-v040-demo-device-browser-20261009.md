# N3 完整示范的设备与真实浏览器验证切片

- 状态：本切片实际验证通过，提交后独立审阅另行归档；N3 整体仍为 PENDING。
- 来源：`memory-demo` 固定提交 `81bdef33331fefedbb858b1ce109ebc437759bb6`，生产 ZIP 8490 字节，SHA256 `27f1df3b689e6b4592cbfcae4a80e759a274cfd7857e2764ac2203d27bb0876b`。
- 独立构建：复用 `.ci-tmp/game-hub-work/v030-final`，检出 `4c33ab283ff1be051c8cdfa0586800660157559d`，保存前次已审阅改动至该检出的 stash；重新运行生产入口及 `--verify`。本切片测试/构建配置随后复制到独立检出，不声称是最终干净提交发行候选。

## 实际设备验证

`DynamicDemoDeviceTest` 只读取仪器 APK 的生成资产；`prepare-dynamic-device-fixture.mjs` 先执行生产候选验证，再将固定示范 ZIP 和元数据复制到 `android/app/build/generated/dynamic-device-assets`。Gradle 仅为 androidTest 设置该资产目录，生产大厅 APK 不内置示范。普通未准备资产的设备测试会跳过该可选用例，不能把跳过算作验证通过。

任务 AVD `gamehub-upgrade-20261009` / `emulator-5564` 上真实执行：

- [x] 临时 RSA3072 密钥签署实际示范清单；私有测试 store 经生产 v2 验签、ZIP/完整清单安装后，打开真实 `ResourceSession`。
- [x] 使用生产 `MainActivity.openGamePrepared`、真实 resolver、独立 HTTPS origin、统一 `GameHubBridge` 与文件流；触摸错误配对、重新开始，真实 Enter 键翻第一牌，触摸完成三对、三步并禁用匹配牌。
- [x] 系统 DocumentsUI 实际导出 JSON；重开一局后经真实文件输入和 DocumentsUI 导入，再导出。两次导出摘要相同：`51100967b0d672c9ad959cd35afde976720ae133dcf01b82e31f3f67ab8a66aa`。
- [x] 关闭真实会话后移除资源，确认未安装且最高编号仍为 1；重新校验安装同包，新的 Activity/WebView 读取到移除前的实际游戏进度。用例最终恢复测试前此 origin 的游戏存档，并断言恢复结果。

最终实际输出：`OK (1 test)`，23.392 秒。最终仪器 APK SHA256 `7ea02eba44b602456cce396edd88a0695f662c142998884031cfdee810d187f3`，同发行证书 `44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2`。目标 APP 仍为上个独立审阅的开发候选 `64c1e3a0fa61bc1480fb53cf770f43036166da026a1827a976eb97f73bfe0d13`（code4/0.4.0），不作为正式发行资产。

首轮真实失败位于 DocumentsUI 文件名文本节点的直接父节点不可点击；修正为寻找实际可点击祖先后通过。红色输出、修正后和最终运行输出均保留。没有通过直接回调注入 URI 或伪造文件输入绕开系统选择器。仅摘要和自有测试路径公开，导出文件正文保留于任务设备私有过程材料；测试目录及导出文件纳入 N8 集中清理。

## 真实浏览器验证

CUA 两次初始化均因 `windows sandbox failed: helper_unknown_error` 退出，未产生有效测试。改用预装 Playwright/Chromium、全新临时浏览器配置，访问只绑定 `127.0.0.1:18404` 的固定来源检出。`verify-memory-demo-browser.mjs` 实际执行六组交互；Chromium `151.0.7922.34`，页面脚本错误 0：

- [x] 真实指针错误配对只增加一步、无匹配。
- [x] 真实 Enter 激活聚焦牌；三对完成且全部禁用。
- [x] 实际 Blob 下载、文件输入导入并恢复完成进度。
- [x] 非法 JSON 文件拒绝且保留原进度，文件输入重置。
- [x] 刷新后实际 localStorage 进度恢复。
- [x] 390×844 完成页截图人工查看，六牌、操作按钮和文件输入可见。

浏览器结果和截图在本切片证据目录；下载正文为自有夹具，也保留在私有 `.build/memory-demo-browser`，公开记录摘要 `ecbc5ad6192ceb659a066d96366509914af24c3f726c450252c1e2d97fa73027`。浏览器正常关闭；本机测试 HTTP 服务 PID 39312 已记录，N8 清理时核实并停止。

## 尚未覆盖的边界

本设备通过反射调用已验证会话的生产准备入口；未使用生产信任根授权测试密钥，也未把测试目录写入正式 store。尚未证明动态发现/注册界面、普通 `openGame` 的动态安装链及 Activity 恢复注册；N4 负责完整客户端链路。动态 Service Worker 故障、旧四五页存档回归仍待后续实际验证。示范目前翻牌后重建按钮，键盘连续焦点改进留 N6，不声称键盘焦点连续性已完成。

- [ ] N7：`abelian-sandpile` 和 `lambda-diagram-game` 独立打包、发布并用正式大厅验收动态新增。
- [ ] N8：全部发布验收后集中清理本任务临时目录和文件。
