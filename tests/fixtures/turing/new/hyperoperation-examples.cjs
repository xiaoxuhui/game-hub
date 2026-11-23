"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hyperoperationExamples = exports.Program = void 0;
const register_tm_1 = require("./register-tm.cjs");
/** Build finite control flow, not answers: every counter change runs on tape. */
class Program {
    instructions = new Map([
        ["done", { kind: "halt" }], ["reject", { kind: "reject" }],
    ]);
    registers = 3; // input A, input B, result
    labels = 0;
    label() { return `p${this.labels++}`; }
    register() { return this.registers++; }
    inc(register, next) {
        const label = this.label();
        this.instructions.set(label, { kind: "inc", register, next });
        return label;
    }
    dec(label, register, positive, zero) {
        this.instructions.set(label, { kind: "dec", register, positive, zero });
    }
    clear(register, next) {
        const loop = this.label();
        this.dec(loop, register, loop, next);
        return loop;
    }
    // Append source to destination, leaving source empty.
    move(source, destination, next) {
        const loop = this.label();
        this.dec(loop, source, this.inc(destination, loop), next);
        return loop;
    }
    // Scratch is zero on entry and exit. Preserve source; replace destination.
    copy(source, destination, scratch, next) {
        const loop = this.label();
        const restore = this.move(scratch, source, next);
        this.dec(loop, source, this.inc(destination, this.inc(scratch, loop)), restore);
        return this.clear(destination, loop);
    }
    one(register, next) {
        return this.clear(register, this.inc(register, next));
    }
    multiply(a, b, output, next) {
        const outer = this.register(), inner = this.register(), scratch = this.register();
        const loop = this.label(), add = this.label();
        this.dec(add, inner, this.inc(output, add), loop);
        this.dec(loop, outer, this.copy(b, inner, scratch, add), next);
        return this.clear(output, this.copy(a, outer, scratch, loop));
    }
    // Fixed rank expands program structure only. Iteration counts stay on tape.
    hyper(rank, a, b, output, next) {
        if (rank === 2)
            return this.multiply(a, b, output, next);
        const count = this.register(), scratch = this.register(), product = this.register();
        const loop = this.label();
        const replace = this.clear(output, this.move(product, output, loop));
        const calculate = this.hyper(rank - 1, a, output, product, replace);
        this.dec(loop, count, calculate, next);
        return this.one(output, this.copy(b, count, scratch, loop));
    }
    positive(register, next) {
        const check = this.label();
        this.dec(check, register, this.inc(register, next), "reject");
        return check;
    }
}
exports.Program = Program;
function project(name, description, input, operator, p, entry) {
    return {
        category: "一进制运算", name, input, initialState: "BOOT", blankSymbol: "□",
        acceptStates: "", rejectStates: "REJECT", haltStates: "HALT", maxSteps: null,
        description: `${description} 两侧用 1 的个数表示数值，空串表示 0。工作区在原点左侧，停机后只留下答案的 1；规则全部由读写头执行，默认 Max，仍可暂停或设置步数上限。`,
        rules: (0, register_tm_1.compileRegisterMachine)(p.instructions, entry, p.registers, 2, operator),
        sharedRules: () => (0, register_tm_1.compileRegisterMachine)(p.instructions, entry, p.registers, 2, operator, true),
    };
}
function division() {
    const p = new Program();
    const remaining = p.register(), scratch = p.register();
    const outer = p.label(), inner = p.label(), subtract = p.label();
    p.dec(subtract, 0, inner, "done");
    p.dec(inner, remaining, subtract, p.inc(2, outer));
    // Label outer is a forward jump into a reusable divisor-copy loop.
    p.instructions.set(outer, { kind: "jump", next: p.copy(1, remaining, scratch, inner) });
    const entry = p.positive(1, p.clear(2, outer));
    return project("一进制除法（取商）", "1111111/11 表示 7÷2，得到 111（取整商 3，舍去余数）；除数为 0 进入 REJECT。", "1111111/11", "/", p, entry);
}
function hyperoperation(rank, name, operator, description, input) {
    const p = new Program();
    let entry = p.hyper(rank, 0, 1, 2, "done");
    if (rank >= 4)
        entry = p.positive(0, entry);
    return project(name, description, input, operator, p, entry);
}
exports.hyperoperationExamples = {
    unaryDivide: division(),
    unaryPower: hyperoperation(3, "一进制乘方（幂）", "^", "111^11 表示 3²，得到 9 个 1。指数为 0 得 1，本示例约定 0^0=1。", "111^11"),
    unaryTetration: hyperoperation(4, "一进制超幂（幂塔）", "^^", "11^^111 表示 2↑↑3=2^(2^2)=16，幂塔从右向左结合。底数须≥1，高度 0 得 1。默认 2↑↑2=4；2↑↑4 已有 65536 个 1，逐步运行非常慢。", "11^^11"),
    unaryPentation: hyperoperation(5, "一进制超超幂", "^^^", "11^^^11 表示 2↑↑↑2=2↑↑2=4；递推 a↑↑↑(n+1)=a↑↑(a↑↑↑n)。底数须≥1，次数 0 得 1。2↑↑↑3=65536，计算步数远大于答案长度，请从小数开始。", "11^^^11"),
};
