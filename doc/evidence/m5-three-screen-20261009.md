# M5 三屏幕配置与原生无障碍节点验证

- 日期：2026-10-09；开发基线 f6368e29a0d484091ac53a0c8fd0a5ced5aa83d8。生产与仪器构建只在 `D:\soft\game-hub-upgrade-20261009`，本任务 AVD emulator-5564；四原仓库未修改。包内 bundle 来源仍 b58f165，仅为本切片候选，最终发行须 clean SHA 重建。
- 同现有发行证书签名 v0.3.0/code3 UI 候选 SHA-256 `5f5b249900f8a9e24ca31883a90605c71bf175fcfb8d1c9c0a4b37c61ec7182a`，覆盖安装 Success。仪器包 `7c91ce034bac10a83c3a3b6e8eefb90b3507e1d31c8d4e483b83106a01defd4bc`；证书 `44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2`。未发布这些包。
- 独立构建 assembleRelease、assembleReleaseAndroidTest（release variant）、testDebugUnitTest 退出0。JVM XML共62项/0失败/0错误；执行状态以构建日志为准。

## 实际执行

| 配置 | 参数 | 结果 |
|---|---|---|
| 普通手机 | Pixel 2 AVD 默认1080×1920、密度420，font_scale=1、竖屏 | OK (1 test)，8.433秒，未滚动前四卡完整可见 |
| 矮屏大字体 | wm size 640x1136、density320，320dp宽、font_scale=1.6、竖屏 | OK (1 test)，8.799秒，四入口可滚动到达，更新标记完整绘制 |
| 平板横屏 | wm size 1000x1600、density200、font_scale=1、user_rotation=1 | OK (1 test)，9.604秒，实际Configuration横屏且宽≥600dp |

命令：`adb -s emulator-5564 shell am instrument -w -e class com.xiaoxuhui.gamehub.LobbyAccessibilityDeviceTest -e uiProfile <phone|large|tablet> -e uiFilePrefix <唯一文件前缀> com.xiaoxuhui.gamehub.test/androidx.test.runner.AndroidJUnitRunner`。需显式离线/空闲控制；无uiProfile默认Assume跳过，不能将默认仪器测试成功视为此三配置已执行。每组finally恢复默认屏幕尺寸/密度、font_scale=1和竖屏；此任务模拟器保持离线用于后续本地验收。

用真实 MainActivity 渲染器与真实文件资源执行，APK0.4.0、Conway/Light资源#2提醒是明确的UI状态夹具，未声称远端发行。四卡真实AccessibilityNodeInfo名字/可见/可点击/焦点动作通过；受更新游戏状态TextView最后行覆盖完整文本且高度足够。详情真实取消按钮focus/click使实际门禁token.cancelled=true，清理完成前busy保持；本测试没有HTTP下载工作者，真实HTTP及清理由另一已闭环协调器切片覆盖。完成后真实Light页面加载并发现LightStorage。

## 失败、修正与截图复核

1. 初次phone在ACTION_ACCESSIBILITY_FOCUS失败（m5-ui-phone.txt）；UiAutomation服务补FLAG_REQUEST_TOUCH_EXPLORATION_MODE后同生产代码通过（m5-ui-phone-focus.txt）。这属于测试服务配置，不是TalkBack实际验证。
2. 初版截图首帧空白：UI线程断言完成不代表模拟器合成器已呈现。截图前增加500ms固定呈现等待；m5-ui-*-frame.txt记录三组通过，空白截图不作为验收证据。
3. 人工读取实际截图发现：大字体版本+提交摘要折两行时maxLines=2截掉“#2 可更新”。保留修复前 `m5-large-frame-20261009-lobby-bottom.png`。生产首页去除提交摘要（资源详情仍保留完整SHA），卡片状态取消两行截断，按字体放大增加最小高度。新增实际文本layout末行和高度断言。最终三组重新执行均通过；`*-final-*`九张PNG已用view_image抽查普通手机四卡、大字体完整标记及详情、横屏布局。

## 未执行范围

AOSP34镜像无TalkBack服务，以上仅证明原生节点树操作，不证明TalkBack语音/手势。真实TalkBack、用户真机和系统安装器人工交互按用户授权留发布后验收。截图只包含本任务原生界面和合成提醒，不含原始存档、口令或密钥。来源/截图摘要见同目录hashes.json。普通CI f6368e已成功：运行37838260946；手动完整覆盖流水线37840684965失败在已安装code4后shell退出141，另切片修复，不把它写为通过。提交推送后独立审阅闭环再进入下一切片。
