# N6 来源锁与正式客户端更新前基线独立审阅

日期：2026-10-09。受审提交 `64e1451044513139509a3821de6745dfffb03ef5`，`HEAD=origin/main`，主仓库干净，`git show --check` 无空白错误。仅只读审阅源码、公开非秘密证据和远端标签；未构建、发布、改动主仓库或原游戏仓库，未读取原始 SAF 存档。

## 结论

**CLOSED：无阻塞，可进入干净独立检出的资源 #2 生产与重复摘要切片。** 本审阅不把来源锁和更新前基线当作资源 #2 已签署、发布或完成正式客户端更新验收。

## 核查

- `dynamic-sources.lock.json` 仅把自有 `memory-demo` 来源固定到此前独立审阅通过的完整提交 `80898b3ba78ea51a62533c42362f00a4e37421f1`，将 `contentCode` 升至 2、版本升至 1.0.1、说明改为键盘焦点功能；固定仓库、目录、五文件集合、入口、`memory-demo-dynamic-v1` 存档合同未变。该 Git 提交存在且相对 #1 来源只改 `examples/memory-demo/app.js`、`index.html`；`core.js` 等存档代码未改。四原游戏源未在本提交变动。
- `tests/dynamic-resources.test.mjs` 只把旧完整 SHA 字面断言换为新完整 SHA；仍独立精确断言值，没有改为读取被测锁自证。缺文件、额外文件、存档合同伪造和浮动 `main` 的拒绝测试保留。初次 34/35 失败日志明确显示仍期待旧 SHA；修正后独立检出日志 Node 35/35、0 失败/跳过。
- 新的显式仪器 `ProductionResourceIdentityDeviceTest` 默认不运行，须参数 `productionResourceIdentity=true`。它读取已安装目标 APK 的 `ResourceRuntime` 生产单例、公钥和动态 store 实际 active/selection，核包名版本 0.4.0、hostCode4、`base.apk` SHA `c6e071...2645967`、公钥 SHA `649107...92673`、资源代码/ZIP/来源/存档合同；不注入第二 store、测试公钥或替代网络。正式安装版本上日志 `OK (1 test)` 与 logcat 的 active #1、`81bdef...` 来源、旧 ZIP、`ready:null` 一致。测试参数中的期望值用于断言，不代替读取实际安装身份。
- 更新前实际 SAF 导出公开 JSON 仅记录 schema1、1 步、0 胜局、144 字节及 SHA-256 `5dd0b7e0147736ab08693a8032661c82de834284bb0d3d61d7a6760b66e14c05`；原始导出未入库。该基线可在 #2 更新后按同一用户进度和摘要复核。
- 远端 `v0.4.0` 与 `game-resources-v2` annotated tag 的 peeled 目标仍同为 `4aacb1f81b7fc381d2ca7fd725fd93dd109e390e`。本提交仅改来源锁、测试、计划和证据；没有改正式 APK、资源目录或已发布标签。N7 两新游戏与 N8 清理仍留待办。

后续应按实施计划从这个固定 SHA 在独立检出生成 #2 ZIP、重复验证，再独立审阅签署历史和正式发布工具；最后在已发布 v0.4.0 上验实际局部更新、旧 1 步进度及 APK 字节不变。
