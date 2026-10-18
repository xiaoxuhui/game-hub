# N22 逻辑工坊发行证据

2026-10-18，逻辑工坊 0.2.0 / contentCode1 已加入公开大厅动态资源目录序列15，包含“延迟线清零”按钮名称。原五个动态游戏完整描述逐字段一致。

## 来源与验证

- [源码固定版本](https://github.com/xiaoxuhui/logic-circuit/commit/4d986e4ec445a2de3ab872730f2fcc9f89e09163)：MIT，六文件 dist，80 项核心/分发测试、81 项完整浏览器检查、12 组专项浏览器验收；[源码 CI 成功](https://github.com/xiaoxuhui/logic-circuit/actions/runs/39087349678)。专项覆盖延迟步进与清零、总线、查表、门编辑级联、只读查看、框选移动复制、临时输入、子路径及导出桥。
- 大厅生产固定 f655d273a50eaafcf4ee162a311dcd5d47e2ac09；[大厅 CI 成功](https://github.com/xiaoxuhui/game-hub/actions/runs/39087427494)，86 项 Node 测试及原生构建验证通过。[本地测试记录](n22/hall-tests.txt)。
- 独立清洁目录 D:/soft/.ci-tmp/game-hub-n22/work，来源全部从公开远程固定 SHA 获取。两轮六个 ZIP、unsigned 描述及候选元数据共八文件 SHA256 完全一致；--verify 核对提交源码字节。[首轮](n22/production-first.json)、[第二轮](n22/production-second.json)。

## 公开身份

| 对象 | 身份 |
| --- | --- |
| Release | 407394942 / game-resources-v2，固定标签保持 |
| 目录 | sequence15 / asset652152660 / SHA256 0eb07895d68c1a307571c726bd58158a80dc8bf3a030ecef93f2add1cac10f30 |
| 逻辑工坊 ZIP | asset652150688 / 135904字节 / SHA256 63079c4dbd9686bc3f061bcf5edce845f94b1b6e3a09710653930a3dcf52feda |
| 前序目录 | asset644809132 保留为 catalog-seq14-bdb9889af98e.signed.json，原摘要不变 |

匿名输出：`Verified online sequence 15, 16 cumulative resources across 15 signed catalogs`。全部历史签名与累计 ZIP 已下载核对。[在线验证](n22/online-verified.json)、[发行身份](n22/issuance-facts.json)、[签名目录](n22/catalog.signed.json)。签名信任根与旧资源保持，凭据和私钥仅在发布包装器内存中处理。

## 过程与使用

第一次调用旧版 Windows PowerShell，默认 ANSI 解码公开 UTF-8 快照失败，在凭据读取和上传之前停止。改用 PowerShell 7 与新证据目录；上传后公开元数据缓存暂未出现新资产，包装器在签名前停止，按现有 ResumeAfterUploads 守卫核对上传身份后继续，仅签名一次。激活后 CDN 首次返回旧目录，仅重试匿名在线核验，最终通过，没有重复签名或激活。

大厅“立即检查”→“游戏目录”→逻辑工坊→安装，之后可离线使用。无需更换 APK。没有 Android 真机安装、文件选择器或设备 WebView 新增验收，不把 Chromium 验收等同于真机测试。
