# N6 资源 #2 正式发行闭环独立审阅

- 日期：2026-10-09
- 受审提交：`fae01e6a11870fbf460e0950910860ac24b80756`，本地 `HEAD=origin/main`，工作树干净；`git show --check` 无格式错误。
- 范围：N6 正式资源 #2 发行与现有 v0.4.0 客户端验收的归档、公开资产、非秘密设备证据。本次只读；没有修改主仓库、原游戏仓库、发行资产或读取原始存档/密钥。

## 结论

**CLOSED：未发现阻止进入 N7 的问题。** 正式 v2 资源目录已从序列 1 连续更新到序列 2，保留旧目录和两个 ZIP。固定 v0.4.0 APK 不变；设备证据显示旧 #1 已安装、#2 自动下载进入 ready、下次打开后成为 active，旧 1 步存档的实际 SAF 导出在更新前后字节数与 SHA-256 相同。文档准确保留了首次匿名缓存、UI 快照和 SAF 提前拉取失败，并以修正后的独立结果作结论。

## 核查记录

1. 匿名 GitHub Release API 当前返回 `game-resources-v2` Release `407394942`、非草稿预发布，恰有四个 `uploaded` 资产：历史序列 1 目录原资产 ID `623482430`、2599 字节、SHA `0bc8cf66…dcfba68`；current 目录 ID `625125622`、2659 字节、SHA `0428deda…b31915`；旧 #1 ZIP ID `623482293`、8490 字节、SHA `27f1df3b…bb0876b`；新 #2 ZIP ID `625120403`、9510 字节、SHA `178d01e9…fde8442`。这与 `seq2-online-verified.json` 的签名历史序列 1/2 和累计资源身份一致。`game-resources-v2` 与 `v0.4.0` 本地 annotated tag peeled 目标均仍为 `4aacb1f81b7fc381d2ca7fd725fd93dd109e390e`。
2. 正式 v0.4.0 Release `407395194` 的公开 API 仍仅有原 APK 资产 `623483084`，摘要 `c6e071e18eac1cb97f3d898d6eb4dab2c790b8d9310a907a7e44e3c34a78ee39`。发行工具 CI run `37939913188` 的 API 状态为 completed/success，head 是 `868aaf6ebf3802cff17c0f60794e339609248b87`。两次生产日志都输出同一固定提交；归档 ZIP 摘要为 `178d01e9…fde8442`。
3. 设备更新前生产单例日志记录 #1/version1.0.0、active=`1-27f1df3b…b0876b`、ready=null、源 `81bdef…`、同一存档合同与 APK SHA/code4。稳定的目录 XML 记录“资源已就绪，下次进入生效”、已安装 v1.0.0 和候选 v1.0.1；真实打开后截图能看到新增键盘提示及 `1 步`。设备生产单例仪器 `OK (1 test)`、0.235s，日志记录 #2/version1.0.1、active=`2-178d01e9…fde8442`、ready=null、来源 `80898b3ba78ea51a62533c42362f00a4e37421f1`、`memory-demo-dynamic-v1` 与原 APK SHA/code4。仪器代码直接读取 `ResourceRuntime.get(context)` 和 `dynamicStore.describeAll()`，同时断言生产公钥、active 内容编号/摘要/来源/合同及 APK 身份；不是替代 store。
4. 更新前 `n6-before-saf-identity.json` 与更新后 `n6-after-saf-identity.json` 均标记真实系统 SAF、schema1、moves1、wins0、144 字节和 SHA `5dd0b7e0147736ab08693a8032661c82de834284bb0d3d61d7a6760b66e14c05`。未读取或归档原始存档。首次新建目标提前拉取为 0 字节，报告明确等待系统实际写完 144 字节后才通过精确摘要断言。
5. N6 最终四原仓库状态归档与已存在的 v0.4.0 状态快照逐项比较：四个 HEAD 均相同，工作树条目均相同，EML 22 条既有变化原样保留。来源构建使用锁定提交，未将后来原仓库 HEAD 变动当成资源来源。

## 边界与后续记录

已归档的 Chrome 六组键盘/文件操作属于功能切片；本次 Android 验收证明页面提示、进度、资源身份与实际 SAF 摘要，未额外声称 Android 上完整重跑六组键盘动作或用户真机。`doc/N6-资源局部更新实施计划.md` 在受审提交中标记“COMPLETE（提交后独立发行复审进行中）”，并将本次独立复审勾选项暂留空，符合提交时点。此审阅闭环后可在下一次状态整理时把复审项勾选；N7、N8 仍独立待办。
