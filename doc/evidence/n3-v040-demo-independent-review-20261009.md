# v0.4.0 N3 示范游戏浏览器与设备切片独立审阅

- 受审提交：`b71d14ae2d554ed38eda72480d15d06b2c02fafd`。
- 方式：只读检查提交、脚本、仪器测试、编译/设备/浏览器证据及完成页截图；未在主仓库或四原仓库构建或修改。检查时主仓库工作树干净。

## 结论与通过范围

**未发现阻塞本切片归档的问题。** `DynamicDemoDeviceTest` 从仪器 APK 的可选生成资产读取固定 ZIP/元数据，断言固定来源 SHA 和 ZIP SHA；用临时 RSA3072 仅授权测试私有 `GameResourceStore`，经生产目录验签、安装并打开 code1 会话。它通过反射把已验证会话交给生产 `MainActivity.openGamePrepared`，由生产 resolver/WebView/统一桥加载页面。文档明确说此路径不覆盖生产信任根、普通动态发现/注册与 `openGame` 缓存门禁，没有把它写成完整首次安装链。

真实 UI 注入触摸及 Enter 后，测试逐步断言错误配对、胜局与六张牌禁用；系统 DocumentsUI 导出、实际文件行选择导入、重导出 JSON 等值与本地状态回归均有断言。移除资源前关闭会话，重装同一签名 ZIP 后新 Activity/WebView 读取原进度；`finally` 在正常断言或失败路径中尝试恢复测试前 `memory-demo-state-v1`，并断言恢复值。原始用户存档、密钥及口令未进入提交；保留的导出为任务模拟器自有测试材料，文档列 N8 清理。

`prepare-dynamic-device-fixture.mjs` 先执行候选 `--verify`，再拷贝到 `android/app/build/generated/dynamic-device-assets`；Gradle 只把该目录接入 `androidTest` assets。未准备夹具时用例 `Assume` 跳过，文档没有将跳过当通过。最终 `n3-demo-device-final.log` 是 `OK (1 test)`、23.392 秒，同证书仪器 APK 的 SHA 与证书摘要有日志。首轮 DocumentsUI 文件名父节点不可点击的失败与修正日志均保留。浏览器结果列六项、`pageErrors=[]`；截图实际显示六张已匹配牌、胜局、导入导出入口，和报告狭义主张一致。

## 后续门禁

- N3 仍需真实动态 Service Worker/缓存故障、旧四游戏五页存档回归；N4 仍需普通动态目录发现、用户选择安装、生产协调与注册全链路。当前临时私有签名夹具与反射准备入口不能代替这些测试。
- 测试自产的私有夹具目录与 Downloads 导出文件留给 N8 集中精确清理；若后续将用例放进长期 CI，宜改为在 `finally` 中按 UUID 精确清理，且在测试失败时报告恢复/清理失败。当前证据没有把任务模拟器残留误称零残留。

**审阅结论：本示范浏览器/Android SAF 切片可归档并进入下一切片；N3 整阶段继续 PENDING。**
