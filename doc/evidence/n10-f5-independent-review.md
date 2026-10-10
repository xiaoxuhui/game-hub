# N10-F5 部分清理与空目录收尾独立审阅（2026-10-11）

受审提交：`74ece0b6324b90d48ee7f2049ff3eb9f6401ba0d`。仅在主仓 `D:\soft\game-hub` 只读审阅，未使用已删的 N10 work、未重启 ADB、删除目录、访问线上 API 或读取密钥，未提交推送。`git show --check` 无错误，主仓受审时干净。

## 首审结论：OPEN（收尾前补一个端口归属门禁）

F5 对失败状态表述准确。原 dry run 与 Execute 日志都先以相同索引 `e3ded2b9f419879ef094d4478814db42073f34ec202c26ceaef535a1d6cf926b` 验证 17,870 文件、7,348,387,960 逻辑字节；执行在最后移除被占用的空 `work` 目录时失败，退出 1、无 `cleanup-result.json`，并未宣称清理完成。只读复核现时 task root 仅含空 `work`、两级无文件；永久 index SHA 正确、469 项归档路径均存在，完整逐字节哈希在 F4 已独立 CLOSED，最终收尾前需再验。PID30648 的可执行文件是永久 toolchain 的 `adb.exe`，命令为端口5037的 fork-server；它与唯一持有 `work` 目录句柄的归档记录一致。归档 `adb devices` 列表为空。此处没有把逻辑字节当成磁盘实际净释放，也保留了 freeBefore 未记录的事实。

**P1 执行门禁补充：** `adb -P5037 kill-server` 作用于当时占用 5037 端口的服务器，而不是按 PID30648 指定进程。当前只读 `Get-NetTCPConnection -LocalPort 5037 -State Listen` 的 OwningProcess 确为 **30648**，但 F5 计划只要求复核 PID/命令与设备空，未要求在 kill-server 紧前复核 **5037 的实际监听 owner 仍为同一 PID**。若服务在检查后被替换，可能停止非本任务的 ADB。应将端口 owner=经句柄确认的 PID30648 作为硬门禁写入并执行；新服务器启动后仍要核监听端口5037、新 PID/二进制、设备全集为空。若任何一步不符，停下且不删目录。

其余收尾顺序合理：在独立审核后再次检查索引、永久469项完整哈希、受保护目录及七原仓状态；确认 task root/work 是固定绝对普通目录、没有 reparse/子项，再非递归 `Directory.Delete(work,false)`、`Directory.Delete(root,false)`。重启仅限上述本任务 ADB 服务，从永久 toolchain 目录启动，其他终端/服务/AVD 不处理。写结果时须记录最初验证的文件数与逻辑字节、部分清理恢复过程、`freeBytesBefore=null` 的边界，并再次验证保护资产/原仓；最终结果另行独立审阅才能勾 F VERIFIED。

## 批改复审：`f53005b677442aeca7953ab0c8327fc9b204e10a`、`b8d0c77445269c444b3b5c3bd8ca6f1d90d1421d`

**CLOSED：F5 空目录收尾方案可以按门禁执行；实际收尾与 F 整体仍 PENDING。** 文档已增加在 `kill-server` 紧前要求 5037 监听至少一条、均为 loopback，且所有 `OwningProcess` 必须等于持有 work 句柄的精确 PID30648；新服务器启动后又要求旧 PID 消失、新唯一 PID 与工具链 binary/5037 loopback 监听一致、设备全集仍空，任一不符停下。只读观察时监听端口5037的 owner 确为30648，与既存 Win32 句柄/进程记录相符。后续提交将命令参数改为可直接执行的 `-LocalPort 5037` 和 `adb -P 5037`，两次 `git show --check` 均无错误。

本次仅批准上述限定本任务 ADB 重启及两级固定空目录非递归删除的方案，没有执行重启、删除或写结果。实际执行必须重新通过文档的 PID/端口/空设备/空目录、索引及永久归档门禁；若进程或端口已变化，应停止而不是按旧 PID 强行操作。最终实际清理结果需另行提交和独立审阅。
