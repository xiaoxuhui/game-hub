# 参与贡献

感谢提交问题和改进。请先阅读 [需求与测试用例](doc/需求与测试用例.md)、[设计文档](doc/设计文档.md)及[来源基线](doc/来源基线.md)。本仓库只集成四个固定来源；玩法改动应先在相应原项目处理，再经评审更新来源 SHA。

1. 从本仓库创建独立检出，在该目录安装依赖和构建。不要在四个原游戏仓库运行合集构建，也不要修改它们的工作树。
2. 对功能变更先更新对应需求、验收方式和设计，再小步提交代码。请附上实际运行的命令、结果、设备或浏览器环境，以及未验证项。
3. 提交前在独立检出运行 `pnpm run check`、`pnpm run bundle`、`pnpm run verify:bundle`、`pnpm run audit:storage` 和 `cd android && ./gradlew testDebugUnitTest assembleDebug`。如果缺少 Android 环境，请清楚注明。
4. 提交 Pull Request 时说明固定来源是否变化、数据兼容性影响和截图或录屏证据。不要提交密钥、签名文件、生成的 APK、`node_modules` 或 APK 内置资源副本。

漏洞请按 [SECURITY.md](SECURITY.md) 私下报告，不要先公开利用细节。
