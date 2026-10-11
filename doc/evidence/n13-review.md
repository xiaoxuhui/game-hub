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
