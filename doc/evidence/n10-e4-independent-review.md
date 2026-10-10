# N10-E4 提交后独立复审

- 受审提交：`a5cfca3af922783ad4df992ae9ef3486070215ce`；固定 APK 源码：`fc9da9be6a238018d86f2085facd5b8085e68cf8`。
- 结论：**CLOSED**。E4 固定候选与新宿主完整通用设备门禁的证据足以支持本切片完成；E5 的正式签名设备查询、同证书覆盖升级及后续发布仍待执行。

## 独立核对

1. 工作检出为受审提交且干净。`fc9da9b..a5cfca3` 的差异只涉及计划、D/E4 文档和证据；`android`、`scripts`、`tools`、`resources` 无差异，`git diff --check` 通过。因此当前 APK 的源码绑定仍为 `fc9da9b`。
2. 对实际文件独立复算：正式 APK `2,654,159` 字节、SHA-256 `9f57c90af42efea54e4e079d637d964346a78e7e880493eac7887f9aaac323da`；伴随测试 APK `3,019,593` 字节、SHA-256 `3ef81927a6b9e5ad006231bc9ceee5d8533d834e8699aca6322ab9cc948ab978`。与身份清单一致。签名记录为原证书 `44e92c1a…07125ae2`；`verify_apk.py` 记录固定提交的四个内置来源、40 个资源通过，报告记录 code 5 / name 0.4.1 / DER `649107…`。
3. 独立逐 ZIP 条目比较签名前 Gradle 输出与签名后的正式 APK：应用 170 项、伴随测试包 9 项的内容 SHA 全部相同；各仅增加 3 个 `META-INF` 签名项。这也闭合了“签名时 Gradle 最终任务仍在运行”的内容绑定疑虑；最终 release 构建日志确实以 `BUILD SUCCESSFUL in 2m 14s` 结束。
4. 归档 Node 日志为 53 通过、0 失败；17 个 JVM XML 汇总 95 测试、0 失败、0 错误、0 跳过。精确源码 CI `38070554881` 记录 `head_sha=fc9da9b…`、`completed/success`。
5. 独立解析设备原 XML：70 项、0 失败、0 错误、13 显式跳过、57 实际执行，设备名为独立 `gamehub-n10-debug-20261011(AVD)`。最终 Gradle 记录 `BUILD SUCCESSFUL in 3m 44s`。13 个跳过均列名，包含需要专门正式宿主、外部进程中断或升级控制器的测试；报告没有用控制台累计的 83 代替真实 XML 计数。
6. 首次未就绪安装和 PowerShell 错传 `-P` 参数的红灯分别保留，后者日志明确显示 Gradle 找不到误传的 task；更正命令后才有上项绿灯。七个原仓的 SHA/工作树状态清单均标记与基线一致，既有 EML 22 项仍保留。

## 边界

本次 57 项是在全新 **debug** AVD 运行。历史 memory code 1 与未来 code 6 / 0.4.2 是测试专用夹具，未来版本没有被当作已发布资产；`UpdateFixtureTest#newerSameSignerApkPassesPreflightAndProducesSystemInstallerIntent` 在 XML 中实际执行并通过。此证据不覆盖正式签名 APK 在保留旧数据的 AVD 上查询、断网、正式未来包预检或同证书覆盖升级；报告将这些正确留给 E5，且未宣称 0.4.1 已发布。无新增阻塞项。
