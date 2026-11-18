export const EXAMPLES = {
  bf: [
    { name: '你好，纸带', description: '用循环构造字符，输出 Hello World!。先单步观察，再加速运行。', source: '++++++++++[>+++++++>++++++++++>+++>+<<<<-]\n>++.>+.+++++++..+++.>++.<<+++++++++++++++.\n>.+++.------.--------.>+.>.', input: '', initialTape: '' },
    { name: '原样回声', description: '每次读到逗号时询问输入，数字可用逗号分隔；选择结束输入后循环退出。', source: ',[.,]', input: '你好，纸带！\n', initialTape: '' },
    { name: '把 3 搬到右边', description: '每轮让 0 号格减 1、1 号格加 1。结束时得到 0、3。', source: '+++[->+<]', input: '', initialTape: '' },
    { name: '向左走也可以', description: 'BF 在此使用双向无限纸带。负编号表示起点左侧的位置。', source: '<+++<++>>+', input: '', initialTape: '' },
    { name: '定义函数：加三', description: '定义 add3 并调用两次，在相邻两格各写入 3。可点“转换为原始代码”查看 +++>+++。', source: 'fn add3 { +++ }\n@add3\n> @add3', input: '', initialTape: '', functionsEnabled: true }
  ],
  pdouble: [
    { name: '认识 λ 和 R', description: 'λ 先将当前符号加 1，再左移；R 右移。观察两条指令如何配合。', source: 'λRλRλR', input: '', initialTape: '', symbols: 4 },
    { name: '清除连续的 1', description: '二元字母表下，λ 把 1 变成 0 并左移；遇到空白 0 时退出循环。', source: '(λ)', input: '', initialTape: '1 1 1 1', symbols: 2 },
    { name: '原地归零', description: '重复 λR，直到当前格按模 4 回绕到空白符号 0。', source: '(λR)', input: '', initialTape: '2', symbols: 4 },
    { name: '嵌套循环', description: '内层循环先清零，随后 λ 改写并左移；外层在空白格结束。', source: '((λR)λ)', input: '', initialTape: '1', symbols: 2 },
    { name: '询问输入（扩展）', description: '输入 3,72：先在 0 号格写入 3，λ 将其变成 4 并左移，再在 −1 号格写入 72。', source: ',λ,', input: '', initialTape: '', symbols: 256 },
    { name: '定义函数：加一', description: '定义 inc 为 λR，调用三次后，0 号格为 3。转换后就是 λRλRλR。', source: 'fn inc { λR }\n@inc @inc @inc', input: '', initialTape: '', symbols: 16, functionsEnabled: true }
  ],
  tm: [
    { name: '一元数加一', description: '从 0 号格开始向右数 1，遇到空白 0 就写入 1 并停机。三个 1 会变成四个。', source: 'q0 1 -> q0 1 R\nq0 0 -> halt 1 N', input: '', initialTape: '1 1 1', symbols: 2 },
    { name: '清除纸带', description: '向右将每个 1 擦成空白 0。读到原有的空白后停机。', source: 'q0 1 -> q0 0 R\nq0 0 -> halt 0 N', input: '', initialTape: '1 1 1 1', symbols: 2 },
    { name: '判断 1 的个数是奇是偶', description: '每读到一个 1 就切换奇偶状态。遇到空白后，偶数个进入 accept，奇数个进入 reject。', source: 'q0 1 -> odd 1 R\nodd 1 -> q0 1 R\nq0 0 -> accept 0 N\nodd 0 -> reject 0 N', input: '', initialTape: '1 1 1 1' },
    { name: '多字符符号', description: '把两格的「红蓝」和「🔴🔵」依次换成 A01 和完成，读到空白符号「空格」后停机。', source: 'q0 红蓝 -> next A01 R\nnext 🔴🔵 -> check 完成 R\ncheck 空格 -> halt 空格 N', input: '', initialTape: '红蓝, 🔴🔵', blankSymbol: '空格' }
  ]
};
