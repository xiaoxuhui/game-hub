# 游戏大厅 v0.4.3 发布记录

## 发布身份

- Release：<https://github.com/xiaoxuhui/game-hub/releases/tag/v0.4.3>
- Tag：`v0.4.3`，指向发行源码提交 `bc3d5af081dc07e3cf4413cc946d6f16b43beacd`。
- GitHub Actions 候选运行：`40415400554`，成功；推送 main 触发的 Android CI：`40415383046`，成功。两者均运行于同一提交 SHA。
- 最终 APK 所含固定 bundle：4 个源项目、40 个资源文件；manifest SHA-256 `43ee707c27e684f8949be94c7075c79965a0bc4f55bb0cd56133276cbb70717d`。

## APK 核验

- 包名 `com.xiaoxuhui.gamehub`，versionName `0.4.3`，versionCode `7`，minSdk `24`，targetSdk `34`。
- 权限：`INTERNET`、`ACCESS_NETWORK_STATE`、`REQUEST_INSTALL_PACKAGES` 和 Android 生成的非导出动态接收器权限。
- Release APK：2,683,223 bytes；SHA-256 `0031b1107ef1f07d4153a8067df34e83989cb80d31cc00456aaa9278999fa1a3`。
- 签名证书 SHA-256：`44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2`，与既有正式大厅 APK 发行证书一致。
- GitHub 候选 unsigned APK 与本地 unsigned APK 字节完全一致（2,660,428 bytes，SHA-256 `9b5f8d388ba0815a0431c0f02efa38323633168ee94849659a8b76e0e65aff40`）。
- Release 唯一资产：`game-hub.apk`，asset ID `679744460`。通过该 asset ID 下载回读，2,683,223 bytes 和 SHA-256 与签名 APK 完全一致；发布后 latest 为 `v0.4.3`。

## 验证

- Node 全量：233/233 通过，原始输出见 `node-final-bc3d5af.log`。
- Android JVM：18 个 XML 测试套件，共 97/97 通过，原始输出和 XML 见 `gradle-final-bc3d5af/`。
- Android 34 模拟器：动态卡片专属图标与分类回退 instrumentation 1/1 通过；原始输出与 XML 见 `instrumentation-final-bc3d5af.log`、`gradle-final-bc3d5af/dynamic-lobby-device-test.xml`。
- Gradle、仪器测试及 Node 的未改动原始构建输出也压缩保存于 `original-build-logs-bc3d5af.zip`；可读文本副本清理了 Gradle 自身输出的行尾空格。
- 7 张 APK 图标在解码后与源 PNG 像素完全一致；`verify_apk.py` 核实 APK 含 4 个固定源、40 个资源并绑定上述源码 SHA。
- 四款既有固定游戏打开及返回大厅通过，证据见 `emulator-smoke/`；升级烟测、既有存档标记保留证据见 `upgrade-smoke/`。
- 四个原游戏仓库的工作树保持 clean，SHA 与 `original-repository-readonly-state.json` 相同。游戏资源包、资源锁和签名资源目录均未修改。

## 图标映射

- `abelian-sandpile` → 阿贝尔沙滩专属图标
- `lambda-diagram-game` → Lambda 专属图标
- `logic-circuit` → 逻辑工坊专属图标
- `traffic-planner` → 路流·交通规划专属图标
- `mini-scratch` → Mini Scratch 专属图标
- `memory-demo` → 记忆示例专属图标
- `red-green-puzzle` → 红绿谜题专属图标

其他没有专属图标的动态游戏仍按原 `iconKind` 显示分类图标；四款固定大厅卡片保持原样。用户可安装发布 APK 进行真机验收。
