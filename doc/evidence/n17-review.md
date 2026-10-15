# N17 提交后独立审阅与批改

## A 计划：CLOSED

- 提交de21569，review_p0独立审核CLOSED；git show --check通过、独立检出干净，私有九仓基线各有完整SHA/porcelain/时点。
- 回调关闭未恢复只是待验证线索，不能直接宣称用户故障已确认；B01–B05同时覆盖真实系统返回、首次资源激活、合法历史、加载取消与重建，并检查AndroidRuntime崩溃。
- 执行细化：记录ready→active身份与实际系统返回、前后Activity/PID/任务栈；相同Activity恢复区别于新建。D只交付修复候选，不默认创建正式Release。

## B 失败回归：诊断OPEN → 批改 → 核心复现CLOSED

- review_p0指出首轮及v2/v3红停在测试的后台状态预设、未到产品断言，不能当产品失败；历史case也未等到合法历史提交。保留原始失败，依次修订946c2a8/e4ac083/f17635d。
- v4通过真实Launcher3图标启动，builtin回归已记录同Activity/PID/任务恢复、ready2实际激活和游戏物理返回后CREATED，awaitLobby红，review_p0独立确认核心B CLOSED。
- v4第二dynamic测试仍是图标查找超时，不算动态复现；C绿门禁需修复连续启动和历史时序，不能跳过。详见N17测试报告及原始日志。
