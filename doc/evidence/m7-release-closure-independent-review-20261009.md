# M7 v0.3.0 正式发行闭环独立审阅

- 受审提交：`669fc401211ed89ab74cdead913ec9caf77e0600`，基线 `e694efaed707bd852cc48ea78e31c3ed198731c0`。只读核查时主仓库 HEAD 与远端 main 均为受审提交，工作树干净，`git diff --check` 退出 0；本提交变更 37 个文档/非秘密证据文件，没有生产代码、APK 或签名密钥。未新建或清理目录，未读取密钥、口令或原始存档。
- **结论：无阻塞项，M7 发行闭环审阅通过；可按既有授权进入 v0.4.0 的独立需求、设计与实施规划。** 本结论覆盖已归档的模拟器与公开线上通道实证，不把真机、TalkBack、异机密钥恢复或新增资源编号自动下载写作已通过。

## 公开发行身份与字节

1. 本地与远端注释标签 `v0.3.0` 剥离后指向发行源码完整 SHA `e694efaed707bd852cc48ea78e31c3ed198731c0`；`v0.2.0` 仍指向原 `74216c3fba62faed3f92fb5daa8e3526ba35f866`。本次文档提交不移动发行标签。公开 GitHub API 的 `/releases/latest` 与 `v0.3.0` 都返回 Release ID `407294713`、非草稿、非预发布、唯一资产 `game-hub.apk` ID `623113303`。资产 2621167 字节、SHA-256 `61751251fa878523186a879c3c73ae9fef722a163cbf1e00f343c6c17736d73d`，与已独立审阅固定候选完全相同。
2. 公开 `game-resources-v1` 为 Release ID `407293817`、非草稿、**预发布**，恰有 `catalog.signed.json` 和四个游戏 ZIP 五资产。API 的资产 ID、长度、摘要逐项与 `anonymous-online-verification.json`、`resource-publication-latest-separation.json` 及发行记录一致。独立匿名下载六资产到内存并复算全部长度与 SHA-256，六项均相符；没有写入本地文件。资源预发布不抢占正式 latest，发行后 latest 指向 v0.3.0。
3. 线上 signed 目录重新以仓库内生产 `resource_public_key.der` 和现有 `verifyEnvelope/validateCatalog` 验签成功：目录 10907 字节、SHA-256 `e7f017b35cbb2fad04f5a521c47508f3616fea0ef471f4bd7245f42cd02f7d62`；payload 摘要 `f5e72d28651a46f6d37d6a2e607bd4699bc4fed209cf912171e6d09f02e4a28b`，序号 1，Conway/EML/Light/Turing 均为 `contentCode=1`。与当前内置编号相同，冷启动没有可安装的游戏更新合理；不据此声称新编号的生产资源已自动下载。

## 客户端、证据和边界

1. `old-client-query-v030.xml/png` 的旧 v0.2.0 UI 实际显示“发现新版本 v0.3.0”与约 3 MB 下载提示；`new-client-startup-v030.xml/png` 的最终 v0.3.0 UI 显示“大厅已是最新版本”“没有可安装的游戏更新”，四卡仍为内置。两张截图已目视抽查，与 XML 文本一致。它们证明本轮真实客户端在公开通道的查询状态；旧客户端没有在本轮点进系统安装器，文档没有扩大此范围。
2. 发行记录所引最终 APK 候选审阅与发布工具审阅均已归档，固定 APK SHA、发布辅助脚本 SHA、错误提交和错误 APK 的预门禁负例吻合。三轮 v0.2.0 seed/verify、覆盖 v0.3.0 后 verify 的设备日志各 `OK (1 test)`、4.548/3.890/4.058 秒。最终升级没有新旧 PID transcript；报告第 11 行对此明确限定，实际进程终止专项的独立证据另存，未以本轮日志冒充新 PID 实证。
3. `doc/evidence/m7-v030-release-20261009.md:10,19` 准确区分 dbcb 生产/测试代码相同情况下实际复跑 JVM 62 项，与 e694 最终构建的缓存复用；Node 22、lint 0 error/15 warning、运行依赖 153 行与许可基线一致有证据。首次联合资产可见性断言失败未保留各字段，报告只记录后续只读重查成功，没有猜测网络或服务端根因，也没有称首次通过。
4. README、CHANGELOG、SECURITY、测试报告、开源审计和阶段记录的“已正式发布”与公开 Release 相符；主要相对文档链接均存在。历史切片原先的待执行句在最终闭环段落下保留以便追溯，当前 M1–M7 `[VERIFIED]` 明确限定于报告中的本机、模拟器与公开通道范围。密钥异机备份/恢复按用户授权仍为待办，真机/TalkBack/厂商启动器仍未测；v0.4.0 尚未实现。

审阅方式：只读 Git 差异、发行记录、公开 GitHub API 与六个匿名下载资产的内存哈希、生产公钥目录验签、两张原生 UI 截图及 XML。未重跑设备测试、未执行发布、未修改任何仓库。
