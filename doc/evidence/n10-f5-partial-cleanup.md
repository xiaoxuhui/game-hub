# N10-F5 实际清理部分结果与空目录收尾调整

Status: COMPLETE（失败记录及调整切片；最终清理仍PENDING）。F4原始索引实际独立CLOSED归档并推送14174d29b372a123fb009c4cb77329d7370ed037；主仓FF到同clean/pushed HEAD，从主仓执行：

powershell scripts/cleanup-n10.ps1 -ExpectedIndexSha256 e3ded2b9f419879ef094d4478814db42073f34ec202c26ceaef535a1d6cf926b -ExpectedCommit 14174d29b372a123fb009c4cb77329d7370ed037

默认只读exit0，验证精确17870文件/7348387960逻辑字节。随后同参数-Execute重新验证后递归删除，所有文件移除，但最后work目录被占用而exit1，未生成cleanup-result。只读核对仅剩固定root/work两个空目录、0文件；469归档全部仍同index size/fullSHA。非递归空目录删除也被同句柄拒绝，未触及其他目录。原始失败日志和实际门禁保留n10-f5/，不以部分删除冒称完成，实际初始可用磁盘字节未留存，不推算磁盘净释放。

own CUA reset未解决；只读按Windows文件句柄定位最终唯一目标owner PID30648，ADB服务持有work路径。ExecutablePath精确D:\soft\game-hub-toolchain\android-sdk\platform-tools\adb.exe；CreationDate2026-10-10 22:20:02晚于本任务22:02基线，CommandLine adb -L tcp:5037 fork-server server --reply-fd 712。它是本任务从work启动后留存的服务；当前adb -P 5037 devices -l实际无任何设备（含offline/unauthorized），其他用户服务未操作。

此前计划保留共享ADB以避免设备中断；这次只针对经路径句柄/时间/工具链身份核实、且无连接设备的本任务服务作小步调整。提交独立CLOSED后，执行前再要求PID30648/路径/命令一致、Get-NetTCPConnection -LocalPort 5037 -State Listen结果至少一条且所有OwningProcess均为该精确PID（只接受本机loopback地址）、显式5037设备全集为空、剩余两个目录无文件无reparse、永久index摘要不变。才由永久platform-tools工作目录adb -P 5037 kill-server、adb -P 5037 start-server；要求旧PID消失、新服务器同binary/port，5037所有loopback监听OwningProcess均为新服务器唯一PID、devices正常仍为空；任一门禁不符停止，不继续删除。不关用户终端/8000服务或其他进程，不用进程注入改变工作目录。

随后再次验证所有469永久artifacts大小完整SHA，严格固定两个绝对空目录/祖先普通目录，Directory.Delete(work,false)再Directory.Delete(root,false)，非递归且出现任何文件拒绝。记录目录不存在及cleanup-result（初始verified141、17870文件/逻辑字节、resume说明，磁盘freeBefore=null），七原仓SHA/status/EML22不变、工具链/签名/备份/旧正式APK仍在。结果提交推送后另一个独立视角复审，才F VERIFIED与全部完成。
