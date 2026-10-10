# N10-F2 归档控制预备：独立只读审阅

受审提交 `8fde08d5bd00aa5c3f9e34918283e39fb1ffb30e`。只读检查公开 `doc/evidence/n10-f2/archive-n10.ps1`、私有 `evidence/archive-n10.ps1` 与准备说明；未运行归档脚本、调用额外 API、操作设备、读取密钥或执行清理。

## 结论：OPEN，归档执行前需修范围门禁

1. **P1：候选目录可经重解析点越出唯一任务根，且未锁定 12 文件集合。** `doc/evidence/n10-f2/archive-n10.ps1:38` 直接列举 `.build/resource-candidate` 与 `.build/dynamic-candidate`，`Copy-ArchiveFile:19-20` 仅检查列举出的文件本身，不检查 `.build`、候选目录和各祖先是否普通目录。候选目录若被替换为 junction，普通目标文件可来自任务根外，违反“不归档根外 key”的边界；额外普通文件会被复制，缺失文件也未在脚本内拒绝。执行前逐层检查 canonical 绝对路径、目录和无 reparse；对两个候选目录按最终已审候选摘要精确验证各 6 项的名称、大小和 SHA，禁止多/少项与子目录，再复制。
2. **P1：证据目录在拒绝链接前已递归枚举。** `archive-n10.ps1:31-32` 先以 `Get-ChildItem -Recurse` 展开整棵树，再对返回项检查 reparse；不同 PowerShell/文件系统行为下可能先遍历目录 junction，才发现它。改为显式栈遍历：对每个目录项先校验绝对路径、普通类型及无 reparse，确认后才将目录入栈；复制时再次验证源路径祖先。这样根外内容不可能被枚举为归档输入。

## 已确认的边界与证据

- 公开/私有 helper SHA-256 都为 `b577f87ef527558048be7ac00842ae671df5d32283ed25a315f9cc5ca7f83bc6`；`controller-hashes.json` 与重算一致。PowerShell 解析为 0 错误。本次没有永久 N10 归档、索引或只读清理结果，不能宣称 F 已执行。
- 固定任务根、永久归档、D/E `[VERIFIED]` 文本前置、匿名正式 APK 指定摘要/长度回执、源 clean、已占用进程拒绝、复制后 SHA 核对、Git bundle verify、索引最后写入均有实现。执行前仍须独立确认实际 D/E 证据及索引恢复完整性，不能仅依赖计划文本。
- 当前现场两个候选目录均为普通目录，各有 6 个预期文件；私有 `evidence` 按文件名扫描未发现 key/keystore/pem/dpapi/密码文件。此现场观察不能代替执行时的路径与精确集合门禁。
- `n10-f2-archive-preparation.md` 正确把 E 与归档/清理列为待完成，并承诺未知结果不覆盖重试；F1 清理脚本此前 CLOSED 只覆盖其预备设计，不放行此次 helper 或将来的实际删除。

待修订提交后复审，后续真实归档索引、dry run、删除和七原仓状态还需各自独立门禁。此报告未修改产品代码或原仓库。
