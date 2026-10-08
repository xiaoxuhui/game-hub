# N2 核心切片审阅批改

- 首审提交：2251dba8a8340d3b90fed8ed26a835babcaf7fce；独立视角 review_p2。
- P1：最新目录退役后仍可能激活旧 ready。保存 available，退役时撤销 ready，签名历史恢复同一门禁，isEligible/续期/激活均检查当前可用性；已 active 不删除、离线可用。
- 明确重新提供的规则：更高目录序号可显式恢复相同内容编号与完全相同哈希，不允许内容变化复用编号；旧 ready 不自动恢复。此选择保留已有内容水位语义，文档和回归对应。
- P2 路径读取：读取证明前检查正文、AtomicFile 的 .bak/.new 和所有祖先；历史目录也在列举前检查。实际 Windows junction 对历史父目录及备份路径的负例确认 read adapter 未执行、外部哨兵保留。
- P2 跨仓库预算：保留 N4 待验门禁，不声称各 store 独立锁提供原子预留；设计已明确所有生产入口须共用串行门禁。

## 执行证据

仅使用 D:\soft\.ci-tmp\game-hub-work\v030-final 独立检出；四原仓库未构建或修改。

1. 新增退役回归在修复前实际失败：1 项 / 1 失败，断言 ready 未撤销；见 n2-v040-store-20261009/n2-retirement-red.log。
2. 修复后强制全量任务执行：`:app:testDebugUnitTest --rerun-tasks --console=plain`，36 秒，23 任务全部实际执行，75 项 / 0 失败 / 0 错误 / 0 跳过；动态用例 10 项。见 green.log 和 retirement-DynamicResourceStoreTest.xml。
3. 首次启动漏设 ANDROID_HOME 的依赖解析失败不算产品负例，设置既有 SDK 后才运行上述红灯。

以上仍是宿主 JVM 签名 ZIP、真实文件与链接验证；对象重建不等于 Android 实际进程重启，磁盘哨兵不等于 WebView 存档。N2 整体保持 PENDING，设备与后续界面另行验证。修复提交推送后等待独立复审闭环。
