"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.builtinExamples = void 0;
const unary_examples_1 = require("./unary-examples.cjs");
const conjecture_examples_1 = require("./conjecture-examples.cjs");
const hyperoperation_examples_1 = require("./hyperoperation-examples.cjs");
const function_examples_1 = require("./function-examples.cjs");
const rule_format_1 = require("./rule-format.cjs");
const inverse_operation_examples_1 = require("./inverse-operation-examples.cjs");
const lambda_example_1 = require("./lambda-example.cjs");
const binary_examples_1 = require("./binary-examples.cjs");
const unary_state_names_1 = require("./unary-state-names.cjs");
const brainfuck_1 = require("./brainfuck.cjs");
const exampleDefinitions = {
    ...function_examples_1.functionExamples,
    binary: {
        category: "二进制运算",
        name: "二进制加一",
        description: "先移动到最右端，再从低位处理进位。",
        input: "1011",
        initialState: "scan",
        blankSymbol: "□",
        acceptStates: "",
        rejectStates: "",
        haltStates: "HALT",
        rules: `scan,0 -> scan,0,R\nscan,1 -> scan,1,R\nscan,□ -> carry,□,L\ncarry,0 -> HALT,1,N\ncarry,1 -> carry,0,L\ncarry,□ -> HALT,1,N`,
    },
    palindrome: {
        category: "基础示例",
        name: "二进制回文判断",
        description: "逐次标记两端字符；进入 ACCEPT 或 REJECT。",
        input: "1001",
        initialState: "start",
        blankSymbol: "□",
        acceptStates: "ACCEPT",
        rejectStates: "REJECT",
        haltStates: "",
        rules: `start,X -> start,X,R\nstart,Y -> start,Y,R\nstart,0 -> seek0,X,R\nstart,1 -> seek1,Y,R\nstart,□ -> ACCEPT,□,N\nseek0,0 -> seek0,0,R\nseek0,1 -> seek0,1,R\nseek0,X -> seek0,X,R\nseek0,Y -> seek0,Y,R\nseek0,□ -> check0,□,L\ncheck0,0 -> back,X,L\ncheck0,X -> check0,X,L\ncheck0,Y -> check0,Y,L\ncheck0,1 -> REJECT,1,N\ncheck0,□ -> ACCEPT,□,N\nseek1,0 -> seek1,0,R\nseek1,1 -> seek1,1,R\nseek1,X -> seek1,X,R\nseek1,Y -> seek1,Y,R\nseek1,□ -> check1,□,L\ncheck1,1 -> back,Y,L\ncheck1,X -> check1,X,L\ncheck1,Y -> check1,Y,L\ncheck1,0 -> REJECT,0,N\ncheck1,□ -> ACCEPT,□,N\nback,0 -> back,0,L\nback,1 -> back,1,L\nback,X -> back,X,L\nback,Y -> back,Y,L\nback,□ -> start,□,R`,
    },
    ...unary_examples_1.unaryExamples,
    ...binary_examples_1.binaryExamples,
    lambda: lambda_example_1.lambdaExample,
    brainfuck: (0, brainfuck_1.makeBrainfuckProject)(brainfuck_1.bfPresets.letter.source),
    ...hyperoperation_examples_1.hyperoperationExamples,
    ...inverse_operation_examples_1.inverseOperationExamples,
    ...conjecture_examples_1.conjectureExamples,
};
exports.builtinExamples = Object.fromEntries(Object.entries(exampleDefinitions).map(([id, project]) => {
    const variant = project.category === "一进制运算"
        ? (0, unary_state_names_1.shortUnaryProject)(project) : project;
    return [id, { ...variant, rules: (0, rule_format_1.compactRuleArrows)(variant.rules) }];
}));
