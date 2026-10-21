# 跨项目架构评审：是否值得抽取通用 mini-app 框架

- 日期：2026-10-20
- 修订：2026-10-21 —— 追加 §11「决策建议」；修正 §7.5 分发首选（由私有 registry 改为 vendored tarball，与"离线优先"原则对齐）；文档由工作区迁入本仓库 `doc/`
- 范围：本地克隆的 9 个仓库（`game-hub` + 8 个游戏：conway-life-game、EML、light_game、turing-machine-simulator、abelian-sandpile、lambda-diagram-game、mini-scratch、logic-circuit）
- 性质：**只评审、只出文档，未修改任何代码**
- 评审方法：读取各仓库 README/设计文档/存档规范，统计文件结构、代码行数，做跨仓库同名文件哈希比对、`MainActivity.kt` 归一化相似度计算、脚手架行数占比统计

---

## 0. 结论摘要（先行）

1. **确实存在大量"架构性重复"，但重复的是脚手架，不是玩法。** 8 个游戏的引擎、渲染、领域规则各不相同且高度耦合于自身玩法；真正重复的是 Android 外壳、资源同步脚本、构建/服务脚本、存储适配层、导出桥、Toast/Dialog/撤销/渲染循环等**基础设施**。
2. **Android 侧的"统一框架"其实已经存在** —— 就在 game-hub 里（`MainActivity` 1133 行 + `AssetAccessPolicy`/`FileNamePolicy`/`GameContentResolver`/`DocumentExportFlow`/`ExportTaskState`/`GameResourceStore`/`DynamicGamePolicy` 等策略类，并用 `bridgeName(gameId)` 把 4 个旧游戏 + 动态游戏的桥名映射到同一份 `SaveBridge.saveFile`）。**不需要再造一个 Android 框架，需要的是收敛宿主。**
3. **值得抽，但必须窄化**：只抽"Web 侧脚手架 + 构建工具链 + 测试门禁"，明确**不抽**引擎/渲染器/领域校验/关卡数据/UI 排版。建议红线：核心包 ≤ ~1200 行、零运行时依赖、不提供全局单例。
4. **收益对"小游戏"最大**：脚手架占代码比例 —— lambda 约 45%、abelian 约 38%、conway 约 9%、mini-scratch 约 9%。游戏越小，越是被样板代码拖累；这直接决定"新做一个小游戏"的成本。
5. **最大的隐性成本不是行数，而是修复不传播**：Android 15 edge-to-edge、MediaStore 导出、桥接口、存档迁移这类修复，现在要在 6 个 `android/` 里各改一遍，或干脆不改 —— abelian/lambda 的 `MainActivity.kt` 已与主流版本分叉到 29.7% / 59.0%，就是漂移的证据。

**推荐优先级**：构建/同步/服务脚本（P0，零运行时风险）→ Android 宿主收敛（P1，重复量最大，但含产品决策）→ 存储适配层（P2，规范要求最强、风险最高）→ UI 原语（P3，opt-in）。

---

## 1. 评审范围与口径

| 项 | 说明 |
|---|---|
| 纳入 | conway-life-game、EML、light_game、turing-machine-simulator、abelian-sandpile、lambda-diagram-game、mini-scratch、logic-circuit、game-hub |
| 未纳入 | `FirstProject`（非本系列）；各仓库 `node_modules`、`dist`、`build`、`.build`、Android `assets` 等生成物 |
| 行数口径 | 按文件换行符计数（`\n`+1），不含空目录；不含 lock 文件与二进制 |
| 重复度口径 | ① 字节级：同内容 md5 相同；② 模板级：同路径文件 + 归一化（去包名/字符串/空白）后的文本相似度；③ 概念级：职责相同但实现不同 |

---

## 2. 各项目架构概览

