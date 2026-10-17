# 参与贡献

请先阅读 [Android需求与测试用例](doc/需求与测试用例.md)、[设计文档](doc/设计文档.md)及[来源基线](doc/来源基线.md)。本仓库集成四个内置来源及经过审核的动态游戏；网页八游戏另冻结在web/sources.lock.json。玩法改动应先在相应原项目处理，再经评审更新来源SHA。

1. 从本仓库创建独立检出，在该目录安装依赖和构建。不要在四个原游戏仓库运行合集构建，也不要修改它们的工作树。
2. 对功能变更先更新对应需求、验收方式和设计，再小步提交代码。请附上实际运行的命令、结果、设备或浏览器环境，以及未验证项。
3. Android改动在独立检出运行 `pnpm run check`、`pnpm run bundle`、`pnpm run verify:bundle`、`pnpm run audit:storage` 和 `cd android && ./gradlew testDebugUnitTest assembleDebug`。如果缺少Android环境，请清楚注明。网页改动先读[网页需求](doc/网页版大厅需求与测试用例.md)和[实施计划](doc/网页版大厅实施计划.md)，按README运行prepare/check/test/build/verify及浏览器测试；pnpm test的原核心门禁也必须保留。
4. 提交 Pull Request 时说明固定来源是否变化、数据兼容性影响和截图或录屏证据。不要提交密钥、签名文件、生成的 APK、`node_modules` 或 APK 内置资源副本。

漏洞请按 [SECURITY.md](SECURITY.md) 私下报告，不要先公开利用细节。

所有安装、构建和浏览器运行均使用本次独立检出拥有的缓存/产物目录。固定来源仓库只读；历史reader副本只作有许可和摘要证明的有限向量，不能在未跑真实旧reader/writer矩阵时宣称全历史双向兼容。网页开发不自动提升Android版本或改变APK资源身份。
