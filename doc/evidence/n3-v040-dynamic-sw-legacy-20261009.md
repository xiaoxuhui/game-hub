# N3 动态 Service Worker 与旧四游戏回归切片

- 状态：设备验证通过，提交后独立审阅待闭环；N3 保持 PENDING 至本切片审阅完成。
- 目标 APP：独立检出开发候选 `64c1e3a0fa61bc1480fb53cf770f43036166da026a1827a976eb97f73bfe0d13`，同证书 code4/0.4.0；不作为最终发行候选。
- 构建与设备：仅复用独立检出 `D:\soft\.ci-tmp\game-hub-work\v030-final` 和任务 AVD `gamehub-upgrade-20261009` / `emulator-5564`。没有修改原四游戏仓库。

## 动态 origin 的实际 Service Worker

`DynamicOriginWebViewTest` 新增两项真实 Chromium/WebView 用例，连同原两项隔离/CacheStorage 共 **4 项通过，3.372 秒**。

1. 在 `https://memory-demo.appassets.androidplatform.net` 实际注册游戏路径范围的 Worker，缓存旧入口，确认新建 WebView 确实受到 controller 控制并显示 `DYNAMIC_OLD_PROXY`。关闭这些页面后执行生产 `ResourceCacheGuard`，解除 Worker 并删除已登记缓存；再次新建 WebView 显示 `DYNAMIC_FRESH`、controller 为 null，测试存档标记仍保留。
2. 实际注册根范围 Worker，并缓存带伪造 `{ok:true,safe:true}` 的检查页。生产门禁返回 `canActivate=false/canPlay=false`、旧代理错误；进度标记和伪造缓存内容均保留。测试最后只清除自产注册/缓存和恢复测试前标记，重新设置生产 Worker 拦截器。

这里使用可控 HTML 响应及 ServiceWorkerClient 作为旧代理夹具，未把这些模拟页面称为正式游戏资源。固定来源完整示范经真实签名 ZIP/生产 resolver/桥加载的证据由上一切片覆盖；普通动态目录安装和注册仍属 N4。

动态 Worker 仪器 APK SHA256：`0084d417c4ecc778b8bb258ada361e3670512bfd0fb0394b1c5dff180c153989`；签名日志归档。

## 禁用 Cookie 后的旧四游戏回归

`ResourceStorageCompatibilityTest.loaded` 明确应用生产 `WebViewCookiePolicy.disable/configure`，每次实际页面读取均断言 `document.cookie` 为空。它覆盖真实游戏内置→已校验下载资源→恢复内置三个版本阶段：康威实际图案库、EML 选择状态、光学星级、图灵编辑器项目与 campaign 草稿五页，以及下载图灵模块 Worker 的真实协议完成。

同一设备进程还实际执行下载资源的四游戏系统文件导入/导出、旧四桥系统导出及旋转/重叠/停止回调负例、旧 origin 的 resolver/cache/Worker 保护：

- `ResourceStorageCompatibilityTest`：6 项。
- `DownloadedDocumentBridgeTest`：1 项，显式 `downloadedDocuments=true`，实际四游戏导出→系统导入→再次导出。
- `DocumentExportTest`：5 项，其中实际四桥 DocumentsUI 导出。
- `ResourceWebViewTest`：4 项，旧来源路径/存档/Worker/伪造门禁回归。

**真实输出：OK (16 tests)，108.185 秒。** 仪器 APK SHA256：`b7f57d80cb0885d3bbec749a5557a93d4494f7800198020c15eaaf1a061e5cb5`；同发行证书 `44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2`。

本回归使用任务模拟器上自有测试存档，未声称保留其早前 v0.3 基线状态；N5 正式 v0.3→v0.4 五页升级仍在保留的另一任务 AVD 单独验收。原仓库只读基线也不由模拟器测试代替。公开日志仅通过计数/自有路径及摘要，原始导出正文不入仓库。

## 后续

本切片独立审阅闭环后，N3 可按上述真实测试范围归档。N2 跨 store 生产串行容量门禁及 N4 三通道/发现注册/普通安装/恢复链路仍未完成，不用这些夹具测试替代最终客户端验收。

- [ ] N7：两个新游戏资源包及正式大厅动态新增验收。
- [ ] N8：全部发布验收后的临时目录和文件集中清理，包括任务设备自产导出及夹具残留。
