# N8 匿名限流回退独立审阅（2026-10-09）

受审提交：`50064fdcf9f4d6cf53a7f272c3c8df15e0b52e1c`。只读检查差异、N8 归档独立审阅和匿名限流失败日志；检查时主仓库 HEAD 对应受审提交且工作树干净。本次未运行归档或清理，没有调用真实 credential helper、读取密钥/原始存档、停止设备或移动/删除目录。

## 结论

**CLOSED，可重试既定执行前门禁；不等于清理已通过。** 原匿名 403 日志支持失败发生在进程停止、工具链移动、目录删除之前。执行脚本仍先核提交/远端、96 项归档原字节及索引 SHA，再运行完整归档复验；其非零退出会在第 78 行停止，后续设备与文件操作不能开始。

## 安全边界核查

- `doc/evidence/n8-prepare-archives.py:222-238` 的认证回退只在显式 `--authenticated-api`、匿名响应恰为 403 且 `X-RateLimit-Remaining: 0` 时触发一次。认证后的 HTTP 错误或其他匿名错误均原样失败；不会把不可查询当通过。
- `existing_github_token()` 从已有 Git credential 取值，设置 `GIT_TERMINAL_PROMPT=0`、`GCM_INTERACTIVE=never`、30 秒超时，凭据只保存在进程内变量/请求头；不写归档、日志、JSON 或命令行参数。脚本和本审阅均未输出口令。
- 认证只用于 `api_json()` 的固定 `https://api.github.com/repos/xiaoxuhui/game-hub/releases/` 路径；URL 均由固定 tag 或已校验正整数 Release ID 构造，请求方法为 GET。专用 opener 的 `NoApiRedirect` 拒绝重定向。实际公开资产下载仍走第 274–280 行独立无认证 `urllib.request.urlopen`，继续核实际长度/SHA；完整分页、前后身份集合与既有归档原字节复核仍在。
- `doc/evidence/n8-execute-cleanup.ps1:77-78` 仅向归档复验传新增标志，失败检查未放宽。`git diff --check` 未见格式问题。

## 非阻塞文字批改建议

`n8-prepare-archives.py:1` 的 docstring 和 `doc/N8-发布后集中清理实施计划.md` N8-B 段仍称归档脚本“不访问密钥”。现在可选回退会读取已有 GitHub 访问凭据；建议准确写成“不访问发行签名私钥；仅在显式选项和匿名限流时以内存凭据只读查询固定 GitHub 元数据”。这是文档精度问题，代码没有将该凭据用于公开资产下载或写入归档。

实际认证回退/完整公网复验尚待执行。只有复验返回成功且索引 SHA 未变化后，才可进入本任务两台模拟器停止、工具链搬迁和白名单清理；执行结果还需提交后独立审核。
