# N10-E1 0.4.1 版本与未来升级夹具

大厅清单同步为0.4.1/code5；Android check和release candidate校验同版本。协调器伪远端改0.4.2，私有预检fixture要求0.4.2，升级smoke从5/0.4.1构造6/0.4.2并断言实际安装code6；动态目录“未来主机不兼容”例改为minHost6。

真实正式旧0.4.0的ProductionResourceIdentityDeviceTest、ProductionUpdateSaveDeviceTest和旧版UpgradeFixtureStageTest保留原固定身份断言；不会把新版本改动推广到历史验收。D现场原正式APK及三存档保留，未安装本切片的调试构建。D4独立审阅CLOSED后的网络配额等待期间进行本地独立工作，D真实验收及复审仍是正式APK发行前置。

本切片构建用于代码/夹具编译验证，内置bundle仍来自此前干净SHA，不称为当前版本正式候选。提交审阅CLOSED后须在新精确干净提交普通bundle重新组装，APK完整SHA/签名及实际同证书升级另行验收。README/CHANGELOG的0.4.1发行说明在正式候选阶段写入，当前未冒称已发布。

首轮Node52/53：既有android-shell版本断言仍锁code4，实测捕获遗漏。同步为严格code5边界及0.4.1名称断言，保留原应用ID/minSDK独立身份校验；红日志保留，未改生产逻辑或删除断言。

实际最终Node53/0失败/0跳过。独立检出 `gradle -p android testDebugUnitTest assembleDebug assembleDebugAndroidTest --no-daemon` BUILD SUCCESSFUL 44秒；JVM XML95/0失败/0跳过。aapt编译输出为`com.xiaoxuhui.gamehub`、code5、0.4.1。没有运行设备suite或安装debug APK，没有改变旧正式存档现场。

公开日志副本只规范行尾空白及单EOF换行，私有原始日志保留；不是正式发布或真机验收结论。
