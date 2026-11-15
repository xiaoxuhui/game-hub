import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { inspectResources, createZip } from '../../../scripts/resource-bundle.mjs';
import { sha256 } from '../../../scripts/resource-protocol.mjs';

export const RUNTIME_FILES = ['LICENSE', 'index.html', 'style.css', 'src/app.js', 'src/examples.js', 'src/machine.js'];
const root = new URL('../', import.meta.url);
// The Android host supplies offline resources and prohibits service workers.
// Keep browser-preview caching separate from the host's signed resource set.
const browserCacheLine = "if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});";
export function resourceEntries() {
  const entries = RUNTIME_FILES.map(path => {
    let data = readFileSync(new URL(path, root));
    if (path === 'src/app.js') {
      const text = data.toString('utf8');
      if (text.split(browserCacheLine).length !== 2) throw new Error('Browser cache bootstrap changed; review the resource build.');
      data = Buffer.from(text.replace(browserCacheLine, ''));
    }
    return { path, data };
  });
  inspectResources(entries, 'tape-language-lab');
  return entries;
}
export function buildResource() {
  const entries = resourceEntries(), directory = new URL('../dist/', import.meta.url);
  for (const entry of entries) {
    const target = new URL(entry.path, directory);
    mkdirSync(new URL('./', target), { recursive: true }); writeFileSync(target, entry.data);
  }
  const archive = createZip(entries);
  const metadata = {
    id: 'tape-language-lab', displayName: '编程语言实验', version: '0.1.0', entryPage: 'index.html',
    storageContract: 'tape-language-lab-dynamic-v1', publicationStatus: 'local-preview-only',
    archiveBytes: archive.length, archiveSha256: sha256(archive),
    files: entries.map(entry => ({ path: entry.path, bytes: entry.data.length, sha256: sha256(entry.data) }))
  };
  mkdirSync(new URL('../.build/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../.build/tape-language-lab-preview.zip', import.meta.url), archive);
  writeFileSync(new URL('../.build/resource-preview.json', import.meta.url), JSON.stringify(metadata, null, 2) + '\n');
  console.log(`Local resource preview: ${entries.length} files, ${archive.length} bytes; SHA-256 ${metadata.archiveSha256}`);
  return metadata;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildResource();
