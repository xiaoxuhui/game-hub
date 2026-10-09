# N7 两游戏固定上游与集成来源验收

日期：2026-10-09（Asia/Shanghai）。仅生成可审核集成来源，尚未生产/发布两新资源包或做正式客户端安装验收。

## 固定来源及构建

复用独立大厅检出 `.build/upstream-dynamic/<id>` 从公开远端检出冻结SHA，未使用原游戏工作树或跟随外部新HEAD。

| 来源 | 实际检查 | 最终结果 |
| --- | --- | --- |
| 阿贝尔 d58e2b1d06c3dfdf6cd25b65986c1d494759ed7f / 0.1.2 | node scripts/check.mjs；node scripts/build.mjs；node scripts/sync-android-assets.mjs；node --test | 检查31个JS/11文档；构建13文件；测试53通过，0失败/跳过，856.7612ms |
| Lambda 11b0aef6dcac9a37abdc08cde25ea0efd1f8f6a2 / 0.3.0 | pnpm11.19 run test；node scripts/build.mjs；node scripts/sync-android-assets.mjs；pnpm11.19 run test | 120通过，0失败/跳过，3646.6259ms；单文件85296字节 |

首次阿贝尔未生成dist时49/53、生成dist未同步Android资源时50/53，日志完整保留；按原构建流程在独立克隆同步资源后53/53。首次Lambda未同步Android资源时118通过、2跳过，随后补齐独立资源，原两项实际执行通过，最终120/120。没有修改原仓库、上游测试或游戏规则，未构建上游APK。

Lambda独立重建与冻结提交已跟踪dist/lambda-lab.html完全相同，SHA `548484c86bfb3b43fdfb1d9bc2e7f9fe0212f03b437d2ef4277c7f0f8df149ab`。阿贝尔每个构建输出均与固定Git运行文件blob相同。

## 来源证明及重复生成

`dynamic-upstreams.lock.json` 如实记录固定上游；`stage-upstreams.mjs` 限定复用独立.build的输入/新输出目录，验证远端/HEAD、每个输入与固定Gitblob字节及MIT，调用固定构建脚本，再核输入未变及产物。所有输入和运行产物摘要记录在包内upstream-source.json；Lambda另核已跟踪原blob与重建一致，差异时失败关闭。

连续两次独立生成共17文件（阿贝尔13运行/许可+1证明，Lambda2运行/许可+1证明），逐文件字节/SHA全部一致；完整hash清单归档。复制为大厅examples集成来源后，逐个`git show :examples/...`的索引blobSHA仍与证明一致，无换行规范化失配。尚未把未提交输出当成已发行来源；后续来源锁必须固定本集成提交经独立审阅后的完整SHA。

大厅Node完整回归42/42、0失败/跳过，9471.3047ms，包括来源身份、伪造摘要/输入路径、Lambda原blob不一致拒绝。输入Git字节比对由实际两次构建工具执行；单测不冒充远端构建验收。

## 真实浏览器交互

Chromium151.0.7922.34，390×844触摸及1280×900键盘，四组通过、pageErrors0；两游戏分别独立origin，移动无横向溢出。截图均实际查看。

1. 阿贝尔真实触摸棋盘投入1粒、等待自动保存、精确localStorage重载恢复；真实下载JSON、确认清空、选择同自身JSON并确认导入、重载仍1粒。
2. 阿贝尔桌面方向键/Enter投沙，总数变2。
3. Lambda触摸转换/单步，保存checkpoint、重载保留1步；真实下载、重置、选择自身JSON导入后恢复1步与原当前式；Lambdaorigin无阿贝尔存档键。
4. Lambda桌面Ctrl+Enter转换与单步。

原始导出仅留忽略私有目录；公开JSON只有自身测试形状/大小/摘要。此浏览器验证覆盖网页下载路径，正式已发行宿主的统一桥与系统SAF必须在两新ZIP发行后继续实测，不把浏览器下载代替SAF。

## 下一门禁

集成来源提交后独立审核与批改闭环，再固定真实集成来源SHA进入三游戏动态锁、独立ZIP生产、seq3发行及正式客户端验收。上游实际当前HEAD可能由外部继续推进，本任务只读复记并保持资源来源不移动。N8集中清理仍待全部发行验收完成。
