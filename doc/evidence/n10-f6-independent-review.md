# N10-F6 最终收尾：独立只读复审

受审实际结果提交 `3f9e3b354f47b20fa9ff7bcc9c0d08ef4164869c`；文字批改提交 `18efb18f87d2ef59edf640e75467de1a475b5b31`。只读检查主仓、永久归档、七原仓 Git 状态及本机 ADB 进程/监听。没有运行归档或清理器、ADB 设备命令、额外 API、密钥读取、构建或删除。

## 结论：CLOSED

F6 实际收尾与证据边界符合计划；N10-F 可在本报告归档后标为 VERIFIED，N10 全局可标为 COMPLETE。真机人工验收和两把签名密钥异机备份仍为后续事项。

## 复核结果

- `D:\soft\.ci-tmp\game-hub-n10` 当前不存在。永久原索引 `D:\soft\game-hub-archives\n10-20261010\cleanup-index.json` 重算 SHA-256 为 `e3ded2b9f419879ef094d4478814db42073f34ec202c26ceaef535a1d6cf926b`。按索引逐项重新计算 **469/469** 个 artifact 的长度与 SHA，全部匹配；索引为 456 项原证据、12 项候选和一个完整 Git bundle。`git bundle verify` 成功，`refs/heads/main` 指向索引 `sourceCommit=b46d90ef1d428898d32c94f258141694f90d671d`。首次失败的独立 incomplete 目录仍保留 159 个别名证据文件，未被冒称成功归档。
- 公开 `cleanup-result.json`、`f6-final-integrity.json` 和 `f6-adb-restored.json` 与永久归档原件在统一换行后逐字一致。结果明确 `removed=true`、初始验证文件数 17,870、逻辑字节 7,348,387,960、初始 `freeBytesBefore=null`；文档只称逻辑字节，不声称实测净磁盘释放。最初 `-Execute` 在剩余空 `work` 目录因 own ADB 句柄失败、退出 1 且无成功结果，后续按已审 F5 门禁只对两个固定空目录 `Directory.Delete(false)`；失败和续作均被保留。删除后的初始文件数只能依据预先只读门禁日志与结果记录复核，不能从已移除目录重新计数。
- 续作记录显示原 PID 30648 的服务经精确永久工具链路径、命令、loopback 5037 owner 和空设备门禁后恢复。当前只读系统检查：新 PID 29260 的可执行文件仍是 `D:\soft\game-hub-toolchain\android-sdk\platform-tools\adb.exe`，命令为 `adb -L tcp:5037 fork-server server`；`netstat` 显示 `127.0.0.1:5037` 由该 PID 独占监听。归档的恢复结果记录设备列表为空。未调用 ADB 重新查询设备，也未发现需要再次操作服务的证据。
- 逐个只读运行七原仓 `git rev-parse HEAD` 与 `git status --porcelain=v1 --untracked-files=all`，均与 `f6-final-integrity.json` 完全一致；EML 原有 22 项改动仍保留。主仓、永久工具链、签名目录/备份和 archives 均存在；旧正式 v0.4.0 APK 重算 SHA 为 `c6e071e18eac1cb97f3d898d6eb4dab2c790b8d9310a907a7e44e3c34a78ee39`。
- `n10-f6-final-cleanup.md`、v0.4.1 测试报告和实施计划把 F 标为 COMPLETE、最终独立复审待归档，未把真机或异机备份误标通过。F3 文字批改 `21f3609` 已区分首次失败目录移动当时 159/159 匹配与 helper 修订后当前 158/159 匹配；旧 helper 原字节保留，审阅补注见 `n10-f3-independent-review.md`。

## 首轮文字意见与批改

首查 `3f9e3b3` 时发现 `CHANGELOG.md` 0.4.1 节首称正式发布，但该节末条仍写“同证书覆盖升级及正式发布仍待验收”。这是 **P2 发行状态矛盾**，需在全局 COMPLETE 前修正。提交 `18efb18f87d2ef59edf640e75467de1a475b5b31` 仅改这一行，明确同证书升级、存档/查询/断网、匿名完整下载与发行前后独立复审已通过；与现有 E6 证据边界一致。差异格式检查通过，未改 APK 或清理证据。该意见现已闭环，最终结论 CLOSED。
