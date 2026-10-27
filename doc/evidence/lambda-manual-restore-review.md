# Lambda 手动恢复独立复审记录

- **复审范围**：`02177cb` 至 `64b37ae` 的手动恢复实现、存档写入门禁、资源证明与浏览器回归。
- **结论**：CLOSED（2026-10-27）。最终动态资源 source revision 为 `1ad91a97e5e1f1f98ca2a39b6d8355f61a3b25cb`，contentCode 5；HTML SHA-256 `4189b4a26ace5802bac2a8a84136a202d7d5f29655ea4ae1b1b09d184a6534a1` 与 `upstream-source.json` 一致。

## 复审发现与修正

1. **P1：启动后无操作离开会覆盖旧档。** `pagehide` 原先无条件触发自动存档。改为初始化期间禁止保存，并且只在游戏存档快照发生变化后排队。
2. **P1：启动转换本身调用保存。** 初始 `convert → render → save` 曾启用自动存档。增加启动标记，并在首轮转换后记录比较基线；未变化的重复“转换/适配”或“适配图示”不写入。
3. **P1：导入选择、导航按键和空白点击会误开自动保存。** 移除宽泛的 DOM 事件启用逻辑。无效文件导入没有写入路径；真实游戏状态变化通过既有 `save/queueSave` 路径保存。
4. **P1：真实变化后重开偶发 C5 并发保护。** 自动保存定时器回调此前未清空其句柄，导致 `pagehide` 把已完成存档再写一次，并向新页面发出跨页 storage 事件。现在回调及显式写入都会清空句柄，离页只刷新仍待执行的 debounce。
5. **P2：浏览器回归场景未显示课程关卡。** 测试新 context 默认处于自由模式，改为先进入挑战模式再选取动态关卡；CI workflow 现在安装 Chromium 并运行此浏览器回归，且监视 `dynamic-sources.lock.json`。

## 验证记录

- `node --test tests/lambda-manual-restore.test.mjs tests/lambda-storage-integration.test.mjs tests/upstream-proof.test.mjs`：17/17 通过。
- `node tests/lambda-manual-restore.browser.cjs`：1280px 与 390px 各 3 项，共 6/6 通过，0 页面错误；覆盖新会话、手动恢复、JSON 导入和动态关卡保存。
- 独立复审浏览器探针：debounce 完成后 reload，无 C5 modal、无 storage events，旧 AUTO 字节保持不变。
- `git diff --check`：通过。

## 暂未完成

- 浏览器行为已本地验证，新的 GitHub Actions workflow 尚待 push 后执行。
- 动态资源候选生产、签名目录后继发行、匿名下载核验尚未执行；Android 更新仍需完成资源发布流程。
