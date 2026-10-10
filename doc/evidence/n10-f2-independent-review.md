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

## 复审 `821f23ced7f4d667d0757f0eefc1f4c871aa3906`：仍 OPEN

原两项 P1 的方向已落实：`archive-n10.ps1:29-37` 对 evidence 用显式栈，子项先拒重解析和越界再入栈；`:38-57` 对 `.build` 与两候选目录检查普通 canonical 目录，并以固定 producer `fc9da9b…` 的已审清单强制两组各 6 个唯一名称、类型、大小和 SHA。公开/私有 helper 重算同为 `e488e18d617b3f94a44b4174884dd24517779ef45ec5bbfe4ae6720477aafe59`，PowerShell 解析 0 错误；所有输入预检已移到创建永久目录之前。

**新增确定性 P1：现有证据路径不符合归档相对路径规则，会在创建归档后失败。** `Copy-ArchiveFile:17` 只接受 ASCII `[A-Za-z0-9._/-]`；当前 `evidence` 共有 428 个文件，其中至少 154 个相对路径含空格/括号，例如 `b-full-controller-red-results/TEST-gamehub-n10-20261010(AVD) - 14-_app-.xml`。`:58` 先创建永久归档，`:59-64` 开始逐项复制，遇此路径必抛 `Unsafe relative archive path`；下次又因 `:5` 归档已存在而拒绝，需人工核查残留。请在任何写入前覆盖全部输入路径预检，并把每份证据映射到 cleanup 索引可接受的安全归档路径（保留原相对路径与原字节哈希的可核对关系），或同步调整归档器与清理器一致的安全规则。必须保留全部 428 项证据，不应直接跳过不合格文件。

因此本轮仍不能放行实际归档；E 仍在等待其正式验收，本报告没有执行 helper、API、设备或清理。

## 复审 `1b5372b9896ff5e4f39d1a4dd86b5ca2faded477`：准备切片 CLOSED

前述路径 P1 已闭环。`archive-n10.ps1:38-48` 在创建归档前为每条原相对路径计算 UTF-8 SHA-256 安全别名，拒绝空、`.`、`..` 分段及别名碰撞；索引 `evidenceFiles` 同时保留原 `path`、`archivePath`、大小和完整文件 SHA。`:69-74` 复制时只使用预先算出的安全别名。`cleanup-n10.ps1:64-75` 从原路径重算同一别名，要求其在 `artifacts` 中恰好一项且大小与完整 SHA 一致，现场原路径文件也逐字节核对。

独立只读遍历现有 428 份 evidence，包含原先 154 条带空格/括号的路径；依同一 UTF-8 路径算法得到 428 个不同且符合归档安全规则的别名，碰撞与非法别名均为 0。公开与私有 helper 重算 SHA 均为 `a672de13fbab35c95efcffeb97a0f7808bcf01ea82516fe1fa58fe856e35efc4`，与 `controller-hashes.json` 一致；归档器和清理器 PowerShell 解析均 0 错误，提交格式检查无问题。永久 N10 归档目录仍不存在。

**CLOSED 只适用于 F2 静态准备与提交后审阅。** E 仍 PENDING；须待 D/E 实际 VERIFIED、匿名发行回执与独立审阅完成后，才可执行归档 helper。生成的真实索引、全部归档字节、source bundle、只读清理结果与最终删除仍需下一轮分别独立审核。本次没有执行脚本、访问 API、操作设备或读取密钥。
