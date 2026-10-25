# C4-A 真实读取器与格式合同

此阶段未接主页面、未激活图灵机源锁或发行。

- 原始旧32eb与新ec1的`src/core.ts`、`src/project-codec.ts`和MIT六份原始blob逐字节冻结在tests/fixtures/turing。TypeScript5.9.3按ES2022/CommonJS去类型，唯一模块路径改写`./core`→`./core.cjs`，原/编译结果SHA及工具参数均见source-proof.json。数学core旧新相同。
- `actual-old-max-red.log`为未适配Max互读基线预期失败0/1：真实新reader接受，而旧reader因null步数拒绝。没有放宽旧reader；适配后的格式专项8/8。
- `format.log`：明确有限上限1–1000000/无默认值、真实旧reader接受、原完整Max/未知字段/数值语法恢复、真实旧save保扩展及旧编辑冲突、坏/未来/嵌套扩展/绑定篡改、输入20MB与封套独立上限、实际发出的隔离历史reader/同一factory在VM执行无eval。
- `hall-unit.log`：全根168/168。未经适配的固定源独立检出原156/156、typecheck、build:android成功，分别见三个upstream日志；不会将这些原源测试当作尚未实现界面的验证。
- 原文/摘要规范化记录见metadata；本阶段无真实UI改动，桌面/手机、保管故障、课程与速度、实际ZIP/签署发行均待B–D。

提交检查发现两份原始core.ts都包含上游末尾空行，不能裁切后仍称原blob。因此仅对该原始夹具路径固定不转换文本并允许末尾空行，其他空白检查不变；生产脚本和测试不适用此例外。公开日志规范为一个末尾换行，原始日志不改并有SHA留证。
