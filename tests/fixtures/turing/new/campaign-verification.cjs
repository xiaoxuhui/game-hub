"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tapeOutput = tapeOutput;
exports.verifyCampaignCases = verifyCampaignCases;
const core_1 = require("./core.cjs");
const lambda_local_1 = require("./lambda-local.cjs");
const brainfuck_1 = require("./brainfuck.cjs");
const universal_machine_1 = require("./universal-machine.cjs");
const symbol_annotations_1 = require("./symbol-annotations.cjs");
function tapeOutput(tape) {
    const entries = tape.entries();
    if (!entries.length)
        return "";
    let output = "";
    for (let position = entries[0][0]; position <= entries.at(-1)[0]; position++)
        output += tape.read(position);
    return output;
}
const statusText = { accept: "接受", reject: "拒绝", halt: "停止", "missing-transition": "缺少规则", "step-limit": "达到观察步数" };
/** Execute submitted transitions; decoders inspect tape results without computing an answer for the machine. */
function verifyCampaignCases(cases, maxSteps, definition, progress) {
    const results = cases.map((testCase, caseIndex) => {
        const machine = new core_1.TuringMachine(definition, (0, core_1.inputToTape)(testCase.input, definition.blankSymbol));
        const budget = Math.min(maxSteps, testCase.maxSteps ?? maxSteps);
        let reason = "step-limit";
        while (machine.stepCount < budget) {
            const result = machine.step();
            if (result.stopped) {
                reason = result.reason;
                break;
            }
            if (machine.stepCount % 25000 === 0)
                progress?.(caseIndex, machine.stepCount, budget);
        }
        let actualOutput = "", goalPassed = false;
        switch (testCase.mode ?? "tape") {
            case "status":
                actualOutput = statusText[reason];
                goalPassed = actualOutput === testCase.expectedOutput;
                break;
            case "nonblank-count":
                actualOutput = `${machine.tape.entries().length} 个非空格`;
                goalPassed = actualOutput === testCase.expectedOutput;
                break;
            case "lambda":
                actualOutput = (0, lambda_local_1.readLambdaOutput)(machine.tape)?.output ?? "无法解码归约结果";
                goalPassed = actualOutput === testCase.expectedOutput;
                break;
            case "brainfuck":
                actualOutput = (0, brainfuck_1.readBrainfuckOutput)(machine.tape).text;
                goalPassed = actualOutput === testCase.expectedOutput;
                break;
            case "goldbach": {
                actualOutput = tapeOutput(machine.tape);
                const parts = actualOutput.split("+");
                const prime = (n) => n >= 2 && Array.from({ length: Math.max(0, Math.floor(Math.sqrt(n)) - 1) }, (_, i) => i + 2).every(divisor => n % divisor !== 0);
                goalPassed = parts.length === 2 && parts.every(part => /^1+$/.test(part) && prime(part.length)) && parts.reduce((sum, part) => sum + part.length, 0) === testCase.input.length;
                break;
            }
            case "universal": {
                const decoded = testCase.alphabet && (0, universal_machine_1.readUniversalResult)(machine.tape, testCase.alphabet);
                const labels = { H: "停止", A: "接受", J: "拒绝", M: "缺少规则", B: "达到上限" };
                actualOutput = decoded ? `${decoded.output}（${labels[decoded.reason] ?? decoded.reason}）` : "无法解码模拟结果";
                goalPassed = actualOutput === testCase.expectedOutput;
                break;
            }
            default:
                actualOutput = tapeOutput(machine.tape);
                goalPassed = actualOutput === testCase.expectedOutput;
        }
        const entries = machine.tape.entries(), tapePreview = [];
        if (entries.length)
            for (let position = entries[0][0]; position <= entries.at(-1)[0] && tapePreview.length < 120; position++)
                tapePreview.push((0, symbol_annotations_1.visibleTapeSymbol)(machine.tape.read(position)) || "·");
        return { ...testCase, actualOutput, tapePreview, steps: machine.stepCount, reason, stoppedState: machine.currentState, readSymbol: machine.tape.read(machine.headPosition),
            passed: goalPassed && reason === (testCase.expectedReason ?? "halt") && (testCase.expectedSteps === undefined || testCase.expectedSteps === machine.stepCount) };
    });
    const passedCount = results.filter(result => result.passed).length;
    return { passed: passedCount === results.length, passedCount, totalCount: results.length, cases: results };
}
