# C3-A EML格式合同证据

当前只完成格式切片，缓存/UI/KaTeX/锁/EML发行均未开始。

- 固定旧源2616c9e9b081762b01599cc79da919d20340d0a2、新源63cbfd8fdce98874802cf1ac608b1084c8e48d40；tests/fixtures/eml/source-proof.json记录旧9/新10份原始blob（含MIT）。生产旧reader仅expression/value-store/persistence三模块，输入SHA硬校验且UMD全局隔离。
- `node --test tests/eml-compatibility.test.mjs`：12/12；真实旧拒cos/组合，新封套旧读基础/新恢复完整原文，数值准确/公式索引闭合、不伪造组合，真实旧serialize/saveToCache无改写可恢复但改基础必须显式冲突，坏/未来/重复/嵌套/错绑定扩展拒绝，旧普通档/新完整档互读、40层表达式/原数字语法、UTF-8超限手动完整退路、实际发出运行脚本及全局隔离。
- `node --test`：135/135，0跳过；未宣称UI/候选/Android/SAF已验。
- baseline-red.log：真实旧读取器期望新cos/组合原档可读的两项失败；两者在新原reader均有效，适配后已绿。
- self-provenance-red.log：9过/1失败，证明新允许的直接自引用EML推导仍被旧reader拒；修为只省略不可表达推导，完整原文和数值保留。
- chinese-boundary-red.log：11过/1失败，证明旧真实text.length限制允许的中文完整档被最初字节限制误拒；修后读入保留旧5MiB UTF-16合同和15MiB字节防御上限，兼容导出单独5MiB字节规范。
- 原始日志私有留存，公开版本仅任务路径占位、LF规范和移除行尾空白（提交diff检查发现Node断言空行带空格），原/公开摘要见evidence-metadata.json；不抹去失败，不改数学/旧reader断言。