| 项目 | 定位 | JS/TS 行 | HTML/CSS 行 | 模块方式 | 构建方式 | android/ |
|---|---|---|---|---|---|---|
| conway-life-game | 生命游戏 + 逻辑电路生成 | 9,596 | 415 / 1,031 | 经典脚本 ×14（defer） | 无构建，静态复制 | 37 文件 / 270 行 KT |
| EML | EML 计算台（表达式/推导） | 6,440 | 122 / 371 | 经典脚本（IIFE，UMD 包装） | `build.mjs` 单文件内联 | 37 / 270 |
| light_game | 光学解谜 | 6,410 | 68 / 489 | 经典脚本 ×6 | 无构建，静态复制 | 37 / 243 |
| turing-machine-simulator | 图灵机 + campaign | 3,432 (TS) | 81 / 292 | ESM + TS | Vite（`build:android --base=./`） | 37 / 280 |
| abelian-sandpile | 阿贝尔沙堆 | 1,502 | 34 / 7 | 经典脚本 ×10 | `build.mjs`（复制 + 注入） | 39 / 267 |
| lambda-diagram-game | Lambda 图示/归约 | 1,007 | 82 / 31 | 经典脚本 ×10 | `build.mjs` 单文件内联 | 37 / 161 |
| mini-scratch | 图形化积木 | 948 | 75 / 43 | ESM | `build.mjs`（ESM 内联打包） | 无 |
| logic-circuit | 逻辑电路 | 1,151 | 43 / 49 | 经典脚本 ×3（defer） | `build.cjs`（复制） | 无 |
| game-hub | 大厅宿主 + 资源分发 | 1,678 JS + 3,068 MJS | 1,293 / 10 | Node 脚本 + Android | `bundle.mjs` + Gradle | 74 KT / 8,655 行 |

> 8 个游戏的 Web 代码合计约 **4 万行**；game-hub 的 Kotlin 约 **8.6k 行**（含大量 androidTest）。

---

## 3. 共性：所有项目共享同一套"骨架"

逐个读代码后，8 个游戏的**分层与生命周期高度同构**，可归纳为同一条主线：

```
index.html（单页，viewport + 工具栏 + 画布/面板）
   └─ 状态（一份可序列化的 world/project/state）
        ├─ restore/persist  ← 存储层（schema + version + migrate + validate）
        ├─ render           ← 渲染器（canvas 或 DOM）
        ├─ bind/事件         ← 指针/键盘/工具栏/对话框
        ├─ run/frame        ← requestAnimationFrame 循环 + 速度节奏
        └─ export/import    ← JSON 序列化 + 下载桥（Blob 拦截或原生 saveFile）
```

**证据（同一骨架的具体落点）：**

| 共性职责 | conway | light | EML | abelian | lambda | mini-scratch | logic-circuit | turing |
|---|---|---|---|---|---|---|---|---|
| 入口引导 | `scripts/app.js` (1115) | `scripts/app.js` (1066) | `src/app.js` (1019) | `src/app.js` (76) | `src/app.js` (254) | `src/app.js` | `src/app.js` | `src/main.ts` |
| 渲染 | `renderer.js` | `renderer.js` | DOM 渲染 | `renderer.js` | `diagram-view.js` | `sprites.js` | canvas | `route-view.ts` |
| 存储 | `file-backup.js` | `storage.js` (481) | `persistence.js` (225) | `storage/persistence.js` (88) | `snapshot.js` (167) | `persistence.js` | localStorage 直用 | `project-codec.ts` (135) |
| 导出/桥 | Blob 拦截 | `downloadFile()` 探测 `LightAndroid` | Blob 拦截 | `AbelianAndroid` | `LambdaAndroid` | 无 | 无 | Blob 拦截 |
| 循环/节奏 | `runAnimationFrame` | `frame/start/stop` | — | — | — | `runtime.js` | rAF | `ExecutionScheduler` |
| 提示/对话框 | `showToast`/`dialog` | `showOverlay`/`addAction` | `showNotice` | 原生提示 | 原生提示 | `notice` | dialog | `renderExecutionLog` |
| 撤销/历史 | `undoClear` | 完整 undo/redo 栈 | `undoLastChange` | 无 | 快照 | 无 | 无 | campaign 进度 |

> 三个大 `app.js`（conway/light/EML）都是**单 IIFE 巨型闭包**，内部段落顺序也几乎一致：状态 → 读档/存档 → render → 绑定 → 循环 → 提示 → 导入导出 → 工具栏/HUD。

---

## 4. 重复度量化（硬证据）

### 4.1 字节级完全相同的跨仓库文件

共 6 组，独立行数 182，按"仓库数×行数"计约 952 行，**可消除冗余约 770 行**：

| 文件 | 出现在 | 行数 | 说明 |
|---|---|---|---|
| `scripts/sync-android-assets.mjs` | 5 个仓库（conway/light/turing/abelian/lambda） | 139 | md5 `97c6c40…` **完全一致**；EML 另有一个 71 行变体 |
| `android/app/src/main/res/xml/data_extraction_rules.xml` | 6 | 15 | 完全一致 |
| `android/app/src/main/res/xml/backup_rules.xml` | 6 | 8 | 完全一致 |
| `android/app/src/main/res/mipmap-anydpi-v33/ic_launcher.xml` | 6 | 7 | 完全一致 |
| `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` | 6 | 6 | 完全一致 |
| `android/build.gradle.kts` | 6 | 6 | 完全一致 |

