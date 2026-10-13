# N13 Lambda 资源设计

冻结上游正常构建，先核已追踪离线 HTML 原字节与重建一致，再应用明确的 lambda-storage-isolation-v1 适配。适配只替换 workspace 三个存储键并在 restoreInitial 内迁移旧数据；不修改引擎或游戏规则。proof 同时记录原产物、适配脚本和适配产物摘要，核验仍严格拒绝漂移。

旧键 lambda-lab-v2 / lambda-lab-checkpoint-v2 / lambda-lab-v1；新键 lambda-lab-hub-v3 / lambda-lab-hub-checkpoint-v3 / lambda-lab-hub-legacy-v3。AUTO 新键存在（包括空状态）时不再次迁移。先解码两个旧记录再写，写失败还原新键原值，旧键从不写入或删除。没有旧记录时沿用上游首次启动行为。

沿用同一游戏 ID、独立 origin、dynamic-v1 存储合同及桥协议，以旧数据保留和新版隔离满足回退保护。静态资源仍为 HTML、MIT、upstream-source.json 三文件。编号递增3，固定集成提交后独立生产四个动态候选，其它三候选须与线上原字节一致。

既有发行器增加明确 n13 过程目录，签署仍经过完整历史/候选/精确主分支/固定标签门禁。只更新 game-resources-v2 累计目录，不重发大厅 APK 或移动标签。上传后先匿名核验，再在可用正式模拟器验证；设备证据与浏览器证据分开报告。
