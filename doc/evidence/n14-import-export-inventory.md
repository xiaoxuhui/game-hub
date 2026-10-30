# N14 在册游戏导入、导出与启动恢复盘点

- 日期：2026-10-30
- 范围：`resource-sources.lock.json` 与 `dynamic-sources.lock.json` 中全部 15 个 ID。
- 方式：逐项检查锁定适配资源、本地可读上游或应用源码的入口控件、事件处理及持久化路径；本表反映当前版本，不代表 N14 修复已实现。
- 结论：11 个游戏已有相应 JSON/项目文件入口；4 个有用户数据的游戏缺少完整文件往返入口；图灵机已有入口但自动恢复与用户偏好冲突。

| ID / 游戏 | 用户数据与本地持久化 | 当前文件导入 / 导出 | 启动恢复 | 结论与证据 |
|---|---|---|---|---|
| `conway` 康威生命游戏 | 世界、规则、视图、图案及用户记录写入本地存储 | 有：世界/视图、图案、逻辑函数和记录均有文件入口 | 自动载入本机状态 | 已具备。`D:/soft/conway-life-game/scripts/app.js`（导入/导出处理）；源清单列出的 `scripts/file-backup.js`。 |
| `eml` EML 计算台 | 计算列表和缓存状态写入本地存储 | 有：JSON 列表保存/导出和文件导入，导入失败不替换现有列表；最大 5 MiB | 自动读本机状态 | 已具备。`D:/soft/EML/dist/eml-workbench.html`（`#saveButton`、`#importButton`、`restoreState`、`Persistence.deserialize`）。 |
| `light` 光学游戏 | 用户关卡布局保存在本机；不保存跨设备共享文件 | 有：关卡 JSON 导入/导出；导入整份校验，ID 冲突时不覆盖定义 | 自动载入本机布局 | 已具备关卡级 I/O。`D:/soft/light_game/index.html`（`#btn-export`、`#btn-import`）；`D:/soft/light_game/scripts/storage.js`（完整校验、导入、导出）。 |
| `turing` 图灵机实验台 | 完整项目、旧版镜像和保护历史写入浏览器缓存 | 有：项目导入/导出及保护记录/备份导出和显式恢复选择 | **自动把缓存项目应用到页面** | 需修复启动：每次打开默认新场景，旧档只在主动导入或恢复后载入。`scripts/turing-compatibility-ui.mjs`（`restoreStartup`、`importFile`）；`scripts/turing-preservation.mjs`。 |
| `memory-demo` 配对练习 | 当前进度自动写入本地存储 | 有：JSON 导入/导出；文件最大 65,536 字节并验证 schema | 自动续上进度 | 已具备。`examples/memory-demo/app.js`（自动加载、导入导出和大小校验）。 |
| `abelian-sandpile` 阿贝尔沙滩 | 沙盘、教学进度写入本地存储 | 有：JSON 导入/导出；最大 2 MiB；校验后应用 | 自动恢复且暂停 | 已具备。`examples/abelian-sandpile/src/app.js`（`#export`、`#import` 和 `P.decode`）。 |
| `lambda-diagram-game` Lambda 线路实验室 | 函数库、归约状态、关卡进度和检查点保存在本机 | 有：存档 JSON 导入/导出、完整原始存储恢复导出和备份 | 默认新会话；手动“恢复已保存状态” | 已具备。`examples/lambda-diagram-game/lambda-lab.html`（`#restore-state`、`#export-state`、`#import-state`；`prepareManualRestore`）。 |
| `red-green-puzzle` 红绿变换 | 保存单一数量参数；按参数重新生成确定性流程 | **缺少项目 JSON 导入/导出**；可复制生成的文本结果，但不能用项目文件往返设置 | 自动恢复数量参数并立即生成 | 需补参数配置文件往返；结果保持由 schema 配置重新生成。`examples/red-green-puzzle/app.js`、`core.js`、`index.html`。 |
| `mini-scratch` 灵感积木 | 完整作品和版本迁移备份写入本机 | 有：作品 JSON 导入/导出；4 MiB 预算并先完整验证 | 自动载入项目 | 已具备。`D:/soft/mini-scratch/dist/index.html`、`src/app.js`、`src/project.js`。 |
| `logic-circuit` 逻辑工坊 | 电路布局、自定义门和撤销历史保存在本机 | 有：完整 JSON 文本/文件导入导出，并有“全部删除并导出”备份路径 | 自动载入本机布局 | 已具备。`D:/soft/logic-circuit/dist/index.html`、`src/app.js`。 |
| `traffic-planner` 路流·交通规划 | 道路/地铁方案自动保存在本机 | 有：方案 JSON 导入/导出；导入限制 1 MiB 并校验 | 按模式自动载入方案 | 已具备。`D:/soft/traffic-planner/dist/index.html`、`src/app.js`。 |
| `hex-cell-lab` 元胞实验室 | 元胞棋盘、规则和撤销历史保存在本机 | 有：完整 JSON 项目导入/导出，2 MiB 上限 | 自动载入本机项目 | 已具备。`examples/hex-cell-lab/index.html`、`src/app.js`。 |
| `langtons-ant` 兰顿蚂蚁 | 画布、蚂蚁状态、运行设置自动保存在本机；恢复时暂停 | **没有项目文件导入/导出**；只有重置、随机填充、清空等控制 | 自动恢复本机状态并暂停 | 需补完整 JSON 往返并确保无效/取消导入不改当前画布。`D:/soft/langtons-ant/dist/index.html`、`src/app.js`、`src/storage.js`。 |
| `turbowarp-neural-network` 神经网络实验室 | 训练样本、轮次、权重和缩放值自动存储 | **没有文件导入/导出**；有从原始作品重新开始及恢复副本机制 | 自动恢复训练变量 | 需补 schema 验证的 JSON 往返，保留当前数据直至候选完整验证。`D:/soft/turbowarp-neural-network/web-dist/index.html`（状态包装器 299–389 行）。 |
| `turbowarp-logic-lab` 逻辑小实验室 | NAND 电路、工具与撤销状态自动存储 | **没有文件导入/导出**；有从原始作品重新开始及恢复副本机制 | 自动恢复电路变量 | 需补 schema 验证的 JSON 往返，避免导入中途产生半成品电路。`D:/soft/turbowarp-logic-lab/web-dist/index.html`（状态包装器 299–389 行）。 |

