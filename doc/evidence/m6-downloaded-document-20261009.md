# M6 四个下载资源会话的真实系统文件导入导出

- 开发基线 `63b9c1d315097450e5d754aee48021bea695031b`。构建只在 `D:\soft\game-hub-upgrade-20261009`，实际目标为任务AVD emulator-5564 已安装的同发行证书v0.3.0/code3 UI候选（5f5b2499…7182a），本次无生产代码改动。
- 临时RSA资源夹具使用四个真实内置基线文件构建带入口注释的code2 ZIP，生产GameResourceStore验签/安装/激活并openSession；断网会话contentCode=2。通过现有MainActivity.openGamePrepared与实际GameContentResolver/WebChromeClient/SaveBridge，四游戏原有页面按钮及真实DocumentsUI路径操作。此夹具会话不经过启动缓存迁移门禁，该门禁另见已闭环WebView/生命周期测试；不把此称为生产公钥或线上资源发行。
- `assembleReleaseAndroidTest -PgameHubTestBuildType=release`退出0，仪器以同发行证书签署（2287d2da6dc0e7a067ea8770abd0b479f22cdb49ec345217e9f50345cca5b383）。测试源码主仓库/独立检出摘要一致，见source-hash.json。

## 实际验证

命令：`adb -s emulator-5564 shell am instrument -w -e class com.xiaoxuhui.gamehub.DownloadedDocumentBridgeTest -e downloadedDocuments true com.xiaoxuhui.gamehub.test/androidx.test.runner.AndroidJUnitRunner`。最终 `OK (1 test)`，40.946秒。单用例循环包含四游戏、每次实际导出→系统选取自产JSON导入→再次导出；每游戏结束检查无会话泄漏。

| 下载会话 | 实际游戏结果 | 再导出规范化JSON字节数 / SHA-256 |
|---|---|---|
| Conway #2 | 导入generation1234，真实toast成功；再导出generation1234、alive数组与首次完全一致 | 5018 / b1e9750247b4c66f7af63be706d68fb8f91fd307c62e2dfde4e978d47a559da9 |
| EML #2 | 文件Reader真实加载首次导出列表，清空旧notice后出现“导入成功”；再导出JSON与首次逐值一致 | 409 / 563cd92913d61994e3d53499241b4441440efeef7dd77fcb92e0e9c4fdf58701 |
| Light #2 | 自产关卡改为新UUID/id及标题“下载资源文件桥验收”，导入后真实level-title变化，再导出id/title一致 | 454 / ba0efea9f35ab8a9b24b81dcaf81a9ecea9876b0cb09cb6b72c1ff64a2da45d5 |
| Turing #2 | 自产项目input改10100110，导入后真实编辑框变化，再导出input一致 | 311 / 023dd47a3ae81fb6b50a4bc152769f7ab608aa55e399cb5414908f98fcd8f31e |

表中摘要对实际再导出解析后JSONObject.toString()的紧凑UTF-8计算，不是带排版的磁盘文件字节摘要。四条实际System.out记录提取到actual-outcomes.txt；原始文件只在本任务模拟器Downloads，禁止提交原始存档。

导出经原有真实按钮、原生桥、系统CREATE_DOCUMENT并写入JSON。导入文件由本测试ContentResolver创建MediaStore.Downloads自产URI，只用于系统GET_CONTENT选择，finally删除自产URI。导入按钮实际触屏事件提供可信用户手势；GET_CONTENT返回的文件由真实网页解析，不直接调用解析器代替文件选择器。固定生产WebView allowFileAccess/allowContentAccess=false及原生取消门禁保持。

## 失败和批改

1. 首编译引用不存在session.contentCode，改为checkNotNull(session.game).contentCode，保留first-compile.txt。
2. 初次设备调用evaluateJavascript .click()导入，Chromium日志明确“File chooser dialog can only be shown with a user activation.”，尚未打开选择器。改为按实际DOM按钮位置注入真实触屏down/up，坐标检查限定当前WebView边界，不削弱浏览器限制。
3. 第二次文件名TextView ACTION_CLICK返回false；DocumentsUI名称节点本身不可点击。改为向上寻找可点击的真实文档行，再执行CLICK，没有把返回false忽略。
4. 第三次完整四游戏通过，未改生产功能以适应测试。最终日志/源码哈希与失败记录一并归档。

同提交补归档完整升级CI审阅、实际成功任务37842381018（63b9c1d，步骤全绿），普通CI37842157028亦成功。该CI使用调试证书/code3→4和私有文件标记，不代替先前发行证书v02→v03真实四存档证据。真机文件选择器、正式在线签名资源及最终clean SHA发行候选仍属后续，未测不标完成。提交后独立审阅再进入下一切片。
