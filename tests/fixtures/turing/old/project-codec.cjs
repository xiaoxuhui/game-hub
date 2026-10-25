"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProjectData = validateProjectData;
exports.parseProjectJson = parseProjectJson;
exports.saveProject = saveProject;
exports.loadProject = loadProject;
const core_1 = require("./core.cjs");
const textFields = [
    "name",
    "description",
    "input",
    "blankSymbol",
    "initialState",
    "acceptStates",
    "rejectStates",
    "haltStates",
    "rules",
];
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validateProjectData(value) {
    if (!isObject(value))
        throw new Error("项目内容必须是 JSON 对象");
    if (value.format !== "turing-machine-simulator")
        throw new Error("不是图灵机实验台项目");
    if (value.version !== 1)
        throw new Error("仅支持项目格式版本 1");
    for (const field of textFields) {
        if (typeof value[field] !== "string")
            throw new Error(`字段 ${field} 必须是文本`);
    }
    if (!Number.isSafeInteger(value.maxSteps) || value.maxSteps < 1 || value.maxSteps > 1_000_000) {
        throw new Error("最大步数必须是 1–1000000 的整数");
    }
    if (!Number.isFinite(value.speed) || value.speed < 1 || value.speed > 1000) {
        throw new Error("目标速度必须在 1–1000 步/秒之间");
    }
    const project = value;
    if (!project.initialState.trim())
        throw new Error("初始状态不能为空");
    if (Array.from(project.blankSymbol).length !== 1)
        throw new Error("空白符必须是一个字符");
    const parsed = (0, core_1.parseTransitions)(project.rules);
    if (parsed.errors.length)
        throw new Error(parsed.errors.slice(0, 4).join("；"));
    new core_1.TuringMachine({
        blankSymbol: project.blankSymbol,
        initialState: project.initialState.trim(),
        acceptStates: splitStates(project.acceptStates),
        rejectStates: splitStates(project.rejectStates),
        haltStates: splitStates(project.haltStates),
        transitions: parsed.transitions,
    }, []);
    return { ...project };
}
function parseProjectJson(source) {
    let parsed;
    try {
        parsed = JSON.parse(source);
    }
    catch {
        throw new Error("项目文件不是有效的 JSON");
    }
    return validateProjectData(parsed);
}
function saveProject(storage, key, project) {
    try {
        storage.setItem(key, JSON.stringify(project));
        return null;
    }
    catch {
        return "无法保存到浏览器本地存储；当前页面仍可继续使用";
    }
}
function loadProject(storage, key) {
    try {
        const source = storage.getItem(key);
        return source === null ? null : parseProjectJson(source);
    }
    catch {
        return null;
    }
}
function splitStates(raw) {
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
}
