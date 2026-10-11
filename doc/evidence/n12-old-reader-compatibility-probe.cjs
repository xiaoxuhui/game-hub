"use strict";

// Synthetic, in-memory compatibility probe. No user saves or repo files are written.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const root = "D:\\soft\\.ci-tmp\\game-hub-n12\\upstreams";
const revisions = {
  eml: {
    released: "2616c9e9b081762b01599cc79da919d20340d0a2",
    target: "76cdd75bc26fc7d1dc23a2a4b19e74857c9c430c",
  },
  lambda: {
    released: "a75d180193fbe7298709298102c8c6008d1353cd",
    target: "5f5ec5561be70716c22be62797c808aa0db9a960",
  },
};

function oldModules(repo, revision) {
  const cache = new Map();
  function load(name) {
    assert.match(name, /^[a-z0-9-]+\.js$/);
    if (cache.has(name)) return cache.get(name).exports;
    const source = execFileSync("git", ["-C", repo, "show", `${revision}:src/${name}`], { encoding: "utf8" });
    const module = { exports: {} };
    cache.set(name, module);
    const localRequire = (specifier) => {
      assert.match(specifier, /^\.\/[a-z0-9-]+\.js$/);
      return load(specifier.slice(2));
    };
    new Function("module", "exports", "require", source)(module, module.exports, localRequire);
    return module.exports;
  }
  return load;
}

function attempt(operation) {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

const lambdaRepo = path.join(root, "lambda-diagram-game");
const lambdaCore = require(path.join(lambdaRepo, "src", "core.js"));
const lambdaNew = require(path.join(lambdaRepo, "src", "snapshot.js"));
const lambdaOld = oldModules(lambdaRepo, revisions.lambda.released)("snapshot.js");
const lambdaSample = {
  version: 2, draft: "(λx.x) ((λy.y) z)", functions: [], completed: [], mode: "free", level: 0,
  session: { original: lambdaCore.parse("(λx.x) ((λy.y) z)"), steps: 2, paths: [["arg"], null], dirty: false, halt: "" },
  view: { speed: 600, scale: 1, autoFit: true, historyOpen: false, helpOpen: false, hintOpen: false },
  selection: { start: 0, end: 0 }, error: "",
};
const lambdaNewSave = lambdaNew.encode(lambdaSample);
const lambdaNewRead = attempt(() => lambdaNew.decode(lambdaNewSave).version);
const lambdaOldRead = attempt(() => lambdaOld.decode(lambdaNewSave).version);
delete lambdaSample.session.paths;
const lambdaLegacySave = lambdaNew.encode(lambdaSample);
const lambdaOldReadLegacy = attempt(() => lambdaOld.decode(lambdaLegacySave).version);
assert.equal(JSON.parse(lambdaNewSave).version, 3);
assert.equal(lambdaNewRead.ok, true);
assert.equal(lambdaOldRead.ok, false);
assert.equal(lambdaOldReadLegacy.ok, true);

const emlRepo = path.join(root, "eml");
const emlExpr = require(path.join(emlRepo, "src", "expression.js"));
const emlStore = require(path.join(emlRepo, "src", "value-store.js"));
const emlComposition = require(path.join(emlRepo, "src", "eml-composition.js"));
const emlNew = require(path.join(emlRepo, "src", "persistence.js"));
const emlOld = oldModules(emlRepo, revisions.eml.released)("persistence.js");
const definition = emlComposition.parseDefinition("F(x, y, z) = EML(EML(x, y), z)");
assert.equal(definition.ok, true);
const evaluation = emlComposition.evaluate(definition.definition, [emlExpr.ONE, emlExpr.ONE, emlExpr.ONE]);
assert.equal(evaluation.ok, true);
const added = emlStore.addCompositionEvaluation(emlStore.createInitialState(), evaluation,
  [emlStore.initialValueId, emlStore.initialValueId, emlStore.initialValueId]);
const emlNewSave = emlNew.serialize(added.state);
const emlNewRead = emlNew.deserialize(emlNewSave);
const emlOldRead = emlOld.deserialize(emlNewSave);
const emlOldSave = emlOld.serialize(oldModules(emlRepo, revisions.eml.released)("value-store.js").createInitialState());
const emlNewReadOld = emlNew.deserialize(emlOldSave);
assert.equal(emlNewRead.ok, true);
assert.equal(emlOldRead.ok, false);
assert.equal(emlNewReadOld.ok, true);

console.log(JSON.stringify({
  synthetic: true,
  userDataRead: false,
  revisions,
  lambda: {
    newSavedVersion: JSON.parse(lambdaNewSave).version,
    newReadNew: lambdaNewRead,
    oldReadNew: lambdaOldRead,
    oldReadWithoutManualPaths: lambdaOldReadLegacy,
  },
  eml: {
    newOperation: Object.values(added.state.derivations)[0].operation,
    newReadNew: { ok: emlNewRead.ok, error: emlNewRead.error ?? null },
    oldReadNew: { ok: emlOldRead.ok, error: emlOldRead.error ?? null },
    newReadOld: { ok: emlNewReadOld.ok, error: emlNewReadOld.error ?? null },
  },
  passed: true,
}, null, 2));
