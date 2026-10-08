# M6 实际杀进程恢复验证

- 切片基线：4652b87f83ef5dd585090f4a4d3cd056007e5169；提交后独立审阅另行归档。
- 构建仅在 D:\soft\game-hub-build-resources-20261008；Android34专用模拟器 emulator-5562，无用户真机操作。
- 生产改动：GameResourceStore构造参数重命名 trustedDirectory，避免初始化块内 directory 引用构造参数而绕过同名 canonical property。清理仍限制于可信根的子路径，子链接不跟随，未放宽目录校验。
- 测试使用临时RSA3072公钥、四实际资源夹具的LightZIP及隔离私有验证目录。私钥未落盘，原临时夹具在达到中断点前关闭；测试另存公钥/已签目录/ZIP供新进程验证。

## 执行及批改

1. 首次编译失败：测试错误引用 ResourceGame.entryPage，正确字段entry；修正后编译退出0，18s。
2. 首轮外部执行：download中断及恢复通过；extract中断后新进程GameResourceStore初始化抛出deletePrivate边界异常。真实路径 /data/user/0 与 /data/data 别名揭示了上述构造参数遮蔽；这是生产恢复缺陷，未用测试放宽或绕过校验。
3. 修复后独立 Gradle testDebugUnitTest/assembleDebug/assembleDebugAndroidTest退出0，41s；JVM62无失败。
4. PowerShell外部控制脚本执行五种中断，每次先核对marker PID是当前应用，再执行am force-stop并确认应用PID消失；恢复仪器在另一个实际PID运行，每项输出OK (1 test)。脚本退出0，总计5次实际终止、5项恢复测试通过。

| 中断点 | 原PID→新PID | 恢复结果 |
|---|---|---|
| download | 19415→19472 | 首块done/partBytes>0；重启协调器清理part，无ready |
| extract | 19518→19575 | staging实际已有1文件；重启清理，无ready |
| state-before | 19621→19677 | 真实AtomicFile.new已写但未finish；保留旧选择，无ready |
| state-after | 19724→19781 | 原子ready状态已提交、旧进程未更新内存；重启校验并激活code2，读取完整实际Light入口 |
| journal-half | 19828→19886 | 第一签名日志seq3/第二seq2；重启恢复seq3，拒绝seq2回退 |

所有场景内置active在恢复开始保持不变（只有state-after后显式打开才激活）。隔离存档哨兵SHA-256均为46c18bce99f54fe9919e4979928787096ffd8327d4cce73c437ba63dd61000f9，未删除或改写。完整marker、恢复输出与结果JSON见m6-process-fixed；首次失败输出见m6-process-first。源码与独立构建文件逐字节一致，摘要见m6-process-source-hashes.json。

## 限定

下载连接受控、AtomicFile中断由测试ResourceStateFile接口精确暂停，外部终止是实际OS进程终止。此结果证明指定Android34文件恢复边界，不是任意断电、物理存储故障、线上TLS、正式密钥或四真实游戏存档覆盖升级。默认仪器运行未传phase时，这两项控制测试Assume跳过；只有显式脚本才能启动中断。原始导出JSON和密钥不会公开。

协调器前切片CI abd0621运行37833953287已success；此生产修复提交后还需独立审阅与CI。
