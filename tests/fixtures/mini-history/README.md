# 固定历史存档向量

这些是测试输入，不会进入网页产物。四个版本的纯 reader/helper 原字节来自 mini-scratch 固定完整 Git SHA，见各目录 provenance.json；每份保留原 MIT LICENSE。没有复制界面、录音或网络模块。

- v1：0.1.0 的原 tests/fixtures/square.json，配套原 core.js reader。
- v2：0.2.0 原 example(dance)，包含变量、事件、嵌套返回值和旧参数定义。
- v3：0.3.0 原 example(dance) 经该版本真实启动的 migrateProcedures，包含具名参数；本向量没有媒体资产。
- v4：0.4.0 同样本经该版本真实启动的 migrateEventScripts，包含独立事件脚本。

复现：先 `pnpm run prepare:web` 准备固定隔离来源，再 `node tests/fixtures/mini-history/generate.mjs`；生成器仅 git show 读取既有缓存的固定提交，Date.now 在样本生成时固定为 0 以稳定积木 ID，finally 恢复。源 helper/许可逐文件保存 bytes/SHA-256。

浏览器用例证明新 reader 读取这些旧样本、编辑升级、原旧槽及备份原字节保留、旧 reader 仍能读取保留旧槽。**不证明新编辑会回流旧槽，也不证明旧 reader 能执行新列表/媒体/事件等全部新能力。** N13 的完整逐版本双向矩阵继续单列，不把旧槽保留当作全历史兼容认证。
