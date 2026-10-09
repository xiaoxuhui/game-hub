# N5 v0.4.0 最终候选独立审阅（2026-10-09）

固定源码：`4aacb1f81b7fc381d2ca7fd725fd93dd109e390e`，主仓库 HEAD 与 origin/main 相同且工作树干净。独立构建目录 `D:/soft/.ci-tmp/game-hub-work/v030-final` 同 SHA、构建后仍干净；只读审核，没有在主仓库或四原仓库构建/修改，没有读取私钥、口令或原始存档。此前 `489c175` 候选及失败诊断位于 `pre-final-489c175`，**本结论仅绑定下列新字节**。

## 固定可发布产物

- 正式候选 `game-hub.apk`：**SHA256 `c6e071e18eac1cb97f3d898d6eb4dab2c790b8d9310a907a7e44e3c34a78ee39`，2,645,967 字节**，包名 `com.xiaoxuhui.gamehub`，code4 / 0.4.0。独立复算摘要、`apksigner verify --print-certs` 退出 0，发行证书 SHA256 `44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2`；从干净独立检出运行 `verify_apk.py` 通过，确认包内四来源/40 资源与固定提交绑定。仪器 APK SHA256 `06bde7d7ead8d4b53804e971771612da3653492da9b4f94c4f91b7be2a930488`，独立验签退出 0 且同证书。
- `build_v040_final.ps1` 与已提交审阅副本经换行归一后文本一致；固定 SHA、干净检出、构建后干净校验成立。Node 35/35；Release JVM XML 14 套件合计 82/0 失败/0 错误/0 跳过，Gradle Release 单测/组装/lint 55 项均实际执行；Android instrumentation APK 组装成功；lint 0 错误、18 警告。四个 v1 ZIP 重复摘要一致，完整清单复核通过；自有 v2 示范 ZIP 验证通过，示范游戏未进入 APK 内置资源。
- APK 权限与固定公开 v0.3.0 APK 逐行一致：INTERNET、ACCESS_NETWORK_STATE、REQUEST_INSTALL_PACKAGES 及既有私有动态接收器权限；没有新增 Android 权限。Release runtime 依赖树 153 行与 v0.3.0 基线一致，配置行 1 条相同；全文日志仅有构建时长和 CI 路径尾行差异。tracked 657 文件的禁跟踪/PEM/GitHub token 字面量检查为 0，该扫描已明确不覆盖所有秘密格式。四原仓库 HEAD/工作树只读快照均与冻结基线一致，EML 原有用户变动保留。
- GitHub Actions [运行 37867512231](https://github.com/xiaoxuhui/game-hub/actions/runs/37867512231) 经匿名 API 独立查询为 `completed/success`，head SHA 精确为 `4aacb1f81b7fc381d2ca7fd725fd93dd109e390e`。

## 真实覆盖升级与工具边界

固定公开 v0.3.0 APK 复算 SHA256 为 `61751251fa878523186a879c3c73ae9fef722a163cbf1e00f343c6c17736d73d`。任务 AVD `emulator-5562` 在安装/force-stop 前核名称；升级脚本固定新 APK 与仪器 APK SHA、同证书。断网时服务状态 Wi-Fi disabled、mobile false，`dumpsys connectivity` 报 `Active default network: none`；原/后服务状态 `wifi=true/mobile=false`、global 设置 `1/1` 相同，恢复错误数组为空。脚本不卸载或清应用数据，按公开旧包种四游戏五页真实存档、force-stop 后旧包复读、同证书覆盖新 APK、再 force-stop 新包复读；三段各 `OK (1 test)`（31.939 / 4.349 / 8.833 秒），终点 `FINAL_V030_TO_V040_SAME_SIGNER_FIVE_PAGE_UPGRADE_OK`。此前旧包 campaign 草稿即时成功但结束进程后失败，修正种档时保持 WebView 渲染器存活 6 秒；失败/诊断与新成功分别保留，未将旧版失败归因于新版迁移。

断网控制器初版曾把 `settings global mobile_data=1` 当成服务仍在线，尽管 telephony 服务实际为 false；该误判日志保留。现用 `dumpsys wifi`、`telephony.registry` 与无默认网络的严格服务读回及限时等待，且恢复原服务与 global 设置，完整复跑通过。`publish_v040.ps1` 与已提交、先前独立复审过的副本文本一致：显式模式、固定完整 SHA 与远端 main、不可移动标签、正式 APK 固定路径/摘要/源码绑定/签名/code4 门禁，资源 ZIP 先上载、签名目录后上载，APK 先 draft 后公开。首份发布工具只用于 N5；N6/N7 后续目录签署须使用已有签名历史锚点。

## 结论

**无阻塞；放行上述固定 SHA 的 `game-hub.apk` 作为 v0.4.0 正式发布资产，并放行从 `4aacb1f` 建立不移动的 v2 资源与 v0.4.0 标签、按既定顺序先资源后 APK 发布。** 此时尚无 v0.4.0 公开资产；发布后仍须另验匿名资产字节/生产公钥、旧新客户端和 latest 分流并做提交后独立发行复审。N6 示范局部更新、N7 两个新游戏真实动态新增、N8 集中清理仍未完成。TalkBack 真机/厂商设备与异机密钥备份恢复按用户授权留后续待办，不冒充已测。