> 字节级重复之所以"只有"770 行，是因为 `MainActivity.kt` 改过包名/文案/导出默认文件名——下面用模板级度量补上。

### 4.2 模板级：Android 外壳是同一份模板复制 6 次

| 指标 | 结果 |
|---|---|
| `android/` 目录文件数 | 6 个仓库均为 **37**（abelian 39） |
| 与 conway 同路径文件 | EML/light/turing/lambda **36/37**，abelian 35/39 |
| `MainActivity.kt` 归一化相似度（vs conway） | **EML 98.6%**、**turing 98.7%**、**light 91.3%**、lambda 59.0%、abelian 29.7% |
| Android 文本行合计（kt/kts/xml/pro/properties/gradlew/md） | 817 + 761 + 868 + 817 + 642 + 570 = **4,475 行** |
| 每个仓库附带的二进制 | 13 张启动图标 PNG + keystore + gradle-wrapper.jar，×6 |
| `tests/android-shell.test.*` | turing 247 / abelian 284 / lambda 255 行，各自重写，验证同一批契约（asset 路径、manifest、backup 规则） |

`MainActivity.kt` 的共享结构（直接读码确认）：`ComponentActivity` + `WebViewAssetLoader`（保留域名 `appassets.androidplatform.net`）+ edge-to-edge insets + 返回键回落 + `onShowFileChooser` + JS 桥导出到系统下载目录 + `sanitizeName`。**只有包名、`ASSET_FILE`、桥名、默认导出名不同。**

### 4.3 概念级：构建/服务/同步/存储

| 类别 | 重复情况 |
|---|---|
| 资源同步 | 5 份 139 行**完全相同** + EML 1 份 71 行；`sync:android`/`check:android` 命令出现在 6 个仓库 |
| 静态服务 | 8 个仓库各写一份 serve（5–72 行），语义都是"零依赖静态服务器 + 端口 + 目录回退" |
| 构建 | 5 个仓库各写一份 build（5–43 行），策略分 4 类：静态复制 / 单文件内联 / ESM 内联 / Vite |
| 存储适配 | EML 225 / light 481 / abelian 88 / turing 135 / lambda 167 行，均实现 `schema+version+migrate+validate+serialize+load/save+大小上限`；light 还自建了"localStorage 不可用 → 内存后端"与可注入 backend |
| 导出桥 | 至少 4 种桥名与签名：`saveFile(name,content)`、`saveFile(name,content,mime)`、`saveFileConfirmed(...): Boolean`、`AbelianAndroid.exportResult(msg,ok)` |
| 治理文档 | `CONTRIBUTING` 5 份（13–59 行，各改各的）；`CODE_OF_CONDUCT` 4 份（conway 与 light **字节相同**，其余漂移）；`SECURITY` 4 份；`CODE_REVIEW` 2 份；`CHANGELOG` 8 份各不相同 |
| CI | 各仓库 3–4 个 workflow（mini/logic 各 1，game-hub 9），流程高度相似但互不复用 |

### 4.4 脚手架占比（关键结论）

| 仓库 | 脚手架行（android文本+同步+serve+build+存储） | 业务代码行（JS/TS+HTML+CSS） | 脚手架占比 |
|---|---|---|---|
| lambda-diagram-game | ~908 | ~1,120 | **≈45%** |
| abelian-sandpile | ~931 | ~1,543 | **≈38%** |
| turing-machine-simulator | ~1,092 | ~3,805 | ≈22% |
| conway-life-game | ~1,015 | ~11,042 | ≈9% |
| mini-scratch | ~96 | ~1,066 | ≈9% |
| EML | ~1,101 | ~6,933 | ≈14% |
| light_game | ~1,904* | ~6,967 | ≈21% |
| logic-circuit | ~11 | ~1,243 | ≈1% |

\* light 的存储模块统计包含了 `snapshot/save` 命名相关文件，略偏高。

> **游戏越小，样板代码占比越高。** lambda 近一半代码是脚手架，而它真正"玩"的部分只有 1k 行左右。这意味着"再做一个同量级小游戏"时，超过一半的工作是在**复制上一版的骨架**。

---

## 5. 差异：这些是"玩法"，不能抽

评审中逐项确认了**不可抽象**的部分，抽取时必须显式排除，否则会得到泄漏抽象（leaky abstraction）：

