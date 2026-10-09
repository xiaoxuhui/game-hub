# v0.4.0 N5 最终验收脚本独立首审

- 受审文件：`D:\soft\.ci-tmp\game-hub-maintenance\verify_v040_upgrade.ps1`、`verify_v040_online.ps1`（2026-10-09 当前只读版本）。
- 范围：脚本本身及其引用的现有 `UpgradeSaveDeviceTest` /目录 CLI；未执行升级、联网发布、构建或修改主仓库与四原仓库。最终 APK 正在形成，本记录不认定候选字节或发行通过。

## 发布验收前须修正

1. **P1：在线资产集合会被重名和上轮残留误判通过。** `verify_v040_online.ps1` 第 7、16–25 行复用固定 `anonymous-downloads`，只检查 v1 数量 5/v2 数量 2 与逐项名称正则，不要求唯一且精确的资产集合。如果 v2 公共 Release 有两个同名示范 ZIP、缺 `catalog.signed.json`，旧目录中残留的 catalog 仍会被第 45 行验签；v1 也可重复一个游戏 ZIP、遗漏另一个。每次使用新的任务目录（或安全地精确清空本轮命名空间），先校验每通道资产名唯一、v1 恰为四款 ZIP 加 catalog、v2 恰为固定示范 ZIP 加 catalog，再只对本轮下载文件验签。
2. **P1：目录签名与当前公开 Release 资产归属未闭合。** 第 23–30 行核的是浏览器下载字节与 GitHub 回报 digest、v2 本地候选字节；第 43–46 行的两个 CLI `verify` 模式只验证签名/目录结构，不传公开 Release 的完整分页快照。签名目录即使包含错误 `releaseId`、不存在/别处的 `assetId`，脚本仍可能输出最终成功，而客户端查询会拒绝。应按公开 API 完整分页构造快照并调用现有 `validateReleaseSnapshot` 逻辑，对每个已签入资产的 ID、规范名、大小、摘要、Release 身份逐一精确比较；或运行实际客户端在线查询并记录成功。v1/v2 均需要此闭环。
3. **P2：网络恢复没有判定成功。** `verify_v040_upgrade.ps1` 第 42–43 行在 `finally` 中调用 `adb shell svc wifi/data`，但未检查两个返回码或恢复后的状态。PowerShell 的 `$ErrorActionPreference='Stop'` 不会自动把原生 `adb` 的非零退出码变成异常；脚本可能先打印第 40 行成功标记，最终网络仍未恢复而总体返回成功。建议在 `finally` 中分别检查 adb 退出码与状态回读，并把恢复失败明确记为失败；同时检查第 24–25 行的断网命令实际生效后才种五页存档。
4. **P2：最终仪器包未锁定字节。** 升级脚本第 29 行安装固定路径 `final-release-test.apk`，却只对候选正式 APK 和公开 v0.3 APK 做 SHA 校验。若该文件是旧仪器包，`OK (1 test)` 只证明旧测试逻辑。建议传入或固定本次已审阅仪器 APK SHA，并记录证书摘要；与最终源码及五页用例版本关联后再运行。

## 已有有效边界

- 升级脚本限定 `emulator-5562` 且核 AVD 名为 `gamehub-resource-20261008`，没有 `uninstall` 或 `pm clear`；v0.3 公开 APK 以固定 SHA 校验，目标 v0.4 APK 以调用方提供的 64 位 SHA 校验。`adb install -r` 从公开 v0.3 到候选 v0.4 若签名不同会失败。仪器类使用目标包的实际五页 HTML/JS 和同 origin WebView 存储，seed/read/upgrade/read 四段断言可检查这五页存档跨 APK 覆盖；它并非普通大厅导航路径，报告需保持此表述。
- 在线脚本从匿名 GitHub Release 拉取 APK/v1/v2，逐文件比对 API digest/大小；从实际下载 APK 内提取固定 `res/raw/resource_public_key.der`，核固定 SHA 并用其验证两目录签名。这能证明公钥与已下载 APK 字节关联，但在上述资产归属缺口修复前不足以证明真实客户端接受在线目录。

**首审结论：** 两项 P1 会造成公开发行验收假阳性，需批改并复审后才可作为 N5 发布门禁；网络恢复与仪器字节锁定亦建议在真实升级运行前补齐。独立 JVM/构建成功不替代最终签名 APK 与在线实测。

## 三份工具批改独立复审（2026-10-09）

- **在线两项 P1 已在脚本层闭合。** `verify_v040_online.ps1` 每次使用 UUID 子目录，旧 catalog 不能被复用；新增 `verify_v040_release_binding.mjs` 用现有 `captureReleaseSnapshot` 读取匿名固定 v1/v2 Release 的完整连续分页，使用从本次下载 APK 提取的公钥验签，再运行 `validateReleaseSnapshot` 核对签入 releaseId、资产 ID/规范名/大小/摘要。它还核 v1 四个精确 ID、v2 仅示范 ID、资产名唯一及恰好 `游戏数+1` 项，逐个快照资产与本次下载字节核对。重名、缺 catalog、缺 ZIP、签名目录指向错误 Release/资产均会失败。在线真实执行尚未发生，不能把静态复审当成公开渠道通过。
- **仪器 APK 锁定已闭合。** `verify_v040_upgrade.ps1` 第 15–19 行对 `final-release-test.apk` 锁定 SHA-256 `bb17b2bee3d8ff3001902a2c14b4327aa81c153e04bd25cc0d0e6280eb5bf3a5`，并用 `apksigner verify --print-certs` 核发行证书指纹；正式候选 SHA 仍由参数核对。恢复侧第 49–59 行分别检查 Wi-Fi/移动网络命令退出与状态回读，并保存非秘密 JSON 证据。
- **仍需一项 P2 批改：断网动作未检查。** 升级脚本第 31–32 行直接执行 `svc wifi disable`、`svc data disable` 并丢弃输出，没有检查 `$LASTEXITCODE`，也没有在种档前回读状态；因此断网失败时仍能走五页验收，不能声称已验证离线条件。应对两条命令逐一检查退出码和 `wifi_on`/`mobile_data` 回读，失败即停；`finally` 仍恢复原值并核对。批改说明若称“断网 exit+回读均检查”，目前与代码不符。

**实际升级门禁状态：未通过。** 主执行端报告 v0.3.0 在安装 v0.4.0 前的跨进程 Turing 输入读档已失败，延长写盘等待后仍失败，正在独立诊断。脚本的 JUnit 输出检查会因此抛错，未见误报成功；不得以本次工具静态复审、已构建候选 SHA `4e719cad636029d6bc6e2f517f146cc24d0468a008fb0a9549643976dcaa0916` 或在线脚本修订代替真实 v0.3→v0.4 五页通过。

**复审结论：** 首审两项在线 P1 与仪器字节锁定已闭合；断网确认 P2 待补，真实升级失败待查。当前不能通过 N5 发行门禁。
