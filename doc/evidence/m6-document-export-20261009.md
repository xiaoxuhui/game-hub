# M6 后台文档保存与选择器生命周期

## 行为和边界

DocumentExportFlow 以 Activity ViewModel 保存当前进程的待选文档和写入状态，不持有 Activity。URI 返回后在单线程工作器通过真实 ContentResolver 写 UTF-8、flush 并关闭输出流；成功或错误结果回到前台界面只显示一次。流尚未关闭时仍占用原生流程门禁，重复请求拒绝。onStop 解除界面监听，onCleared 关闭工作器的后续预约，已受理写入可以完成。

普通方向变化由既有 AndroidManifest configChanges 处理，实际旋转并不重建大厅 Activity。另有 ActivityScenario 强制重建用例验证相同 ViewModel 保留待保存内容。没有把内容塞入大 Bundle，也没有声称进程死亡后可以恢复未保存内容：缺失请求而 URI 返回时明确提示重试，bridge true 仅表示选择器已受理。

文件选择器回调同时拒绝失效 WebView、停止界面、加载失败、保存/安装冲突和重复选择器；拒绝及启动失败均交付 null，重复请求不取消先前有效请求。实际回调门禁测试包含旧已销毁 ViewView、停止界面、保存冲突和原选择器引用保持。

## 真实执行

所有构建在 D:\soft\game-hub-build-resources-20261008。首轮编译和 JVM 状态验证成功；首轮设备 4 项通过。最终 JVM XML 62 项失败/错误 0，设备 DocumentExportTest 五项加 stoppedActivitySaveBridgeRejectsBeforeOpeningExternalFlow 共 6 项全部通过，Gradle 2 分 13 秒退出码 0。

模拟器真实 ContentResolver file URI 写入 UTF-8 与不存在提供者的错误；UI StrictMode 未报告写入。四实际网页通过真实导出按钮、Blob/原有 LightAndroid 桥、系统 DocumentsUI 注册结果回调完成保存。光学在选择器等待时旋转到横屏，之后保存成功；确认普通旋转大厅 Activity 保持且 ViewModel 相同。另有强制 Activity 重建、缺失请求提示和四类选择器取消回调测试。

四个实际 JSON 仅在本地 m6-actual-exports 归档且忽略 Git，不公开原始存档：康威随机真实世界 19741 字节、EML 真实列表 540 字节、光学实际关卡/布局 555 字节、图灵机实际项目 359 字节；分别核对 alive 数组非空、schemaVersion2、id/placement、turing-machine-simulator 格式。来自本任务模拟器测试数据，不是用户真机数据。此次四导出操作使用大厅开发内置基线，不能代替下载版本或正式签名 APK 覆盖升级验收。

## 失败与批改记录

五次专项失败输出均保留：首次误匹配同名非编辑控件；第二次把 Light 原有桥误认为另三项目的 Blob 适配器；第三次在外部选择器前台调用 ActivityScenario.recreate，框架等待 RESUMED 超时；第四次旋转使系统选择器还原默认文件名，测试误读未创建的目标，实际 t01.json 已保存555字节；第五次旋转尚在切换时操作旧编辑节点。最终限定 EditText、采用真实旋转、旋转后重取控件并确认文件名后通过。所有修订针对实际原因，没有取消保存内容或生命周期断言。

真实进程终止、生产签名资源下载后的四桥/导入、同发行证书覆盖升级与发行仍待后续切片。本切片提交后独立审阅待执行。