| 维度 | 具体表现 | 为什么不能抽 |
|---|---|---|
| 领域引擎 | 生命规则、沙堆 Abelian、光学传播、图灵机 `Tape/TuringMachine`、Lambda 归约、EML 求值/组合、Scratch VM、逻辑门仿真 | 算法与不变量就是产品本身，耦合深、复用概率低 |
| 渲染器 | 网格/单元格/纸带/节点/连线的具体绘制 | 与领域强绑定，抽象只会退化成"传一堆回调" |
| 领域校验 | `validateState`、`validateLevel`、`proof.minimum`、`hasDependencyCycle` | 校验规则是领域知识，各项目完全不同 |
| 关卡/预设/教学内容 | `levels.js`、`presets.js`、`campaign.ts`、`teaching.js` | 数据资产，不是代码骨架 |
| UI 排版与手势 | 工具栏布局、拖拽、缩放、点击容差 | 交互是体验差异点（例如 lambda 有 20px 点击容差） |
| 模块系统 | 5 个经典脚本 / 2 个 ESM / 1 个 TS+Vite | 强行统一会推翻现有构建与加载方式，迁移成本极高 |

**桥接口的差异尤其需要注意**：`存档格式与升级兼容规范` 明确写道"四个现有外壳的能力相近，但导出接口并不完全相同……适配层需保留这些网页可见的接口名称与返回约定"。这说明**框架必须兼容多种桥签名**，而不是规定一种。

---

## 6. 关键判断：Android 宿主已经统一，缺的是"收敛"而非"新建"

读 game-hub 的 Android 代码可确认，它已经实现了完整的宿主框架：

- `MainActivity.kt`（1133 行）：大厅 UI、WebView 容器、返回导航、文件选择、导出流程、资源会话
- 策略类已抽出且可单测：`AssetAccessPolicy`（同源与资源白名单）、`FileNamePolicy`（文件名清洗 + MIME）、`GameContentResolver`（按注册路径放行）、`DocumentExportFlow` + `ExportTaskState`（导出事务/并发）、`GameResourceStore`（资源版本与安装）、`DynamicGamePolicy`（动态游戏 ID 校验）、`ResourceArchive`/`ResourceCacheGuard`（资源校验与缓存）、`ReleaseClient`/`ApkUpdateManager`/`UpdateCoordinator`（检查更新）
- **桥适配**：`bridgeName(gameId)` → `conway→ConwayAndroid`、`eml→EMLAndroid`、`light→LightAndroid`、`turing→TuringAndroid`、动态→`GameHubBridge`；统一 `SaveBridge.saveFile(name,content): Boolean` + 统一注入 Blob 拦截脚本

结论：**Android 端的"通用 mini-app 框架"已经存在，并且是 game-hub 的核心价值。** 6 套 `android/` 是这套框架成熟前的历史副本，继续维护它们只会持续制造漂移（abelian 29.7%、lambda 59.0% 就是已发生的漂移）。

---

## 7. 建议：抽什么、不抽什么

### 7.1 分层建议

```
L3 宿主（已存在，收敛）
    game-hub：唯一 Android 宿主（大厅 + WebView + 资源版本化 + 动态安装 + 更新）
    ↑ 通过稳定契约加载各游戏产物
L2 测试/发布门禁（mini-app-harness）
    android-shell 契约测试 / 浏览器烟测 / 存档兼容矩阵 / 发布检查
L1 构建工具链（mini-app-build，Node-only）
    build / serve / sync-android / check / verify —— 配置驱动，统一命令
L0 运行时脚手架（mini-app-core，浏览器端，零依赖）
    boot/mount/unmount、storage 适配、export/import 桥、toast、undo、raf runner、resize/fit、dialog
    ↑ 不含任何游戏引擎/渲染/领域逻辑
```

### 7.2 抽取优先级与理由

| 优先级 | 抽什么 | 重复量 | 运行时风险 | 建议 |
|---|---|---|---|---|
| **P0** | 构建/同步/服务脚本（L1） | ~1,160 行（同步 840 + serve 196 + build 123） | **零**（不进入产物） | 立刻做。5 份完全相同的 sync 直接合并；`serve`/`build` 收敛为策略插件 |
| **P1** | Android 宿主收敛（L3） | ~4,475 行 + 6×37 文件 | 中（涉及产品决策） | 让 game-hub 成为唯一宿主；各游戏 `android/` 要么归档，要么由模板生成 |
| **P2** | 存储适配层（L0.storage） | ~1,100 行（概念重复） | **高**（迁移/兼容） | 先"包装"后"统一"：保留各游戏现有 reader 作为 legacy reader，新增统一 `createStore` 仅服务新代码 |
| **P3** | UI 原语（L0.ui） | ~600–1,000 行 | 低–中 | opt-in，只抽 toast/dialog/undo/raf/resize 这些高频重复项 |

