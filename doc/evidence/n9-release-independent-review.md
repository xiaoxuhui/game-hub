# N9-D seq4 红绿变换发行独立审阅

## 首审：`436699d0c84ac6ab260af007e3b4ac6e4d0ced49`（2026-10-10）

**结论：发行身份与正式设备证据成立；文档批改待闭环。** 本次只读审阅主仓库、专用 N9 过程证据和匿名 GitHub API，未修改发行资产、模拟器或原游戏仓库。

### 核实结果

1. 主仓库 `HEAD=origin/main=436699d…` 且干净。匿名 API 中 `game-resources-v2` 是 Release `407394942`，公开预发布，恰有四份目录（seq1–4）和五份 ZIP；目录 `625643138` 是 9,867 字节、SHA-256 `7a0312859ae27ccec42e737006a4deb46d57e7620cdd44dbfb8619a377bb17ac`，新 ZIP `625642734` 是 14,620 字节、SHA-256 `81edc7c967f7cdfabd1a1e8707b677ec0d930d63e12cc0b8d427f65261767c62`。九项资产 ID/长度/摘要逐项与 `online-verified.json` 相合。旧 seq3 目录 ID `625249539`、长度 7,935、摘要 `69a34e...d3b5f4` 保持，名称已历史化。
2. `v0.4.0` 公开正式 APK 仍是 ID `623483084`、2,645,967 字节、SHA-256 `c6e071e18eac1cb97f3d898d6eb4dab2c790b8d9310a907a7e44e3c34a78ee39`。本地两个注释标签的 peeled commit 均为 `4aacb1f81b7fc381d2ca7fd725fd93dd109e390e`。归档在线工具报告四份签名目录与五份 ZIP 严格校验通过；首次 `Public asset bytes mismatch` 和仅只读重验成功都有日志，报告没有把缓存假说写成已证实根因。
3. 正式身份 instrumentation 源码要求显式 `productionResourceIdentity=true`、生产 `ResourceRuntime`、实际安装 APK 原字节和生产 DER 摘要；实际结果 `OK (1 test)`、logcat 身份为 `red-green-puzzle`/code1/source `31eec2e…`/激活 ZIP 摘要 `81edc7…7c62`/hostCode4，`ready=null`。未见测试替换存储或公钥。
4. 私有任务证据的真实 UI 层级：10 位、非法 11、离线重开就绪、离线再生四份 XML 均有恰好 683 个独立 `t=` 节点，末行 `t=682`，含全绿 `1111111111`，统计 682 步/683 行；非法 11 显示拒绝提示且旧流程仍在。复制按钮 UI 有“已复制完整流程”，报告明确未读取系统剪贴板全文。公开正式客户端截图中首页显示已安装红绿卡片，离线截图显示参数 10 与统计值。专用 CI 结果记录精确提交 `436699d…` 成功。六原游戏/mini-app-harness 状态复查记录全部 matches；其中 EML 原有 22 项变更没有被清理或改写。

### 待批改

- **P2 文档现态不一致：** `README.md:7` 仍以“v2 目录序列 3 提供…”描述当前目录，应明确 seq4 已加入红绿，而 seq3 是两新游戏的历史发行。
- **P2 计划尾注过期：** `doc/N9-红绿变换接入实施计划.md` 末段仍写 N9-C 来源锁/发行器“待独立审阅”、重复生产和 CI“仍待实际执行”，与上方 N9-C `[VERIFIED]`、真实 seq4 发行和 CI 成功冲突。应更新为已完成并保持 N9-D 审阅、N9-E 清理待办。
- **P3 格式：** `git show --check` 仅报告 `doc/evidence/n9-release/production-identity-result.txt:7` 文件末尾多一空行；建议同次批改。

上述是文档准确性和留痕问题，未发现发行资产或客户端验收的安全/正确性阻塞。批改提交后须再次只读核对精确 SHA，再作 CLOSED 结论。

## 批改复审：`dbed4612a772a25c17ba7181fb7bd22d567ba2e2`、`1314466b6c65f00bc0ff81779d87f49d4e771081`

**最终结论：CLOSED。** `HEAD=origin/main=1314466b6c65f00bc0ff81779d87f49d4e771081`，工作树干净；两次批改合计仅改 `README.md`、N9 实施计划和身份结果文本三文件。README 的当前目录已改为 seq4，明确列出红绿变换 1.0.0 与原三项；N9-C 尾注改为已完成来源/重复生产/精确 CI/独立审阅，N9-D 明确等待本次发行复审，N9-E 仍待执行。身份结果文件末尾多余空行已去除，`git show --check` 对两个批改提交与整体 `git diff --check` 均通过。原先两项 P2 与一项 P3 均闭环，无需再改发行资产或客户端。

本结论只关闭 N9-D。专用 AVD、N9 过程目录和 N9-E 归档/清理继续按计划处理；本轮未运行会清除设备数据的测试，也未停止专用 AVD。
