# N12 C4 离线执行脚本提交后独立审阅

审核视角：review_p0。只读，未执行ADB、未查询公共API。

- 初审61be3271ec6320fa2d089712f8d22d9338dc5b25：OPEN。finally先写PASS再恢复网络，恢复失败会留下假成功；无条件双开改变原网络开关。
- 批改296992c04c5c7e3d73888540b1a116f60bd3d40e：先记录原开关，finally逐项恢复并复核，恢复后才生成终态；错误保留并FAIL。
- 复审仍OPEN：global mobile_data不是实际telephony服务状态。N5和本轮只读AVD均已有global=1、实际mUserMobileDataState=false反例。
- 第2批改a8ccc9f690b4941e0967bbb20b2b672ffbfaf7fe：唯一实际mobile服务状态控制恢复动作；终态同时核对原global与WiFi/mobile实际service；超时先核验本轮AVD并force-stop指定测试APP，再停止本次host ADB。
- 独立复审CLOSED：完整61be父提交至a8ccc9f的diff --check通过，精确HEAD/远端一致、工作树空；仅脚本逻辑关闭，不将未运行的在线/离线验收算成通过。
