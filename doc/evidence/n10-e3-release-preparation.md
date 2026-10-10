# N10-E3 发行文档与十项审计准备

README与CHANGELOG新增0.4.1候选说明，当前正式latest仍0.4.0；新测试报告分开B旧宿主设备范围、C浏览器、D待验资源与E编译/正式设备边界，十项OSS审计未将待办标PASS。新增后本地README链接30/0失效，治理文件齐全；先前精确f2de2ad代码扫描与CI留存。

实际`lintRelease --no-daemon` BUILD SUCCESSFUL 1m55s，XML0错误18告警；E2批改精确GitHub Check run38069723772 success。最终正式候选与标签绑定SHA尚未选定，必须ordinary bundle/verify_apk、证书/版本/生产公钥、实测升级/检查与其精确CI齐备，再提交报告独立复审后发行。

私有严格未来fixture在已有独立historical producer `b71d14ae2d554ed38eda72480d15d06b2c02fafd`仅将版本改为6/0.4.2，assembleDebug/Release 1m31s通过。该body是历史代码，只用于包名/同证书/严格更高版本安装预检，不能当作新版大厅功能或未来正式0.4.2。原发行证书签署私有fixture SHA `6f266cf0f8f99d9ab9842d38aa2aff8e82f7990047a206f0464abeb3cfc00d3c`，不公开上传、不安装该future；正式候选有独立本轮真实源码和证据。

F1脚本预备复审CLOSED仅授权准备归档，不代表实际删除。最终候选采用完整干净提交与固定来源，验收/审阅报告如产生后续文档提交，正式版本标签仍绑定实际构建及CI对应的已审核源码提交；后续主分支只归档实际发行证据，不重写已发布标签。构建与签名资产的完整SHA永远记录，不以主分支最后文档提交冒称二进制源码。
