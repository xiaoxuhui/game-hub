# N13 提交后独立审阅与批改记录

## A：需求/设计/存档规范 — CLOSED

- 实施提交：16d9955；独立视角：review_p0（2026-10-12）。
- 初审：OPEN，P2 设计误称公共 reusable workflow 代码不持调用仓凭据。GitHub 每作业自动有调用仓的 GITHUB_TOKEN，公共复用代码仍可访问 github.token。
- 批改提交：aa76ecdac7383c7091f59486c517b48609b44935，改为固定 SHA + 审阅信任边界、contents:read、禁 secrets:inherit、checkout persist-credentials:false；明确代码与令牌并未隔离。
- 复审：CLOSED，允许进入 B。八仓范围、私有报告边界、升级/回退区分、检查点恢复、自动发行/迁移仍列待办均符合需求；git diff --check 通过。
- 并行推进观测：A 后 Turing cea23ff→c304728、Lambda d308dca→bc3586d，工作树状态相同。bc1ff54 明确初始基线不改写，部署记录实际时点 SHA，旧探针不外推新版本。
- 后续提示：迁移实装必须设计 Android 资源指针与网页数据指针跨存储崩溃恢复状态机，当前规范仅为目标，不宣称实现。

官方依据：[token](https://docs.github.com/en/actions/concepts/security/github_token)、[复用](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)。

## B：通用检测器 — CLOSED

- 实施提交：450432e130976320de469fa4dff9c0a1a33381cb；独立视角review_p1（2026-10-12）。
- 首审无阻断，CLOSED：八仓白名单、default/master分支、正式tag真实commit解析、no-release与失败分离、分叉/截断失败关闭、重命名/HTML/依赖/CI不误归纯文档、异常文本脱敏、只读权限和私有报告边界通过。
- 实测10聚焦/74完整Node测试全部通过；真实8仓查询全部checked，只有7个公开报告进入仓库，私有第8报告留本机归档。
- C的8包装工作流和实际云端运行尚待验收，代码CLOSED不代表部署完成/自动发行。

## C：八仓部署 — OPEN → 批改 → CLOSED

- 八仓wrapper提交后review_p0部署前CLOSED：仅新增daily-maintenance.yml，错峰schedule/dispatch、固定450432e、只读权限/不传秘密、默认分支目标正确。
- 部署后首审OPEN：大厅验收证据dd2beeb未推送，远端还在f8ef2ba；按意见正常push，不强推，复审git ls-remote=dd2beebc2af26685ab1f2bd09123c6350721c1a1，工作树干净。
- 最终review_p0 CLOSED：8原始run-metadata为对应仓/分支/调用SHA、workflow_dispatch、completed/success；8 artifact-metadata的ID/run ID/size/digest与ZIP一致；ZIP内JSON与外部原件一致；8报告实现450432e、checked无errors、blocked未尝试发行。公开7仓14文件与原件同摘要，没有私有第8SHA/执行ID/摘要。原始完整私有文件保留。
- 首次schedule及候选/迁移/签名自动发行不属于本次已验范围。

## C2：06:00、双向存档与资源触发规则 — CLOSED

- 修改提交cc9be47→1a56030→0696f99；默认分支资源触发规则f8629f48d0a4fd1817cedd1b7452a222b0ffca86；部署证据b5b1a55d33f096ab4dc27c93ae3f91f29e3ea1ba。
- review_p0提交后部署前复审CLOSED：九cron0 22，七源各仅修改wrapper一行；读取固定450432e、只读令牌、不继承秘密；新版读旧档/旧版读新基础及扩展保护为真实reader验证目标，历史选择器/迁移/自动签名发行均PENDING。
- f8629追加复审CLOSED：默认分支资源/构建输入变化触发，不等待Release/tag/功能版本号；文档/测试不重发，未知依赖/新输入审查；递增contentCode/sequence，不发布不兼容候选；U10未发行提交到大厅安装仍为后续验收。
- 部署后CLOSED：八仓现时ls-remote/本地分支、九文件Git blob/cron复算一致。大厅b5是f862之后仅文档提交，工作流blob相同。公开七仓八行与私有原件对应行一致，无私有源revision。
- 只读查询尚未观测今天06:00 schedule事件，未以配置核验冒充实际定时执行；每日自动候选/签名发行仍PENDING。
