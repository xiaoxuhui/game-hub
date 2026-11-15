import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resourceEntries, RUNTIME_FILES } from '../scripts/build-resource.mjs';
import { createZip, readStoredZip, inspectResources } from '../../../scripts/resource-bundle.mjs';
import { collectReferences } from '../../../scripts/bundle.mjs';

test('hall resource excludes browser caching and has a complete relative dependency closure', () => {
  const entries = resourceEntries(), paths = new Set(entries.map(entry => entry.path));
  assert.equal(entries.length, 6); assert.deepEqual([...paths], RUNTIME_FILES);
  assert.doesNotThrow(() => inspectResources(entries, 'tape-language-lab'));
  for (const path of collectReferences(readFileSync(new URL('../index.html', import.meta.url), 'utf8'))) assert.equal(paths.has(path), true, path);
  const app = entries.find(entry => entry.path === 'src/app.js').data.toString('utf8');
  assert.doesNotMatch(app, /serviceWorker|\bcaches\s*\./);
  for (const match of app.matchAll(/from ['"]\.\/([^'"]+)['"]/g)) assert.equal(paths.has(`src/${match[1]}`), true);
});
test('hall preview ZIP round trip preserves all six resource bytes', () => {
  const entries = resourceEntries(), zip = createZip(entries), unpacked = readStoredZip(zip);
  assert.deepEqual(unpacked.map(entry => entry.path).sort(), [...RUNTIME_FILES].sort());
  for (const entry of entries) assert.deepEqual(unpacked.find(item => item.path === entry.path).data, entry.data);
});
