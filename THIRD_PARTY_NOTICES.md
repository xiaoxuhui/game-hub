# 第三方许可与来源

本文件对应游戏大厅的四个固定来源和锁定 Android 运行依赖，适用于 v0.2.0、v0.3.0 及准备发行的 v0.4.0；运行依赖坐标未在本轮改变，最终依赖图须再核验。随 APK 一同放在 `assets/games/THIRD_PARTY_NOTICES.md`；Apache 2.0 完整文本位于 `assets/games/Apache-2.0.txt`，本仓库对应文件为 [`licenses/Apache-2.0.txt`](licenses/Apache-2.0.txt)。合集 MIT 文本与四份来源 MIT 文本也分别放在 APK 的 `assets/games/LICENSE` 和 `assets/games/<id>/LICENSE`。这些文件均纳入 `bundle-manifest.json` 的逐文件 SHA-256 校验。

动态资源单独附带对应来源的完整 LICENSE，署名与逐文件摘要进入签名清单。首个配对示范为本仓库自有 MIT 源码，不内置于大厅 APK；后续新增游戏的许可及完整来源 SHA 需分别审核和归档。

## 四个固定游戏来源（MIT）

| 来源 | 固定版本 | 许可 |
|---|---|---|
| [conway-life-game](https://github.com/xiaoxuhui/conway-life-game) | 0.17.0 | MIT |
| [EML](https://github.com/xiaoxuhui/EML) | 1.3.0 | MIT |
| [light_game](https://github.com/xiaoxuhui/light_game) | 1.2.0 | MIT |
| [turing-machine-simulator](https://github.com/xiaoxuhui/turing-machine-simulator) | 0.5.0 | MIT |

四个固定提交的完整 Git SHA 见 [`sources.lock.json`](sources.lock.json)，每个提交均包含其 MIT `LICENSE`，版权声明为 `Copyright (c) 2026 xiaoxuhui`。组装时从固定提交复制许可文本，不读取四个原工作树。

## Android 运行依赖（Apache License 2.0）

以下是 [未签名 Release 候选 CI](https://github.com/xiaoxuhui/game-hub/actions/runs/36756586701) 的 `releaseRuntimeClasspath` 所解析的坐标；它是依赖图清单，包含仅作元数据或平台约束的坐标，不声称每项都以独立文件存在于最终 APK。逐项 Maven POM 许可字段均为 Apache 2.0；`com.google.guava:listenablefuture` 的许可由其 `guava-parent:26.0-android` POM 继承。来源分别为 [AndroidX](https://android.googlesource.com/platform/frameworks/support/)、[Kotlin 标准库](https://github.com/JetBrains/kotlin)、[Kotlin 协程](https://github.com/Kotlin/kotlinx.coroutines)、[JetBrains Annotations](https://github.com/JetBrains/java-annotations) 和 [Guava](https://github.com/google/guava)。

```text
androidx.activity:activity:1.9.2
androidx.activity:activity-ktx:1.9.2
androidx.annotation:annotation:1.6.0
androidx.annotation:annotation-experimental:1.4.0
androidx.annotation:annotation-jvm:1.6.0
androidx.arch.core:core-common:2.2.0
androidx.arch.core:core-runtime:2.2.0
androidx.collection:collection:1.0.0
androidx.concurrent:concurrent-futures:1.1.0
androidx.core:core:1.13.1
androidx.core:core-ktx:1.13.1
androidx.interpolator:interpolator:1.0.0
androidx.lifecycle:lifecycle-common:2.6.2
androidx.lifecycle:lifecycle-livedata-core:2.6.2
androidx.lifecycle:lifecycle-runtime:2.6.2
androidx.lifecycle:lifecycle-runtime-ktx:2.6.2
androidx.lifecycle:lifecycle-viewmodel:2.6.2
androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.2
androidx.lifecycle:lifecycle-viewmodel-savedstate:2.6.2
androidx.profileinstaller:profileinstaller:1.3.1
androidx.savedstate:savedstate:1.2.1
androidx.savedstate:savedstate-ktx:1.2.1
androidx.startup:startup-runtime:1.1.1
androidx.tracing:tracing:1.0.0
androidx.versionedparcelable:versionedparcelable:1.1.1
androidx.webkit:webkit:1.11.0
com.google.guava:listenablefuture:1.0
org.jetbrains:annotations:13.0
org.jetbrains.kotlin:kotlin-stdlib:1.9.24
org.jetbrains.kotlin:kotlin-stdlib-common:1.9.24
org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.0
org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.0
org.jetbrains.kotlinx:kotlinx-coroutines-android:1.6.4
org.jetbrains.kotlinx:kotlinx-coroutines-bom:1.6.4
org.jetbrains.kotlinx:kotlinx-coroutines-core:1.6.4
org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm:1.6.4
```

构建阶段使用 Node.js、pnpm、Vite、TypeScript、Android Gradle Plugin 与 Gradle；这些工具不作为运行依赖复制进 APK。每次正式候选变更依赖后需重新生成依赖图、核对许可并更新此文件。
