# N13 测试与验收记录

## B：2026-10-12

在唯一独立检出 D:/soft/.ci-tmp/game-hub-n13/work 使用 Node 执行：

- `node --check scripts/repository-watch.mjs`：成功。
- `node --test tests/repository-watch.test.mjs`：10通过、0失败、0跳过，原输出n13-tests-focused.txt。
- `node --test`：74通过、0失败、0跳过，原输出n13-tests-full.txt。
- `git diff --check`：成功。
- 调用 checkRepository 对八仓进行真实授权只读API检查：8 checked、0 unknown；私有harness报告保留本机，不进入公共仓。公开7报告见n13-live-public.json。

真实查询期间最新版本：大厅0.4.1、康威0.17.0、EML1.3.1、光学1.2.1、图灵0.6.0、Lambda0.3.2；Abel/harness无正式Release。这些是自身发布版本，不能视为大厅已更新资源；存档兼容探针也不外推这些新版本。

本切片修改维护脚本/Actions/文档，无游戏UI或存档行为变化：浏览器交互、APK重构建及迁移矩阵不适用。八仓云端包装器实际运行单列C，当前未声称完成。
