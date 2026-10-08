# N3 基础切片审阅批改

- 首审提交e1efdf214a08f546722dd1e22f7dc451ef995bea，独立review_p1，意见原件见n3-v040-origin-independent-review-20261009.md。
- P1：动态入口文件故障时，MainActivity同步阻止及UpdateCoordinator异步持久隔离仍写v1 store；前者因动态ID非法在清会话/显示面板前抛异常。
- 批改：同步阻止使用runtime.storeFor(id)，异步修复对合法动态ID选择runtime.dynamicStore，四原ID仍使用原resourceStore（包括已有验证注入）。完整三通道及注册UI留N4。

## 实际红绿验证

1. 新Android用例用仅测试的ResourceSession模拟“已验证会话的入口文件随后丢失”，直接经过真实Activity/resolver/WebView HTTP错误回调；不写生产目录或签名状态。未修复同证书候选实际崩溃，堆栈为blockFailedIdentity→MainActivity.showError，见n3-error-red-device.log。adb返回0仍有Process crashed，不把返回码当通过。
2. 修复后该用例确认失败会话已关闭、webView=null、loadFailed=true、错误面板存在；与两项动态origin/存储/Cookie和四项旧WebView回归合跑7项，7.99秒，OK(7 tests)。故障用例的合成会话不提供安装签名证明，实际签名ZIP安装来自此前N2用例，完整示范仍待后续。
3. 新JVM用例使用真实即时签名ZIP，激活首个动态code1→阻止/持久隔离→对象重建仍pinned/quarantine1、拒绝打开→显式恢复/重试1→重装并安全打开。全量强制78项/0失败/0错误/0跳过，发行与测试构建及lint一并强制98任务实际执行，55秒，lint0错误/16告警。

修复候选App SHA256 64c1e3a0fa61bc1480fb53cf770f43036166da026a1827a976eb97f73bfe0d13，测试APK 682427cc77d3f13bcfbb465943bb51895c58c6af667b573c72778afcc1948776；同发行证书验证输出已归档。仅独立检出构建/本任务AVD执行，非最终发行候选。

本次设备故障负例证明错误UI路径不再因选错store崩溃，JVM证明动态首编号隔离和明确重试持久规则；coordinator真实动态隔离提交、完整示范存档及注册UI继续在N3/N4后续验证，不扩大通过范围。提交推送后独立复审闭环再继续。
