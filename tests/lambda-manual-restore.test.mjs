import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';
import { lambdaManualRestoreHtml } from '../scripts/lambda-storage-c5-integration.mjs';

const html = readFileSync(new URL('../examples/lambda-diagram-game/lambda-lab.html', import.meta.url), 'utf8');

test('startup prepares a manual restore candidate without applying or replacing the saved session', () => {
  const fixedInput = execFileSync('git', ['show', 'ff17bc5306ad9c85f545db96ab74b15a090b98f2:examples/lambda-diagram-game/lambda-lab.html'], { maxBuffer: 2_000_000 }).toString('utf8');
  assert.equal(lambdaManualRestoreHtml(fixedInput), html, 'committed resource must be the reproducible adaptation of its fixed input');
  const start = html.indexOf('function prepareManualRestore()');
  const end = html.indexOf("\n    $('function-form').addEventListener", start);
  assert.ok(start >= 0 && end > start);
  const body = html.slice(start, end);
  assert.match(body, /localStorage\.getItem\(CHECKPOINT\)\|\|localStorage\.getItem\(AUTO\)\|\|localStorage\.getItem\(LEGACY\)/);
  assert.match(body, /checkpoint=S\.encode\(snapshot\)/);
  assert.doesNotMatch(body, /apply\(snapshot\)|localStorage\.setItem|removeItem/);
  assert.match(body, /本机存档已保留，可手动恢复/);
});

test('startup rendering is excluded from autosave and later explicit restore/import apply snapshots', () => {
  assert.match(html, /function persist\(explicit=false\) \{\s*if\(explicit===true\)autosaveReady=true;\s*clearTimeout\(saveTimer\);if\(restoring\|\|\(!autosaveReady&&explicit!==true\)\)return;/);
  assert.match(html, /function queueSave\(\)\{if\(autosaveReady&&!restoring\)/);
  assert.match(html, /workspace\.prepareManualRestore\(\);renderMode\(\);convert\(\);\s*const userAutosaveEvent=event=>event\.isTrusted&&!\(event\.target instanceof HTMLInputElement&&event\.target\.type==='file'\);\s*document\.addEventListener\('input',event=>\{if\(userAutosaveEvent\(event\)\)workspace\.enableAutosave\(\);\}/);
  assert.match(html, /const userAutosaveEvent=event=>event\.isTrusted&&!\(event\.target instanceof HTMLInputElement&&event\.target\.type==='file'\)/);
  assert.match(html, /document\.addEventListener\('change',event=>\{if\(userAutosaveEvent\(event\)\)workspace\.enableAutosave\(\);\}/);
  assert.match(html, /document\.addEventListener\('click',event=>\{if\(event\.isTrusted&&event\.target\.closest\([^)]*#level-list button/);
  assert.match(html, /document\.addEventListener\('toggle',event=>\{if\(event\.isTrusted&&event\.target\.id==='history-details'\)/);
  assert.match(html, /Math\.hypot\(event\.clientX-start\.x,event\.clientY-start\.y\)>10\|\|captureTap\(event\.target\)/);
  assert.match(html, /\(event\.ctrlKey\|\|event\.metaKey\)&&event\.key==='Enter'\|\|event\.target\.closest\('#diagram-mount'\)&&\['Enter',' '\]\.includes\(event\.key\)&&captureTap\(event\.target\)/);
  assert.doesNotMatch(html, /convert\(\);workspace\.enableAutosave\(\)/);
  assert.match(html, /window\.addEventListener\('pagehide',persist\)/);
  assert.match(html, /\$\('restore-state'\)\.addEventListener\('click',\(\)=>\{\s*if\(!checkpoint\)return;\s*try\{const snapshot=S\.decode\(checkpoint\);apply\(snapshot\);persist\(true\);/);
  assert.match(html, /\$\('import-state'\)\.addEventListener\('click',\(\)=>\$\('import-file'\)\.click\(\)\)/);
  assert.match(html, /apply\(snapshot\);persist\(true\);feedback\('存档已导入/);
});

test('all inline JavaScript in the Lambda page parses', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.ok(scripts.length > 0);
  for (const source of scripts) assert.doesNotThrow(() => new Script(source));
});
