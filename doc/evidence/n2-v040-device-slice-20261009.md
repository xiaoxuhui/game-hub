# N2 Android 实际进程恢复切片

- Status: COMPLETE（本切片实现与执行；提交后独立审阅待闭环）。
- 代码基底：9dd50979c6b329e8d1c84a3d845f168de2c50700，加本切片测试/版本副本；构建仅在 D:\soft\.ci-tmp\game-hub-work\v030-final，不是最终发行候选。
- 开发候选：versionName 0.4.0 / versionCode 4；同步 Node 断言及 CI 基版/新版夹具 4→5、0.4.0→0.4.1，未打发行标签。
- 任务设备：emulator-5564 / AVD gamehub-upgrade-20261009；控制器在安装或终止前检查 AVD 名称，不操作真机，不卸载应用。5562 保留旧版，N5 在该任务设备执行公开 v0.3→最终 v0.4 升级验收。

## 构建和签名

Node 31/31；发行构建、匹配 release friend 的测试 APK 和 lint 通过，98 任务中35实际执行、63 up-to-date，73秒。JVM任务在此构建为 UP-TO-DATE，75项强制执行证据来自前一修复切片，不能称本次重新全量执行。lint 0 errors / 16 warnings（包含既有弃用/本地化告警）。最终测试源码另实际重编译，43任务5执行，2秒。

App APK SHA256：41f2effea39770684c95e3b7c706cec9c63cfb5aba1bfe05574b8e89d4cc45dd。

最终测试 APK SHA256：2dd2f43a9ebdb2d7a0e6487591ff38901294283ff6a9a27722e02285f989690f。

两者均用既有发行证书签署并校验 SHA256 44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2；没有将密码或私钥写入仓库、日志或资产。

## 三次实际终止与恢复（最终源码）

| 场景 | 中断 PID | 恢复 PID | 结果 |
|---|---:|---:|---|
| state-before | 10244 | 10296 | AtomicFile.new已写且sync，外部force-stop；已接受的内容水位1保留，active=builtin、ready为空、installed=false，首次打开拒绝；此夹具没有已激活旧资源。 |
| state-after | 10340 | 10390 | 已提交ready后force-stop；完整签名资源可在安全会话激活，读取实际HTML。 |
| retirement-half | 10435 | 10484 | 两份签名历史分别seq2/seq1时force-stop；恢复采用seq2退役状态，撤销ready，拒绝旧目录和首次激活。 |

三次均确认被终止PID确为当前应用，force-stop后无存活PID，新 instrumentation 进程断言不同PID、staging为空、内容水位保留、隔离磁盘哨兵摘要不变。完整结果见 n2-v040-device-20261009/final-process。首次通过版本也保留，不混用两轮PID。

第一次实际设备执行失败是 Android ZipOutputStream 省略协议要求的UTF8旗标；生产解包器正确拒绝。测试改用与生产资源生成器/既有设备夹具相同的明确 STORED+UTF8 格式，保留失败记录，没有放宽产品ZIP验证。

## 验证边界与下一阶段

fixture使用即时RSA3072测试密钥、微型HTML和隔离私有store，不修改生产资源store。公开记录仅进程元数据/哈希，不上传测试密钥、存档正文或APK。磁盘哨兵不是实际WebView存档；N3另验真实origin、文件桥、跨游戏存储与同ID重装。两个store并发预算门禁留N4；最终干净提交完整候选、公开签名目录和历史APK升级留N5。

用户追加的 abelian-sandpile / lambda-diagram-game 资源生产与真实动态新增验收已列待办，按要求在本轮完成后执行，两个原仓库只读，来源冻结后独立生产。
