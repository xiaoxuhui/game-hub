# M1 Android 协议策略切片独立审核（2026-10-08）

- 受审提交：`dd9faac9d53c88a175fb05391d165e9a8006177b`
- 范围：`StrictJson.kt`、`ResourcePolicy.kt`、固定 RSA3072 公钥、四项 JVM 测试及 Node 签名入口调整。尚未接入 APP 网络、私有存储、WebView 或界面。
- 结论：**无 Kotlin 编译/API24 阻塞，可进入 M2 实现；下述目录新鲜度和公钥加载须在下载/激活路径接入前闭环。** 不能把此协议切片称作自动更新功能完成。

## 发现与后续门禁

1. **P2：Android 目录解析尚未实施当前时间判定。** `ResourcePolicy.kt` 的 `parseCatalog` 只验证 issued/expires 顺序及最长 90 天；Node `validateCatalog` 还拒绝过期和超过 5 分钟的未来目录。Android `verifyEnvelope` 当前可返回此类签名有效但已过期的目录。建议提供统一带注入时钟的 `isFreshAt`/校验入口，针对过期、未来、设备时间异常添加测试，并在 M4 查询和 M2 安装/激活的决策点明确调用。已激活离线资源不应因目录过期被删除。此项不阻止先写 M2 本地存储，但阻止开放自动下载或激活。
2. **P2：公钥必须在正式调用路径固定。** `verifyEnvelope(bytes, publicKeyDer, keyId)` 当前接受调用方传入任意 DER；这一切片尚无 APP 调用方。M2/M4 接入时必须从 APK `res/raw/resource_public_key.der` 读取并固定 `KEY_ID`，不能用目录或远端元数据选钥；加不受信任公钥替换的拒绝测试。现有测试中的临时 RSA 密钥仅是夹具。
3. **P3：公钥路径可做公开文档最小化。** 证据文档公开了本机 DPAPI 私钥文件的绝对路径，但没有密钥字节、口令或恢复令牌。若文档随公开仓库发布，可改记“仓库外 DPAPI 加密文件”，保留可审计的本地私有记录；当前不构成密钥泄露或 M2 阻塞。

## 已核对

- Android `minSdk=24`、`compileSdk=34`；解析/验签使用 `org.json`、UTF-8 Decoder、JCA RSA/SHA256、自实现规范 Base64、`SimpleDateFormat`，未在产品代码引用 API26 的 `java.util.Base64`。`ResourcePolicyTest` 中 `java.util.Base64` 仅为本地 JVM 测试。
- JSON 解析先限制字节、严格 UTF-8 和深度，拒绝重复键、非法转义/尾部；字段解析限制四个固定 ID、仓库 URL、SHA、合同、路径、MIME、大小和编号。签名校验以原始 payload 字节进行，强制 RSA3072 和 384 字节签名，拒绝未知 keyId。
- 新版 Node 与 Android 路径均拒绝 `%`，避免 WebView URL 编码层绕过；UTC 时间采用规范毫秒 `Z` 格式。公钥 DER 文件 SHA-256 独立核对为 `649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673`，与证据一致。
- 本提交的 `git diff --check` 无输出，审阅时工作树干净。仓库证据记录独立 Gradle BUILD SUCCESSFUL、17/17 JVM、22/22 Node；本审核为只读静态复核和公钥摘要核对，未重新构建、访问私钥或执行异机恢复。证据明确本机 DPAPI 恢复不等于异机备份。

## 时效批改复审：`cc0122725ad8d1f8d19bb85ceb9dbe16b89231c5`

**结论：上述 P2 目录时效缺口已闭合，可继续 M2。** `ResourceCatalog.requireFresh(now)` 与 Node 的未来容差 5 分钟、到期即失效规则一致；`verifyEnvelope` 默认使用当前时间，并允许测试注入确定性时钟。`verifyInstalledProof` 明确分离已安装完整副本的离线历史验签，避免目录到期让旧游戏无法离线使用。新增边界测试覆盖未来超限、容差端点和到期端点；仓库证据记录 JVM 18/18、BUILD SUCCESSFUL 23 秒。本次复审仅核对提交与证据文字，未重新构建。

仍需在 M2 接入时保证 `verifyInstalledProof` **仅在已核实完整且已安装的本地版本**上调用，不能作为新下载或 ready 候选的安装放行路径；正常安装必须走 `verifyEnvelope`。正式适配器仍须将 APK `res/raw` 公钥与固定 KEY_ID 绑定，不能接受远端提供的公钥。此为后续接入门禁，当前协议切片无阻塞。`git diff --check` 无输出，审阅时工作树干净。
