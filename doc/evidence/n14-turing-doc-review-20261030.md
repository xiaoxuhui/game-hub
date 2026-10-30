# N14 图灵机更新文档独立审阅与批改记录

## 首轮审阅

- 日期：2026-10-30
- 被审提交：`896043e`（`docs: plan Turing resource update`）
- 结论：**OPEN，需要批改**
- 审阅视角：独立审阅代理；只读检查，未修改仓库文件。

### 审阅意见

1. 需求与设计允许用户为 Max 任意选择 1–1,000,000 的兼容步数。现有[存档格式与升级兼容规范](../存档格式与升级兼容规范.md)要求沿用明确记录的真实有限配置，禁止把任意数字伪装成 Max。无可信既有配置时必须阻止旧版镜像/兼容导出。
2. 冲突选择没有说明旧版改动的已知字段如何合并到完整档及如何保留未知字段。规范要求旧 writer 不得覆盖完整档。用户取消需保留双方原文；选择恢复完整档时要留存旧版修改原文。

### 批改记录

- 需求、验收和设计改为只接受存档已记录的有限步数；无该记录时完整 Max 仍可运行和导出，但兼容镜像不写回。
- 明确图灵机状态为单项目对象，没有多记录集合；冲突合并以稳定项目存储键为身份，只合并旧版已知字段并保留完整档未知字段。选择应用旧版字段后按其真实有限 `maxSteps` 退出 Max；选择恢复完整档时保留旧改动原文为历史；取消时两边原文不变。
- 批改提交之后的独立复审仍待执行；Stage A 未关闭，不能进入代码实现。

## 第二轮审阅

- 日期：2026-10-30
- 被审提交：`6dd1960`（`docs: clarify Turing save compatibility`）
- 结论：**OPEN，需要再次批改**
- 审阅视角：第二个独立审阅代理；只读检查，未修改仓库文件。

### 审阅意见

1. 设计目标仍残留“仅由用户显式选择有限兼容值”，与存档规范和需求中“只恢复已记录真实有限配置”矛盾。
2. 可信有限配置的数据来源及绑定规则未定义；只知道不得任意选择还不足以实现可验证判断。

### 批改记录

- 将设计目标改为只恢复可验证的既有限制；不存在可信记录时不写旧镜像。
- 明确接受来源：兼容扩展中相互绑定的 `legacyMaxSteps/fullText/baseText`；保护记录中经真实旧 reader 重新验证的 `current/fullText/baseText/mirrorAfterRaw/legacyMaxSteps`；或用户明确选择且同样绑定完整原文/基础视图的历史记录。裸 Max JSON、未绑定数值均拒绝作为有限配置。
- 同时确认图灵机 0.6.0/content3 已发布；任务范围修正为手动恢复和大厅导入/导出盘点，不再重复生产已包含 `ffca` 的旧内容。
- 修订后的全游戏需求与阶段计划记录于 N14 文档；第三轮独立复审仍待执行，CLOSED 之前不进入产品改动。

## 第三轮审阅

- 日期：2026-10-30
- 被审提交：`fe8bd48`（`docs: re-scope Turing restore and import audit`）
- 结论：**OPEN，需要批改**
- 审阅视角：独立审阅代理；只读检查，未修改仓库文件。

### 审阅意见

1. 绑定和读回校验只能证明兼容值与当前档案一致，不能证明该有限值来自 Max 切换前的真实有限项目。旧 C4 路径曾允许任意选择有限兼容上限，因此相关包装、保护记录和普通历史也可能只是保存了该选择。
2. 需要定义 Max 文件没有可信切换前有限原档时的行为。

### 批改记录

- 新增来源规则：必须是用户提供的无 Max 包装的有限原项目原档，或可验证的不可变切换前有限快照，并绑定到同一项目；当前匹配、旧 reader 读回或普通历史都不能独立建立来源真实性。
- 明确旧 C4 生成且无切换前证据的兼容值/镜像/历史一律来源不明，不得写入 Max 兼容视图。
- Max-only 文件继续可运行和完整导出；没有可信来源就不生成或改写旧版镜像。如旧镜像存在，保持字节不变；仅在显式导入并关联真实有限原档或恢复已验证快照后才可更新。
- 本次批改已提交；需再次独立复审通过后才进入实现阶段。

### 第四轮审阅

