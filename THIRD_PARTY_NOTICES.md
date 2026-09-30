# 第三方许可与来源

合集打包以下四个固定来源的网页资源。四个固定提交都包含 MIT `LICENSE`，其版权声明均为 `Copyright (c) 2026 xiaoxuhui`。构建会将每个来源的许可文本放入 `assets/games/<id>/LICENSE`，并将本仓库许可文本放入 `assets/games/LICENSE`。完整 SHA 见 [`sources.lock.json`](sources.lock.json)，许可文本与运行资源的摘要都在构建生成的 `bundle-manifest.json` 中。

| 来源 | 固定版本 | 许可 |
|---|---|---|
| [conway-life-game](https://github.com/xiaoxuhui/conway-life-game) | 0.17.0 | MIT |
| [EML](https://github.com/xiaoxuhui/EML) | 1.3.0 | MIT |
| [light_game](https://github.com/xiaoxuhui/light_game) | 1.2.0 | MIT |
| [turing-machine-simulator](https://github.com/xiaoxuhui/turing-machine-simulator) | 0.5.0 | MIT |

构建阶段使用 Node.js、pnpm、Vite、TypeScript、Android Gradle Plugin 与 Gradle；它们不作为源代码目录复制进 APK。APK 使用 AndroidX Core、Activity、WebKit 和 Kotlin 运行库。正式对外分发前仍需从最终 APK 的依赖清单复核它们的精确版本及许可证，并随分发包提供所需的许可文本。本文件目前是源码来源清单，不冒充最终发行版的完整第三方许可清单。