### 7.3 明确"不抽"清单

- ❌ 游戏引擎/领域模型（life/sandpile/optics/turing/lambda/EML/scratch/logic）
- ❌ 渲染器与画布绘制
- ❌ 领域校验规则与关卡/预设/教学数据
- ❌ UI 排版与手势细节
- ❌ 统一的"组件框架"或"游戏引擎"

### 7.4 包结构草案（仅设计，不落地）

```
packages/
  mini-app-core/          零依赖，浏览器端
    src/lifecycle.js        boot(appDefinition) -> {unmount, restart}
    src/storage.js          createStore({key, schema, version, migrate, validate, onError})
    src/export.js           exportJson(name, data)  // 自动探测 saveFile 桥，回退 Blob
    src/ui/toast.js
    src/ui/undo.js
    src/ui/raf.js           createRunner({step, fps, onFrame})
    src/ui/canvas.js        observeResize + fitTransform
  mini-app-build/         Node-only
    bin/mini.js             build | serve | sync:android | check
    src/strategies/         static.js | inline.js | esm-inline.js | vite.js
    src/sync-android.js     现有 139 行脚本的通用化版本（配置驱动）
  mini-app-harness/       测试与发布门禁
    android-shell/          统一契约测试（替代 3 份重复测试）
    storage-matrix/         存档双向兼容矩阵
    browser-smoke/          playwright 通用烟测
```

**规模红线（建议写入评审结论）**：`mini-app-core` ≤ 1,200 行、零运行时依赖、无全局单例、不 import 任何游戏代码；`mini-app-build` 只依赖 Node 内置模块（与现有"零依赖脚本"传统一致）。

### 7.5 分发方式

现有体系是"独立仓库 + 固定 SHA + 产物 SHA-256 校验"，天然适合**版本化 + 完整性校验**。**结论：首选 vendored tarball，registry 作为演进路径。**（原稿将 registry 列为首选，因与"离线优先"冲突已于 2026-10-21 修正）

- **首选：vendored tarball + integrity 锁定**
  - 形态：`vendor/mini-app-core-0.1.0.tgz` + `mini-app-deps.lock.json`（记录 `version` + `sha256`）
  - 安装：一个约 30 行的 `scripts/vendor-install.mjs`，解包到 `vendor/node_modules`（或 `third_party/`）
  - 理由：全程离线、可复现、无 token/网络/认证依赖；与 `sources.lock.json` 的"按 SHA 锁定"是同一套心智模型；CI 不需要配 secrets
  - 约束：tarball 内必须带 LICENSE 与第三方声明，与各仓库现有 `THIRD_PARTY_NOTICES.md` 对齐
- **演进路径**：项目数增多或引入外部协作者时，再升级到私有 registry（verdaccio / GitHub Packages）；lock 里的 `version + integrity` 可直接迁移，不构成返工
- **不建议** git submodule（多仓库同步易产生"指针漂移"）
- 必须**双格式输出**（ESM + UMD/global），因为 5 个游戏是经典脚本加载方式

---

## 8. 迁移路径（建议分阶段，先低风险）

| 阶段 | 内容 | 风险 | 验收 |
|---|---|---|---|
| 0 | 冻结现状：记录各仓库当前 SHA、Android 契约、桥签名、存储 schema | 无 | 基线清单 |
| 1 | 抽 `mini-app-build`：合并 5 份相同 sync、统一 serve/build；各仓库删本地副本、改走包 | 低（不改变产物） | 产物 SHA-256 与迁移前逐字节一致 |
| 2 | 抽 `mini-app-harness`：把 3 份 android-shell 测试合并为契约测试 | 低 | 6 个仓库全部通过 |
| 3 | 收敛 Android：以 game-hub 为唯一宿主；各游戏 `android/` 归档或模板生成 | 中（产品决策） | 大厅内 10 个游戏启动/返回/导出/存档全通过 |
| 4 | 存储适配层：先新增统一 `createStore` 服务新代码，旧 reader 原样保留 | 高 | 按《存档格式与升级兼容规范》做双向读矩阵 |
| 5 | UI 原语：按需接入 toast/undo/raf/resize | 低–中 | 逐游戏视觉回归 |

> **试点分工见 §11.4**：工具链（L1）试点选 lambda（最小、脚手架占比 45%）；**存储层（P2）试点明确选 light**（存储最完整，已有内存后端 + 可注入 backend + 桥感知下载，是最接近"框架形态"的现成样本）。**不要在同一仓库上同时叠加工具链与存储两类风险。**

