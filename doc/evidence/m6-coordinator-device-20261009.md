# M6 更新协调器真实字节设备验证

- 开发基线：b25f978121dd47f5d7f20bec39da2a80b09f7282；本记录随切片提交，提交后独立审阅另存。
- 构建仅在 `D:\soft\game-hub-build-resources-20261008`，专用模拟器 emulator-5562 / Android 14。独立目录包内资产仍来自旧构建基线，此轮不能代替最终候选源码溯源验证。
- 公钥临时 RSA3072；HTTP 连接受控，正式 PublicReleaseHttp、ResourceCatalogClient、UpdateTaskGate、GameResourceStore 和 Android AtomicFile 执行原代码。隔离 Context 的 files/cache/preferences；不操作应用生产资源存储和四原仓库。
- JVM XML：62 tests / 0 failures / 0 errors；首轮编译成功。首轮专项设备 6 项，5 通过、1 失败；最终设备 11 项全部通过，Gradle 退出码0，1m49s。
- 最终 11 项 = UpdateCoordinatorDeviceTest 6 + DocumentExportTest 5。命令还列出不存在的旧生命周期方法名，runner 未选入该项；不能宣称第12项执行。已有生命周期结果另见上一切片证据。

## 实际覆盖

1. 查询两个固定通道、下载并验签真实目录与资产摘要；只有 Light code2 包被下载和安装，其他三项 code1 保持内置，APK v0.4.0 仅提醒、没有自动下载。Light ready 打开会话后激活正确 identity，目录中无 part，所有连接 disconnect。
2. 计费网络默认只查不自动下载，手动未确认被拒；自动关闭设置持久化后 Wi-Fi 仍不自动下载。重新创建协调器和资源存储，从实际文件读取历史提醒；历史不能直接下载，重新检查后确认计费可手动下载。
3. 实际 ZIP 输入流在已复制首块后受控阻塞，记录 done>0/total=签名大小。分别进入游戏、切后台、切计费网络，取消后 busy 保留；新查询和下载预约被拒。释放夹具读取后原版本保持、part 清理、busy 释放；同轮不自动重试，手动重试成功。
4. 实际 ZIP 字节被改动，摘要校验失败、原内置和选择状态保持、part 清理；更正输入后手动重试成功。
5. APK 403/429/404 时资源仍安装；403/429 持久限流阻止下一次 APK 请求，404 可再查。资源429限流跨协调器/存储对象重建保留，APK新提醒正常。
6. 复验提交的 DocumentExportTest，包括四真实网页按钮经 DocumentsUI 保存 JSON、Light旋转及故障/重复请求等5项，补齐上一审阅提到的测试源码清理结构未重编译证据。

## 批改留痕

首轮计费/对象重建测试安装成功，但 `assertOnlyLight` 读取了构造时旧 store 对象的内存 ready，触发空指针。断言改为新建存储读取实际已提交文件；生产行为未因这一失败修改。增加首块进度后暂停断言，最终全通过。首轮与最终日志均存档。

## 源码一致性 SHA-256

主仓库与独立构建目录四文件的字节摘要完全相同：

- UpdateCoordinator.kt：7dfb4b084e0eded32e4e691608c928417abfdebc94c15a5092f628abface92f8
- ResourceDeviceFixture.kt：ad067caf5699025983f0012a0fcb78f644c324b340ccc4cf28a127faa9c4aef8
- UpdateCoordinatorDeviceTest.kt：2eb1efaf2b93e9866a984516ab23d3abb3ee3fbbc3064480928233fe7a63cd88
- DocumentExportTest.kt：69339c7a2ffb873a54ea2febba462f1061553115cbefbaa3b61c56dc98189f95

## 边界

受控连接不等同线上下载、TLS、正式发布密钥或真实网络读取超时；阻塞夹具释放后才观察取消清理，不宣称可以中断任意正在阻塞的系统 read。对象和文件重建不等同真实杀进程；此轮未执行正式 APK 覆盖升级、低 API 真机或第三阶段。实际原始导出 JSON 仍 local ignored，不进入公开提交。
