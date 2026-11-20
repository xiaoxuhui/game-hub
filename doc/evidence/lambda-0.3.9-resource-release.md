# Lambda 0.3.9 资源发布记录

2026-11-21，Lambda 线路实验室 0.3.9 / content 17 已发布到游戏大厅的新旧两套签名资源目录。

函数逐层展开时，原函数线条平滑变成展开后的内部结构，周围线条跟随移动；回退反向播放动画。保留已有的存档保护、运行前备份、历史会话归档及导出恢复功能。

- [公开资源包](https://github.com/xiaoxuhui/game-hub/releases/download/game-resources-v2/game-lambda-diagram-game-17-0e92bbd31b83.zip)：690369 字节，SHA-256 `0e92bbd31b83cff979e36f60eb7dd38c2eea87b28b4e1a6988191d4ef6e3763d`，资产 ID `772925827`。
- 包内 HTML SHA-256 `6477dbb48760cdbabe230c6157fde67df1867f792669ba29a1727ed4e6d3bf68`；HTML、MIT 许可和来源证明均已从公开资源包下载核验。
- 扩展目录 sequence 79，SHA-256 `864a7333d6a1dfd0a1fc569c3815fdc5c8e3fdd2c602e7b65efa549de9f6eff9`。
- 兼容目录 sequence 59，SHA-256 `5a5924a80e5f28ebf3dd49799e577eeadde1e7397473fcc1fb29e0ed87938a13`。两套目录均已完成线上签名及历史资源核验，并指向同一新版资源包。
- [上游提交 a2f3533](https://github.com/xiaoxuhui/lambda-diagram-game/commit/a2f35337f0b1ede9a5b5e1a68c067bac232ba537)，大厅成品提交 `aa2eb72`，生产提交 `6a575428d11495bfde6dabd5c2e1348fa3e540a8`。

验证：上游 39 项针对性测试、大厅 311 项测试通过；桌面与手机尺寸均验证展开动画、中途回退和正常运行，实际大厅 HTML 也通过相同浏览器检查。生产提交的 Lambda 兼容性及 Android 大厅工作流通过。上游浏览器云端任务停在系统依赖安装，浏览器行为由本地成品测试验证。

在大厅检查更新并下载后，退出当前游戏，再次进入以激活新资源。运行中的游戏页面不会自动刷新，无需重新安装大厅 APK。
