# N4 固定 v2 客户端与共享任务门禁首切片独立审阅

- 受审提交：`1fab29562690c7d8ebabac0e03aa5ad4b4c89c0a`；核查时 `HEAD=origin/main`、主仓库干净。只读审阅，未在主仓库或四个原游戏仓库构建、修改，未新建克隆。
- **结论：无阻塞项；本狭义切片可标 VERIFIED 并进入协调器接线切片。** `git diff --check` 无错误。

## 核查结果

1. `ResourceStorePolicy.kt` 把 v1/v2 release tag、更新通道及下载种类写死在应用内的 `BUILTIN/DYNAMIC` 枚举；v1 默认仍指 `game-resources-v1` 和四固定 ID。`ResourceCatalogClient.kt:19-64` 默认策略不变，只有显式动态策略才请求固定 `game-resources-v2`；同一固定 GitHub API、预发布标志、完整分页边界/重复资产拒绝、签名目录字节 SHA/大小、对应策略验签与新鲜度、Release ID、每项 ZIP assetId/名称/状态/大小/摘要均在返回 offer 前验证。没有从目录或用户设置接受任意 URL、仓库或信任根。
2. `ResourceOffer.kt`（定义于 `ResourceCatalogClient.kt:7-16`）在预约前确认目录仍新鲜、目标条目与已验目录完全相同、ID 属于策略且 `available=true`；退役条目仍由查询核验其资产，但不能预约下载。动态 offer 生成 `DYNAMIC` token；旧调用缺省仍是 `RESOURCE`。
3. `UpdateTaskGate.kt:26-89` 仍仅有一个 active token。动态下载参与前台/大厅、联网与计费网络、自动设置撤销、人工取消、修复抢占及完成清理，busy 保持到 `finish()`；APK、v1 和动态三退避分别由 `apk/resources/dynamic` 键管理，无参 `canAutoDownload()` 继续代表旧 v1。`UpdatePreferences.kt` 保留旧键，仅追加 `backoff-dynamic`，旧安装读取为 0；设备测试覆盖写入后重建与三个限流时间互不混淆。
4. 独立测试证据：强制 release JVM 82 项、失败/错误/跳过均 0，42 秒、24 任务实际执行；构建 70 任务中 13 实际执行，7 秒；同发行证书开发 APK 与仪器 APK 上 `UpdatePreferencesTest` 3 项通过、0.322 秒。签名日志显示固定证书与 code4/0.4.0；这些是中间候选，不是最终干净发行 APK。
5. `doc/evidence/n4-v040-client-gate-slice-20261009.md` 准确声明协调器尚未调用 v2 客户端、未实现首装手动/已装自动与共享预算生产验收、动态注册 UI 仍待后续；N4 整体保持 PENDING。归档的前 N3 独立复审与本次范围没有冲突。

## 下切片核验重点

协调器接线时，应保证所有动态下载均由对应已验 `ResourceOffer.reserveDownload` 预约，首装必须手动、已装才可自动；下载后由动态 store 复核签名目录及共享容量。需要设备或受控网络证据覆盖三个通道互不串扰、取消后 busy 直到实际文件/连接清理、动态 403/429 单独持久退避，以及退役/不兼容项不进入下载队列。本次放行不代表这些生产行为已完成。
