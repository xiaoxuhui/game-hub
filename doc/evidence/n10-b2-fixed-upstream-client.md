# N10-B2 固定六源正式发布客户端

日期2026-10-10，独立检出，基于B1独立复审CLOSED及归档提交2bc492b699f9e91d2ac42d2ab55372fe4952b17b。

新增客户端固定conway/EML/light/turing/Abel/Lambda六仓，拒绝未知编号，严格正式draft/prerelease布尔值、v规范标签与整数范围、同仓规范Release URL、正ReleaseID；只返回版本/编号提示，不提供安装资产。HTTP新增以登记游戏ID调用的上游入口，共用既有匿名HTTP字节预算/取消/时限/ETag重验证；原metadata入口仍只接受大厅路径，资产下载入口不变。404明确未找到正式发布、待检查。红绿与示例不在原游戏源比较表中。

实际命令：

- `D:\soft\game-hub-toolchain\gradle-8.7\bin\gradle.bat -p android testDebugUnitTest --console=plain` exit0，JUnit XML **87项/0失败/0错误/0跳过**；[日志](n10-b2-jvm.log)。新增三测试覆盖六源身份、未知源拒绝、正式版本比较、预发布/草稿/缺标记/伪布尔/错误归属/错误版本及溢出拒绝、实际请求固定端点、404未知、旧metadata入口跨仓拒绝且不发请求。
- `node --test` exit0，**46项/0失败/0跳过**；[日志](n10-b2-node.log)。`git diff --check` exit0。
- B1精确代码提交77ff3c72a22310ce53832d7f727671b639674cbb远端CI [38059316276](https://github.com/xiaoxuhui/game-hub/actions/runs/38059316276) success；[元数据](n10-b1-ci.json)。B2自身CI待提交后核对。

本切片是底层新接口，未接入协调器和UI、不代表APP现在已逐源查询；接入/设备负例/自动与手动/离线状态/三资源生产发行仍待后续，N10-B仍未完成。提交后独立审阅CLOSED才继续。
