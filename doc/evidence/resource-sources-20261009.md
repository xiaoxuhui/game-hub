# 独立子游戏资源生产切片

来源锁分为不可移动的 APK sources.lock.json 与资源候选 resource-sources.lock.json。独立资源命令只输出 .build/resource-source-assets 和 .build/resource-candidate；资源编号锁绑定完整 SHA、兼容合同、发行说明。三份锁的摘要与大厅完整提交写入候选记录，任何锁改变即拒绝旧候选。客户端签名协议仍为 v1。

首轮和最终 Node 检查均 22 项通过。扩展既有实际候选用例：只改变光学 SHA/版本/编号并重建独立文件，验证 APK 原锁和资产未改；来源编号不一致、编号 1 承载新源、替换仓库、候选后修改发行说明均拒绝。夹具 SHA 是测试值，不代表已发布新的游戏代码。

在 D:\soft\game-hub-build-resources-20261008 从四个远端固定 SHA 克隆并执行真实源码构建，40 文件清单和四 ZIP 验证成功。重复 ZIP 生成摘要完全一致，另存实际执行输出。该检出包含待提交代码复制，开发 manifest 为 00b53f1b401e06ec75392f8edb02efcb58143f44；通过 assemble API 验证构建接口，不冒充干净提交的 prepare:resources CLI 验收。干净提交 CLI 验证将在提交后独立检出执行。

构建后只读快照 resource-sources-original-state-20261009.txt 与先前状态一致，EML 原有 22 条工作树变化保留，其他三仓库干净。四源固定 APK 基线未变。

新增只读权限的手动 Actions 候选工作流，无私钥和发行操作。本切片未运行该远端手动工作流、未签署或发布资源目录；源码双向存档兼容需要实际游戏验收，工具扫描不能替代它。发行手册记录这些边界。

提醒缓存批改 eda34518ff77635692985d47871580c40d2d3788 的独立复审已闭合，原件随本切片归档；实际进程死亡和在线生产通道尚待后续验收。

## 提交后实际 CLI 与独立审阅批改

898fa6a5c6705adc0bc14fc3ddbd91d7d11c426a 准确 push CI 成功（37827361576），但不覆盖手动 prepare:resources 入口。新干净检出 D:\soft\game-hub-resource-producer-20261009 实际 CLI 四源40文件构建完成后 exit13：CLI 顶层 await 等动态导入，而资源构建模块反向静态导入当前模块，形成未解决的模块求值循环。这是本切片自验发现的 P1，失败日志完整保留。

已改 CLI 为异步 Promise catch，不阻塞当前模块求值。独立审阅另外指出 P2 候选顶层额外内容未拒绝；现验证文件集合恰为四 ZIP 与两 JSON，并拒绝非普通文件和符号链接。Node22专项复验包含额外文件、目录、Windows junction 链接负例，全部通过；脏检出拒绝另有实际输出。批改提交后仍须新干净提交实际 CLI 和独立复审，未完成前不进入下一切片。
## 批改后的真实干净命令验收

新独立目录 D:\soft\game-hub-resource-producer-20261009 切到 35687d8545f23deed68ba00c8f46988815f782f7 后，实际 pnpm run prepare:resources 和 pnpm run verify:resources 均退出码 0：远端四源构建40文件、生成并验证四ZIP，前后Git工作树为空。candidate.json 的 bundleCommit 精确35687d，sourceMode independent，APK基线/资源来源锁摘要均189f9f904455ae46f3dafc7a6eabd99386fd609402a742de562b612173c1c2ac，资源编号锁摘要85728ed380a4e80ea2f64276adef13471c364a575d00ab92dfb00fea4b4faa39。执行日志另存；新目录未生成 APK 内置资产。