# N9-C 来源锁与发行器路径首审（2026-10-10）

受审提交 `25d537b1dfda4f7ee4b2d5cb52f5e84d15383313`。只读核对 `dynamic-sources.lock.json`、`scripts/publish-resource-successor.ps1` 和既有 N9-B 来源证明；未运行资源生产、签署或发布。检查时主仓库和独立生产检出均位于受审提交且干净。

## 结论：OPEN，一项 P1 批改后复审

**P1：被接受的 `-TaskScope N9` 会误落到 legacy 过程根。** `scripts/publish-resource-successor.ps1:6,11-14` 使用默认大小写不敏感的 `ValidateSet('legacy','n9')`，但分支是大小写敏感的 `-ceq 'n9'`。只读 PowerShell 最小验证得到 `N9` 被接受而分支为 `False`；因此操作者给出合法参数 `-TaskScope N9` 时，会静默选择旧 `D:\soft\.ci-tmp\game-hub-work\v030-final` 检出及旧证据根，与本轮仅使用 N9 根的承诺不符。虽然精确 HEAD/目录门禁可能使当前运行失败关闭，作用域参数本身仍不可靠。建议改大小写不敏感比较或先规范化，再用 `n9`/`N9` 两个接受的输入验证都映射到 N9 根，`legacy` 仍映射旧根；批改提交后再复审。当前不要进入重复生产或发布。

## 已核对的非阻塞部分

- 来源锁差异只追加 `red-green-puzzle`，旧三项未改；新项固定已审大厅集成提交 `31eec2e638357d8e3e6a0550afc780e09bdaac49`、`examples/red-green-puzzle` 五文件、独立存储合同、version 1.0.0/contentCode 1。比较该提交至当前 HEAD 的新游戏目录无差异；所含 LICENSE 为 MIT 全文，`upstream-source.json` 区分冻结图灵上游与大厅适配来源。
- 发行器除 TaskScope 参数及两路径分支外无其它功能差异；固定 Release/tag、clean/pushed 提交、匿名预检、累计历史与真实资产绑定、凭据及私钥读取时机、先 ZIP 后 catalog、未知结果停止等原保护代码未改。`git diff --check` 无格式问题。
- N9-C 实施计划仍标 PENDING；没有把本切片称为两次重复 ZIP 生产、线上 CI、序列 4 发布或正式客户端验收完成。

## P1 批改复审（2026-10-10）

修正提交 `1c548febd08177cfb29e7ca9da0a74fe755212fa` 已推送；只把 `scripts/publish-resource-successor.ps1:11` 的 `-ceq` 改为 `-ieq`。复审时 HEAD 为此提交且工作树干净，差异检查无格式问题。用不调用发行脚本的最小 PowerShell 参数验证：`n9` 与 `N9` 都映射 N9 分支，`legacy` 仍映射旧分支；与脚本实际比较表达式一致。原签署及发布逻辑没有其它差异。

**首审 P1 已闭合，复审结论 CLOSED。** 可继续 N9-C 的两次独立资源生产、哈希核验、CI 与阶段审阅。此结论不表示资源已生产、签署、发布或完成正式客户端验收。
