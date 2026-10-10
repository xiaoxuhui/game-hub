# N10-E5b 外部断网等待批改

Status: COMPLETE（控制器批改准备；实际 fresh→offline 门禁仍待独立复审后的重跑）。

额度恢复后真实六源与非空目录已达WAITING；外部svc关闭own serial5566网络，wifi_on0/default network:none。原helper只等60秒，提前抛Controller did not complete并finally恢复网络；实际instrument74.203秒OK1且日志显示offline PASS，但PASS与恢复有竞态，不能当作严格最终门禁。

完整timeout-red控制/在线前/结果/actual-sources保存。只调整外部等待60→120秒（测试原180秒断言不变；不改产品APK、源fc9、签名或未来夹具）；必须等runner完成且OK1后才finally恢复。私有helper与公开副本一致；PS解析零错误。提交后独立审阅CLOSED才重跑，所有原红记录保留。测试/OSS报告与待办同步已完成项，E、正式发行及F仍PENDING。
