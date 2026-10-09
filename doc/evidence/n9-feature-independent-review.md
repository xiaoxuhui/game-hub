# N9-B 红绿变换适配独立审阅

- 受审提交：`31eec2e638357d8e3e6a0550afc780e09bdaac49`；核对时 `main`、`origin/main` 相同，主仓库及独立工作目录均干净。
- 结论：**CLOSED**。就本切片的独立网页适配、1–10 数量边界、来源与许可证、参数恢复及复制降级，没有发现阻止下一阶段的缺陷。N9-C 锁源/发行器与 N9-D 正式 Android 资源验证仍须另行验收。

## 独立核查

1. 对固定上游 `592027dbc5cab9cb83f91b904f4f23a9e3cbe24b` 只读执行 `git show`：`doc/red-green-puzzle.html` 是 10,727 字节、SHA-256 `9ff81f454bf07ba20bfe3e37615b082f049b509ea5ba8d5d2b881c380151d60d`；`LICENSE` 是 1,066 字节、SHA-256 `12eb4f44e3289367dbba7f173765735d8b7d2bfefa4f027f90d8e38f834838ec`。它们分别匹配已提交 fixture 与完整 MIT 许可证。原仓库当前工作树 HTML 的 SHA-256 为 `c73db02267b40eeca1ba9c7c263bf1fa0de57b86b17cecf24b5fcff95676f520`，与固定 Git blob 不同；报告已明确区分两者，未把工作树字节冒充 Git blob。
2. `scripts/red-green-source.mjs` 将仓库 URL、完整提交、输入摘要、四个适配文件的完整字节摘要锁定；拒绝输出链接/特殊文件及额外输出。`--write` 路径要求独立来源检出的固定 HEAD、origin、干净状态，并对比 `git show` 原始字节。只读 verifier 在 `D:\soft\.ci-tmp\game-hub-n9\work` 成功。
3. `core.js` 在分配前要求整数 1–10，10 位最多 682 步/683 行；固定算法逐规模对照和独立 BFS 的测试均在。参数只恢复 schema 1 的有效整数，损坏数据或存储不可用退回 6。`app.js` 对无效输入保持现有流程；剪贴板依次尝试 `writeText`、`execCommand`，两者失败后保留完整可选文本并提示手动复制，不虚报成功。
4. 在独立工作目录复跑四项定向 Node 测试：4/4 通过；已归档全量 Node 日志为 46/46。浏览器证据覆盖移动 390×844 与桌面 1280×900、触摸/Enter、10 位完整生成、非法输入不破坏结果、重载恢复、损坏/拒绝存储、模拟剪贴板成功与强制失败、零 pageerror。目视 `red-green-mobile-default.png` 与 `red-green-desktop-fallback.png`：规则和色块清楚，失败路径显示完整文本框及手动提示；未见覆盖。`git show --check` 通过。

## 证据边界

- 浏览器剪贴板成功路径使用注入接收器，失败路径故意拒绝两个自动接口；这些证据没有声称真实 Android 系统剪贴板已通过。
- 本次未安装正式 APK、未签署或发布资源，未复测 WebView 离线与参数恢复。上述事项继续列于 N9 后续阶段。
- 审阅只读访问主仓库和固定上游，定向测试仅在 N9 独立工作目录运行；未修改任何原游戏仓库或发行资产。
