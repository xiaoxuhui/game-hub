# M6 四个下载资源会话的真实系统文件导入导出

- 开发基线 `63b9c1d315097450e5d754aee48021bea695031b`。构建只在 `D:\soft\game-hub-upgrade-20261009`，实际目标为任务AVD emulator-5564 已安装的同发行证书v0.3.0/code3 UI候选（5f5b2499…7182a），本次无生产代码改动。
- 临时RSA资源夹具使用四个真实内置基线文件构建带入口注释的code2 ZIP，生产GameResourceStore验签/安装/激活并openSession；断网会话contentCode=2。通过现有MainActivity.openGamePrepared与实际GameContentResolver/WebChromeClient/SaveBridge，四游戏原有页面按钮及真实DocumentsUI路径操作。此夹具会话不经过启动缓存迁移门禁，该门禁另见已闭环WebView/生命周期测试；不把此称为生产公钥或线上资源发行。
- `assembleReleaseAndroidTest -PgameHubTestBuildType=release`退出0，仪器以同发行证书签署（2287d2da6dc0e7a067ea8770abd0b479f22cdb49ec345217e9f50345cca5b383）。测试源码主仓库/独立检出摘要一致，见source-hash.json。

## 7aa34ce历史首轮验证（EML差异断言未闭环）

命令：`adb -s emulator-5564 shell am instrument -w -e class com.xiaoxuhui.gamehub.DownloadedDocumentBridgeTest -e downloadedDocuments true com.xiaoxuhui.gamehub.test/androidx.test.runner.AndroidJUnitRunner`。首轮 `OK (1 test)`，40.946秒；这是批改前历史结果，EML原样导入的差异恢复证据不足，不作为最终四桥闭环。最终批改版57.091秒见后文final-device/outcomes。单用例循环包含四游戏、每次实际导出→系统选取自产JSON导入→再次导出；每游戏结束检查无会话泄漏。

| 历史首轮下载会话 | 当时游戏结果（EML弱断言） | 历史再导出规范化JSON字节数 / SHA-256 |
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

同提交补归档完整升级CI审阅、实际成功任务37842381018（63b9c1d，步骤全绿），普通CI37842157028亦成功。该CI使用调试证书/code3→4和私有文件标记，不代替先前发行证书v02→v03真实四存档证据。真机文件选择器、正式在线签名资源及最终clean SHA发行候选仍属后续，未测不标完成。提交后独立审阅再进入下一切片。首审发现EML原样导入不能证明恢复，见下文；此前OK结果不表示EML差异状态已验证。

## 提交后独立首审与批改

受审提交7aa34ce；独立首审P1：EML原样导入并再次导出相等，可能在没有恢复状态时误通过。初版四桥结果中EML仅证明成功路径提示和JSON重复输出，未证明不同状态恢复，首审未放行后续切片。

批改构造有效且与首次不同的 selectedValueId 和 inputXId（null与valueOrder[0]之间切换），导入后实际页面.value-button的aria-pressed选中态必须匹配，真实EMLPersistence缓存字段和再导出字段必须匹配，且与首次字段不同。Conway generation和Turing input同样保证重复执行时与首次值不同，避免测试存档遗留导致弱断言。Light每次唯一UUID。测试清理限定自身UUID前缀的before/after文件和自产MediaStore导入URI，禁止枚举删除其他Downloads。

EML第一轮批改（仍固定Turing目标值）实际四游戏重跑通过，62.157秒；最终增加Conway/Turing差异断言后另外重跑，结果待下文归档。初版instrument副本因新编译已被覆盖，原2287d2da仪器摘要只是当时记录，当前新副本摘要另列；不能以当前副本冒称可复算旧仪器字节。

最终批改版实际四游戏 `OK (1 test)`，57.091秒（final-device.txt）。EML每个selectedValueId/inputXId均有原值与输入值不相等、实际页面选中态、持久缓存字段及再导出字段断言；Conway/Turing也与原值明确不同。新仪器副本SHA-256 `523eebf2cefa45dcc5a21b018192aa1db217c6fd3bf2083cc221271dff3e4afb`。最终四条规范化JSON结果见final-outcomes.txt；此次EML两次翻转后回到原始初始选择状态，所以最终摘要可以与最初相同，不代表未执行改变。

四原仓库用GIT_OPTIONAL_LOCKS=0及`status --porcelain=v1 --untracked-files=all`只读重查，与20261008快照精确相同。初次重查未指定all，Git把src/tests未跟踪目录折叠成一行导致文本比较失败；随后完整枚举确认不是原仓库变化。记录m6-original-source-state-20261009.txt。批改提交后需独立复审闭环。
