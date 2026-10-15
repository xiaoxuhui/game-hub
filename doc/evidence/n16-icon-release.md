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
