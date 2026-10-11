# N12 收尾清理范围

- 仅删除本轮独立任务根 `D:\soft\.ci-tmp\game-hub-n12`。其内含两个大厅独立检出、四上游独立检出、构建/测试产物及自有AVD。
- 保留原仓库与大厅主仓、共享工具链、两类签名密钥/备份、全部既有永久归档。原始七仓HEAD和完整工作树状态须与n12-baselines.json逐项相同。
- 永久归档 `D:\soft\game-hub-archives\n12-20261012`：固定2afb生产bundle、四上游bundle、12候选、最终源码bundle、全部原始evidence按原路径hash映射；清单逐文件完整SHA256/size，独立复核后才清理。
- 原始evidence/offline-run.ps1仅初始未执行草稿。真实离线验收执行仓内scripts/verify-n12-offline.ps1，最终审阅源a8ccc9f，控制器源2afb。
- 模拟器限定serial5566和AVD gamehub-n12-20261012，已完成验收和原网络恢复后停止；未停止共享ADB服务。
- archive-n12.ps1只冻结归档，不删除；cleanup-n12.ps1默认dry-run。执行需指定经审阅清单完整SHA与精确已推送main提交，且生产检出保持固定2afb；校验bundle、证据集合/字节、路径及无reparse、原仓状态、无占用进程/自有AVD后才允许Execute。
- 归档冻结后不新增或修改临时evidence；后续清理结果与复审记录写永久归档及主仓。收尾追加最终bundle覆盖后续文档提交，不改写冻结清单。

本记录提交时：C范围已独立CLOSED；D归档freeze、dry-run及删除尚未执行，不将准备工作标成完成。
