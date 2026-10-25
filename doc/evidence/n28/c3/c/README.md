# C3-C EML界面与源适配

本阶段只有独立固定源集成，未启用EML生产源锁，未发行EML新资源。D字体/许可/完整引用闭包与八键审计、E候选/CI/发行另验。

- 固定源63cbfd8fdce98874802cf1ac608b1084c8e48d40；app/template/styles/build四原始字节和2616旧interaction-fixture文件见tests/fixtures/eml/ui-source-proof.json，正文MIT见对应old/new/LICENSE。
- `node --test tests/eml-resource-ui.test.mjs`：3/3；`node --test`：155/155，0跳过。
- 原源命令在独立副本恢复固定源四文件后执行`node scripts/build.mjs`、`node scripts/sync-android-assets.mjs`、`node --test tests/*.test.js`，172/172通过。之后重新以39个原始构建输入逐一Git blob校验并适配构建，未拿修改后源码冒充原始套件全绿。
- `node scripts/eml-hall-browser.cjs --integration`：桌面1440×1000/手机390×844各11项，共22通过，pageerrors=0/external=0/missing=0。手机数值选择、输入、计算、保存和坏档管理实际使用tap；手机截图已查看，无横向溢出。
- 真实旧fixture加载/计算/缓存/生产桥导出/reload；COS真实KaTeX节点（非仅其它公式渲染）、兼容导出取消与完整回读；组合函数实际输入/添加且旧基础不伪造组合推导；pending恢复、旧写冲突取消只读/后来恢复重启保存；配额取消和明确只改会话；仅初始值+函数清空保护；过期文件基础/完整/取消三选择、弹窗Ctrl+Z不泄漏；坏导入、集合只并历史/未知字段及逐份恢复/只清历史保当前；真实同源第二页执行冻结旧saveToCache触发storage事件，阻自动写但完整会话可导出。
- corrupt-ui-red.log：坏保护记录可以导出，但错误invalidate使明确清理仍保留{broken，真实失败；修后桌面/手机绿。会话只读只暂停自动保存，数据模块失效仅用于实际外页/写冲突。
- 使用实际产出文件/loopback资源子路径、合成CSP与生产EXPORT_BRIDGE_JS/native JS stub；不代表Android WebView、SAF、真实设备、Safari或离线冷启动。原Activity无CSP响应头，不把合成头称生产头。
- 日志只做任务路径占位/LF/行尾空白处理，原/公开摘要见evidence-metadata.json；source-proof.json为本次39输入/适配脚本/输出源摘要，最终资源proof会在D闭包阶段补实际发行输出清单。
