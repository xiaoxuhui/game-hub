# 大厅图标源

`game-hub-icon.svg` 为可编辑的大厅品牌图：蓝色入口轮廓与薄荷色手柄，深色背景及蓝/金色按键。矢量由本项目直接设计，不含第三方图标或生成模型素材，按仓库 MIT 许可使用。

Android 实际资源为 `res/mipmap-anydpi/ic_launcher.xml` 的普通图标、`res/drawable/ic_launcher_foreground.xml` 的透明前景和 `res/drawable/ic_launcher_monochrome.xml` 的单色镂空层。Manifest 使用同名 mipmap：API24–25 选择普通矢量，API26–32 选择 v26 adaptive，API33+ 选择 v33 adaptive/monochrome。没有单独设置 roundIcon；系统使用同一个自适应图标作形状裁切。

SVG 和 Android 前景路径一致；修改图案时同步三份 Android 矢量及 SVG。所有层采用 108×108 画布，主要图形处于中心安全区域。实际预览和编译证据见图标改版记录。
