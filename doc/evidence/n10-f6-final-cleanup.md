# N10-F6 最终实际清理与完整性

Status: VERIFIED（最终独立复审CLOSED，见n10-f6-independent-review.md）。F5 plan OPEN→监听owner与参数批改→p1 CLOSED，归档0cdf721后实际执行。原始清理失败/续作完整保留，不重复使用已删work依赖的原cleanup脚本。

own ADB操作前PID30648、精确永久toolchain binary/cmd、5037 loopback全部监听owner、devices全集为空、原index fullSHA、仅root/work两个普通空目录全部PASS。从永久platform-tools cwd显式adb -P 5037 kill-server/start-server，旧PID消失，新唯一同binary的loopback5037 server验证与空devices通过（实际新PID见f6-adb-restored.json）。服务恢复可用，无用户设备连接被中断；未关闭用户终端/8000服务或其他进程。

随后永久469项size/fullSHA再次全部核对，固定绝对空work/root无reparse且仍无文件，用Directory.Delete(path,false)顺序非递归删除两个空目录，Test-Path D:\soft\.ci-tmp\game-hub-n10=false。cleanup-result真实removed=true、17870初始文件、7348387960初始逻辑字节、原validated141与resumeReviewed0cdf；初始磁盘free未留存，freeBefore=null，不声称净释放7.35GB。后续freeAfter184164167680是完成时读数。

最终七只读原仓完整SHA与工作树逐项匹配，包括EML原有22项；主仓是授权开发仓，不按原不可变SHA比较。工具链、签名目录/备份、永久archives与旧正式APK fullSHA c6e071e18eac1cb97f3d898d6eb4dab2c790b8d9310a907a7e44e3c34a78ee39均保留。永久原index SHA e3ded2b9f419879ef094d4478814db42073f34ec202c26ceaef535a1d6cf926b未变。实际JSON/raw日志规范副本见n10-f6/。

永久恢复目录D:\soft\game-hub-archives\n10-20261010（456原始证据+12候选+完整bundle），首次失败归档n10-20261010-incomplete-20261011-0230保留历史旧helper/失败现场，属于审阅记录，不是活动构建检出。可通过index.evidenceFiles原path找到safe archivePath恢复；源b46完整历史含固定fc9源码与v0.4.1 tag。所有可变工作与构建目录已移除，主仓仅文档与恢复脚本，不在主仓重新构建。

v0.4.1真实发行/匿名完整字节/原签名/版本/发布后实际启动检查已E6独立CLOSED。最终F结果提交推送，另一独立视角3f9e3b3首审发现CHANGELOG残留待验收措辞，18efb18纯文案批改后CLOSED；global COMPLETE与F VERIFIED，完整意见和批改见n10-f6-independent-review.md。真机人工安装与签名密钥异机备份按授权留后续；不当作本轮验证完成项。
