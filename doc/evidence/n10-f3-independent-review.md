# N10-F3 归档输入读取门禁：独立只读复审

受审提交 `8d661ef536e34ade1bb8197acf75eee90eb1ce32`。只读检查公开与私有归档 helper、首次失败保留目录、原仓与 own AVD 记录。本轮未运行归档 helper、清理器、API、设备命令或密钥操作。

## 结论

**CLOSED，可在固定的新完整源码提交上尝试首次完整 N10 归档。** 此结论仅关闭 F3 控制器批改；成功后的真实索引、归档资产、source bundle、只读清理与最终删除仍须独立审核。`D:\soft\game-hub-archives\n10-20261010` 目前不存在，不能把保留的 incomplete 目录当成正式归档。

## 核查

- `doc/evidence/n10-f2/archive-n10.ps1:39-49,69-75` 现在先遍历所有证据，计算原路径安全别名及**原文件完整 SHA 与字节长度**，再检查固定 producer 候选 12 项；只有全部预检成功才创建永久归档。逐项复制时目标与当时源 SHA 相同，且再次与写前预检摘要、长度比较；若 own emulator 日志句柄仍无法读取，将在创建归档前失败。公开 helper 与私有 `evidence/archive-n10.ps1` 重算 SHA 都为 `ab7f1df981a65e4de1129817088de38ab477499edcd8a43a5154499708072601`，与控制器记录一致；PowerShell 解析 0 错误，提交格式检查无问题。
- 首次失败保留目录 `n10-20261010-incomplete-20261011-0230` 仅含 `evidence` 下 159 个安全别名文件，无 `cleanup-index.json`；目标正式归档目录仍不存在。该 incomplete 目录在永久 archives 范围内完整保留，源任务根未删除。原 SHA 对照记录和现场检查表明 159 项原先可映射；当前重新核对为 **158/159 与当前源字节一致**，唯一差异是失败归档中旧版 `archive-n10.ps1` SHA `a672de13…35efc4`，当前批改后的同名 helper SHA `ab7f1df9…072601`。这是修订导致的预期历史差异，建议后续归档说明明确“159 项匹配”指移动当时的快照，避免误读为本次当前现场 159/159。
- `f3-own-emulator-stopped.json` 记录固定 AVD `gamehub-n10-20261010`、专用 serial `emulator-5566`、停止回执、serial 消失与 own 进程 0；`f3-originals-before-archive.json` 逐列七原仓完整 HEAD 与原有状态（EML 22 项保留）均标匹配。E/D 计划当前为 VERIFIED，未把第一次残留目录或 F3 预备称为 F 完成。

实际再次归档时若任何预检或复制失败，仍须保留结果并只读协调；本次 CLOSED 不授权自动覆盖或删除 incomplete 目录。
