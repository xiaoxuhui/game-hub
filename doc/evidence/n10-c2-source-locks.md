# N10-C2 三游戏正式来源锁定

代码提交77fd2bc。光学资源固定正式1.2.1 / 85163534ccae2b023928c877e002581a8f35f0cb、图灵正式0.5.1 / 32eb3b95eb78eab703abe8e64214bd8dbbb939c7，两者contentCode 1→2且原storageContract保持。Lambda集成来源固定已审64c8932af9a0b5cc886db25910b3923a16aa0677、0.3.1/code2，proof内正式上游a75d180…；其余三个动态锁完整元数据不改。原APK sources.lock.json与f3e0ed1逐字节相同。

实际Node回归：升级生产锁后旧合成“baseline/code1”测试抄当前生产发行锁，引发46项/1失败Resource release lock mismatch。修正为根据不可移动sources.lock.json显式构造code1夹具，再跑46/0失败/0跳过；原拒绝来源变化未加code、原子失败不污染、合同/元数据篡改和未知文件拒绝等断言全部保留。没有改生产校验以通过测试。

audit-storage.mjs增加唯一限定CLI `--resources`，读取本独立检出的.build/resource-source-assets/games；无参数继续原APK assets。拒绝其他参数，不允许任意目录。生产后以此审计新资源，而不是拿旧APK资源冒称新版已审。

本切片仅锁与审计入口，生产ZIP、两fresh检出一致性与新光学/图灵浏览器存档仍待下切片；未发行。CLOSED后才执行普通严格clean producer。