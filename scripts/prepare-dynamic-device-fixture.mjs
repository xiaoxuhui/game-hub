import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Requires the normal producer's exact-current-commit verification before copying any bytes.
execFileSync(process.execPath, ['scripts/dynamic-resources.mjs', '--verify'], { stdio: 'inherit' });
const input = resolve('.build/dynamic-candidate');
const games = JSON.parse(readFileSync(resolve(input, 'games.unsigned.json'), 'utf8'));
const game = games.find(item => item.id === 'memory-demo');
if (!game || game.contentCode !== 1 || !/^[0-9a-f]{64}$/.test(game.archiveSha256)) {
  throw new Error('The initial pinned memory-demo fixture is required');
}
const output = resolve('android/app/build/generated/dynamic-device-assets/dynamic-demo-fixture');
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'games.json'), JSON.stringify([game], null, 2) + '\n');
copyFileSync(resolve(input, `game-memory-demo-1-${game.archiveSha256.slice(0, 12)}.zip`), resolve(output, 'game.zip'));
console.log(`Prepared instrumentation-only demo fixture: ${game.sourceRevision} / ${game.archiveSha256}`);
