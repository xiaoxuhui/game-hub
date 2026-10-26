import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';
import { lambdaC5BrowserAdapterSource } from '../scripts/lambda-storage-c5-integration.mjs';
import { createLambdaC5Storage } from '../scripts/lambda-storage-c5.mjs';

const oldFixture = JSON.parse(readFileSync(new URL('./fixtures/lambda-content3-reader.json', import.meta.url), 'utf8'));
const currentFixture = JSON.parse(readFileSync(new URL('./fixtures/lambda-content4-reader.json', import.meta.url), 'utf8'));
function reader(fixture) {
  const context = { TextEncoder, TextDecoder };
  for (const source of fixture.scripts) runInNewContext(source, context);
  return context;
}
const old = reader(oldFixture), current = reader(currentFixture);
class Element {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.listeners = {}; this.dataset = {}; this.attributes = {}; this.open = false; this.classList = { toggle() {} }; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { (this.listeners[type] ??= []).push(callback); }
  async fire(type) { for (const callback of this.listeners[type] ?? []) await callback({ preventDefault() {} }); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  querySelector(selector) {
    this.nodes ??= new Map();
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element(selector.slice(1)));
    return this.nodes.get(selector);
  }
}
function pageAdapter(storage) {
  const document = { head: new Element('head'), body: new Element('body'), createElement: tag => new Element(tag) };
  const downloads = [], listeners = {};
  const root = { localStorage: storage, document, LambdaDownload: { save: (...args) => downloads.push(args) },
    location: { reload() { root.reloaded = true; } }, addEventListener(type, callback) { (listeners[type] ??= []).push(callback); } };
  const context = { root, document, S: current.LambdaSnapshot, TextEncoder, TextDecoder };
  new Script(`${lambdaC5BrowserAdapterSource()}\nglobalThis.adapter=localStorage;globalThis.autoKey=AUTO;globalThis.checkpointKey=CHECKPOINT;`).runInNewContext(context);
  return { ...context, document, downloads, listeners, dialog: () => document.body.children.find(node => node.tagName === 'dialog') };
}
function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}
function fullText(draft = '(λa.a) u') {
  return current.LambdaSnapshot.encode({ version: 3, draft, functions: [], completed: current.LambdaPresets.levels.map(x => x.id), mode: 'challenge', level: 29,
    session: { original: current.LambdaCore.parse(draft), steps: 0, dirty: false, halt: '', paths: [] },
    view: { speed: 600, strategy: 'normal', direction: 'left', numberEncoding: 'decimal', decimalPlaces: 4, scale: 1, autoFit: true, panX: 0, panY: 0, historyOpen: false, helpOpen: false, hintOpen: false },
    selection: { start: 0, end: 0 }, error: '', functionDraft: { name: '', source: '' } });
}
function divergentV2(storage, draft) {
  const state = old.LambdaSnapshot.decode(storage.getItem('lambda-lab-v2'));
  state.draft = draft; state.session.original = old.LambdaCore.parse(draft);
  return old.LambdaSnapshot.encode(state);
}
function pendingConflictStorage() {
  const storage = memoryStorage(), c5 = createLambdaC5Storage(storage, current.LambdaSnapshot, old.LambdaSnapshot, { eventTarget: null });
  c5.setItem('lambda-lab-hub-v4', fullText());
  storage.setItem('lambda-lab-v2', divergentV2(storage, '(λb.b) v'));
  const v3 = storage.getItem('lambda-lab-hub-v3');
  storage.setItem('lambda-lab-hub-journal-v4', JSON.stringify({ schemaVersion: 1, before: [['lambda-lab-hub-v3', v3]], after: [['lambda-lab-hub-v3', v3]] }));
  return storage;
}

