# N8 归档与集中清理独立首审（2026-10-09）

受审提交 `a590d7c3eeb3bee4af54fcfcd562dac76d9db4de`；检查时 HEAD 一致、主工作树干净。本次仅只读审阅计划、初始清单、Python 归档脚本与 PowerShell 清理脚本。**没有运行归档、停止进程、移动或删除。**

## 结论：OPEN，归档前有一项 P1 阻塞

**P1：正式 Release 资产清单未完整分页，资产 ID 下载绑定只是无效查询参数。** `doc/evidence/n8-prepare-archives.py:190-220` 直接遍历 `/releases/tags/{tag}` 响应中内嵌的 `release['assets']`，没有按 Release ID 再请求完整连续的资产分页。`len(release['assets']) > 30` 只能拒绝过多内嵌项，无法证明未遗漏后续页；v2 累计历史 ZIP/目录尤其需要完整清单。第 205–210 行从浏览器下载 URL 加 `?verified_asset_id=<id>`，该参数不是 GitHub API 的按 ID 下载机制，也不证明返回字节来自所记录 asset ID。虽然下载后按 API `digest`/size 对比可证明字节相等，仍不能把现实现表述为“实际 ID 绑定且所有正式资产已归档”。

**批改要求：** 对五个固定 Release 分别按 ID 查询 `/releases/{id}/assets?per_page=100&page=N`，验证连续分页、全部 ID/name 唯一、Release ID 固定、资产状态/大小/完整 SHA；用实际 asset ID 端点下载，或在按官方 `browser_download_url` 下载前后重新查询同一资产 ID 并严格比较 URL/name/digest/size，且最终检查下载原字节 SHA。记录完整分页数量及 ID/摘要。修订后在归档阶段前再次提交并独立复审。

## 其他只读核查

- 清理白名单为顶层 17 个加 `.ci-tmp` 14 个精确名称；主仓库、六原仓库、签名及备份、私有永久归档不在白名单。计划明确 N8 尚未执行，不将浏览器/设备结果误作已清理。
- 归档脚本验证十个既有检出快照的 HEAD、状态、patch、bundle、refs 和未跟踪文件；另为七个检出创建 bundle/patch/untracked ZIP，检查字节与 ZIP CRC。私有过程证据与 AVD 配置另归档；临时构建缓存、AVD 磁盘作为可重建项排除并明示。
- 执行脚本对源目录使用精确绝对路径、祖先 reparse 检查及递归子项扫描，只容许一个指定 pnpm 内部 junction 且不进入；`Remove-Item` 用 `LiteralPath`。正式运行前以精确主提交、远端 main、归档索引 SHA、归档全部文件摘要及重新运行归档脚本门禁；未知部分执行状态会要求人工检查，不盲重跑。
- 仅在 PID 与实际命令行匹配时停止指定本地 HTTP 服务；指定两台 emulator 先经 AVD 名称核验，其它设备存在时阻止工具链迁移。SDK/JDK/Gradle 移动和 pnpm 真实包复制均复核文件大小/SHA 与运行版本，保留永久路径说明。任何一次移动后中断需按手册人工恢复，不应直接重跑。

N8-B 真实归档、归档索引复审、N8-C 删除及最终磁盘观测均未执行。本首审不能放行删除。