- 日期：2026-10-30
- 被审提交：`ddb9404`（`docs: require pre-Max provenance for compatibility`）
- 结论：**OPEN，需要批改**
- 审阅视角：另一独立审阅代理；只读检查，未修改仓库文件。

#### 审阅意见

1. “有序、不可变的切换前保护快照”没有定义如何证明早于首次 Max 切换。单靠时间戳/历史顺序可能来自旧 C4 任意兼容值路径。

#### 批改记录

- 规定快照必须由受信任的应用迁移流程生成，并由可校验的事件顺序记录绑定同一项目键、快照摘要、捕获事件和首次 Max 切换事件，明确捕获早于切换。
- 普通时间戳、历史顺序、文件名和可编辑元数据均不足以证明来源；无可校验顺序记录时一律来源不明。
- 该批改完成后仍需独立复审，再决定是否进入实现。

#### 第四轮批改

- 删除无法在旧数据上证明可信生成时间的快照来源，不尝试追认已有 Max 缓存/历史为切换前证据。
- 唯一来源调整为用户主动选择的基础有限原档：不含 Max 包装、步数为有限正整数；与当前 Max 项目比较时除 `maxSteps` 外的全部旧 reader 已知字段必须一致；文件原文和摘要保留，且须由用户明确关联。
- Max-only 或旧 C4 包装可继续运行并完整导出，但不新建/改写兼容镜像；已有镜像原字节保留。该规则不声称从文件元数据证明原档创建时间。
- 第五轮独立复审完成前，Stage A 仍未关闭。

#### 第五轮复审结论

- 被审提交：`a08b4be`（`docs: restrict Turing compatibility to explicit finite source`）
- 结论：**CLOSED**
- 审阅意见：独立审阅确认移除无法验证的快照路径后，有限配置来源规则可实现且与存档规范一致；保留 Max-only 原文、拒绝从旧 C4 包装推断兼容值的行为已说明。代价是缺少匹配有限原档时，新编辑不会生成新的旧版镜像，这是保证语义正确的明确取舍。
- Stage A 文档审阅现已关闭，可以开始全游戏盘点；不代表代码实现或产品验收已完成。

## Stage B 图灵机手动恢复代码复审

- 日期：2026-10-30
- 被审提交：`e7033cc`（`fix(turing): start fresh and preserve Max saves`）
- 结论：**CLOSED（实现逻辑）**
- 审阅视角：独立审阅代理；未修改仓库文件。

### 审阅意见

- 启动始终返回初始项目；冲突情况只读；首次有内容的保存先保护上次完整原文，再写新项目。
- 新 Max 项目使用 `legacyMaxSteps: null` 并保留旧镜像字节；旧 C4 包装仍可读但其历史兼容数字不会传递到新写入；有限项目由自身 `maxSteps` 生成镜像。
- 资源 `contentCode: 4` 与冻结运行文件摘要一致。31 项定向测试通过。
- 非阻断项：浏览器真实交互尚未验收；现有 UI 测试覆盖源集成与行为文本，不是浏览器运行验证。

### 验收记录

- 本地 `node --test tests/turing-preservation.test.mjs tests/turing-compatibility.test.mjs tests/turing-ui-integration.test.mjs tests/turing-resource-activation.test.mjs`：31/31 通过。
- 锁定 Turing 来源在独立检出目录完成适配和 Vite 资源构建；finalizeTuringResource 来源与输出校验通过。
- 浏览器 UI 运行检查受安全策略限制：本地服务 URL 超时，`file:` 页面打开被浏览器策略拒绝。未尝试绕过策略；需要后续在允许的本地浏览器工作流中验证。

## Stage C1 红绿变换配置文件复审

- 日期：2026-10-30
- 功能提交：`4667743`（`feat(red-green): import and export puzzle config`）
- 独立审阅结论：CLOSED；未发现阻断性正确性或回归问题。
- 审阅证据：导入先验证文件大小、JSON、游戏 ID、schema 与数量范围，再更新输入并重新生成流程；无效文件/取消不会替换有效状态。导出同样有界且带游戏标识。
- 定向验证：`node --test tests/red-green-puzzle.test.mjs`，5/5 通过；来源证明验证通过。
- 非阻断批改：来源证明的 `changes` 说明未提及新文件导入/导出。

### 批改与复审

