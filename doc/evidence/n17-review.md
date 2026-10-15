# N17 提交后独立审阅与批改

## A 计划：CLOSED

- 提交de21569，review_p0独立审核CLOSED；git show --check通过、独立检出干净，私有九仓基线各有完整SHA/porcelain/时点。
- 回调关闭未恢复只是待验证线索，不能直接宣称用户故障已确认；B01–B05同时覆盖真实系统返回、首次资源激活、合法历史、加载取消与重建，并检查AndroidRuntime崩溃。
- 执行细化：记录ready→active身份与实际系统返回、前后Activity/PID/任务栈；相同Activity恢复区别于新建。D只交付修复候选，不默认创建正式Release。

## B 失败回归：诊断OPEN → 批改 → 核心复现CLOSED

- review_p0指出首轮及v2/v3红停在测试的后台状态预设、未到产品断言，不能当产品失败；历史case也未等到合法历史提交。保留原始失败，依次修订946c2a8/e4ac083/f17635d。
- v4通过真实Launcher3图标启动，builtin回归已记录同Activity/PID/任务恢复、ready2实际激活和游戏物理返回后CREATED，awaitLobby红，review_p0独立确认核心B CLOSED。
- v4第二dynamic测试仍是图标查找超时，不算动态复现；C绿门禁需修复连续启动和历史时序，不能跳过。详见N17测试报告及原始日志。

## C 最小修复：CLOSED

- review_p0独立复核2d2fe8c，仅在委派系统返回期间关闭回调，并在finally恢复；无资源/存档协议改动。
- 首轮绿7项中的历史case失败后，用真实campaign链接触摸替代脚本跳转，原生canGoBack强断言保留；4365077/aaa6739留痕。连续Launcher动画与全屏坐标修订同样仅影响测试。
- 748e284自包含公开测试ZIP与历史发行归档逐字节相同，默认旧测试夹具路径不改；review_p0确认无私钥、无新增产品代码。
- 独立复核最终设备XML：28/0失败/0错误/0跳过，包含新增7项；JVM95/0/0/0，Node85/0/0/0。原始设备绿日志/logcat/XML、Node/JVM日志及计数归档后提交复审，C正式CLOSED待记录。
- c09c0f3＋156cc09提交后review_p0正式复审CLOSED：公开XML与独立原件SHA一致；公开日志只归一行尾空格、私有原件完整保留。Node/JVM生成于748e284前，748只改androidTest夹具，设备28项在748后实跑；最终安装候选另从干净提交构建，不混淆测试时点。
