# M6 下载资源文件桥切片独立审阅（首审）

- 受审提交：`7aa34ce30a8d198d593179d0f82c75030aa04fbd`，基线 `63b9c1d315097450e5d754aee48021bea695031b`。
- 审阅方式：只读检查提交差异、测试源码、独立检出中的构建产物及提交的日志/摘要；未构建主仓库，未读取原始存档或密钥。主仓库检查时工作树干净。测试源码在主仓库和独立检出的 SHA-256 均为 `96aa8c1ac1be70ce8e6a62cd393920279170cbedefda6e60508e20306c267d2b`。

## 阻塞 U42 完整闭环的问题

**P1（验收覆盖）：EML 导入是原值回灌，无法证明状态被恢复。** [`DownloadedDocumentBridgeTest.kt` 第 115–120 行](D:/soft/game-hub/android/app/src/androidTest/java/com/xiaoxuhui/gamehub/DownloadedDocumentBridgeTest.kt) 的 `when` 不修改 EML 的首次导出对象；第 143 行只看“导入成功”，第 151 行要求再导出与首次相等。若文件选择器和网页显示成功、但导入后的状态没有应用，原值仍可使这两个断言通过。生产 EML 页的校验允许 `inputXId`、`inputYId`、`selectedValueId` 在 `null` 与有效数值 ID 之间切换，适合构造有效且可观察的差异。建议修改自产 JSON 的选择字段，先断言它与初始状态不同；通过真实 DocumentsUI 选择后，同时断言页面选中状态/持久状态及再导出字段与输入相同。修改后重新运行四游戏完整用例并归档新日志。此项闭合前，四桥端到端状态恢复不可标记为全部通过。

## 已核对的通过范围与边界

- 测试明确要求 `downloadedDocuments=true`；四个游戏都通过真实签名 ZIP 夹具的 `GameResourceStore.install/openSession` 并断言 `contentCode=2`。调用 `MainActivity.openGamePrepared` 后使用生产 `ResourceRuntime`/WebView/桥；该测试刻意绕过启动缓存迁移门禁，文档已如实说明。
- Conway、Light、Turing 分别修改 `generation`、`id/title`、`input`，导入后观察页面或成功提示，并检查再导出字段。文件导入经过真实触屏、DocumentsUI 文档行、GET_CONTENT；导出经过系统创建文档与读取实际保存文件。未见用直接调用解析器替代系统文件链路。
- `m6-downloaded-document-row-device.txt` 记录 `OK (1 test)`、40.946 秒，四条设备 System.out 摘要与 `actual-outcomes.txt` 及报告表一致。日志保留了先前失败及修订顺序。报告正确声明 SHA 是解析后 `JSONObject.toString()` 的 UTF-8，而不是磁盘 JSON 原字节；CI 成功与发行证书设备测试的证据分开描述。
- 新增内容只有测试与证据/计划文档，无生产代码变更；提交中未发现原始存档、私钥或口令。当前结果不能替代生产公钥、线上签名资源、真机文件选择器或最终发行候选验证，文档已列出这些边界。

## 非阻塞建议

- 测试 `export()` 创建的 `*-before.json`/`*-after.json` 留在任务模拟器 Downloads；虽然文件名带 UUID、测试环境专用且未入库，后续可在 `finally` 精确删除本轮自产导出文件，以减少重复运行后的残留。不得广泛清理用户 Downloads。

**首审结论：** 有一项 P1 验收断言缺口，待批改提交及新设备运行复审后才能归档 U42 四游戏文件桥闭环。其余本切片证据与范围基本一致。

## 对批改提交 `404f509a38b3bbabfee1336f0425f90647ef2e4a` 的独立复审

- **P1 已闭合。** EML 输入在 `selectedValueId` 与 `inputXId` 两个字段上分别从首次导出值切换到 `null` 或初始数值 ID，且断言原值与输入值不同。真实文件选择后，测试检查网页 `.value-button[aria-pressed]`、`EMLPersistence.loadFromCache(localStorage)` 两字段和再导出两字段。静态生产页面的 `.value-item` 确有 `dataset.valueId`，子按钮确有对应 `aria-pressed`，选择器匹配页面结构。仅显示“导入成功”而不应用状态已无法通过。Conway/Turing 也增加首次值与输入值不同的断言。
- 最终设备日志 `m6-downloaded-document-final-device.txt` 为 `OK (1 test)`、57.091 秒；四条最终 System.out 摘要归档在 `final-outcomes.txt`。测试源码主仓库和独立检出 SHA-256 均为 `2a26ebb09f509bf0e5861461cd31b129a2e4bc3874b58c28116b5749c56bfbf9`，与 `final-source-hash.json` 一致。首审时的日志、旧仪器副本与最终副本已区分。
- 本次 UUID 前缀经固定正则约束，清理命令只指向该次 `before/after` 两个导出文件；自产 MediaStore URI 在 `finally` 删除。未见枚举或清理其他 Downloads 的操作。四原仓库只读状态重新完整枚举的报告已归档；本复审未修改其工作树。

**P2 文档精度待修：** `doc/evidence/m6-downloaded-document-20261009.md` 顶部“实际验证”仍称 `OK (1 test)`、40.946 秒为“最终”，表格仍列首版 Conway/EML/Light/Turing 摘要；后文又称最终为 57.091 秒并指向 `final-outcomes.txt`。首次结果是历史记录，尤其 EML 当时的状态恢复断言较弱。建议把顶部明确标为 `7aa34ce` 历史首轮及其边界，或用 `404f509` 最终数据替换；旧证据可以保留为批改过程。

**复审结论：** 原 P1 代码及设备验收缺口已闭合，可继续下一开发切片；在最终汇总或对外引用该报告前修正文档中的“最终”时态和表格归属。本切片仍不覆盖生产公钥在线资源、启动缓存迁移门禁、真机文件选择器或最终发行候选。

## 文档精度批改 `18d744e87471435bbcc5f81f87389538a856da99` 终审

只读检查该提交相对 `404f509` 的差异：仅修改 `doc/evidence/m6-downloaded-document-20261009.md` 三处文字。章节标题明确为 `7aa34ce` 历史首轮；40.946 秒明确是批改前结果及 EML 差异断言未闭环；表头明确旧四行摘要属于历史首轮，并指向后文 57.091 秒的最终设备日志与结果。首审所提 P2 时态和表格归属问题已闭合，未发现新增矛盾或阻塞。主仓库检查时工作树干净。

**最终结论：** 本下载资源文件桥切片的独立提交后审阅已闭环；可以继续计划中的离线实际重启验收。前述线上正式签名资源、真机选择器与发行候选边界仍保持未验证状态。
