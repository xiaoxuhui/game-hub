# N13 Lambda大厅资源发行

2026-10-13，用户授权“启动服务，然后上传到游戏大厅”。本地服务 `http://127.0.0.1:57695/` 返回200，包含当前归约方向选择器；源仓库工作树未修改。大厅已发布 **Lambda0.3.3源码修订 / 资源#3，v2目录序列7**。用户在大厅点“立即检查”，下载后重新进入游戏即可，无需重装APK。

## 来源与发行身份

- 原源码：`xiaoxuhui/lambda-diagram-game@a5eab9f5c14f33d328f39858b6680e43c41ffa25`；原文编辑、20px点击容差、手动归约、正规序/应用序及右到左均来自此提交。
- 完整集成：`xiaoxuhui/game-hub@286de771581a1d7012f0fe887f4d030fbc2ef205`；生产提交 `ff8ec07674b26378075d3909f55883694a9fc4f3`。存储适配记录在随包upstream-source.json，原dist与重建相等的门禁保留。
- 固定Release407394942、tag `game-resources-v2`。当前目录asset637160386，10199字节，SHA256 `64024dd43bcf75932c90e03b708021944af9324a9fd27ba50c1a62e178572d14`。
- Lambda ZIP `game-lambda-diagram-game-3-fcef92bb937e.zip`，asset637155800，117813字节，SHA256 `fcef92bb937ec4df8fe57a853a1c28fa930ad35c74acf6540880c8c0789908b5`。
- 旧序列6保留为 `catalog-seq6-ab9a0d45b27f.signed.json`，asset631380780、摘要不变。v0.4.0及资源标签仍指向4aacb1f81b7fc381d2ca7fd725fd93dd109e390e。
- 生产公钥DER摘要 `649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673`、keyId resources-20261008不变。私钥由已有DPAPI发行器仅内存解密/stdin使用，没有进入源码或证据。
- memory-demo、阿贝尔、红绿资源与当前序列6逐字段（除绑定assetId）及ZIP字节一致。正式大厅v0.4.1 APK不替换。

## 实际验证与范围

上游162检查通过。大厅最终 `node --test` 85通过、0失败、0跳过；`node scripts/lambda-hall-browser.cjs` 11通过、页面错误0。1280/390px实际旧→新→旧→新验证最新基础进度、旧版正常步骤合并、原文/完整路径/方向保留、保存点、备份清空导入；存储访问失败时UI仍可用。独立来源适配重复三文件摘要相等，独立生产四ZIP和unsigned描述重复相等。详见[准备报告](n13-preparation.md)及[截图](n13-browser/)。

云端[Lambda兼容run38406282183](https://github.com/xiaoxuhui/game-hub/actions/runs/38406282183)成功，覆盖最终集成代码；[Android run38406745755](https://github.com/xiaoxuhui/game-hub/actions/runs/38406745755)在精确生产提交成功，包含85检查、四来源构建、存储审计、Android测试、APK身份和debug签名检查。此前浅克隆失败已本地复现，单处修复并云端回读成功，见[CI记录](n13-ci-triage.md)。

发行后执行 `node scripts/resource-successor.mjs online <本轮发行证据目录> ab9a0d45b27f7c85eef36e93cc92f81b4fe791ca47ddf3d4ee5f6bcb179b1f30 7`：**Verified online sequence 7, 8 cumulative resources across 7 signed catalogs**。匿名完整下载校验目录生产签名、顺序1至7、当前/历史目录与全部引用ZIP摘要大小、来源和资产绑定。安全公开证据见[n13-release](n13-release/)。

本轮未运行正式安卓设备或用户真机验收。浏览器原生桥模拟不代表大厅GameHubBridge/SAF实际持久写入确认。旧版基础视图从最新表达式继续，无法显示新版手动轨迹/原文扩展；完整v3与替换前归档仍保留，返回新版可恢复。升级前原始备份不覆盖，持久日志保护跨键写入，过时并发覆盖会拒绝。未宣称所有游戏迁移规范都已实现，EML及图灵Max仍列待办。

## 首次失败与安全续行

首轮隔离方案上传后未签名，随后纠正为完整v3+最新v2兼容视图。未引用资产637079010保留为历史过程证据，不是本次有效版本。

最终ZIP上传后首次fresh payload检查报Asset identity mismatch，目录尚为序列6，发行目录只有before/previous/uploaded三记录。只读重新捕获验证四资产编号、摘要、大小及旧目录身份后，使用发行器受限 `-ResumeAfterUploads`；生成且仅签名一次序列7、保留旧目录、上传新目录。首次发行后匿名检查遇到Public asset bytes mismatch；没有重复签名或写远端，核对公开资产后只读重新执行online检查成功。所有失败过程证据保留在 `D:/soft/.ci-tmp/game-hub-n13/evidence`。

## 审计结论

PASS：完整MIT/版权、固定来源及三文件白名单、重建与重复摘要、85/11检查、当前代码CI、生产信任根和全历史公网验签、历史保留、文档/既有治理文件。静态项目private:true不发布npm；资源沿用固定既有标签，不移动正式APK标签。BLOCKER：本次签名资源发行无剩余阻塞。待验范围：正式宿主设备和用户真机，本轮未替换APK。没有创建新的独立Lambda APK Release。
