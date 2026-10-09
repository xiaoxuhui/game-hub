# N7 两游戏来源集成独立审阅（2026-10-09）

受审提交：`c46ec6d3cabc6df9ecd90409649b89d765a0a5a9`。检查时主仓库 HEAD 与提交一致且工作树干净。本次只读检查提交、来源锁、生成脚本、证明、许可、浏览器脚本/结果和上游测试日志；没有修改或构建主仓库及原游戏仓库。

## 结论

**CLOSED，无阻塞。** 可在此提交后固定大厅完整 SHA 作为两游戏真实集成来源，进入独立 ZIP 生产及 seq3 发行门禁。本切片只证明已提交的网页集成来源与固定上游的关系，未证明资源包已签发、正式 APK 的 SAF 桥或设备存档升级通过。

## 核查结果

- `dynamic-upstreams.lock.json` 固定阿贝尔 `d58e2b1d06c3dfdf6cd25b65986c1d494759ed7f`、Lambda `11b0aef6dcac9a37abdc08cde25ea0efd1f8f6a2` 及仓库/版本/入口。`scripts/stage-upstreams.mjs:25-40` 只用 `.build/upstream-dynamic/<id>` 独立检出，校验远端、HEAD、每个参与构建的输入文件与该提交的 Git blob 原始字节、版本和 MIT 全文；没有访问原游戏工作树的构建路径。
- `scripts/stage-upstreams.mjs:42-59` 在独立检出调用固定构建脚本，构建后重新检查输入；阿贝尔的 13 项运行/许可输出逐项等于固定 Git blob；Lambda 单文件输出与冻结提交中已跟踪的 `dist/lambda-lab.html` 字节相等，否则失败关闭。两个 build 脚本实际读取的输入都在固定输入清单内。`upstream-source.json` 记录输入/输出摘要，仓库索引 blob 复核和两次生成的 17 文件逐字节同摘要见归档。
- 两份 `examples/<id>/LICENSE` 均为 MIT 全文，`THIRD_PARTY_NOTICES.md` 指向固定来源、许可和证明，并明确资源包尚未发行、APK 未变。差异未触及两游戏 core/UI/schema/key；提交中新增的是固定上游产物及来源说明。
- `doc/evidence/n7-integration-source/browser-verification.mjs` 使用实际 Chromium 的 390 触摸与 1280 键盘、两独立 origin，检查交互、localStorage 重载、浏览器下载/自身导入与 page error；结果 JSON 四组且 `pageErrors=[]`。原始自身测试导出仍位于未提交的私有证据目录；提交只含摘要/大小和截图。页面依赖均是包内静态文件，Lambda 的外链为用户主动点击的说明链接，离线基本玩法不依赖网络。
- 上游测试最终日志分别为阿贝尔 53/53、Lambda 120/120，0 失败/跳过；早期未构建/未同步造成的失败和跳过日志也保留。大厅 Node 日志 42/42。`git diff --check` 没有格式问题。

## 后续边界

浏览器下载/导入不能替代正式宿主的原生文件桥、SAF、签名资源下载和旧存档升级；证据文档已明确留到后续门禁。后续动态锁应引用本次已审阅的大厅完整提交 SHA，并在新独立检出重复核对资源包字节与包内许可、来源证明。
