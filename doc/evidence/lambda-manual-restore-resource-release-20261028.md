# Lambda 手动恢复资源发行验收

- **日期**：2026-10-28（北京时间）
- **结论**：已发布，线上历史与资源校验通过；没有制作或发布 APK。
- **生产提交**：`93f79c08e428788629a48adf74b315345ca1df0e`（`main`）。
- **动态目录**：序列 38；固定 Release `407394942` / `game-resources-v2`；新目录资产 `681814767`，30883 字节，GitHub SHA-256 `4887f30db1eda1a84d79f23acb59ed86649e20eb528cd55b0fb8db84470a0772`。本地生产公钥验签成功，签名 payload SHA-256 为 `3c7322322dded472d095d002e70c4da9308eb3781a9e73c33b6db22bdb0c2aad`。
- **Lambda 资源**：版本 `0.3.4` / `contentCode 6`；资产 `681813905`；ZIP `game-lambda-diagram-game-6-6264e126b39a.zip`，217036 字节，SHA-256 `6264e126b39a7fbea3e4628e5b99aac758144ae507f1351576a71acbe50eb79f`。
- **目录差异**：序列 37 到 38 只有 Lambda 资源版本变化；另 10 款资源的版本和 ZIP 摘要均保持不变，包含图灵机。
- **历史保留**：序列 37 已改名归档为 `catalog-seq37-3e9b47ad34d2.signed.json`，资产 `681703565`，摘要仍为 `3e9b47ad34d2d27d08f6cf48a1d68e763859f94d80fee2bc721d0f1b8a57cad9`。
- **线上验证**：发布器匿名下载并核对序列 38、连续 1–38 签名目录链及目录引用的资源 ZIP；结果为 `Verified online sequence 38, 41 cumulative resources across 38 signed catalogs`。
- **使用方式**：打开游戏大厅并检查/更新 Lambda 资源。每次打开 Lambda 都是新会话；需要旧进度时点“恢复已保存状态”或导入存档。
- **本轮范围**：Lambda 手动恢复和旧检查点迁移；图灵机没有修改。