---

## 9. 风险与对策

| 风险 | 说明 | 对策 |
|---|---|---|
| 抽象泄漏 | 把领域逻辑塞进框架，导致框架变成"上帝对象" | 明确红线：core 不含任何游戏概念；评审时以"删掉某个游戏，框架是否仍成立"为判据 |
| 破坏离线可复现 | 引入 npm 依赖，与"固定 SHA + 离线构建"冲突 | **首选 vendored tarball + integrity + lockfile**（§7.5）；私有 registry 仅作后续演进，不作起步方案 |
| 存档迁移出错 | 规范要求双向读，迁移是最高风险区 | 不重写旧 reader；新 store 只服务新代码；按规范做双向矩阵验收 |
| 模块系统冲突 | 5 经典 / 2 ESM / 1 TS | 双格式产物；不强制统一加载方式 |
| 独立 APK 能力丢失 | 删 `android/` 等于放弃"每游戏独立发 APK" | 先做产品决策（见第 10 节）；如需保留，则由模板生成，不手维护 |
| 已有漂移 | abelian/lambda 桥签名与主流不同 | 框架提供**桥别名 + 签名兼容层**；迁移时逐个实测 |
| 过度工程 | 一次性抽太多，长期无人维护 | 分阶段、每阶段独立可用；包体量与依赖设上限 |

---

## 10. 待你决策的问题

> 评审方对以下五项的具体建议与依据，见 **§11「决策建议」**。本节只保留问题与各选项的影响，便于对照。

1. **是否保留"每个游戏可独立发布 APK"？**
   - 若否 → 6 套 `android/` 可直接归档，Android 维护量减少约 4,475 行；game-hub 成为唯一宿主。
   - 若是 → `android/` 改为由 `mini-app-build` 从模板生成，禁止手工修改（否则漂移会继续）。
2. **公共包分发方式**：私有 npm registry，还是 vendored tarball + sha256？（影响离线构建与 CI）
3. **是否接受重构存储读写层**？还是只允许"新增统一 store、旧 reader 冻结"？
4. **试点选哪个游戏**：lambda（最小）还是 light（存储最完整）？
5. **抽取边界是否认可**：只抽 L0–L2 脚手架，明确不抽引擎/渲染/领域/UI？

---

## 11. 决策建议（评审方立场）

§10 列了五个待决策项。本节给出**明确建议**而非选项罗列——评审方对每一项都有倾向性判断，并说明依据与前提。

> 总原则：**先收敛宿主，再定分发，存储放最后。** 顺序颠倒会把风险叠加到同一个迭代里。

| # | 决策项 | 建议 | 核心理由 |
|---|---|---|---|
| 1 | 独立 APK | **源码层不保留，产物层按需出** | 6 套 `android/` 各 37 文件、36/37 同路径、`MainActivity` 相似度 98.6% / 98.7% / 91.3%（§4.2），维护是 6 倍成本；但"单游戏轻量分发"是真实需求，可用同一宿主 + 构建参数（只打某 game、隐藏大厅入口）产出，不必养 6 份源码 |
| 2 | 分发方式 | **vendored tarball + sha256 + lockfile**，不上私有 registry | 这批项目自底向上是离线优先（零运行时依赖、经典脚本直跑），registry 会引入 token/网络/认证依赖，与离线性直接冲突；tarball 按 SHA 锁定与 `sources.lock.json` 同构（详见 §7.5） |
| 3 | 存储层 | **新增统一 store + 旧 reader 降级为只读导入器**，不做全量重构 | 存档是用户数据，破坏即数据丢失，风险最高档（§7.2 已定 P2）；规范只要求"事务/检查点"这种**新增能力**，并未要求重写。走"旧读 → 转新 schema → 一次性写入新 store"最安全 |
| 4 | 试点 | **不只挑一个，分三级试点**：lambda → light → turing | 见 §11.4。三个游戏分别覆盖"最小仓库 / 最完整存储 / ESM+Vite"三类风险面，单一试点会漏掉模块系统这一支 |
| 5 | 抽取边界 | **认可 L0–L2 边界，但需追加"准入规则 + 逃生舱"两条硬约束** | 边界本身正确；不加约束，公共层会从"消除重复"退化为"新的耦合瓶颈"（§11.5） |

### 11.1 关于独立 APK（Q1）

**建议：源码层收敛到 game-hub 单一宿主；独立 APK 改为按需构建产物，不进常规 CI。**

