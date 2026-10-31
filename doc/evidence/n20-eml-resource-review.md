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


## 术语批改

- `bf18c99` 复审建议将 `Candidate manifest` 改称资源构建清单，避免与 `games.unsigned.json` 候选清单混淆。
- 已在 `n20-eml-resource-candidate.md` 将其改为“Staged resource bundle manifest SHA-256”，该摘要指 `bundle-manifest.json`。
- 复审仅明确 CLOSED 证据身份修订，未明确批准 C 阶段本身；C 状态暂保持 IN_PROGRESS，待独立审阅确认 U06 门禁结论。


## C 阶段 U06 复审结论

- 独立复审确认 C 阶段 **VERIFIED**：双构建一致；与 sequence 6 线上目录相比，仅 EML contentCode 从 2 升至 3，其他三款 ZIP 摘要及编号不变；40 项 proof、资源闭包、MIT/KaTeX 许可与测试均通过。
- D 阶段注意：后续归档提交使 d54 候选绑定过期。正式发行应在最终 producer commit 的干净独立检出中重新构建、校验并做最新线上预检。


## D 阶段发行结果

- 最终生产检出 `c1c17f3` 发布资源目录 sequence 7；只增加 EML-3 ZIP 并激活新签名目录。
- 失败的两次预检没有读取凭据或写远端；第三次预检通过，签名、上传、历史目录归档和公网全历史验证成功。
- 详细 release ID、asset IDs、摘要与验证文件见 `doc/evidence/n20-eml-v1-publication.md` 及关联 JSON。
- D 阶段已完成；E 阶段独立最终复核待执行。


## E 阶段最终独立复核

- Reviewed commit: `3a0dce3d709e6c9d73798856b84f57707641e685`
- Result: **CLOSED，无阻断项**。
- 审阅者从当前 GitHub release 重新下载并核验：sequence 7 catalog asset `694073326`，SHA-256 `dfcc326c7db3892b472aca6fae145f07ebd20a90f26522270ef46dc51ff547bc`，签名有效；EML-3 asset `694072897` 的大小和 SHA-256 与记录一致。
- sequence 6 历史资产 `676509558` 存在；下载核验的历史签名目录覆盖 sequence 1–6，与当前 sequence 7 构成完整历史链；11 个唯一 ZIP 的 ID、字节数和摘要均与归档结果一致。
- 生产提交 `c1c17f3` 是 main `3a0dce3` 的祖先；发行归档提交仅更新文档/证据，无 APK 发布。测试 237/237、资源 80 文件校验通过。
