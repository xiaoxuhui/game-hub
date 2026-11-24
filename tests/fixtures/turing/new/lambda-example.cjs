"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lambdaExample = void 0;
const lambda_local_1 = require("./lambda-local.cjs");
exports.lambdaExample = (0, lambda_local_1.makeLambdaProject)("(λx.λy.x) y");
