# N3 动态 Worker 与旧四游戏回归切片独立审阅（2026-10-09）

受审提交：`99f2eac85ccfacfc78ca7aeabe7679c0976e3a0a`。审阅时 HEAD 与 origin/main 相同、工作树干净、`git diff --check` 无输出。仅只读核对本提交两项 Android 仪器测试、生产门禁调用、原始编译/设备/签名日志及前一 `b71d14a` 切片已闭环的审阅记录；没有在主仓库或原游戏仓库构建/修改，也没有新建检出。

## 实际核对

- `DynamicOriginWebViewTest.kt:146-166` 在动态派生 origin 上实际注册路径范围 Service Worker，把旧入口放进 CacheStorage；新 WebView 先断言 `DYNAMIC_OLD_PROXY` 且有 controller，再调用生产 `ResourceCacheGuard.inspectAndClear`。清理后另建 WebView 断言 `DYNAMIC_FRESH`、无 controller，原 localStorage 标记仍在。该测试确实覆盖“旧代理真实控制→生产门禁解除→新页面未受控”，不只检查注册列表。
- 同文件 `:168-184` 注册动态根范围 Worker，并放入带伪造安全结果的缓存检查页；生产门禁给 `canActivate=false`、`canPlay=false` 与旧代理原因，标记和未知缓存保持。此处证明伪造检查不能授权；夹具 HTML/Worker 并非正式游戏资源，测试只清自产注册/缓存并恢复生产拦截器。签名 ZIP、生产 resolver/WebView/统一桥、实际 SAF 导入导出及示范交互已由上一已复审切片覆盖；普通目录发现/注册与首装仍为 N4。
- `ResourceStorageCompatibilityTest.kt:28-40` 在每次旧游戏 WebView 创建前调用生产 cookie 禁用/配置，并在加载后断言 `document.cookie` 为空。既有六项测试继续跨内置、签名下载资源、恢复内置三个阶段读写康威图案、EML 选择、光学星级、图灵项目和 campaign 草稿五页，另含下载图灵 Worker；同一组合执行中的下载四游戏 SAF 导入导出一项、旧文件桥五项、旧来源/缓存/Worker 四项，日志列项数 6+1+5+4=`OK (16 tests)`、108.185 秒。新增动态四项日志 `OK (4 tests)`、3.372 秒。
- 两份仪器 APK 的归档 `apksigner` 输出均为发行证书 SHA256 `44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2`；归档 SHA 分别为 `0084d417c4ecc778b8bb258ada361e3670512bfd0fb0394b1c5dff180c153989` 和 `b7f57d80cb0885d3bbec749a5557a93d4494f7800198020c15eaaf1a061e5cb5`。两次独立检出测试 APK 重编译日志均成功（43 任务中 5 执行）；目标 APP 复用已审 code4 开发候选，文档没有冒称最终发行候选。
- `doc/evidence/n3-v040-dynamic-sw-legacy-20261009.md` 对自有模拟器存档、旧 v0.3→最终 v0.4 升级另测、N4 普通动态发现/注册、N2 双仓库并发预算门禁的边界清楚；未把测试夹具页面、磁盘标记或设备自有存档说成生产完整链/用户原始存档。公开归档未见密钥口令或导出正文。

**结论：本切片未发现阻塞，提交后独立审阅闭环。结合前一 N3 示范切片及已闭环的基础 origin/桥切片，N3 可按实施计划所列真实浏览器、WebView、桥、隔离与旧四游戏回归范围归档完成，并进入 N4。N2 跨 store 串行容量门禁、N4 普通发现/注册、N5 正式升级与发布仍须后续验收。**
