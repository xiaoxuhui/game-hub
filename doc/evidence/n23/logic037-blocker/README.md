# 逻辑工坊0.3.7待发布阻塞（2026-10-22）

性能优化来源已固定c623ecf，版本0.3.7/contentCode17；生成与信号的完整模型等价，本地280项、两套实际输出/原生8位浏览器通过。

大厅本地node --test结果：87项，86通过，1失败。verifyRedGreenSource报Adapted output bytes differ from reviewed provenance。图标icon.png在85fac70及之前图标工作中已经添加，不在冻结输出清单；现有4个运行文件和upstream-source.json均未变，详见provenance-check.json。大厅CI39807651421在Verify source lock and assembler步骤失败。未放宽校验或修改其他游戏文件。

未签名、上传、激活新的资源目录；当前公开版本仍为0.3.6/目录31。此次仅保留来源锁候选和证据，问题解决后需重新完成检查、固定提交双轮构建、签名及公开下载验收。
