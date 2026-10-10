# N10-F4 真实完整归档与清理前门禁

Status: COMPLETE（归档切片；提交后实际索引独立复审待归档，清理仍PENDING）。F3控制器CLOSED归档b46d90ef1d428898d32c94f258141694f90d671d后执行：archive-n10.ps1 exit0。

永久归档 D:\soft\game-hub-archives\n10-20261010。cleanup-index.json原始SHA-256 e3ded2b9f419879ef094d4478814db42073f34ec202c26ceaef535a1d6cf926b；sourceCommit b46d90ef1d428898d32c94f258141694f90d671d。469 artifacts =456全部原始证据+12最终候选+完整Git bundle。Git bundle verify exit0/main HEAD绑定sourceCommit，包含实际fc9源码和正式annotated标签。另一次只读回算全部469项size/fullSHA完全一致，实际逻辑字节见n10-f4/f4-readonly-archive-validation.json。

证据456原path→archivePath安全别名映射保留；原始大小/完整SHA，含空格与括号日志不漏项。索引公共副本仅换行规范化，ExpectedIndexSha256必须用上列永久原始文件摘要。生产APK和匿名下载原字节也各自映射索引内；恢复任意原路径可按evidenceFiles.path找到archivePath。过程源码完整bundle，旧失败归档159文件/旧控制器保留独立历史（移动当时一致，当前helper更新导致158/159比较差异，已在F3注明）。

冻结原始 evidence，从此不写新文件或修改它；后续raw结果存永久archive。七只读原仓/ownAVD停止结果在索引内原path f3-originals-before-archive.json与f3-own-emulator-stopped.json。工具链/签名/备份/旧正式APK和用户服务未清理。

待本切片独立CLOSED并归档后，将仅同步授权大厅主仓git到clean/pushed当前HEAD（原游戏仓不动；不构建）；work/main一致才能由主仓执行scripts/cleanup-n10.ps1 -ExpectedIndexSha256上述64位 -ExpectedCommit精确当时推送HEAD，先默认只读exit0，再同参数-Execute。脚本已独立审核过，唯一删除根 D:\soft\.ci-tmp\game-hub-n10。实际删除后记录目录不存在、释放大小与七原仓完整SHA/状态匹配；提交推送并独立复审才F VERIFIED与本轮完成。
