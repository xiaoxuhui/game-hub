# N5 v0.4.0 匿名在线信任根路径批改独立复审

日期：2026-10-09。范围：已发布 v0.4.0 / game-resources-v2 后，`verify_v040_online.ps1` 对 APK 优化资源路径的批改及重新运行的匿名下载验证。本次只读检查公开资产、脚本和非秘密证据；未更改主仓库、四个原游戏仓库或发布资产。

## 结论

**本次路径批改无阻塞，可以继续公网客户端验证。** 固定源码仍为 `4aacb1f81b7fc381d2ca7fd725fd93dd109e390e`，主仓库 `status --short` 为空。正式公开 APK 的本地重算 SHA-256 为 `c6e071e18eac1cb97f3d898d6eb4dab2c790b8d9310a907a7e44e3c34a78ee39`，与先前获准发布的固定候选一致。

## 核查

1. `D:\soft\.ci-tmp\game-hub-maintenance\verify_v040_online.ps1:35-50` 从已匿名下载且通过固定 APK SHA 校验的 APK 读取 `res/**.der`，只接受 SHA-256 等于固定生产公钥 `649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673` 的唯一条目；重复或缺失均失败。提取后再次校验该摘要。脚本没有从本地秘密或私钥获取验签根。
2. 对该公开 APK 的 `aapt dump --values resources` 只读检查显示 `com.xiaoxuhui.gamehub:raw/resource_public_key` 的实际打包路径为 `res/Fe.der`，与原先预设 `res/raw/resource_public_key.der` 不同。已提取 DER 的独立重算摘要为 `649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673`。因此本次批改针对真实 APK 优化后的资源路径。
3. 新 UUID 目录 `D:\soft\.ci-tmp\game-hub-work\v030-evidence\v040-release\anonymous-downloads\f3030e78ddec4d75b04e02edcc246b7a` 包含匿名下载的 8 个资产、提取的 DER 和两个通道的完整快照。`anonymous-verification-process.log` 显示 v1/v2 签名及完整当前 Release、全部资产绑定均通过，并以 `ANONYMOUS_V040_EIGHT_ASSETS_AND_APK_TRUST_ROOT_VERIFIED` 结束。`anonymous-online-verification.json` 记录正式 Release `407395194` / APK 资产 `623483084`、v1 Release `407293817`、v2 Release `407394942`，8 个资产。独立重算 v2 catalog 摘要为 `0bc8cf66fe67f030b6628bc7e761b466ea8b53d8bf4d3c46d29788178dcfba68`。
4. `verify_v040_online.ps1:51-55` 将该 APK 提取的公钥传给 v1/v2 目录验签，再执行完整快照绑定验证；资源入口扫描未放宽先前固定的 APK 字节、签名、下载摘要或 Release 资产集合检查。

## 非阻塞证据说明

首次失败留存的 `anonymous-trust-root-path-failed.txt` 当前为 **0 字节**，它本身不能证明当时失败的具体错误。旧 UUID 下载目录存在且缺少提取的 DER/完成快照，与在信任根读取处中止相符，但不能替代错误文本。请在后续发行记录中如实说明这一留存限制；本次新运行的成功日志与独立哈希足以支持批改闭环。

本审阅只确认匿名资产、生产 APK 公钥提取、两个目录签名与公开 Release 绑定。公网客户端真实发现、下载安装及启动另按 N5 门禁验收。
