# N3 独立 origin / 统一桥基础切片

- Status: COMPLETE（此切片已实现并执行，提交后独立审阅待闭环；N3 整阶段 PENDING）。
- 构建仅复用 D:\soft\.ci-tmp\game-hub-work\v030-final；144dfa36f45575b43965ef02e1cfdc4b8ba74d0a基底加本切片副本，非最终干净发行候选。四内置资源仍来自不可移动锁定SHA；中间候选继续使用上一独立打包资源，不称APK源码证明完成。

## 产品改动

- origin只由合法ID生成；四原ID仍是appassets.androidplatform.net，新ID为ID.appassets.androidplatform.net。resolver同时核对精确host、协议/端口、路径及当前游戏完整文件清单；跨动态/旧origin请求不能读取资源。
- 动态resolver要求已安装会话，入口/版本/来源采用已选择session，恢复WebView历史时仅允许当前完整清单的HTML。原生桥保持旧四名称，新合法ID为GameHubBridge；动态Blob下载也复用现有原生导出代理。
- 在Activity和缓存检查WebView创建前全局禁用Cookie，每个WebView禁用第三方Cookie。保留localStorage和IndexedDB，没有清空存档API。
- 缓存检查在当前origin执行；已知资源缓存可删除，旧相关Worker解除；未知缓存保存不动，对动态游戏同时拒绝激活和进入，旧四游戏保留既有门禁语义。检查页面必须收到可信native主页面响应，伪造Worker结果不放行。

## 实际执行

- 强制全量JVM：77项/0失败/0错误/0跳过，38秒，23任务实际执行；新host/跨origin/端口/编码路径负例与旧v1全部通过。
- 发行构建、release friend测试APK、lint通过；基础构建32秒，76任务21执行/55up-to-date。随后会话入口/恢复历史边界补丁实际重编译，15秒，70任务12执行/58up-to-date。
- 任务AVD5564覆盖同发行证书code4/0.4.0开发候选；DynamicOriginWebViewTest两项和旧ResourceWebViewTest四项真实执行，5.232秒，OK(6 tests)。完整原始输出与签名摘要见n3-v040-origin-20261009。
- 实际Cookie用例先以native API写入父域测试Cookie，确认它原本可在兄弟host取得，再全局禁用；两个动态origin与旧Light origin的DOM读/写均为空。使用同名专用fixture key/数据库写入三种不同值，重新创建WebView后各自读回其值；只删除测试key/数据库/Cookie，没有删除其他游戏数据。
- 动态缓存用例实际写入已知资源响应、通过guard移除；另写未知响应，guard拒绝canPlay/canActivate，存档标记及未知缓存内容仍在。旧四项WebView用例包括真实Light、旧SW响应被解除以及伪造根Worker检查页拒绝。

## 明确未测范围

上述动态页面是测试夹具，尚非完整示范UI；未把标记数据称作实际游戏存档。动态origin的旧SW注入、实际示范配对/键盘、系统SAF导出→导入、资源移除/重装保留进度及旧四游戏五页真实存档回归留N3后续切片。目录/恢复动态游戏的注册、UI图标及状态管理留N4，尚不能从大厅UI发现新游戏；没有发布中间候选。

前阶段N2设备复审144dfa3已闭环并归档。用户要求两个新游戏资源与全部发布后的临时目录/文件清理已进入版本待办，执行顺序不变；不在本次开发中提前删除目录。
