# C2 康威兼容资源证据

此目录当前记录B2资源界面集成，尚未发行康威新资源。

另含9f83a7f实际候选两次生产、ZIP浏览器22项、资源七键审计、大厅123项、固定源170项首跑/Android同步后九项绿、精确CI及只读v1下一序列4预检证据。完整说明见[N28-C2测试与发行报告](../../../N28-C2测试与发行报告.md)；原始日志摘要与公开路径脱敏/LF处理见evidence-metadata.json。发行producer最终核验仍待完成，旧三游戏完整对象不变的预检为字段比较，不因JS null-prototype差异误判。

- 固定上游：a531a560b3ecce070be80fb6470cbc916971bce4；旧reader：7d857cc9b9eb6a9ccf55afc15f05b0a2079970be。真实源UI三文件以tests/fixtures/conway-a531-*.txt保存；正文与固定reader均遵循上游MIT许可证，版权2026 xiaoxuhui，见conway-source.LICENSE。
- 命令：`node --test tests/conway-resource-ui.test.mjs`，2/2通过；输入/身份篡改拒绝，未授权输入在写前拒绝，输出/proof逐字节绑定。
- 命令：`node scripts/conway-hall-browser.cjs --integration`，在本轮独立固定源检出执行；桌面1440×1000、手机390×844，共22项通过，pageerrors=0、external=0。真实旧reader读取新导出、生产桥JS/native stub、匹配候选全部展示/显式选择、取消、旧基础变化、坏文件、集合导入、配额失败、坏档原文导出、显式清理、存储拒绝仍单步/导出及异游戏键保护；新增空世界规则/代数/变化视图完整保全、取消保护及存储不可用仍手动导出。
- 首轮夹具误把同规则不同原文当唯一导致strict locator错误；修为核对全部实际归档条目。新增快捷键负例曾在选择弹窗期间修改背后世界，实际红；修后同一交互绿。原始红/初轮日志私有留存，不隐去失败。
- 首审两项P2分别实际红：`empty current world including changed view must survive replacement`、`empty custom world must have a manual export route`。改为导入前无条件保全当前完整世界、资源界面空世界导出可用，两项桌面/手机实际绿。新增测试首跑的modal异步夹具竞态另行保留，等待真正关闭后才构成上述两次产品红。
- 手机截图已实际查看，无横向溢出，新增管理入口采用原页面button样式。原生modal中的快捷键不再透传到世界。
- 浏览器为Chromium，路径模拟`/assets/games/conway/`并使用生产CSP/导出桥；不声称Android WebView、SAF、物理机、Safari或离线冷启动通过。实际候选ZIP/重复生产/CI和发行另验。

单元及浏览器实际输出随提交保存；B1模块13专项/120全根与独立CLOSED历史见N28开发与审阅记录。
