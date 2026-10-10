# N10-D 正式资源发行与旧大厅验收

Status: COMPLETE（提交后的独立审阅待归档）。

最终 v2 发行 producer 为 `fc9da9be6a238018d86f2085facd5b8085e68cf8`。两独立检出普通生产的12文件大小及完整SHA完全一致，见 candidate-hashes.json。v1 seq2 已严格验证，见前阶段 n10-d4/v1-online-verified.json。

v2 使用已审阅的 ResumeAfterUploads 参数（TaskScope n10、NextSequence 5、原目录完整SHA 7a0312859ae27ccec42e737006a4deb46d57e7620cdd44dbfb8619a377bb17ac），重用先前 Lambda ZIP ID628444055。新目录 ID628533712、完整SHA d4b8382de275d0141c29974d13b480e50248af5b01a7c24d34a03378b07ad848；旧目录ID625643138改历史名称，字节不变。首次在线验收报 Public asset bytes mismatch，未重复发布。只读 `node scripts/resource-successor.mjs online D:\soft\.ci-tmp\game-hub-n10\evidence\publication\v2-seq5 7a0312859ae27ccec42e737006a4deb46d57e7620cdd44dbfb8619a377bb17ac 5` 随后退出0，验证5份签名历史与6累计资源ZIP。初次下载字节未保存，不能断言具体根因。

真实正式0.4.0 APK（原c6e071…及44e92…证书）在本任务自身AVD gamehub-n10-20261010 / emulator-5566，正常原生查询自动下载 light1.2.1、turing0.5.1、Lambda0.3.1；通过正常首页点击分别激活 code2。测试控制器首先断言三个实际active2及ready为空，openSession(false)不允许测试自行激活。真实原存档及实际玩法、各源无关键通过：在线35.998秒 OK1；专属设备关闭wifi/data、force-stop后离线冷启动28.538秒 OK1，finally恢复网络。日志中分别三项PASS，保存原始私有logcat及UI XML，公开副本仅去行尾空格。

展开验收命令：`adb -s emulator-5566 shell am instrument -w -e class com.xiaoxuhui.gamehub.ProductionUpdateSaveDeviceTest -e productionUpdateSaves verify com.xiaoxuhui.gamehub.test/androidx.test.runner.AndroidJUnitRunner`，在线/离线各一次。正式旧APK版本身份保持4/0.4.0；它的旧“最新版”UI不能用来声称N10新版状态已验收，后续E必须覆盖升级实际验证。

私有完整证据位于本轮 evidence，最终F归档；不包含签名密钥。D发行与存档实际结果完成，进入独立复审；CLOSED前不替换正式旧AVD现场。
