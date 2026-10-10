# N10-C1 Lambda 0.3.1 冻结集成独立审阅（2026-10-10）

受审已推送提交：`64c8932af9a0b5cc886db25910b3923a16aa0677`。结论：**CLOSED，无本切片阻塞项**。仅审阅独立检出、冻结上游源码、公开日志/截图及文件摘要；未运行构建、发布或读取私有原始存档内容。

## 来源与产物

- `dynamic-upstreams.lock.json` 将 Lambda 固定到正式标签剥离后的完整提交 `a75d180193fbe7298709298102c8c6008d1353cd`、版本 0.3.1，Abelian 条目内容保持。上游独立检出 HEAD 与该 SHA 相同且工作树干净，`package.json` 版本确为 0.3.1。
- 逐行核对冻结 `scripts/build.mjs`：读取 `index.html`、`src/style.css` 和 `core,diagram,diagram-view,presets,library,snapshot,download,workspace-tools,viewport,app` 十个 JS；大厅 `stage-upstreams.mjs` 的 `lambdaInputs` 完整覆盖这些输入，另核 `LICENSE`、`package.json`、构建脚本。对来源证明所列 **15/15 输入**逐项重算文件大小、SHA-256 和 Git blob，均匹配固定提交；不是从浮动 HEAD 取值。
- 集成 HTML、上游重建 `dist`、两次新鲜 staging 的 HTML 均为 **97,931 字节 / SHA-256 `baff963457b858d7f2d40f656e91f0abbd087ca56e9a657851c90f85d386f2e9`**；重建 `dist` 的 Git blob 与正式标签已追踪 `dist/lambda-lab.html` 相同。证明中的两个输出（HTML、LICENSE）大小与 SHA 均匹配；LICENSE 与固定 Git blob 相同并保留完整 MIT 正文。`sources.lock.json` 原 APK 四来源未改，资源 contentCode/集成 SHA 尚留 C2 冻结。

## 验证与声明边界

- 大厅 Node 日志为 **46/46、0 失败/跳过**。Lambda 原生测试首轮 **136 项、134 通过/2 跳过**，跳过原因是独立检出尚缺正常生成的 Android asset；执行上游 `sync-android-assets.mjs` 后再次 **136/136、0 跳过**。两轮结果均保留，未把首轮称全绿。
- 浏览器脚本以同一 `127.0.0.1:18416` 原点先加载冻结 0.3.0 HTML，再路由到本次固定 0.3.1 HTML。私有旧 HTML 只核摘要：**85,296 字节 / `548484c86bfb3b43fdfb1d9bc2e7f9fe0212f03b437d2ef4277c7f0f8df149ab`**，与上一版已审证明一致。脚本在 390×844 与 1280×900 两视口实际做转换/单步/保存点、重载、旧普通存档导入、新普通导入、清空前完整备份导入，并断言当前表达式、保存点和无关本地键；最终日志 PASS，`pageErrors=[]`。首轮把普通导出误认为完整备份而失败的日志保留，最终测试分别验证普通格式与完整备份格式，没有改产品逻辑去迎合错误预期。
- 两张截图目视显示手机/桌面图示及交互控件；手机截图是滚动到图示区域的局部视口，不能单独证明页面顶部布局，布局无横向溢出由浏览器脚本断言。此浏览器验证不能替代正式 Android WebView、签名资源和发行升级测试；报告明确这些仍在后续 C2/D/E。`git diff --check` 无问题。

本切片可进入 C2 固定该集成提交的动态资源来源并继续三游戏生产；本结论未授权提前发布资源或 APK。
