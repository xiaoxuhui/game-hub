# 大厅图标改版证据

日期：2026-10-03（Asia/Shanghai）。资源提交 `de3607b3a6698834613f58a067b3ff932ec7ea55`，全部构建与渲染在独立检出 `D:\soft\game-hub-build-icon-20261003`；托管 worktree 工具在当前任务返回“Not a git repository”，因此使用独立本地 Git clone，未在主目录构建。

| 文件 | 支持的结论 |
|---|---|
| `icon-preview.png` | 实际 Android vector 路径的普通/圆形/主题与 48px 视觉模拟，非真实主题启动器截图 |
| `icon-drawer.png` / `icon-drawer-ui.xml` | 新 Android34 AOSP Launcher3 的应用列表实际显示彩色图标 |
| `icon-home-settings.png` / `icon-home-settings.xml` | 当前启动器设置没有主题图标选项，不把主题模式标已验 |
| `icon-lobby.png` / `icon-lobby-ui.xml` | 候选 APK 可启动并显示四游戏与检查更新入口 |
| `icon-node-tests.txt` | 13 项现有 Node 检查通过；负例中的 fatal 日志是测试夹具预期，不是构建失败 |
| `icon-gradle.txt` | 实际 `testDebugUnitTest assembleDebug` 构建成功；未隐藏既有 SDK/deprecated 提示 |
| `icon-bundle*.txt` | 独立固定 SHA 构建并复核四来源、40 资源 |
| `icon-aapt-badging.txt` / `icon-aapt-permissions.txt` | 候选包名/版本/图标路径和权限；无权限增加 |
| `icon-v33-compiled.txt` | 编译后的 v33 adaptive 含 background/foreground/monochrome 引用 |
| `icon-install.txt` / `icon-launch.txt` | 专用模拟器实际安装与启动 |
| `implementation-ci.json` / `verification-summary.txt` | 对应实现提交 CI 状态、实际测试数量和候选摘要 |

运行环境：JDK17、Gradle8.7、SDK34；新建 `gamehub-icon-20261003` AVD，不复用旧发行验收 userdata。仅测试候选采用本机调试签名，versionName 仍为 0.2.0/code2，**不是正式 v0.2.0 发行包，也不能直接覆盖其发行签名版本**。本轮没有打标签、发布或改发行版本。

复核命令（在独立检出执行）：

```powershell
node --test
node scripts/bundle.mjs
node scripts/bundle.mjs --verify
# 配置已有 JDK17 与 ANDROID_HOME 后执行
android/gradlew.bat -p android testDebugUnitTest assembleDebug --no-daemon
```

渲染可用 `python <repo>/doc/evidence/icon-refresh/render-preview.py <independent-checkout>` 生成 `.build/icon-preview.html` 与 `.build/icon-actual-vector.svg`。脚本只读实际 Android XML 路径，不编辑已有位图。使用本机已安装 `chromium_headless_shell-1234`，以 `--no-sandbox --disable-gpu --hide-scrollbars --window-size=1080,580 --force-device-scale-factor=1 --screenshot=<checkout>/.build/icon-preview.png file:///<checkout>/.build/icon-preview.html` 截图；512px 独立图标以相同方式渲染 SVG。预览蒙版与主题着色仅用于视觉模拟，系统实测另列。

真实主题启动器和其他厂商启动器/旧 API 的视觉验收未执行；普通 API34 启动器、编译、资源限定目录及静态视觉已经复核。没有任何密钥或口令进入本目录。

仓库文本副本按 Git 规则统一为 LF，Gradle 副本去掉一处日志行末空格以通过格式检查；没有删掉提示或改变命令结果。未规范化原始文件仍在独立检出的 `.build/`。本轮五份图标文档的 16 个本地链接均存在。
