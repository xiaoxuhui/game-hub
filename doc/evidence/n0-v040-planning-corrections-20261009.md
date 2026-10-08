# N0 规划独立审阅批改（2026-10-09）

首审对象d7a3a8921931dfc6986493b13f2f8cc401ac85b3，独立视角review_p2；意见见同目录首审记录。

- P1 Cookie父域共享：D3明确全局禁cookie及逐View禁第三方cookie，U51新增真实设备父域读写/跨域负例。冻结四游戏打包资源`rg -n -i cookie`无匹配（exit1）；此静态证据不代替设备回归。
- P1 退役资产归属：D1/D5明确固定Release历史ZIP不可删除覆盖，退役记录保留完整资产字段并仍校验归属，available=false禁止新下载/更新，U48补缺失资产拒绝。
- P2 历史SW/CacheStorage：D3/U54补实际旧响应注入、稳定origin移除重装、清理失败禁止加载且保留localStorage/IDB，N3执行。
- P2 状态时态：N0暂PENDING，等此批改提交后复审闭环再改COMPLETE。

本记录只证明规划批改，U45–U64尚未执行，不代表代码或设备通过。
