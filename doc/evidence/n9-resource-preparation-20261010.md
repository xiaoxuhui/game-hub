# N9-C 资源生产与发行准备

- 生产源码：`1c548febd08177cfb29e7ca9da0a74fe755212fa`，已推送、干净独立检出 `D:\soft\.ci-tmp\game-hub-n9\work`。
- 两次实际执行 `node scripts/dynamic-resources.mjs`，六个输出文件逐字节 SHA-256 相同；再执行 `--verify`，4 个 ZIP 的完整文件集合/固定来源 blob/摘要均通过。
- 红绿资源：`game-red-green-puzzle-1-81edc7c967f7.zip`，14,620 字节，SHA-256 `81edc7c967f7cdfabd1a1e8707b677ec0d930d63e12cc0b8d427f65261767c62`，固定集成提交 `31eec2e638357d8e3e6a0550afc780e09bdaac49`。
- 旧三游戏资源 SHA 不变：memory-demo `178d01e9ee05f66cf22d4dd8c77fd3ddd47cb94bfce20e6e38fe406f9fde8442`；Abel `8e9db7fc872072b43ed035673107d58e86bd6e486f83b05d44f57bb392f369e5`；Lambda `5e418cdff45e84ea6ed0b3b1d29d99e0ebb4d1841bc5f2171d48b20f1bf81bb8`。
- 本地 `node --check scripts/bundle.mjs`、`node --test`：46/46，0 fail/skip；完整日志随报告归档。
- 精确源码 CI [37964464871](https://github.com/xiaoxuhui/game-hub/actions/runs/37964464871) 为 completed/success，head_sha 与生产源码相同。它验证四固定来源和 Android 调试构建；本轮红绿实际浏览器测试见 N9-B 报告，不把 CI 宣称为浏览器或正式设备测试。
- N9-C 发行器首审发现参数大小写接受范围与分支不一致，独立提交 `1c548fe` 修复后复审 CLOSED；保留首审和批改记录。

## 开源发行十项核对

| 项目 | 实际证据与结论 |
|---|---|
| 许可证 | 根 MIT 抬头、2026 xiaoxuhui 与 package.json MIT 相同；新包携带完整固定上游 MIT，来源证明验证通过。PASS |
| 清单 | package.json name/version/repository/homepage/bugs/engines/packageManager 完整；APK仍0.4.0，动态红绿1.0.0；private=true，项目不发布npm。PASS |
| CI | 上述精确提交实际 success，本地对应源码检查/46测试通过。PASS |
| 测试 | 实际46项及N9-B两视口交互证据；正式WebView发布后验收仍待N9-D。PASS（准备范围） |
| CHANGELOG | 已有0.2/0.3/0.4发行条目；新增资源发行后补实际seq4记录。PASS |
| 标签 | 实际git tag有v0.2.0/v0.3.0/v0.4.0/game-resources-v2；本轮不移动正式标签，不重发APK。PASS |
| 文档 | 实际检查README 26条本地文件链接，missing=[]；运行、测试、结构、许可和资源维护流程齐全。PASS |
| 治理 | CONTRIBUTING/CODE_OF_CONDUCT/SECURITY、issue/PR模板、dependabot存在；SECURITY真实联系邮件存在。PASS；v0.4措辞应同步已发布状态 |
| 卫生 | 实际git status干净；git diff --check通过；忽略构建/密钥/APK；源码密钥模式扫描只命中发行器在内存拼接PEM头的代码，没有密钥正文。PASS |
| 网页专项 | 已有大厅截图；红绿浏览器截图及完整交互报告已归档。独立页面用HTTP/模块脚本运行，不承诺file://跨浏览器支持。建议项，不阻塞 |

无发行准备阻塞项。实际签署/线上激活及正式客户端验收尚未执行，继续N9-D。用户已授权无人值守发行；无需再次询问发布权限。
