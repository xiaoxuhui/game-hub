# N12 B3 候选与真实浏览器验收

生产提交：ef41c24584a970fafcfae635ae7db15d694059de。两个干净独立检出、远程固定完整来源、LF字节，资源/动态资源生产与verify均成功，12个候选文件逐字节SHA相同，六个未更新ZIP与N10完全相同，见double-build.json。

- 大厅完整node --test：64/64，b2-full-tests.txt。
- 康威初次158测试中156通过、2个Android assets前置缺失失败，保留conway-tests.txt；独立检出sync后针对Android重新9/9通过，conway-android-tests.txt。未声称新运行完整158全绿。
- 阿贝尔初次53中49通过、4个构建/Android前置缺失失败，abel-tests.txt；独立构建同步后完整53/53通过，abel-tests-after-build.txt。
- verify-browser.cjs真实Chromium运行，桌面1280×900、手机390×844，两游戏共4/4 PASS，无页面或HTTP错误。四张截图已逐张视觉检查；无横向溢出，控件与棋盘可见。手机康威纵向滚动正常。
- 旧ZIP真实UI保存→同origin切新ZIP：康威图案/函数保持、批量导入实际成功、普通导出实际下载并解析；缺可选安全文件API时显示不支持且旧记录未删除。阿贝尔实际旧七粒实验保持，250/251ms可运行，空值拒绝启动。无关storage键保持。

浏览器的文件API缺失为显式能力模拟，尚不能替代正式Android WebView验收；成功文件夹备份不在安卓发布承诺中。未发行任何资源；C阶段正式宿主及签名发布仍待执行。
