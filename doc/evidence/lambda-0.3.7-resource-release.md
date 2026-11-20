# Lambda 0.3.7 资源发布记录

2026-11-21，Lambda 线路实验室 0.3.7 / content 13 已发布到游戏大厅的新旧两套签名资源目录，无需重新安装大厅 APK。

- [公开资源包](https://github.com/xiaoxuhui/game-hub/releases/download/game-resources-v2/game-lambda-diagram-game-13-d5af8fe3e1a3.zip)：683943 字节，SHA-256 `d5af8fe3e1a32d5c3aeb0973cbd081f9333566c47c18a348127ca749d889cfae`，资产 ID `772625036`。
- 包内 HTML SHA-256 `3e33a8aaf629ced4bae574ab01b548891fc034082088568f15e118f5091782ed`；MIT 许可及完整来源证明随包提供，三个文件均已匿名下载逐字节核验。
- 扩展目录 sequence 76，SHA-256 `2ff9b1c89cab3b736c5f485a81f3931e20472d7fbc95ea2c1c7dd5681bd8fc67`；线上验证 29 个签名目录、48 份累计资源。
- 旧版兼容目录 sequence 57，SHA-256 `2188bf0d37d5961c0488239b4b8b4294fa1d58892e8eb7f5c28bc27aef3fb40d`；线上验证 57 个签名目录、66 份累计资源。其他游戏及历史资源保持原样，新旧目录均指向上述同一资产。
- 上游提交 [e90e120](https://github.com/xiaoxuhui/lambda-diagram-game/commit/e90e12069fb4ee87104286d9116c4eec152c4afb)，大厅成品提交 `682d0232631dd3ddab505eab5bb5566ac5754fbb`，正式生产提交 `020a403373b4da3164ff767f82fd2675cb1927df`。

本次包含外部组合子编译器、独立按需展开函数开关、四种顺序与方向组合、v5 定义及历史存档、逐个点和 λ 的示例写法。保留三十秒保护、运行前备份、备份管理、卡死导出和长历史恢复；启动自动保存等待初始异步转换完成，保护已有存档。

本地上游 396 项测试、大厅 308 项测试及桌面、手机成品检查通过。大厅生产提交的兼容性和 Android 云端工作流通过。上游 Node 20/22 及 Android 构建通过；其浏览器工作流停在系统依赖安装，本次浏览器成品已由本地测试及大厅兼容性工作流核验，详见[候选验收](lambda-0.3.7-resource-candidate.md)。

在大厅检查更新并下载后，退出当前游戏，再次进入以激活新资源。运行中的页面保持当前版本，不自动刷新或替换用户现场。
