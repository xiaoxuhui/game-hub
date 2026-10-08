# N1 第一切片：v2协议与自有示范源码

Status: COMPLETE（本切片实现及隔离测试完成，提交后审阅待执行；N1整个阶段仍PENDING）。日期2026-10-09。

- N0精确批改提交d21cb9a独立复审无阻塞，复审已归档，N0更新COMPLETE。
- 公共原始字节验签/完整文件清单抽取，v1固定四ID/仓库/入口/存档合同不放宽；v2独立解析最多16个ID，未知桥/资源协议/合同可展示但不能安装。
- 自有6牌3对示范源码/许可/进度校验先提交；下一切片以本提交完整SHA生产独立资源，避免自引用。示范不加入Android内置assets。
- 仅在独立检出D:/soft/.ci-tmp/game-hub-work/v030-final复制本切片代码验证：`node --test`26通过/0失败；Gradle`:app:testDebugUnitTest --rerun-tasks --console=plain`65通过/0失败/0错误，23task实际执行，27s。
- 实际日志见n1-v040-protocol-20261009。此切片未改版本号/未发布，真实浏览器及设备验收仍在N3/N4/N5；不能据单测宣布示范交付。
