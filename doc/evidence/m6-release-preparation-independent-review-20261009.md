# v0.3.0 发行准备文档切片独立审阅

- 受审提交：`bea4192c6f842be7c00bac6c1700b0ed77ee45a9`，基线 `dbcb8b3d3ae737eb62014361ccf257fc1eb3b3b2`。只读核查时本地主仓库 HEAD、远端 main 均为受审提交，工作树干净，`git diff --check` 退出 0。未构建主仓库或四原仓库，未重跑设备测试，未读取密钥、口令或原始存档。
- **首审结论：一项 P2 文档入口问题，应在最终签名候选重建前批改并独立复审。** 其余已陈述的历史构建、测试和公开版本边界与可复核证据一致；异机密钥备份恢复按用户授权仍是后续待办。

## 需批改

**P2：新版开源审计没有对外链接，README 仍把历史 v0.2.0 审计称为当前“发行审计”。** 本提交新增 `doc/开源就绪度审计-v0.3.0.md:1-33`，明确说原审计仅作历史；但 `README.md:62` 的“发行审计”仍指向 `doc/开源就绪度审计.md`，该文件讨论 v0.2.0 的 code2/依赖和已发行状态。README 第 48 行已改为新版 v0.3.0 测试报告，读者容易将旧审计误作本轮审计。全仓库没有到新版审计的 Markdown 入口。建议把 README 的发行审计链接指向 `doc/开源就绪度审计-v0.3.0.md`；可在新版审计首段另链接历史 v0.2.0 审计。此项为文档准确性问题，适合在最终干净 SHA 构建与签名前修正，避免签名后因文档提交变化再重建。

## 已核对

1. `CHANGELOG.md:3-8` 将 0.3.0 放在日期标题下，同时明确写“发行准备记录，正式公开状态以 GitHub Release 为准”。GitHub 最新正式 Release 的公开 API 当前返回 v0.2.0、非草稿、非预发布；新审计第 14 行亦说 v0.3.0 尚待标签及发行，没有虚构已发布状态。
2. `doc/开源就绪度审计-v0.3.0.md:9-18,24-33` 十项核查齐全；明确保留最终干净 SHA、同证书覆盖升级、标签/资产和匿名双通道在线核验四项发行闭环门槛。没有将历史夹具/调试证书升级冒充最终发行证据。2026-10-09 的用户授权准确记为本轮先发行、两类密钥异机恢复延后；同机恢复没有被算作异机验证。
3. 公开 GitHub Actions API 返回运行 `37847705000` 对 `dbcb8b3...`、`37847441916` 对 `e3b39c8...`、`37842381018` 对 `63b9c1d...` 均 `completed/success`，与新审计第 11 行一致。`m6-clean-build-20261009/node-check.txt` 为 22/22；`android-jvm-rerun.txt` 为 `BUILD SUCCESSFUL in 38s`、23 项任务执行；独立检出 12 份 JVM XML 重新汇总为 62/0/0，与 `jvm-counts.json` 一致。`android-unit-release-lint.txt` 与 `android-release-instrument.txt` 均成功；独立检出 lint XML 实数 0 error、15 warning，分类 5 GradleDependency、2 StaticFieldLeak、3 UsableSpace、1 MonochromeLauncherIcon、4 SetTextI18n，与审计第 22 行一致。
4. `resource-repeat-hashes.json` 的四 ZIP 摘要逐项等于早期独立重复构建的 `doc/evidence/resource-sources-repeat.txt`，本轮 `resource-build.txt`、`resource-repeat.txt` 分别记录构建及再次构建。`apk-assets.txt` 只证明干净 `dbcb8b3` 四源 40 APK 资源；新审计将最终 `bea4192` 发行产物验证留作未完成，边界准确。`originals-after-build.json` 的四仓库 HEAD 与原只读快照一致，EML 仍为 22 项既有变化，其余三仓库状态为空。
5. 新增的 14 份构建证据均被 Git 跟踪，文本中未见私钥、口令或原始测试存档正文；公开日志包含本机检出及依赖缓存路径，但未见凭证。新版测试报告的 14 个相对 Markdown 链接均存在；新版开源审计本身无 Markdown 链接，需解决上述 README 入口。

审阅方式只限文件与公开运行元数据；没有复现本轮构建、签名或设备操作。后续最终候选必须基于批改后干净 SHA 重新构建并保存结果。

## 批改提交 `e694efaed707bd852cc48ea78e31c3ed198731c0` 独立复审

- **P2 已闭合。** `README.md:62` 的本轮“发行审计”现链接 `doc/开源就绪度审计-v0.3.0.md`；新版审计第 3 行另以明确的历史标识链接 `doc/开源就绪度审计.md`。两个相对目标均存在，读者从 README 不再被导向 v0.2.0 历史审计作为当前结果。
- 首审原文归档为 `doc/evidence/m6-release-preparation-first-review-20261009.md`，问题与边界保持原样。批改差异仅 README、新版审计首段与首审归档；没有生产代码、构建或发行资产变化。核查时主仓库 HEAD 和远端 main 均为批改提交，工作树干净，`git diff --check bea4192 e694efa` 退出 0。

**最终结论：本发行准备切片的提交后独立审阅闭环，可以从 `e694efa` 干净独立检出开始最终候选重建、签名和升级验收。** 这些后续步骤仍需各自保存实证。
