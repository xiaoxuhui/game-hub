# M1 安卓签名协议与公钥验证

2026-10-08，独立检出 D:\soft\game-hub-build-resources-20261008。

- 私钥位于仓库外 D:\aiden\game-hub-resource-signing\resource-private-key.dpapi，当前 Windows 用户 DPAPI 加密；未写入仓库/CI/日志。
- 公钥为 Android res/raw/resource_public_key.der，RSA3072，keyId resources-20261008。
- 公钥 SHA256：649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673。
- 本机 DPAPI 恢复、内存签署、对应公钥验证夹具 PASS。不是异机恢复，异机备份仍未完成。
- `gradle.bat -p android testDebugUnitTest assembleDebug --no-daemon`：BUILD SUCCESSFUL，49s。
- 新增 ResourcePolicyTest 四项覆盖签名原字节/篡改/未知key、重复JSON/非法UTF8/字段类型、四来源及兼容合同、路径/预算/日期/编号边界；已有13项JVM保持通过，合计17项0失败0错误。
- 严格Base64为应用实现，不依赖 API26 的 java.util.Base64；保持 minSdk24。
- Node 全套22通过0失败；新增公钥 KeyObject 与 DER 使用入口、标准输入私钥签名支持，避免强制私钥落明文文件。

当前尚未接入网络、存储、会话、提示界面，不能将协议验证当成可更新APP。M1资源工具复审两项P1已闭合；见 m1-tools-independent-review-20261008.md。

提交 dd9faac 后独立审阅无平台/编译阻塞，指出目录当前时间检查与固定公钥调用边界。
批改：verifyEnvelope 默认强制当前时间窗口；只有明确的 verifyInstalledProof 可验证已安装离线资源的历史证明，过期不使已有游戏停用。新增确定性未来/过期/偏差边界测试，JVM18项0失败0错误，BUILD SUCCESSFUL in 23s。M2安装必须调用新鲜度入口，M3/M4生产适配器只读取APK固定公钥，不从目录取钥。
