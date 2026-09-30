import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const activity = readFileSync(new URL('../android/app/src/main/java/com/xiaoxuhui/gamehub/MainActivity.kt', import.meta.url), 'utf8');
const bridgeScript = activity.match(/private val EXPORT_BRIDGE_JS = """([\s\S]*?)"""\.trimIndent\(\)/)?.[1];
assert.ok(bridgeScript, 'export bridge script must exist');

function harness() {
  const saved = [];
  const listeners = new Map();
  let nativeClicks = 0;
  let nextUrl = 0;
  class Anchor {
    href = '#';
    download = '';
    getAttribute(name) { return name === 'download' ? this.download : null; }
    closest(selector) { return selector === 'a[download]' ? this : null; }
    click() { nativeClicks++; }
  }
  const context = {
    window: { ConwayAndroid: { saveFile: (...args) => saved.push(args) } },
    document: { addEventListener: (name, fn) => listeners.set(name, fn) },
    URL: { createObjectURL: () => `blob:test-${++nextUrl}`, revokeObjectURL: () => {} },
    HTMLAnchorElement: Anchor,
  };
  runInNewContext(bridgeScript.replaceAll('__BRIDGE__', 'ConwayAndroid'), context);
  return { context, Anchor, saved, listeners, nativeClicks: () => nativeClicks };
}

test('detached programmatic Blob click saves content before immediate revoke', async () => {
  const { context, Anchor, saved, nativeClicks } = harness();
  const anchor = new Anchor();
  anchor.href = context.URL.createObjectURL(new Blob(['project'], { type: 'application/json' }));
  anchor.download = 'project.json';
  anchor.click();
  context.URL.revokeObjectURL(anchor.href);
  await new Promise(setImmediate);
  assert.deepEqual(saved, [['project.json', 'project']]);
  assert.equal(nativeClicks(), 0);
});

test('bubble listener sees EML-style Blob URL assigned by the target click handler', async () => {
  const { context, Anchor, saved, listeners } = harness();
  const anchor = new Anchor();
  anchor.download = 'list.json';
  anchor.href = context.URL.createObjectURL(new Blob(['list']));
  let prevented = false;
  listeners.get('click')({ target: anchor, preventDefault: () => { prevented = true; } });
  await new Promise(setImmediate);
  assert.equal(prevented, true);
  assert.deepEqual(saved, [['list.json', 'list']]);
});
