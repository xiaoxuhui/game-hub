# N20 EML 资源发行记录

- Producer main commit: `c1c17f31726c4bf305b3c1562a95372ceb5b3e26`
- Release: [`game-resources-v1`](https://github.com/xiaoxuhui/game-hub/releases/tag/game-resources-v1), release ID `407293817`
- Resource catalog sequence: `7`
- APK: 未构建、未发布。

## 新目录

- Current signed catalog asset ID: `694073326`
- Signed catalog SHA-256: `dfcc326c7db3892b472aca6fae145f07ebd20a90f26522270ef46dc51ff547bc`
- EML-3 asset: `game-eml-3-d13a6ac888dd.zip`，asset ID `694072897`
- EML archive: 861,794 bytes，SHA-256 `d13a6ac888dd8662225788ca016824a3370a3c3683f3c2f114a6a9656bb424c7`
- 旧 sequence 6 目录已按不可变历史名 `catalog-seq6-1c144d7f87f8.signed.json` 归档，asset ID `676509558`。
- 匿名线上验证重新下载当前签名目录、历史签名目录和所有历史 ZIP，验签 sequence `1` 至 `7` 连续完整；共验证 11 个唯一 ZIP。详细结果见 `n20-eml-v1-online-verified.json`。

## 发行范围核验

本次仅 EML 从 contentCode 2 升至 3。康威、Light、图灵机的资源编号、ZIP SHA-256 与 sequence 6 完全一致。Lambda、Traffic、Hex 的资源输入仍未通过兼容/发行范围门禁，未混入本次目录。

生产检出固定在 main `c1c17f3`，全仓 Node 测试 `237/237` 通过；4 个 ZIP、80 个资源文件及最终 manifest 均已验证。最终生产构建摘要在 `n20-eml-final-production-build.json`，发行激活摘要在 `n20-eml-v1-published.json`，历史验证在 `n20-eml-v1-online-verified.json`。

开始发行时 GitHub API 匿名额度耗尽且后续短暂返回 403。失败尝试均在预检阶段停止，未读取签名凭据、签名或写远端。限额恢复、直接 Node snapshot 请求验证成功后，使用新的证据目录重新执行，最终 sequence 7 发布与全历史验证通过。

四个原游戏仓库在发行前检查均为干净工作树；原大厅 `D:\soft\game-hub` 也保持干净。浏览器 harness 因独立检出缺少 Playwright Node 模块未运行，不声称浏览器或真机验收。
