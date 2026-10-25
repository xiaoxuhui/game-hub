# 元胞实验室资源发行证据

2026-10-26，生产提交8de4e1bb1df892e0fd371bf5240c0de1d5b06ebf，沿用game-resources-v2预发行通道，未创建APK或移动标签。

- catalog.signed.json：正式签名目录seq32；原字节SHA815e283289bfe1c71b44894e12903408bd10326762fbdb5c1bd460b2da7425e8。
- published.json：实际资产身份；online-verified.json：严格匿名验证32份签名目录与33个累计ZIP。
- issuance-facts.json：精确来源、资源ZIP、重复生产和验证摘要；旧七描述保持相同，公开ZIP与测试候选逐字节相同。
- producer-ci.log：精确生产提交CI40210950995成功摘录；candidate-browser.log：实际ZIP在游戏子路径及生产导出桥14/14通过。

原始失败、只读检查和恢复证据另存私有任务evidence，未覆盖。先上传ZIP后因元数据绑定失败停止；核对线上旧目录与新ZIP后，在新恢复目录规范同一上传收据对象为一项数组，保持生产提交、旧SHA及下一序列不变恢复，未重传ZIP。激活后首轮在线读到旧元数据，独立核新目录原字节与签名后只读完整重验通过。

浏览器证据不代表Android真机、系统文件选择器或断网冷启动认证。其它游戏资源刷新、兰顿蚂蚁及清理仍在待办中。
