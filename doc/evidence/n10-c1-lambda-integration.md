# N10-C1 Lambda 0.3.1 冻结集成

- 正式标签完整SHA `a75d180193fbe7298709298102c8c6008d1353cd`；仅远端独立检出。来源证明增加上游构建实际新增 `src/diagram-view.js`；构建脚本逐项读取的全部输入与blob核对。
- 两次 `node scripts/stage-upstreams.mjs .build/upstream-stage-n10[-repeat]` 退出0，97,931字节HTML SHA `baff963457b858d7f2d40f656e91f0abbd087ca56e9a657851c90f85d386f2e9` 相同，且与正式标签已追踪 `dist/lambda-lab.html` 逐字节一致。完整MIT与许可保持，Abelian固定0.1.2输出不改。`git diff f3e0ed1 -- sources.lock.json` 空。
- 大厅 `node --test` 46/0失败/0跳过。Lambda自己的 `node --test tests/*.test.cjs tests/android-shell.test.mjs` 首次136项/134通过/2缺生成资产跳过；仅独立检出执行正常 `node scripts/sync-android-assets.mjs` 后重跑136/0失败/0跳过。未改原仓，也未放宽测试。
- 真正Chromium151.0.7922.34、手机390×844与桌面1280×900，任务独占新profile/原点 `http://127.0.0.1:18416` 路由精确冻结HTML；先在0.3.0实际输入、转换、单步、保存点及文件导出，再同原点加载0.3.1。实际恢复一步轨迹和旧保存点、旧存档导入、新普通导出导入恢复当前轨迹、新清空前完整备份导入恢复当前轨迹与保存点；清空先自动下载备份、无关存储键保留。无横向溢出、pageErrors=0，两个截图已目视图示/控件可见。原始自有测试存档仅私有证据目录，公开只记录摘要。
- 扩展测试首轮错把普通导出当含保存点的完整备份，失败如 `c1-browser-checkpoint-red.log`。按上游明确普通导出 `encode` / 清空前 `encodeBackup` 两种格式修正测试：普通导入后保存点仍为空，再实际导入清空前备份恢复保存点。没有为错误预期改变上游程序。最终两视口全部通过，脚本/结果/失败与成功日志存档。
- 本切片还未更新动态资源contentCode/集成SHA，也没有发行资源或APK；正式Android验证留D/E。提交后独立审阅CLOSED再固定集成来源和生产ZIP。