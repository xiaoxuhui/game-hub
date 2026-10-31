# N20 资源候选阶段独立审阅与批改记录

- Reviewed commit: `d54b51d7ddab0ae59fe0668ded765a0e69bd7b83`
- Review result: **OPEN，证据可追溯性需补齐；未允许进入签名发行。**

## 审阅意见

- 四个 ZIP 摘要与线上当前 asset 相符；EML 候选仅提升到 contentCode 3。
- 已签目录是 sequence 6，签名 SHA 为 `1c144d7f87f8d26c5cdafe2d40c5c5843b3288f366ed13c183c3df3290f29d20`；sequence 7 匿名预检逻辑与候选正确。
- 上游巡检覆盖 14 个 consumer 且无错误；Lambda、Traffic、Hex 延期范围与巡检一致。
- 阻断意见：实施计划未链接 C 阶段证据；缺少两次构建各自留存摘要；sequence 7 预检输出未存档。

## 批改记录

- 新增 `n20-eml-resource-builds.json`：分别归档两次构建时间、producer commit、源锁摘要、80 文件 manifest 摘要、unsigned manifest 摘要及每个 ZIP 摘要；`identical: true` 由生成脚本比较验证。
- 新增 `n20-eml-v1-preflight.json`：归档 sequence 6/7、当前签名目录 SHA、前快照摘要和实际预检输出。
- 新增 `n20-eml-upstream-watch.json`：完整保留当天只读巡检报告。
- 更新 `N20-EML资源兼容更新实施计划.md`，把 C 阶段证据文件逐一链接。
- 修订后的提交将再次由独立视角复审；C 未 CLOSED 前不执行签名、上传或切换 main。


## 第二轮复审意见与批改

- 复审 `1ca212c` 结论 OPEN：候选索引仍记录旧构建 `b8ddf0e` 与旧 manifest SHA `b7d1de…`，与双构建报告的 `d54b51d` / `5428fc…` 不一致。
- 已核对当前候选 `candidate.json`、`bundle-manifest.json` 和两次构建记录，三者均为 producer `d54b51d7ddab0ae59fe0668ded765a0e69bd7b83`、manifest SHA-256 `5428fc30b3546bad0d3bc4767d410cf3a13630895588117424da431951b0c57a`。
- 已将 `n20-eml-resource-candidate.md` 索引更新到该提交和摘要；C 状态回退至 IN_PROGRESS，等待复审 CLOSED。