test('page adapter blocks all app reads and writes until a pending journal conflict is reviewed', async () => {
  const storage = pendingConflictStorage(), journal = storage.getItem('lambda-lab-hub-journal-v4');
  const page = pageAdapter(storage), dialog = page.dialog();
  assert.equal(dialog.open, true);
  assert.throws(() => page.adapter.getItem(page.autoKey), /冲突尚未处理/);
  assert.throws(() => page.adapter.setItem(page.autoKey, fullText('λz.z')), /冲突尚未处理/);
  assert.equal(storage.getItem('lambda-lab-hub-journal-v4'), journal);
  assert.equal(storage.getItem('lambda-lab-hub-c5-conflict-archive-v1'), null);
});

test('stale conflict button does not choose an unpreviewed candidate and refreshes draft previews', async () => {
  const storage = pendingConflictStorage(), page = pageAdapter(storage), dialog = page.dialog();
  const oldButton = dialog.querySelector('#lambda-c5-options').children.find(button => button.textContent.startsWith('新版完整存档'));
  assert.ok(oldButton);
  storage.setItem('lambda-lab-v2', divergentV2(storage, '(λe.e) r'));
  await oldButton.fire('click');
  assert.match(dialog.querySelector('#lambda-c5-status').textContent, /发生变化/);
  assert.ok(dialog.querySelector('#lambda-c5-options').children.some(button => button.textContent.includes('(λe.e) r')));
  assert.equal(storage.getItem('lambda-lab-hub-c5-conflict-archive-v1'), null);
});

test('conflict archive quota failure keeps the raw snapshot export available', async () => {
  const storage = pendingConflictStorage(), before = Object.fromEntries(storage.map), page = pageAdapter(storage), dialog = page.dialog();
  const set = storage.setItem;
  storage.setItem = (key, value) => { if (key === 'lambda-lab-hub-c5-conflict-archive-v1') { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; } return set(key, value); };
  const candidate = dialog.querySelector('#lambda-c5-options').children.find(button => button.textContent.startsWith('新版完整存档'));
  await candidate.fire('click');
  assert.match(dialog.querySelector('#lambda-c5-status').textContent, /quota/);
  const exportButton = dialog.querySelector('#lambda-c5-options').children.find(button => button.textContent === '导出当前全部原始存档');
  assert.ok(exportButton);
  await exportButton.fire('click');
  const payload = JSON.parse(page.downloads[0][1]);
  assert.equal(payload.reason, 'conflict-review');
  assert.equal(payload.storage['lambda-lab-hub-v4'], before['lambda-lab-hub-v4']);
  assert.equal(payload.storage['lambda-lab-hub-v3'], before['lambda-lab-hub-v3']);
  assert.equal(payload.storage['lambda-lab-v2'], before['lambda-lab-v2']);
  assert.equal(payload.storage['lambda-lab-hub-journal-v4'], before['lambda-lab-hub-journal-v4']);
  assert.equal(storage.getItem('lambda-lab-hub-c5-conflict-archive-v1'), null);
});

test('Storage.clear event opens export UI with the previous and cleared snapshots', async () => {
  const storage = memoryStorage(), page = pageAdapter(storage);
  page.adapter.setItem(page.autoKey, fullText());
  const before = storage.getItem('lambda-lab-hub-v4');
  storage.map.clear();
  for (const callback of page.listeners.storage) await callback({ key: null, oldValue: null, newValue: null });
  const dialog = page.dialog();
  assert.equal(dialog.open, true);
  const exportButton = dialog.querySelector('#lambda-c5-options').children.find(button => button.textContent === '导出观察到的全部存档');
  assert.ok(exportButton);
  await exportButton.fire('click');
  const payload = JSON.parse(page.downloads[0][1]);
  assert.equal(payload.event.key, null);
  assert.equal(payload.previousSnapshot['lambda-lab-hub-v4'], before);
  assert.equal(payload.snapshot['lambda-lab-hub-v4'], null);
  assert.throws(() => page.adapter.setItem(page.autoKey, fullText('λchanged.x')), /停止读取和写入/);
});
