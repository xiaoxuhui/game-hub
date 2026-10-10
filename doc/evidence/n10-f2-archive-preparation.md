# N10-F2 归档控制预备

Status: COMPLETE（准备切片；提交后独立复审待归档；N10-F实际归档/清理仍PENDING）。E因02:16:11匿名配额恢复等待，继续不依赖API的本地准备。未运行归档脚本，未创建永久N10归档目录，未删除任何文件或停止用户服务。

公开控制器副本 n10-f2/archive-n10.ps1 与私有同名执行版本hash对应。固定过程根 D:\soft\.ci-tmp\game-hub-n10 和永久归档 D:\soft\game-hub-archives\n10-20261010；祖先目录实际绝对路径、无reparse；永久目录已存在则拒绝重复。执行前要求D/E计划VERIFIED（含实际验收及独立CLOSED），公开v0.4.1实际匿名APK fullSHA/2654159B/anonymous=true回执，以及过程根相关进程已停止。由本任务只停止经marker/avd name确认的专属模拟器，不停止共享ADB或用户8000服务。

复制全部私有evidence（当前原日志、红绿/设备/XML/截图/源码与版本身份/线上历史与签名/正式资产/维护控制器，不包括根外签名keystore/DPAPI/密码文件）；每项文件/祖先安全路径、不随链接、size/hash完整复制后回算。复制两候选目录12文件；生成全Git refs n10-source.bundle，git bundle verify通过后纳入索引。源clean HEAD记录sourceCommit，后续文档提交仅可作为其已推送祖先链；不重打APK。

最后一次写cleanup-index.json schema1/taskRoot/archiveRoot/sourceCommit/artifacts与evidenceFiles，逐项安全归档相对路径/bytes/fullSHA；evidenceFiles同时保留原相对路径与archivePath映射。索引本身不纳入其自引用清单；完整索引SHA作为已审cleanup-n10.ps1的显式参数。生成后冻结现场evidence；后续审阅/只读dryrun/实际清理原始日志写永久归档，避免证据集合变动。未知归档结果或复制不一致停止核查，不覆盖重试。

实际F下一切片必须检查归档索引完整性/恢复必要文件/源bundle绑定、永久与现场逐项一致并提交独立审阅CLOSED，主仓与工作检出精确同clean pushed HEAD，只读cleanup退出0后才Execute删除限定根。实际释放字节/目录不在/七原仓SHA与工作树不变须发行后归档结果与独立复审，预备语法成功不能替代任何删除验收。工具链、主仓、归档、签名目录/备份均永久保留。

## 首审OPEN后的批改

两项P1与首审报告保留。evidence改为显式栈：先检查当前子项无reparse、绝对路径仍在evidence，再入下一层，禁用递归展开后才拒绝的模式。候选`.build`和两目录逐级检查普通目录、无reparse、精确canonical路径；以已提交审阅的fc9 candidate-hashes.json锁定6+6共12唯一文件集合，包含隐藏/目录额外项也拒绝，逐文件类型/大小/完整SHA一致后才归档。全部输入预查完才创建永久目录。公开/私有helper与摘要同步，纯语法门禁通过，未运行归档或清理；提交后复审CLOSED仍必需。

## 第二轮 OPEN 后的批改

原始 428 份证据中 154 个路径包含空格或括号。全部保留：以原相对路径 UTF-8 的 SHA-256 加安全扩展名产生 evidence/ 别名，索引同时记录原路径、archivePath、大小和文件完整 SHA。所有原路径分段与别名碰撞在创建归档前检查；清理器重新计算别名，并要求映射对应且唯一的 artifacts 大小与完整 SHA 一致。只读实测映射 428 项、154 特殊路径、零碰撞，两脚本 PowerShell 解析均零错误；未创建永久目录或删除文件。既有 OPEN 审阅完整保留，等待本提交复审。
