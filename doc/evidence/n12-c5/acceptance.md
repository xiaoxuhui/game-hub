# N12 C5 正式宿主实际验收

2026-10-12，沿用同一测试安装和旧seed数据；没有清数据，也没有替换正式APK。宿主是公开v0.4.1、versionCode5，完整APK SHA256 9f57c90af42efea54e4e079d637d964346a78e7e880493eac7887f9aaac323da。测试控制器源2afbda179f8924d57e029d5cdddb0ca416729c90，同发行证书签署；离线执行脚本经两轮批改后的源a8ccc9f690b4941e0967bbb20b2b672ffbfaf7fe。

- 原seed32.545s，真实旧页面导入图案/函数、投七粒沙保存，OK(1 test)。
- 02:31:22实际update29.2s，OK(1 test)：正式前台自动查询两新目录，checkedAt≥本轮开始、remembered=false；生产下载handler获取两ZIP，玩家handler激活code2。逐项验证完整ZIP与来源SHA、ready清空、无状态错误、旧存档完整一致、无关键保持。
- 02:32:03实际offline19.606s，OK(1 test)：关闭本轮AVD WiFi/data，旧PID3492经force-stop消失，新PID3554；测试入口ConnectivityManager.activeNetwork=null，实际新code2、旧存档及无关键保持。康威缺失文件API的“不支持”提示和不删除旧记录，阿贝尔250ms/step=1均验证。
- finally按原实际服务恢复：WiFi enabled/global1，mobile实际false/global1；原值和恢复值一致，restorationErrors=[]、restorationCompleted=true、result=PASS。

首次seed/update的限流失败仍保留；不将原始失败改写成通过。c5-evidence-manifest.json记录公开规范化文本与原始字节各自的完整SHA/大小，原始字节留永久归档。真实手机可由用户发布后另验，本轮不将模拟器当作真机。

开源审计沿用[n12-c3/oss-release-readiness.md](../n12-c3/oss-release-readiness.md)的十项实际检查；补齐其第4项正式宿主门禁和第5项更新记录。生产CI38158736828及离线脚本CI38163226798均success；64/64、4/4浏览器、两次资源生产一致及9目录/14累计ZIP匿名核验保持。EML/Lambda迁移、云端自动候选签名闭环和异机密钥备份仍是后续待办。
