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
