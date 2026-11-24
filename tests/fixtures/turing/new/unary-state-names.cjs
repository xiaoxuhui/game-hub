"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortUnaryState = shortUnaryState;
exports.shortUnaryProject = shortUnaryProject;
const function_parameters_1 = require("./function-parameters.cjs");
const words = {
    add: "a", sub: "s", mul: "m", cmp: "c",
    scan: "s", seek: "f", pick: "p", take: "t", back: "b", return: "r",
    end: "e", trim: "t", erase: "e", clean: "c", restore: "v", rewind: "w",
    init: "i", parse: "p", validate: "v", fence: "f", write: "w",
    carryBar: "cb", carryOne: "c1", putBar: "pb", putOne: "p1", skipHole: "h",
    entry: "s", exit: "e", op: "o", done: "d", reject: "j",
    cleanLeft: "cl", pickA: "pa", pickB: "pb", backA: "ba",
    scanA: "sa", scanB: "sb", seekA: "fa", seekB: "fb", incA: "ia", incB: "ib",
    result: "r", find: "f", start: "s", even: "e", odd: "o", rest: "t", right: "r",
};
const routines = {
    寄存器加一: "inc", 减一后收拢纸带: "dec", 向右找原点: "hr", 向左找原点: "hl", 向左过分隔符: "ll",
};
const terminalNames = { HALT: "H", ACCEPT: "A", REJECT: "R" };
const shortTerminals = (text) => text.replace(/\b(?:HALT|ACCEPT|REJECT)\b/g, name => terminalNames[name]);
function shortRoutine(name) {
    return routines[name] ?? name.replace(/^公共(右扫|左扫|规则)(\d+)$/, (_, kind, index) => ({ 右扫: "r", 左扫: "l", 规则: "f" })[kind] + index);
}
function shortUnaryState(name) {
    if (Object.hasOwn(terminalNames, name))
        return terminalNames[name];
    return name.split(".").map(part => {
        const match = /^([a-zA-Z]+)(\d*)$/.exec(part);
        return match && words[match[1]] ? words[match[1]] + match[2] : part;
    }).join(".");
}
function shortSource(source, oldBlank, blank) {
    const symbol = (value) => value.trim() === oldBlank ? blank : value.trim();
    return source.split(/(\r?\n)/).map(line => {
        const text = line.trim();
        if (!text)
            return line;
        if (text.startsWith("#"))
            return shortTerminals(line.replace(/\b(?:I|parse|validate|init|clean|return|add|sub|mul|cmp)\.[a-zA-Z0-9_.]+\b/g, shortUnaryState)).replaceAll(oldBlank, blank);
        const header = (0, function_parameters_1.functionHeader)(text);
        if (header) {
            const fields = header.fields.map((field, index) => index < 2 ? shortUnaryState(field.trim()) : field);
            return shortRoutine(header.name) + "(" + fields.join(",") + "):";
        }
        const call = /^([^,():\s]+)\s*:\s*([^,():\s]+)\s*->\s*([^,():\s]+)$/.exec(text);
        if (call)
            return line.slice(0, line.length - line.trimStart().length) + shortUnaryState(call[1]) + ": " + shortRoutine(call[2]) + "->" + shortUnaryState(call[3]);
        const rule = /^([^,]+),([^,]+?)\s*->\s*([^,]+),([^,]+),([^,]+)$/.exec(text);
        if (!rule)
            return line;
        return line.slice(0, line.length - line.trimStart().length) + shortUnaryState(rule[1].trim()) + "," + symbol(rule[2]) + "->" +
            shortUnaryState(rule[3].trim()) + "," + symbol(rule[4]) + "," + rule[5].trim();
    }).join("");
}
function shortUnaryProject(project) {
    const blankSymbol = project.blankSymbol === "□" ? "_" : project.blankSymbol;
    return {
        ...project, initialState: shortUnaryState(project.initialState),
        blankSymbol, input: project.input.replaceAll(project.blankSymbol, blankSymbol),
        haltStates: shortTerminals(project.haltStates), acceptStates: shortTerminals(project.acceptStates), rejectStates: shortTerminals(project.rejectStates),
        description: shortTerminals(project.description).replaceAll(project.blankSymbol, blankSymbol),
        rules: shortSource(project.rules, project.blankSymbol, blankSymbol),
        numericStateSections: project.numericStateSections && Object.fromEntries(Object.entries(project.numericStateSections).map(([state, section]) => [shortUnaryState(state), section])),
        sharedRules: project.sharedRules && (() => shortSource(project.sharedRules(), project.blankSymbol, blankSymbol)),
    };
}
