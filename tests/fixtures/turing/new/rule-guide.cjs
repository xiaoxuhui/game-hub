"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ruleGuideKey = void 0;
const ruleGuideKey = (rule) => JSON.stringify([
    rule.fromState, rule.readSymbol, rule.toState, rule.writeSymbol, rule.direction,
]);
exports.ruleGuideKey = ruleGuideKey;
