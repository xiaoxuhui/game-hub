# M6 文档导出切片独立审阅

- 受审提交：`b25f978121dd47f5d7f20bec39da2a80b09f7282`，`HEAD` 与 `origin/main` 相同，主仓库工作树干净。
- 审阅方式：只读检查提交差异、生产源码、设备与 JVM 测试、验收日志和独立检出文件；未在主仓库或四个原游戏仓库构建、修改。
- 结论：**本切片放行，无阻塞问题**。真实进程终止、生产下载资源版本、正式 APK 覆盖升级仍须按计划后续验收，不能据此宣称 M6 全部完成。

## 核对结果

1. `DocumentExportFlow.kt:10-52` 只持有 `Application`、请求值、单线程工作器和当前界面监听；`MainActivity.kt:151-164` 在 `onStart` 附着、`onStop` 解绑。回调结果经 `consumeResult()` 一次消费；停止期间完成的结果留到下次附着。`onCleared` 不保留 Activity。
2. `DocumentExportFlow.kt:24-46` 在工作器上以真实 `ContentResolver.openOutputStream(uri, "wt")` 写 UTF-8，在 `use` 结束后才向主线程报告；打开、写入、flush 或关闭失败都进入失败结果。`ExportTaskState.kt:12-30` 原子预约、转入写入、拒绝重复请求，直到流关闭后主线程完成状态才释放 busy。设备测试覆盖真实 file URI、故障 provider、StrictMode 无 UI 写盘和重复预约。
3. `MainActivity.kt:75-85,151-176,586-607,810-845` 将系统返回的 URI 交给同一 ViewModel；失效 WebView、停止、加载失败、保存或安装冲突、重复文件选择器均给新回调 `null`，保留原有效回调。保存请求只在主线程二次校验并成功启动系统选择器后返回受理。强制 `ActivityScenario.recreate()` 测试验证 ViewModel 和待保存请求保留；普通 Light 旋转由 manifest 配置处理且设备实际验证同一 Activity。
4. `DocumentExportTest.kt:70-133` 通过四个实际网页按钮进入系统 DocumentsUI，选择文件并读取 JSON 验证格式；四个本地 ignored 文件的字节数和 SHA-256 与提交索引一致，原始 JSON 未被 Git 跟踪。`doc/evidence/m6-export-final-tests.txt` 记录独立检出 JVM 62 项、设备 6 项通过，Gradle `BUILD SUCCESSFUL in 2m 13s`。首次编译及五轮设备失败和对应批改日志保留。补丁 `git diff --check` 通过。
5. 进程死亡边界写明未保留内容；无请求而 URI 返回时 `DocumentExportFlow.kt:27-31` 明确提示失效，不写入也不声称保存成功。设备测试模拟缺失请求；真正杀进程后返回仍待后续验收。

## 证据精度与后续建议

- 独立构建目录的三个生产 Kotlin 文件与提交内容一致。`DocumentExportTest.kt` 与提交版本仅差在四游戏测试外层新增的 `try/finally` 及其缩进，`finally` 用于失败时复位旋转和无障碍标志；断言主体一致。最终日志直接证明旧测试版本通过，新增清理结构未在该日志中重新编译执行。建议下一次独立检出测试时确保测试源码也与提交完全一致，并在证据中记录提交 SHA，避免审计歧义。此差异不改变本切片的生产行为或通过断言，非阻塞。
- 真正进程终止时系统 URI 返回、下载资源版本中的四个导出桥和正式发行 APK 覆盖升级，按现有计划继续验证；本轮通过结论只覆盖当前内置资源与记录的模拟器路径。
