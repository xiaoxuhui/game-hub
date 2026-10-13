# N13 Lambda 资源准备

2026-10-13。用户授权启动服务及上传大厅。Lambda 原工作树未修改；服务 PID6436、57695返回当前方向选择器。大厅旧资源0.3.1/code2，新资源0.3.3源修订/code3，固定上游a5eab9f5c14f33d328f39858b6680e43c41ffa25，集成提交a7d3027cf6da87b16ad81ea9ee371b8c84f14989。

## 测试与来源

- 独立克隆上游并正常构建/同步：162单元/结构检查通过、0失败、0跳过，2^10与3!仍完成。
- 大厅`node --test`：80通过、0失败、0跳过，日志在唯一过程根`D:/soft/.ci-tmp/game-hub-n13/evidence/hall-unit.log`。首次沙箱内两个Git/目录重命名检查因AppContainer权限失败；正常临时目录重跑通过，未放宽测试。
- `node scripts/lambda-hall-browser.cjs`：桌面1280/手机390各5项，共10通过，Chromium151.0.7922.34，页面错误0。旧→新迁移、原文编辑、混合路径、刷新、保存点、旧资源回退、新资源再进入、备份/清空/导入及原生能力失败保留内容均实际操作。截图见[n13-browser](n13-browser/)。原生桥模拟分支不是正式安卓设备实测。
- 首轮命名test-lambda-hall-browser导致Node自动单元发现浏览器脚本；已改为显式lambda-hall-browser，专属CI安装Playwright后运行，普通Android CI无需浏览器依赖。未削弱功能断言。
- 两次`stage-upstreams.mjs`三个Lambda文件逐字节一致。原HTML106649字节，已追踪dist与重建相等；适配HTML107581字节，SHA256 `2a50bce86a745b5c46cb3da8e3ac8ea6ad3a876c84c327ace5b0fab33dc78795`。MIT1066字节SHA256 `12eb4f44e3289367dbba7f173765735d8b7d2bfefa4f027f90d8e38f834838ec`；来源证明3360字节SHA256 `68cc5c84fce64795543154fafbc8178ba5b459cfd05788cd880732a736ba5e5c`。
- proof记录原构建输入/原产物及明确存储适配摘要；既有原构建相等门禁保留。迁移先解码两旧记录，写失败回滚新键，旧键从不改/删；新版空状态不触发再次迁移。旧版继续进度与新版后续进度独立，用户可导出/导入到新版。

## 十项发行审计

| 项目 | 结论与证据 |
|---|---|
| 许可 | PASS：大厅及源完整MIT，2026 xiaoxuhui，清单license MIT，三文件包包含原LICENSE |
| 清单 | PASS：package name/version/repository/homepage/bugs/engines/packageManager齐全，private:true不发布npm；大厅APK版本0.4.1保持 |
| CI | 新增固定Playwright1.56.1浏览器兼容CI，Node本地80通过；当前提交远端结果另行核验 |
| 测试 | PASS：上游162、大厅80、实际浏览器10；迁移/路径/坏数据/写失败/旧数据保护已覆盖 |
| CHANGELOG | 已有0.4.1与资源seq6发行记录；本次seq7发行后补充，不虚称已发布 |
| 标签 | 已有正式标签，v0.4.0与game-resources-v2保持固定旧SHA；新资源不移动标签 |
| 文档 | README覆盖用途、运行、构建、许可及存档；N13需求/设计/计划记录新旧进度分离 |
| 治理 | CONTRIBUTING/CODE_OF_CONDUCT/SECURITY/模板/dependabot已有，真实联系xixuui@qq.com |
| 卫生 | 新资源严格仅HTML/LICENSE/proof；私钥仅既有DPAPI内存解密/stdin，未进入源码或日志。发行器语法解析与diff检查通过 |
| 网页专项 | 服务当前可用，桌面/手机实际交互截图可见；离线资源不依赖CDN |

候选还需干净独立重建与旧其它三资源字节核验、公开签名发行/全历史ZIP校验。正式宿主设备验收与本地浏览器证据分别记录。未声称新增资源已在真机验收。
