# M1 资源工具切片独立审核（2026-10-08）

- 受审提交：`f2acb920439e2c14eda5170d1169b7b1e897b2f0`
- 范围：严格 JSON、协议验证、RSA3072 包络、确定性存储 ZIP、四游戏候选与发行资产身份工具。仅审核此工具切片；M1 全阶段、私钥生成和 Android 接入均未完成。
- 结论：**两项 P1 需批改后复审，再进入依赖该签名目录与候选的下一切片**。`doc/evidence/m1-resource-tools-20261008.md` 记录独立检出 20/20 测试及四 ZIP 两次 SHA 一致；这些证据支持现有用例，不覆盖下面的发行绑定和失败残留场景。本审核未在四原仓库构建或修改任何产品代码。

## 发现

1. **P1：签名命令没有强制验证固定 Release 的资产归属。** `scripts/resource-catalog.mjs:20-24` 的 `sign` 路径只调用 `validateCatalog`，随后直接签名；同文件 `attachAssets` 从未被调用。`scripts/resource-protocol.mjs:62,74` 仅检查 `releaseId`、`assetId` 为正整数，所以错误 Release ID 或凭空资产 ID 也能产生密码学上有效的包络。要求签名前强制输入并验证完整的固定预发布 Release 元数据和分页资产列表，将其与 payload 的 releaseId、每个 assetId、唯一名称、大小、SHA 逐项比对；错误 Release、缺页、重复名、凭空 ID 加负例。此问题不表示现有密钥泄露；发行流程尚未开始。
2. **P1：资源候选目录非事务式生成，失败后可被旧候选冒充。** `scripts/resource-bundle.mjs:72-82` 在现有 `.build/resource-candidate` 中逐个写 ZIP，最后才写 `games.unsigned.json`。中途失败可能留下上一次的完整 manifest 与 ZIP；`:84-92` 的 `--verify` 只校验该目录内部自洽，不证明这次 `bundleCommit`、锁文件或资源代码已进入候选。建议在全新 staging 完整构建、验证后才切换候选目录；失败保持旧完整候选但显式标注旧来源，并令 verify 接受/核对期望 commit 与来源锁。用失败注入证明本轮失败后不能把旧候选报成当前构建成功。

## 后续改进

- **P2：静态缓存扫描是有限启发式。** `scripts/resource-bundle.mjs:56-63` 通过正则拒绝常见 `serviceWorker`、`caches.` 和 `localStorage.clear()` 用法，间接属性访问或拆分字符串可避开它。证据文档已把运行时代理/缓存验证留到 M3，此边界表述准确；后续签署新版来源前仍需源码审阅和 M3 的真实 WebView/缓存夹具，不能将该扫描描述成完整安全保证。
- **P3：时间格式可更严格。** `scripts/resource-protocol.mjs:64-65` 用 `Date.parse` 接受非规范日期字符串，设计约定 UTC 时间。可要求固定 RFC3339 UTC 格式再解析，并加入非 UTC/无时区负例，以保证跨 Node/Android 实现一致。

## 已核对的有效边界

`strictJson` 在解析前限制字节并拒绝重复键、非法 UTF-8/BOM 和非 JSON 尾部；ZIP 自身采用固定顺序、存储方法、固定头字段，读回重建比较使中心目录篡改被拒绝；资源路径拒绝遍历、绝对路径、反斜杠、控制符、重复及前缀冲突；RSA 验证绑定原始 payload 字节并限制 3072 位、签名长度及规范 Base64。`resource-releases.lock.json` 仍以四源既定 SHA 为输入，未修改原始 `sources.lock.json`。这些正向判断基于静态代码和已归档测试证据，不代表 Android 下载、激活、缓存或发行流程已通过。
