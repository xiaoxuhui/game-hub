# N9-C 红绿资源生产与发行准备独立审阅

- 日期：2026-10-10
- 受审提交：`538b16ee386be508050faccad5563195c618303e`，检查时主仓 `HEAD=origin/main`、工作树干净，`git show --check` 无格式错误。
- 范围：独立过程根 `D:\soft\.ci-tmp\game-hub-n9` 中的两次生产候选/日志、来源锁、准备报告、CI、开源发行十项审计。只读检查；未修改或构建主仓/原游戏仓库，未签署或发布 seq4。

## 结论

**CLOSED，无阻塞进入 N9-D 的正式签署与发布门禁。** N9-C 证明四游戏候选资源可重复生产及准备证据；它不证明 seq4 已签署、上线或在正式客户端安装。发布前必须在干净的精确主仓提交上刷新候选并重新 `--verify`：现有 `candidate.json` 的 `bundleCommit` 是生产源码 `1c548febd08177cfb29e7ca9da0a74fe755212fa`，而准备文档提交后主仓和独立检出已经是 `538b16ee386be508050faccad5563195c618303e`。报告/委托方均明确此边界，不得把旧候选直接当最终发行候选。

## 生产与来源核查

1. `production-first.txt` 和 `production-second.txt` 均输出 `Verified 4 dynamic resource ZIPs; 1c548fe…`。首轮 `production-first-hashes.json` 的六个输出摘要与当前第二轮 `.build/dynamic-candidate` 六个文件的独立 SHA-256 重算逐项一致；第二轮文件时间晚于首轮哈希记录。`candidate.json` 锁摘要 `133cf16324729493a71c6821a22cc071efe3e5dda833fb718fc05e4cd5ff302a` 与当前 `dynamic-sources.lock.json` 重算值相同。四个游戏的 `games.unsigned.json` 元数据对应来源锁。
2. 红绿 ZIP `game-red-green-puzzle-1-81edc7c967f7.zip` 为 **14620 字节**、SHA-256 `81edc7c967f7cdfabd1a1e8707b677ec0d930d63e12cc0b8d427f65261767c62`。ZIP 中央目录恰有 `LICENSE`、`app.js`、`core.js`、`index.html`、`upstream-source.json` 五个锁定文件，无额外条目；来源为已审集成提交 `31eec2e638357d8e3e6a0550afc780e09bdaac49`，版本 1.0.0、contentCode1、合同 `red-green-puzzle-dynamic-v1`。
3. 旧三 ZIP 的实测摘要分别仍为 memory-demo `178d01e9…de8442`、abelian `8e9db7fc…f369e5`、lambda `5e418cdf…f81bb8`，与现有 seq3 正式资产身份一致；N9 锁/候选没有升级这些游戏。`--verify` 对四个 ZIP 完整文件/固定提交 blob 的成功结果记录在两轮日志，仍需在最终 538b16e 或后继的精确发行提交重验一次。

## CI、测试与十项开源审计

- `n9-source-final-tests.txt` 是本地 `node --check scripts/bundle.mjs` 加 `node --test` 的真实记录：**46/46**，0 失败/跳过。精确生产源码 CI run `37964464871` 为 completed/success、head `1c548fe…`；独立证据 `ci-release-preparation.json` 还记录最终准备文档提交 run `37964990280` completed/success、head `538b16e…`。该工作流运行 Node 测试、固定四内置资源构建/核验和 Android 调试构建；没有把 CI 成功冒充红绿浏览器、正式 WebView 或生产签署验证。
- 按 `oss-release-readiness` 的十项检查：根 MIT 版权/年份与 `package.json` 许可一致；包清单有名称、版本、仓库/主页/反馈/引擎/包管理器，`private:true` 符合不发布 npm 的用途；已有 v0.2/v0.3/v0.4 变更记录与正式标签；README **26** 个本地链接实测无缺失；治理文件和 SECURITY 联系邮箱存在；源码/产物忽略与密钥扫描边界已记录；网页截图和浏览器交互属于 N9-B 证据。`SECURITY.md` 本提交把 v0.4 的“准备发行”修正为“已发行”，没有产品规则变动。项目没有单独 `lint` 脚本，报告没有虚称运行 lint。红绿资源的正式 seq4 CHANGELOG 仍须在实际发布后记录。
- 非阻塞文字建议：`package.json` 的 description 仍写“离线四项目 Android 游戏大厅”，可理解为四个内置项目，但已发行大厅还支持可下载动态游戏；以后整理公开描述时可同步。该私有 npm 清单措辞不影响本轮固定资源字节或签署门禁。

此前发行器 `TaskScope N9` 大小写 P1 已由 `1c548fe` 修正并经独立复审 CLOSED；本次没有重开该问题。N9-D 继续要求固定 seq3 摘要、历史资产/签名序列、完整公网绑定、正式 APK 原字节及真实设备安装/离线验收；不能因本准备阶段 CLOSED 提前勾选发行。
