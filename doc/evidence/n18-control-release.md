# N18 右开控制积木资源更新

2026-10-16。灵感积木0.2.1 / 资源#4：重复、一直重复、如果/否则、重复直到及积木盒预览改为右开横向U形，保持嵌套编辑与执行。暖黄色手柄图标和作品存档保持，无需更换APK。

来源固定[mini-scratch@3b073c1](https://github.com/xiaoxuhui/mini-scratch/commit/3b073c131fba1861be9214b8eefefffa4560ab96)，dist14文件含MIT；生产提交01ca4f98cb21ca4dafca1ce0d3f7a1c4280c7626。来源42/42、build和verify-build通过，桌面/390px手机实际分支添加、文字编辑、循环运行、删除撤销和重载检查见[来源报告](https://github.com/xiaoxuhui/mini-scratch/blob/main/doc/v0.2.1-测试报告.md)。[来源CI](https://github.com/xiaoxuhui/mini-scratch/actions/runs/38772734542)成功。大厅完整node --test 85/85，保留本轮开始前已有导航修复。

ZIP名称game-mini-scratch-4-c9f604bc2d8b.zip，194491字节，SHA-256为c9f604bc2d8b1ca6fd84a425fd351b77db898f5f8ad555acfa5952790a5c4b62。其他四游戏ZIP保持既有摘要。生产根D:\soft\.ci-tmp\game-hub-n18\work；与其他任务N17隔离。

本轮没有Android设备安装实测。原先返回值拖拽、文件导入导出往返和听音未验收范围沿用来源报告，没有将这些列为通过。

## 发行核验

已发布到固定[game-resources-v2](https://github.com/xiaoxuhui/game-hub/releases/tag/game-resources-v2)，目录序列11。新ZIP asset644536836；签名目录asset644539134，13879字节，SHA-256为f5dcbee0336ef19c9c1b08816a309a2e743a66f226c67ef772f328db5afa99a4。旧序列10 asset644253150原样归档为catalog-seq10-16d563d8ebbf.signed.json。其他四个游戏完整描述相等。

独立两次`node scripts/dynamic-resources.mjs`和`--verify`通过；五份ZIP和unsigned描述两次摘要相同。[大厅生产提交CI](https://github.com/xiaoxuhui/game-hub/actions/runs/38772921048)成功。

最终匿名命令`node scripts/resource-successor.mjs online <本轮目录> 16d563d8ebbf8035e160034dcc19d8286f42173dde7bcd0e057b2d807af58c2e 11`输出：

```text
Verified online sequence 11, 12 cumulative resources across 11 signed catalogs
```

证据：[online](n18-release/online-verified.json)、[来源及旧描述核对](n18-release/issuance-facts.json)、[发布身份](n18-release/published.json)、[测试](n18-release/hall-tests.txt)、[首次生产](n18-release/production-first.json)、[重复生产](n18-release/production-second.json)。

公开列表缓存延迟使首次payload在签名前停止；复核新鲜快照和上传记录后，仅续行原发行。上传后旧目录下载缓存通过只读核对身份并重跑online处理。目录签署与上传各一次，没有重复发行。

用户在大厅点立即检查，更新灵感积木后打开激活即可；本地单文件刷新读取新版。无需更换大厅APK。
