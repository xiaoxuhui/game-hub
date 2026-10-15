# N14 灵感积木首次发行

2026-10-15，按用户“创建并推送，还要加入游戏大厅”的要求，新建公开来源仓库 [xiaoxuhui/mini-scratch](https://github.com/xiaoxuhui/mini-scratch) 并推送 main；游戏大厅 **v2 目录序列 8** 已签名发布「灵感积木」0.1.0 / 资源 #1。

用户在大厅 v0.4.0 及以上点“立即检查”，进入“游戏目录”，选择“灵感积木”主动安装；安装后出现在首页，可离线使用，无需重装 APK。

## 固定来源及资产

- 来源：`xiaoxuhui/mini-scratch@8c3bad2a0a9f71053bc2dfb132f7ca4417a182a4`，目录 dist，6 个文件含完整 MIT、模块入口和单文件入口。
- 大厅生产提交：`dd9537e2515eb8c97be8c3a64eca863ba819ca13`。资源 ID `mini-scratch`，独立动态 origin，存储合同 `mini-scratch-dynamic-v1`，原项目键 `inspiration-blocks-v1` 保持。
- ZIP：`game-mini-scratch-1-1323c534ffba.zip`，asset `644018323`，102015 字节，SHA-256 `1323c534ffba8405448c52cf73c4b048f1596dd88f4c6b231258239d354e0d13`。
- 固定 Release `407394942` / `game-resources-v2`；新目录 asset `644025209`，12339 字节，SHA-256 `0158a1e8f61302f9928722c84716bbcfb3c4eeb5731436806397527c526d088b`。
- 序列 7 原资产 `637160386` 保留为 `catalog-seq7-64024dd43bcf.signed.json`，原字节和摘要保持。既有 4 个游戏的完整描述逐字段完全一致，没有退回版本或改变 ZIP。
- 公钥 DER SHA-256 `649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673` 与 keyId `resources-20261008` 保持；正式 APK 和既有标签未移动。

## 验证证据

来源 `node --test`：17/17；build、verify-build 均通过。[来源 CI](https://github.com/xiaoxuhui/mini-scratch/actions/runs/38745325580) 在精确来源提交成功。

大厅针对性 20/20，完整 `node --test`：85/85。受限环境第一次运行在临时 Git 和目录重命名处失败；指定本轮 TEMP、在允许权限的宿主执行全绿，未改测试断言。完整日志见 [hall-tests.txt](n14-release/hall-tests.txt)。[大厅 Android CI](https://github.com/xiaoxuhui/game-hub/actions/runs/38745525437) 在精确生产提交成功。

从公开远端干净独立检出，执行 `node scripts/dynamic-resources.mjs` 两次和 `--verify`，均输出 `Verified 5 dynamic resource ZIPs`；5 个 ZIP 和 unsigned 描述的两次摘要完全一致，见 [第一次](n14-release/production-first.json) 与 [第二次](n14-release/production-second.json)。新游戏资源包约 100 KB，旧包摘要与原发行一致。

使用受限 N14 发布路径、生产 DPAPI 密钥仅内存解密后经 stdin 签署一次序列 8。最终只读匿名执行：

```text
node scripts/resource-successor.mjs online <本轮发行证据目录> 64024dd43bcf75932c90e03b708021944af9324a9fd27ba50c1a62e178572d14 8
Verified online sequence 8, 9 cumulative resources across 8 signed catalogs
```

已下载并验证全部序列 1–8、生产签名、完整资产分页、历史目录及全部引用 ZIP 的大小和 SHA。见 [在线核验](n14-release/online-verified.json)、[发行记录](n14-release/published.json) 和 [来源与旧描述核对](n14-release/issuance-facts.json)。

## 缓存延迟与安全续行

第一次新 ZIP 上传后，匿名列表尚无该资产，payload 检查以 Asset identity mismatch 停止，未读取密钥或改目录。只读取得确切资产 ID 后等待列表更新，完整复核 5 个上传记录和仍为序列 7 的 current，才用 `-ResumeAfterUploads` 继续原发行。签名仅产生一次。

新目录上传后的首次匿名核验又遇到公开缓存字节不匹配。没有再签或再传；只读确认新目录和旧归档身份后重跑 online，通过全历史核验。原始中断材料保留在 `D:\soft\.ci-tmp\game-hub-n14\evidence`。

## 客户端范围

来源原型此前通过桌面与手机浏览器的 12 项交互检查。本轮未运行正式 Android 设备或用户真机，没有宣称已在用户设备安装。JSON Blob 下载方式与大厅既有导出桥测试匹配，文件输入使用既有选择器；此前 Chrome 扩展文件权限导致导入导出完整往返未验收，这不等于 SAF 真机已经验证。安装和新作品测试可在用户现有大厅中完成。

没有新建 APK、没有改变原生权限、没有新增定时任务。原来源范围与独立资源均保留。