- **不要直接删。** abelian（29.7%）与 lambda（59.0%）的 `MainActivity.kt` 已与主流版本**真实分叉**，很可能含独有修复（桥签名、导出行为差异，见 §4.3）。归档前必须逐项 diff，把独有改动**回灌**到 game-hub 宿主的桥兼容层，否则会丢功能。
- **归档而非删除**：打 tag + 在仓库根加 `ARCHIVED.md` 说明"已被 game-hub 宿主取代，只读保留"，保留历史可追溯。
- **独立 APK 的实现方式**：用 game-hub 的构建参数（flavor / `buildConfigField` 白名单）产出"只含单游戏、隐藏大厅入口"的 APK。手工触发，不纳入 CI 矩阵。
- **收益**：Android 维护面从 ~4,475 行 × 6 套收敛为 1 套，且修复天然传播。

### 11.2 关于分发方式（Q2）

**建议：vendored tarball + `sha256` + lockfile；registry 留作演进路径。**

具体形态与理由已并入 §7.5（本次已修正原稿的"registry 首选"表述）。

补充两条执行要求：

1. **lock 文件必须是唯一真源**：`mini-app-deps.lock.json` 记录 `{name, version, sha256, source}`，禁止直接改 `vendor/` 下的内容——CI 增加一条 `vendor-verify` 校验，不一致即失败。
2. **版本策略先粗后细**：起步阶段公共包与游戏仓库**同仓同版本**（tag 对齐），避免早期频繁发版的负担；稳定后再独立语义化。

### 11.3 关于存储层（Q3）

**建议：只做"新增 + 兼容"，不做"重写"。**

三版迁移节奏（每版独立可交付、可回滚）：

| 版本 | 动作 | 回滚方式 |
|---|---|---|
| v1 | 新增 `createStore`（含 schema / version / migrate / 事务与检查点），**只写不读** | 停用新写路径 |
| v2 | 双写（旧 key + 新 store）；旧 reader 降级为"只读导入器"；跑存档双向矩阵 | 关双写，旧路径仍在 |
| v3 | 切单写；旧 key 仅保留只读迁移入口 | 恢复双写 |

关键约束：

- **旧 reader 一律冻结**，只允许"读旧格式 → 转新 schema"，不允许在里面加新逻辑；
- **验收以《存档格式与升级兼容规范》为准**，双向读矩阵是 gate，不是可选项（参考 §8 阶段 4）；
- 事务/检查点能力必须**先有失败注入测试**（写一半中断、配额超限、localStorage 不可用→内存后端降级），否则"看似支持事务"比"明确不支持"更危险。

### 11.4 关于试点选择（Q4）

**建议：三级试点，按风险面而非按代码量选。**

| 顺序 | 试点 | 覆盖的风险面 | 为什么是它 |
|---|---|---|---|
| 1 | **lambda-diagram-game** | L1 构建链 | 脚手架占比 ≈45%（§4.4），收益最直接；仓库最小、爆炸半径最低；`build.mjs` 属"单文件内联"策略，能验证最复杂的一类构建 |
| 2 | **light_game** | L0 存储适配 | 存储模块 481 行，已具备内存后端降级 + 可注入 backend + 桥感知下载，是最接近"框架形态"的现成样本；`MainActivity` 91.3% 相似，是标准副本 |
| 3 | **turing-machine-simulator** | 模块系统兼容 | 唯一 TS + Vite + ESM 代表，`MainActivity` 98.7% 相似；用于验证"非经典脚本"这一支不被框架排除 |

> 若只能做一个试点，选 **lambda**（验证工具链、零运行时风险）；但存储层迁移的试点应选 **light**，不要在同一仓库上叠加两类风险。

### 11.5 关于抽取边界的硬约束（Q5）

**建议：认可"只抽 L0–L2"，但必须同时写入以下两条约束，否则该边界守不住。**

**约束一：准入规则（三条缺一不进核心）**

1. 至少 **2 个仓库存在等价实现**，且能在评审中给出具体文件与行号；
2. 抽取后能让至少一处**删掉 ≥30 行**重复代码；
3. 有 **harness 测试覆盖**（对应 L2）。

> 该规则的作用是挡住"未来可能用到"的推测性设计。§4.1 中 5 份字节相同的 `sync-android-assets.mjs` 是**已被验证可共用**的典型样本，这类才符合准入；反之"统一路由/统一主题/统一动画"这类没有任何现成重复证据的能力，一律不进核心。

**约束二：逃生舱（核心只提供，不接管）**

