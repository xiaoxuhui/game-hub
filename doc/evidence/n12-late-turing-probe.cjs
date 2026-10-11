// Real old/new readers; original repository is read only. All transpiled files are task-local.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const ts = require('D:/soft/turing-machine-simulator/node_modules/typescript');
const root = 'D:/soft/.ci-tmp/game-hub-n12';
const source = path.join(root, 'late-turing');
const revisions = { old: '32eb3b95eb78eab703abe8e64214bd8dbbb939c7', next: 'ffca525f838101151c9e1a6a8c6cb8798aa7d936' };
const modules = {};
for (const [name, revision] of Object.entries(revisions)) {
  const dir = path.join(root, 'late-turing-probe', name);
  fs.mkdirSync(dir, { recursive: true });
  for (const file of ['core', 'examples', 'project-codec']) {
    const text = execFileSync('git', ['-C', source, 'show', `${revision}:src/${file}.ts`], { encoding: 'utf8' });
    const output = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    fs.writeFileSync(path.join(dir, `${file}.cjs`), output.replace(/require\("\.\/(core|examples)"\)/g, 'require("./$1.cjs")'));
  }
  modules[name] = { reader: require(path.join(dir, 'project-codec.cjs')), examples: require(path.join(dir, 'examples.cjs')) };
}
const oldData = { ...modules.old.examples.examples.binary, format: 'turing-machine-simulator', version: 1, maxSteps: 10000, speed: 1000 };
const maxData = { ...oldData, maxSteps: null };
const encoded = JSON.stringify(maxData);
assert.deepEqual(modules.next.reader.parseProjectJson(JSON.stringify(oldData)), oldData);
assert.deepEqual(modules.next.reader.parseProjectJson(encoded), maxData);
let rejection;
try { modules.old.reader.parseProjectJson(encoded); } catch (error) { rejection = error.message; }
assert.ok(rejection, 'Published old reader must reject the new Max save');
const result = { revisions, oldSaveAcceptedByNew: true, maxSaveAcceptedByNew: true, maxSaveRejectedByOld: rejection, decision: 'Hold current signed Turing resource; design migration and rollback compatibility first.' };
fs.writeFileSync(path.join(root, 'evidence', 'late-turing-compatibility.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
