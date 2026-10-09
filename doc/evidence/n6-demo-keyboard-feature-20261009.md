# N6 示范键盘兼容功能切片

日期：2026-10-09。计划0f15afa提交后独立审阅通过；本切片尚未成为正式资源#2。

- app.js增加cardButtons/focusCard/render(focusIndex)：翻牌重建后保留焦点，匹配禁用后移向下一未配对牌，全完成后聚焦重新开始；原生Tab/Enter/Space保持浏览器行为，四方向/Home/End仅选牌。index.html增加用户按键提示。
- 存档核心/schema/key/桥/入口均为已发布#1合同，core.js SHA `cb22b3116f8735b4813ca89eadc2553e00203cb4aa53381fd5c44a19223946eb`；动态来源锁仍指向已发布#1，功能commit-review闭环后才填新完整源码SHA，不自引用当前未提交来源。
- 复用独立检出0f15afa并复制两候选文件，固定pnpm11.19真实Node35项/0失败；不在开发主工作树或原游戏仓库构建。
- Chromium151.0.7922.34、390×844，六组实际DOM/原生按键/文件input与download/旧schema重载通过，pageErrors0。浏览器隔离上下文通过localhost本地请求路由加载独立候选的精确文件，运行结束关闭；没有用伪DOM证明焦点，没有把此结果冒称Android SAF或正式公网更新。
- 主工作树与独立候选 app.js/index.html/core.js 摘要和浏览器记录一致；手机尺寸截图已实际查看，提示和牌/控制无重叠。原始自行生成导出只留忽略目录；公开仅144字节与SHA `5dd0b7e0147736ab08693a8032661c82de834284bb0d3d61d7a6760b66e14c05`。
- 验收脚本初试Windows绝对模块路径缺file URL，Node加载前ERR_UNSUPPORTED_ESM_URL_SCHEME；改file:///后运行通过。初次失败与批改脚本一并保留。

证据：[n6-demo-keyboard](n6-demo-keyboard)。本切片提交后独立审核闭环再执行来源锁/重复生产和正式签署；N5固定v04 APK与tag不变。

- [ ] N6：正式资源#2与生产客户端旧进度/存档摘要、active资源身份核验，APK摘要与code保持。
- [ ] N7：abelian-sandpile、lambda-diagram-game资源包及正式大厅动态新增验收。
- [ ] N8：全部发行验收后临时目录、文件和进程集中清理。
