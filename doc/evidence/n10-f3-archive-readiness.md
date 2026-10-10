# N10-F3 归档输入读取门禁批改

Status: COMPLETE（控制器批改准备，完整归档/清理仍PENDING）。E发行已独立CLOSED/VERIFIED，七只读原仓与基线完整SHA/状态一致；最初误将授权大厅仓也按不可变原仓比较而停止，无写入，随后严格仅比较七原仓（EML原有22项不改）。own正式AVD marker/name/PID确认后正常emu kill，serial及相关进程消失，未停止共享ADB或用户服务。

首次归档复制159项后Get-FileHash own emulator stderr因退出时残留redirect句柄而失败，尚无cleanup-index。稍后read-only RestartManager无占用、原文件完整SHA可读；移动当时逐一159项对应safealias原源完整摘要相同；本次修改helper后再比当前现场为158/159一致，唯一差异是archive-n10.ps1的修订前历史版本，失败归档完整保留旧版本，不覆盖。完整保留失败目录为D:\soft\game-hub-archives\n10-20261010-incomplete-20261011-0230，移动前固定绝对路径均在永久archives边界，非递归删除，无源移除或覆盖重试。

控制器现对所有evidence在创建永久目录前完整读取SHA，并存预查bytes/SHA；每项复制后原源/目标SHA核对后还要求与预查值一致。候选12项原已有读取门禁。private/archive公开副本及摘要同步；没有变动APK、签名、发行结果或清理脚本。完整归档执行必须等本批改提交独立CLOSED；已存在失败目录不能代替成功索引。原过程根完整保留，未运行cleanup dryrun或Execute。
