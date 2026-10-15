# N16 灵感积木图标修正

2026-10-15，按用户要求，将灵感积木的iconKind从logic改为generic，使用大厅已有暖黄色手柄图标，与Lambda紫色线路图区分。应用版本仍为0.2.0，资源编号递增为3以触发现有客户端更新。不需要更新APK。

现有MainActivity的目录和首页均通过dynamicIcon读取资源图标；generic映射game_dynamic_generic。已安装项目优先读取active元数据，因此需要下载并激活资源#3：大厅“立即检查”→“游戏目录”→“更新灵感积木”→打开一次游戏激活，再返回大厅即可显示新图标。受自动更新设置控制时可等待下载完成后打开。

![图标矢量预览](n16-controller-icon.png)

预览按现有Android矢量的几何形状与颜色绘制，不是设备截图。

## 实现与验证

- 来源固定10d7d0566693764d2de2d83c828f0fabd2fd7102，生产提交16497c9989eba6f839c75581bca050468c16196a。
- 大厅完整node --test为85/85，0失败。[CI运行](https://github.com/xiaoxuhui/game-hub/actions/runs/38757862091)成功。
- 独立公开远端固定检出，dynamic-resources两次生产和--verify通过；五份ZIP及unsigned描述摘要一致。
- 灵感积木ZIP仍188863字节、SHA-256为12d3953b9369755e246e1a3859a506f86cf9db2f120a29efbae13e125a5aadec，和资源#2相同；程序、存档合同与其他游戏不变。
- 本轮未进行Android设备安装验收。

## 已发布与线上核验

固定[game-resources-v2](https://github.com/xiaoxuhui/game-hub/releases/tag/game-resources-v2)目录序列10已发布。图标修订ZIP asset644248725；签名目录asset644253150，13843字节，SHA-256为16d563d8ebbf8035e160034dcc19d8286f42173dde7bcd0e057b2d807af58c2e。旧序列9 asset644172022原样归档为catalog-seq9-d4970f1be88b.signed.json。

最终匿名命令`node scripts/resource-successor.mjs online <本轮目录> d4970f1be88b4afc02878cfa0a0eb92617b241ee1642b031e8696c7851056a9e 10`输出：

```text
Verified online sequence 10, 11 cumulative resources across 10 signed catalogs
```

所有历史签名和累计ZIP大小/SHA已下载验证。证据：[online结果](n16-release/online-verified.json)、[发行身份与原文件相等检查](n16-release/issuance-facts.json)、[发布记录](n16-release/published.json)、[测试日志](n16-release/hall-tests.txt)、[第一次生产](n16-release/production-first.json)、[第二次生产](n16-release/production-second.json)。

GitHub公开资产列表与同名目录下载均遇到短暂缓存延迟。第一次在签名前拒绝payload，复核新鲜快照和上传身份后仅续行原发行；签名与上传各一次。上传后的旧缓存通过只读核对新旧资产并重新online验证处理，没有重复发行。
