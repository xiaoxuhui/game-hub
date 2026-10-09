# N9 红绿变换适配阶段验证

- 日期：2026-10-10；范围仅独立检出 `D:\soft\.ci-tmp\game-hub-n9\work`。
- 上游固定 `592027dbc5cab9cb83f91b904f4f23a9e3cbe24b`，Git原HTML SHA `9ff81f454bf07ba20bfe3e37615b082f049b509ea5ba8d5d2b881c380151d60d`，10727字节；原目录盘点的是工作树实际字节摘要，Git文本检出规范化后另记录blob摘要，不混称相同原字节。源SHA不浮动。
- 完整MIT SHA `12eb4f44e3289367dbba7f173765735d8b7d2bfefa4f027f90d8e38f834838ec`。`node scripts/red-green-source.mjs --write`从独立冻结检出验证输入Git blob后记录4个适配输出；常规verify再次校验已固定的输入/输出。

## 实际命令与输出

1. `node --test tests/red-green-puzzle.test.mjs`首轮3/3，后加来源测试；最终`node --test` **46通过、0失败、0跳过**，其中4条红绿回归，其余42条大厅既有测试。记录见`n9-feature/node-tests.txt`。
2. 1..10每个输出与冻结源算法一致，每步翻转合法、无重复、全0到全1；另用整数位掩码独立BFS枚举全部合法邻居，路径距离逐项相同。10位682步/683行。
3. 0/11/20/负数/小数/NaN/Infinity/非数类型在分配前拒绝；text完整到最后一行；坏schema、20位旧参数、坏JSON默认6。
4. `node scripts/verify-red-green-browser.mjs <task-evidence>` **两个真实视口场景、0 pageerror**：移动390×844（触摸）、桌面1280×900（Enter）；默认6、10位683行、0/11/20/-1/1.5/空输入保留上次结果和参数、重复生成不追加、重载恢复10、无页面横向溢出。
5. 剪贴板成功分支为注入的writeText接收器，验证完整文本；拒绝分支为writeText和execCommand都故意失败，实际页面显示可选完整文本及手动复制提示，不把该分支称为真实系统剪贴板验收。损坏/存储权限拒绝后页面仍可生成6位，0 pageerror。
6. 最后一次浏览器观测10位点击到DOM完成为移动109ms/桌面61ms，属于本机Chromium观测，**不是Android真机性能保证**。截图4张见`n9-feature`，实际目视移动默认与桌面复制降级图，布局/文字/色块可见，无覆盖。

Node对新增core.js提示MODULE_TYPELESS_PACKAGE_JSON自动按ES模块解析，测试全通过；浏览器使用明确type=module且无页面错误。全量输出中“unable to read tree ffff...”是既有失败checkout回归的故意负例，随后该用例及总46条通过，没有跳过/删除断言。

正式签名资源、原APK实际WebView复制/参数恢复/离线仍在N9-D；当前记录不提前声称已发行或Android验收。
