# N10-F1 限定收尾脚本预备

仅预备脚本；D资源发行/旧正式验收、E正式APK与线上验收、最终归档完成后才允许执行。复用既有N9已审清理结构，固定唯一任务根`D:\soft\.ci-tmp\game-hub-n10`、永久归档`D:\soft\game-hub-archives\n10-20261010`和主仓库`D:\soft\game-hub`，不得扩展到其他临时目录或用户项目。

`cleanup-n10.ps1`要求完整已推送commit和永久cleanup-index.json全SHA；默认只读、只有显式Execute才删除固定LiteralPath。递归前验证根/所有祖先与每条子项无链接、最终绝对路径处于唯一任务根；验证归档每资产SHA/大小与source Git bundle绑定、现场全部evidence文件集合与摘要不变；主/工作检出均同一干净完整提交、origin/main一致且归档source是祖先；工具链/签名备份/私钥目录及原0.4.0正式APK存在不变。任务进程、自己emulator-5566尚在或已有清理结果时拒绝删除，不停止共享ADB/其他设备/用户8000服务。

归档保存必要Git恢复bundle、原始失败/成功日志、来源锁/基线/审阅批改、正式APK/测试控制器/未来私有fixture、候选ZIP与签名目录历史；不复制私钥、DPAPI秘密、密码或缓存依赖/AVD磁盘。语法检查通过。当前永久归档尚未创建，未执行dry run或删除；实际索引、只读结果、执行后原仓核对和独立复审另行记录。

计划命令在最终归档及提交后以实际摘要展开，先dry run退出0、独立审核CLOSED再Execute：

```powershell
powershell -File D:\soft\game-hub\scripts\cleanup-n10.ps1 -ExpectedIndexSha256 <完整索引SHA> -ExpectedCommit <最终已推送commit>
powershell -File D:\soft\game-hub\scripts\cleanup-n10.ps1 -ExpectedIndexSha256 <同一完整索引SHA> -ExpectedCommit <同一最终commit> -Execute
```

脚本预备可以在网络配额等待期间完成；实际删除以D/E发行验收CLOSED和恢复归档验签/摘要通过为前置，不将预备标为F完成。