## 实施顺序与安全边界

1. 图灵机：移除启动时自动应用缓存；启动只检查并保护旧原文，显示默认初始项目。首次实际编辑前保存旧完整原文到保护历史。主动导入仍通过现有入口；旧存档显式恢复只通过现有备份管理入口。
2. 红绿变换：导出/导入 `{schemaVersion:1, game:"red-green-puzzle", size}`，只接受 1–10 整数。导入先完整校验，再更新数量并重新生成；取消、无效文件和超限文件不改当前有效流程。
3. 兰顿蚂蚁：导出/导入有版本号的画布、蚂蚁位置/朝向、步数、速度、网格和跟随设置；沿用现有持久化验证器/容量界限。导入候选完整验证后才暂停并替换，导入后保持暂停。
4. TurboWarp 两个项目：复用现有 `TurboHallState` schema 校验和 `apply` 路径，增加文件导出/导入控件；读取前限长，候选验证成功且舞台空闲后再应用。保留本地备份副本；候选错误、取消或运行中不改变舞台/存档。
5. 测试覆盖每个入口的成功往返、无效文件、越界/超限文件和取消保护；核对之前的本机存档、自动恢复路径及现有重置功能没有被导入部分内容覆盖。

所有适配源仓库继续只读，资源修改在大厅独立检出目录中进行。具体 schema、容量和移动设备交互要由实现前的 targeted tests/browser checks 确认；上表结论来自源代码读查，不是运行时验证。