- L0 的任何能力都必须允许项目侧**完全绕过**——不得出现"想用 canvas 就必须先过 core 生命周期"这类倒挂；
- 公共包不提供全局单例、不接管 `window`、不劫持 `requestAnimationFrame`；
- 判据：**删掉某个游戏，框架是否仍成立**（§9 已列为抽象泄漏判据，此处升级为验收项）。

### 11.6 建议的推进顺序

**第一步只做 P0（构建/同步/服务工具链），试点 lambda。**

理由不是"风险低"这种泛泛判断，而是：`sync-android-assets.mjs` 在 5 个仓库**字节完全一致**（md5 `97c6c40…`，139 行），是已经被独立验证过可以共用的代码，不是推测可共用。这一步零运行时风险（不进入产物）、不动存档、不动 UI，完成后立刻可删掉 5 份副本，且验收标准明确——**产物 SHA-256 与迁移前逐字节一致**（§8 阶段 1）。

跑顺之后再谈 §11.1 的宿主收敛（P1），因为 P1 含产品决策，且需要先完成分叉回灌。

### 11.7 一个必须一起定的耦合关系

**Q1 的答案会反向影响 Q2 的价值判断，两项不宜分开决策：**

- 若**不保留**独立 APK → 公共包的实际消费方从 8 个降为 **1 个（只有 game-hub）**，"多项目复用"这一核心收益大幅缩水。此时 `mini-app-core`（L0）应做得**更薄**，甚至只做 L1 工具链 + L2 门禁即可；
- 若**保留**独立 APK（由模板生成）→ 消费方仍是多个，L0 的复用价值成立，值得投入 1,200 行的核心包。

因此建议：**先定 Q1，再据此裁剪 Q2 的规模**。

---

## 12. 最终建议（一句话版）

> **值得抽，但只抽"壳"，不抽"芯"。**
> 先抽零风险的构建/同步/服务工具链（立竿见影，消除约 1,160 行重复）；再把 Android 收敛到 game-hub 这唯一的成熟宿主（消除约 4,475 行模板重复、终止已发生的漂移）；存储层与 UI 原语按"包装优先、统一其次"的节奏逐步推进。**永远不要把游戏引擎、渲染器和领域规则塞进公共包。**

---

## 附录 A：证据与文件位置

| 证据 | 路径 |
|---|---|
| 5 份字节相同的同步脚本 | `<repo>/scripts/sync-android-assets.mjs`（conway/light/turing/abelian/lambda），md5 `97c6c404617da17d8ddad67ab2b8dc87`，139 行 |
| EML 变体同步脚本 | `EML/scripts/sync-android-assets.mjs`，71 行 |
| 同源 Android 外壳 | `<repo>/android/app/src/main/java/com/xiaoxuhui/<pkg>/MainActivity.kt` |
| 宿主桥映射 | `game-hub/android/app/src/main/java/com/xiaoxuhui/gamehub/MainActivity.kt:1073-1080`（`bridgeName`） |
| 宿主策略层 | `game-hub/android/app/src/main/java/com/xiaoxuhui/gamehub/{AssetAccessPolicy,FileNamePolicy,GameContentResolver,DocumentExportFlow,ExportTaskState,GameResourceStore,DynamicGamePolicy}.kt` |
| 存档规范 | `game-hub/doc/存档格式与升级兼容规范.md`（明确提到需要存储适配层与 `mini-app-harness`） |
| 设计文档 | `game-hub/doc/设计文档.md`（来源锁定、资源布局、存储与迁移、原生能力差异） |
| 存储样本 | `EML/src/persistence.js`、`light_game/scripts/storage.js`、`abelian-sandpile/src/storage/persistence.js`、`turing-machine-simulator/src/project-codec.ts` |
| 单 IIFE 巨型 app | `conway-life-game/scripts/app.js`(1115)、`light_game/scripts/app.js`(1066)、`EML/src/app.js`(1019) |

## 附录 B：量化方法说明

- **相似度**：对 `MainActivity.kt` 做归一化（`package` 行替换、字符串字面量替换为 `"S"`、项目名统一为 `APP`、空白折叠），再用 `difflib.SequenceMatcher` 计算字符级相似度。该指标衡量"结构同源程度"，不代表可机械合并。
- **字节重复**：对每个 tracked 文件取 md5，按 md5 分组，仅统计跨 ≥2 个仓库的组。
- **脚手架占比**：脚手架 = `android/` 下文本行（kt/kts/xml/pro/properties/gradlew/md）+ `sync-android-assets` + `serve*` + `build*` + 存储相关模块行；业务代码 = JS/TS + HTML + CSS。
- 所有统计基于各仓库当前 HEAD（评审时点），未包含 `dist`/`build`/`assets` 生成物。
