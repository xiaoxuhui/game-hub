# N1 第一切片独立审阅（2026-10-09）

受审产品提交：`9e54758e459801936ad6dff3051c13033fd20bf2`；随后仅归档两份测试日志的提交：`a1e58a7bb73384009080084a214901f5d8b4ecd5`。主仓库 HEAD 与 origin/main 均为后者，检查时工作树干净。仅只读核查源码、v0.4 需求/设计/实施计划、差异及现有独立检出测试证据；没有在主仓库或四原游戏仓库构建或修改，也没有读取密钥/原始存档。

## 审阅意见（按严重度）

1. **P2，Node 与 Android 对签名 payload 中整数词法的接受结果不同。** `scripts/resource-protocol.mjs:40-42,58,62` 把 JSON 数字 `10.0` 或 `10e0` 解析成 JS 数值 `10`，`Number.isSafeInteger` 放行；v2 的 `scripts/dynamic-protocol.mjs:18-19` 通过合成目录复用该校验。Android `android/app/src/main/java/com/xiaoxuhui/gamehub/StrictJson.kt:61-64` 将同一词法解析成 Double，`ResourcePolicy.kt:49-50` 拒绝。因此 Node 可认为一份重新签名的 v2 目录合法，Android 会拒绝。只读 Node 复现：`strictJson(Buffer.from('{"releaseId":10.0}')).releaseId` 为 10 且 `Number.isSafeInteger` 为 true。正常 `JSON.stringify` 生产目录不会产生此词法，影响是边界一致性和错误候选发现时机。建议 Node 原始解析拒绝会折叠为整数的小数/指数词法，并对手工构造、重新签名的原始 payload 增加交叉负例；检查 v1 回归。
2. **P2，示范游戏导入时存储失败却提示已成功。** `examples/memory-demo/app.js:18,25-28` 的 `save()` 捕获 localStorage 写入异常并只显示错误；导入处理随后无条件把提示改成“已导入存档”，而内存 state 已变为导入值。配额满或存储被禁用时用户会误以为数据已持久化，重启后丢失。建议让 `save()` 返回结果或抛错，导入按实际保存结果提示；为写入失败增加受控测试。
3. **P3，导入格式校验仍接受明显不可能的计数。** `examples/memory-demo/core.js:6-11` 验证匹配的牌和 `complete`，但允许 `matched` 为全部六张、`moves=0`、`wins=0`、`complete=true`。这会让导入 JSON 显示“全部配对成功”同时零步零胜。建议校验 `moves >= matched.length / 2`，完成时 `wins >= 1`，并补负例。此项不涉及 APK 安全边界。

## 已核对的边界与证据

- `ResourcePolicy.kt` 的 v1 固定四 ID、仓库、入口、合同、资源协议 1、签名原始字节与文件预算没有放宽；抽取 `signedPayload` 和 `parseFiles` 后旧入口仍调用原有 v1 解析。`git diff --check` 无输出。
- v2 签名仍要求 RSA3072、384 字节签名、固定 envelope/keyId、1 MiB envelope、512 KiB payload。v2 清单最多 16 项，文件/ZIP 上限与危险路径检查复用 v1；未知正整数桥/资源协议可解析以便展示，但 `ResourceGame.compatible()` 只接受 2/1 动态组合和传入的预期存档合同。`available=false` 的下载资格门禁尚未集成，本切片没有资源安装/UI 代码；须在 N2/N4 验证调用端传 `DynamicGamePolicy.contract(id)` 且拒绝退役项下载。
- Node 合成 v1 复用覆盖 `id`、`assetId`、`resourceProtocol` 和 `storageContract`，但原始动态 ID/资产 ID/资源与桥版本/合同均在 v2 预检中受类型与范围约束；来源、入口、内容编号、哈希、完整文件清单、时效和预算仍经合成校验。未发现上述覆盖直接绕过文件/签名或使未知协议可安装。该复用方式依赖两处校验保持同步，建议后续生产工具维护时增原始字段变异表测试。
- 归档 Node 日志显示 26 通过、0 失败；独立检出 JVM XML 13 个套件合计 65 测试、0 失败、0 错误、0 跳过，Gradle 日志为 23 项实际执行且 BUILD SUCCESSFUL。文档对浏览器/设备/生产公钥/发行待测的表述准确。此复核不把单测视作 N3–N6 的设备或线上验收。

**当前结论：有两项 P2 需要批改并提交后复审；N1 第一切片暂不闭环。**
