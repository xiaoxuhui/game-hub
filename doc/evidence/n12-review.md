# N12 提交后独立审阅与批改

## A 计划与兼容性

- 2026-10-12，review_p0，只读独立视角。初审 c6c26de：OPEN，Lambda 手动归约 snapshot 写version3，已发行旧版只读version2，违反兼容恢复合同；EML新组合函数存档同样旧reader不接受。
- 最小真实模块实验：Lambda手动session.paths新encode=3/newdecode成功，旧decode抛“不支持这个存档版本”；去paths的普通v2仍可读。EML旧存档新reader接受，新组合存档新reader接受而旧reader拒绝。可重复脚本/输出另存。
- 批改 8bd4eef69564db9d4e16aac1b2c8aa884b2b7853：EML/Lambda来源编号冻结，本轮仅康威/阿贝尔更新，T06补阻断依据，迁移列待办。
- 复审 CLOSED：计划与范围一致、主仓干净、diff --check通过；Abel源码只改index interval step=100→1，存储模块未改；康威原存储模块未改，新增两个脚本须进入白名单，缺文件API时先报错不删除，正式WebView仍须实测。

## B 资源候选

- B1 来源集成提交06febcbf7ae9a16ed40cb10aa6507ce6e1ceb4cc，review_p1独立CLOSED：Abel实际源码与集成同字节，仅index step修订，15项输入/13输出证明逐字节及SHA匹配，原存储模块/七原仓HEAD与状态保持，64/64大厅测试；未将来源集成代替B2生产或实际兼容验收。
- B2发行锁与生产验收待提交后独立审阅。
