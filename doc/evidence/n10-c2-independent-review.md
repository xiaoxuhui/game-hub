# N10-C2 三游戏正式资源来源锁独立审阅

- 受审代码：`77fd2bce9f26dc44a9265f14135675c07f987627`；受审证据：`97aa94b87fc0083ba4506df6e7db221e64d48a00`。
- 结论：**CLOSED**，可进入 C3 的干净独立检出重复生产与实际兼容验收。本结论仅核对来源/版本/合同锁和受限审计入口；尚未证明新 ZIP 已生产、签名或发行。

## 独立核对

1. `resource-sources.lock.json` 将光学固定到正式 `v1.2.1` peeled commit `85163534ccae2b023928c877e002581a8f35f0cb`，图灵固定到正式 `v0.5.1` peeled commit `32eb3b95eb78eab703abe8e64214bd8dbbb939c7`。两 SHA 与 `n10-frozen-upgrade-tags.json` 相合且在原 Git 仓库可解析为 commit；`resource-releases.lock.json` 对应两者 `contentCode=2`，原 `light-baseline-v1` / `turing-baseline-v1` 合同保持。康威、EML 的身份/合同/code1不变。
2. `dynamic-sources.lock.json` 的 Lambda 使用已经 C1 审阅的大厅集成完整 SHA `64c8932af9a0b5cc886db25910b3923a16aa0677`、版本0.3.1/code2，合同 `lambda-diagram-game-dynamic-v1` 保持；冻结正式上游 SHA `a75d180193fbe7298709298102c8c6008d1353cd` 明列发行说明与 C1 证明。逐对象比较，memory-demo、abelian-sandpile、red-green-puzzle 三项除 JSON 排版外完全相同。
3. `git diff f3e0ed1 HEAD -- sources.lock.json` 为空；原 APK 四来源基线没有移动。`scripts/audit-storage.mjs` 无参数仍扫描 APK 固定目录，新增唯一允许的 `--resources` 扫描本检出的 `.build/resource-source-assets/games`，拒绝其它 CLI 参数及任意路径输入；它只是 C3 的检查入口，不把旧 APK 扫描误作新资源验收。
4. Node 首轮日志为46项/1失败，失败精确在合成 code1 基线错误地复制当前可演进生产 release 锁导致 `Resource release lock mismatch`。测试修为从不可移动 `sources.lock.json` 显式生成 code1 fixture；未修改生产 `resourceInputs` 的来源/新 contentCode/合同拒绝逻辑，也未删除注入失败、旧完整候选保留、源锁不匹配和未知文件拒绝断言。最终日志为46项/0失败/0跳过。两提交 `git show --check` 均无格式问题。

## 后续门禁

C3 仍须从精确干净提交执行普通严格来源生产，两个新鲜独立检出比对全部候选文件与 ZIP 字节，运行 `audit-storage.mjs --resources`，并实际验证光学/图灵浏览器玩法与存档兼容。当前未运行构建或发布；本审阅只新增本文件，未修改主目录、原游戏仓库或产品代码。
