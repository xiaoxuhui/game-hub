"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exampleLevelId = exports.existingExampleLevels = void 0;
exports.existingExampleLevels = {
    unary: "unary-increment", binary: "binary-increment", unaryAdd: "unary-addition", unarySubtract: "unary-subtraction",
    unaryMultiply: "unary-product", unaryPower: "unary-power", unaryTetration: "unary-tetration", unaryPentation: "unary-pentation",
    binaryAdd: "binary-addition", binarySubtract: "binary-subtraction", binaryMultiply: "binary-multiplication",
    binaryDivide: "binary-division", binaryPower: "binary-power", binaryLog: "binary-logarithm",
    unaryRoot: "unary-integer-root", unaryLog: "unary-integer-log",
};
const exampleLevelId = (id) => exports.existingExampleLevels[id] ?? `example-${id}`;
exports.exampleLevelId = exampleLevelId;
