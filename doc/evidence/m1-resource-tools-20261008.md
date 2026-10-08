# M1 资源工具首轮验证（2026-10-08）

独立检出：D:\soft\game-hub-build-resources-20261008。
源码编辑阶段复制新增脚本与测试到此独立检出执行，四游戏 assets 由已提交 00b53f1 的固定 sources.lock 构建。当前验证仅资源工具切片，M1 全阶段尚未完成。

- `node --test`：20 项，20 通过，0 失败，0 跳过。
- `node scripts/resource-bundle.mjs`：四来源/40 文件校验通过；四 ZIP 完整清单验证通过。
- 连续执行两次资源构建并比较四个 SHA256：完全相同。
- `node scripts/resource-bundle.mjs --verify`：4 ZIP 验证通过。
- RSA3072 测试密钥仅内存生成，不是发行密钥。
- 第一轮针对性测试 6/7，通过失败项揭露 TextDecoder 默认吞 BOM；显式 ignoreBOM=true 保留 BOM 并拒绝，原测试未弱化，第二轮全部通过。
- 已静态扫描资源，不含 serviceWorker/caches 代理或广域存储清空；运行时缓存解除仍留 M3 实测，不据静态结果声称完成。

A0 独立审阅无阻塞。按意见修正历史授权时态；示范游戏定位留 v0.4 设计。

## 提交后审阅批改

原提交 f2acb92 的两个 P1 均已处理：
1. sign 必须携带离线公开元数据快照；签前核对固定预发布 Release、releaseId、全部候选资产名称/大小/摘要/ID。capture 子命令只读抓取连续页，保留 page/hasNext；末页依据 API Link，恰满100也合法。离线签名只证明快照内部一致性；发布在线匿名核验仍是 M7 门禁。
2. 候选先在独立 staging 完整生成及验证，再替换目录；注入 EML 中途失败保留原完整候选。candidate.json 绑定 bundleCommit 与来源锁摘要；verify 对当前期望提交/锁校验，旧提交候选不能冒充本次。

补 canonical UTC 时间格式检查。全套 `node --test` 22 通过/0 失败，含签名快照漏页/整页/凭空资产及中途失败/陈旧提交负例。原始审阅意见归档 m1-tools-independent-review-20261008.md。M1 尚待生产公钥与后续安卓协议接入。
