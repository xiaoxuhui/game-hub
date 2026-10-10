# N10-C3 三资源生产及兼容证据独立审阅（2026-10-10）

受审已推送报告提交：`2cedfd03c93a55c194a80333b685d9fb7dd5a6d7`；实际生产绑定源码：`35fb2b5061c9127a61fec8908d10de23d5514e8e`。结论：**CLOSED，本切片无阻塞项**。只读审核，不改产品、原仓、候选文件，也不执行构建、签名或发行。

## 生产与来源

- 独立重算 `work` 与 `repeat-producer` 两套 `.build/{resource-candidate,dynamic-candidate}` 的文件集合、字节长度和完整 SHA-256：两边各 **12/12** 与 `n10-c3/repeated-candidate-hashes.json` 一致，无额外或缺失文件。包括 8 ZIP、2 `games.unsigned.json`、2 `candidate.json`，不只是三个新 ZIP。两套严格生产日志均记录完整来源 `35fb2b5`、4 源/40 文件以及资源 ZIP 与清单验证。
- 候选清单实际记录：光学 `1.2.1/code2`，上游 `85163534ccae2b023928c877e002581a8f35f0cb`、合同 `light-baseline-v1`、ZIP `19adc2db9b143289c4c8fa6b83d024209ce050fd7744888bd932a7035d115267`；图灵 `0.5.1/code2`，上游 `32eb3b95eb78eab703abe8e64214bd8dbbb939c7`、合同 `turing-baseline-v1`、ZIP `ad26e84c8b60d88bcff9f6569172e2f2e518aa031e036ecafd1432731f63af43`；Lambda `0.3.1/code2`，受审大厅集成来源 `64c8932af9a0b5cc886db25910b3923a16aa0677`、合同 `lambda-diagram-game-dynamic-v1`、ZIP `0ee2f0ef41545e2364172a3ec2c74481c9cb16ae3c6361a66786f24d0594cdb9`。其上游标签 SHA 已在 C1 来源证明绑定。原四款 APK `sources.lock.json` 与 `f3e0ed1` 对比为空。
- 首轮候选两个锁摘要因工作检出 CRLF 与 Git blob LF 不同而未达到 12/12；归档的 `normalize-own-locks.mjs` 仅在双检出同 `35fb2b5` 且干净时回写该提交的三个锁 blob，随后两个工作树再通过严格普通生产和全量摘要。该过程是可复现输入纠正，未改产品源码或跳过 clean gate。报告提交 `2cedfd0` 后在 work 对旧候选运行普通 verify 得到预期 `Stale candidate commit or source lock`；这不推翻绑定 `35fb2b5` 的成功生产。D 阶段必须在新干净精确提交重生产，再执行普通 verify，不能直接发布本次旧 candidate。
- 阅读 `scripts/audit-storage.mjs` 后独立运行只读 `node scripts/audit-storage.mjs --resources`，输出 `Verified 6 distinct storage keys in four independent resource bundles; no direct broad clear`。脚本核四内置资源的六个确切键并拒绝直接 broad clear；这个静态审计不等同所有运行时存档行为验证，浏览器实操另见下项。原生产报告已有命令，若希望日志自包含，可在后续证据归档引用此独立复核输出，无需为本切片重建资源。

## 实际浏览器与声明边界

- `n10-c3/browser.mjs` 路由同原点 `127.0.0.1:18417` 的旧正式内置游戏字节与新生产资源字节。两视口（390×844 触摸、1280×900）各测光学/图灵，结果 **4 组、pageErrors 0**。光学通过 UI 完成旧教学、选择镜子并放置、命名工作台；切新版本后严格比对本地存档对象、恢复布局；两次清空并确认落盘为空后撤销恢复。图灵经 UI 输入/应用/单步并编辑关卡草稿，切新版本后严格比对项目和草稿存储字符串，再实操单步与复位；两个游戏的额外存储键均保持。脚本仅把测试结果及断言文字归档，未公开原始存档。
- 首次等待旧教学星数立即持久化、第二次遗漏工具选择均实际超时，失败日志保留；第三轮脚本修正操作后才 PASS。四张截图目视光学镜子/工具与图灵纸带/控件正常，手机图灵下方设置需滚动，截图不证明所有控件同屏。Lambda 旧 0.3.0→0.3.1 保存点/普通导入/完整备份兼容由已 CLOSED 的 C1 证据支持。
- 本轮仅是冻结资源字节的桌面 Chromium 兼容与确定性生产；正式 Android 安装、签名目录发行、APK 覆盖升级在 D/E 阶段。计划 C 状态仍需本报告归档后按流程更新，不能把 candidate 视为已发布资产。
