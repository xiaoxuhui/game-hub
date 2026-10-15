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

## D 候选与覆盖安装：CLOSED；清理门禁OPEN→批改

- ea8b607提交后review_p0 CLOSED：同证书APK摘要/版本/证书守卫、真实WebView完整存档逐字比对及后退流程合理；必须实际在旧正式APK运行seed证明二进制兼容。
- 0f8c660提交后review_p0 CLOSED：现行CI当前身份6/0.4.2、未来烟测7/0.4.3及伴随测试同步；历史控制器仍固定旧身份。
- 上述干净源码独立构建并原证书签署候选；实际旧正式APKseed1及install -r后verify1通过，候选另26项无跳过通过；报告和原始证据提交后等待独立结果复审。
- bd87fd4提交后review_p0独立结果复审CLOSED：候选/正式旧包全摘要、DER、版本、85/95/26+1+1计数、真实存档摘要和16份公开副本逐项一致；隔离store边界准确。
- e975521清理脚本首次审核OPEN：ADB设备查询未检查退出码；仅按命令行路径和设备列表可能漏活AVD。执行前补ADB失败拒删、归档owner PID/创建时刻/路径/命令行摘要及子进程停止证明、独立扫描PID和AVD/端口，找不到可信身份拒删；当前未执行删除，待提交后复审。
- e3eda04复审仍OPEN：任意emulator/qemu进程的CommandLine不可读也要拒删，不能跳过身份未知的进程。再次补充全量空命令行拒绝检查，保留两轮意见与修订提交，不删除历史记录。
- 4351c96脚本预审CLOSED。实际停机首次时间检查保守拒绝：PowerShell自动将JSON日期解析为DateTime，再DateTime.Parse会丢UTC标记，错误差8小时；原诊断留emulator-owner-check.json。改用DateTimeOffset直接保留类型/偏移，PID30324及qemu28676创建时间与owner记录差小于0.1秒，按真实serial/name核验后仅停止自有AVD，双PID与设备消失均确认。清理脚本时间门禁同样改为类型安全解析，并绑定原owner时点±5秒，不放宽未知身份拒绝。
- 35e06a7复审CLOSED：实际UTC差0.0247s/0.0720s，双PID停止证明与类型安全时间检查吻合，脚本解析/差异门禁通过。
- 实际永久归档与dry-run独立复核CLOSED：72/72大小/完整SHA、68/68现场证据绑定、source.bundle完整历史/35e06a7、实际恢复探针、8只读原仓、干净主/工作检出和远端main、双PID/AVD消失均吻合，CI35e06a7 success。仅允许已审脚本用固定索引及commit重执行所有门禁，删除唯一任务根。
- 实际Execute已完成，removed=true、Test-Path=False，7165文件/3596438793逻辑字节；结果副本n17-cleanup。最后文档提交与执行后独立复核待归档。
- 71a8e0a提交/执行后review_p0独立复核CLOSED：固定索引未变、公开/永久删除收据逐字一致、任务根不存在、候选全摘要相同、8来源HEAD/status逐项不变且4保护目录在；主检出干净，差异仅记录和非秘密收据，git show --check通过。允许仅记录CLOSED、正常最终推送并核验引用、删除本轮自有远端分支及写completion，不再构建/重签/发行。
- 收尾自动审批拒绝包含远端分支删除的组合命令：缺少用户对远端分支删除的明确授权；该命令未执行。采用安全替代方案：保留fix/resource-update-back远端分支，只做已授权的记录提交、主分支推送及只读核验/恢复归档，不重试或绕过删除。
