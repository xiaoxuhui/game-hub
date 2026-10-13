# N13 Lambda 历史reader CI 复现

2026-10-13。Android run38406282282/job115326618660在 `Verify source lock and assembler` 失败；Lambda兼容run38406282183通过。Android默认浅检出只取当前提交，新增测试执行固定已发行reader `64c8932af9a0b5cc886db25910b3923a16aa0677`，CI日志报 `fatal: path 'examples/lambda-diagram-game/lambda-lab.html' exists on disk, but not in '64c8932af9a0b5cc886db25910b3923a16aa0677'`。

独立 `git clone --depth 1 file:///D:/soft/game-hub`，Node24.19.0运行 `node --test`：75项、74通过、1文件失败，错误逐字一致，日志 `D:/soft/.ci-tmp/game-hub-n13/evidence/shallow-repro.log`。同检出 `git fetch --unshallow D:/soft/game-hub main` 后原命令85通过、0失败，日志shallow-fixed.log。CI也是Node24，Ubuntu与Windows差异不是此处历史对象缺失原因。

归因：测试新增历史reader依赖，但Android工作流未获取历史。只在产生约束的checkout旁添加 `fetch-depth: 0`；不改测试、不跳过检查、不变更支持范围。最终云端结论在发行记录列出。