- 批改提交：`6caae0b`（`docs(red-green): clarify project file provenance`），补充配置 JSON 导入/导出说明。
- 独立复审结论：CLOSED；来源脚本只读读取固定 GitHub origin 的固定 SHA Git 对象（`git show`），不切换或修改原游戏仓库；来源证明哈希维持有效。
- Stage C1 已完成。Stage C2（兰顿蚂蚁与两款 TurboWarp 项目文件读写适配）尚未开始。

## Stage C2 三款资源文件导入导出复审

- 功能提交：`1e486a9`（`feat(resources): add file import export to three games`）。
- 首轮独立审阅：**OPEN**。兰顿事件处理器无条件显示成功，覆盖了上游同步保存失败提示。
- 批改提交：`61b9dea`（`fix(resources): report Langton save failures accurately`）；移除包装器的成功提示覆盖，由应用保存结果决定状态。
- 第二轮独立审阅：兰顿问题关闭；另发现 TurboWarp 导出未要求空闲状态，也未校验将下载的数据，逻辑连线过程中可能导出无法再导入的文件。
- 批改提交：`1ea3b1e`（`fix(resources): validate TurboWarp exports`）；导出前检查 ready/locked/idle，并使用 `codec.validate` 校验同一个快照。
- 最终独立审阅：**CLOSED**；确认兰顿失败提示不再覆盖，TurboWarp 导出与导入边界对称。
- 测试：定向适配 4/4、来源锁更新 2/2 通过。当前最终代码的全仓重跑状态另记发行记录；Windows 环境有 Git/MSYS clone 权限和 symlink 权限间歇限制。
- 固定来源实证：从 `dynamic-sources.lock.json` 锁定的 Git blob 直接读取红绿变换 `6caae0b1`、兰顿蚂蚁 `20e30825`、TurboWarp 神经网络 `63943ff2`、TurboWarp 逻辑实验室 `04089708`，四项均执行 pack + verifyPackedDynamic 并通过；源仓库只读。
- 复审未覆盖项：真实桌面/手机浏览器交互；本地浏览器安全策略之前阻断，未尝试绕过，保留人工验收。

## Stage D 离线 Turing 静态资源构建审阅与复打记录

- 日期：2026-10-30
- 被审提交：`9a4ac33`（`fix(resources): build Turing from lock-matched offline cache`）。
- 独立审阅：**CLOSED，无阻断问题**。审阅者确认静态源缓存核对固定 origin、完整 SHA 与干净状态，并在独立 staging checkout 中构建，不切换或改动原游戏仓库；离线工具按 `pnpm-lock.yaml` 版本核对，Vite 生产构建成功。
- 非阻断限制：缓存依赖目前只比较包版本，未逐个校验 pnpm 完整性哈希；离线构建跳过 TypeScript 类型检查。后续可补充缓存完整性验证，并在可正常安装依赖的环境补跑 typecheck。
- Turing 资源构建：来源仓库 `xiaoxuhui/turing-machine-simulator` 固定 SHA `ec1b7a0a6b7504c0adb9e15688031be0c7ff0ff3`，版本 `0.6.0`，`contentCode: 4`；入口 `index.html`，同时包含 `campaign.html` 与 route worker。ZIP `game-turing-4-a3e00a02f35d.zip`，175,997 字节，SHA-256 `a3e00a02f35d81891a767326c1aa426edb4daff04d95fe2420a6baefa7139528`。
- 资源清单：四个静态资源包完整校验通过；bundle manifest SHA-256 `6eabedd454b943c9c8b928e48e6567c40f403ff5d24ed9327a58bcfd60e4e840`，绑定构建提交 `9a4ac33f95455afc27ea2ccc6e0b7d72dd286dc0`。
- 可复现性：两次完整静态资源构建逐文件比较，六个候选工件完全一致。
- 测试：`node --test tests/bundle.test.mjs` 6/6 通过。完整 `node --test` 共 243 项，242 通过；唯一失败为 `tests/resource-bundle.test.mjs` 创建负向测试用符号链接时被 Windows 环境拒绝（`EPERM`），非断言或功能回归。
- 未完成事项：该记录确认资源候选已构建，并不表示已推送到 `main`、已发布到 GitHub Release 或已通过真机/浏览器验收；这些状态须以后续线上证据确认。

### 归档记录复核

- 审阅提交：`911e7f0`（`docs: archive Turing resource build review`）。
- 独立复核结论：**CLOSED，无需批改**。审阅者核对了 Turing ZIP 大小、SHA-256、版本/contentCode/source SHA、Windows 符号链接测试失败原因，以及两项离线依赖校验限制；与归档内容一致。
