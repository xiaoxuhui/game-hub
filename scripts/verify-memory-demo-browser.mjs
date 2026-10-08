import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Supply an existing Playwright module; use a fresh profile and a task-owned loopback server only.
const modulePath = resolve(process.argv[2] || 'node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(modulePath).href);
const output = resolve('.build/memory-demo-browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.GAME_HUB_CHROMIUM ? { executablePath: process.env.GAME_HUB_CHROMIUM } : {}) });
const checks = [], errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:18404/', { waitUntil: 'networkidle' });
  const cards = page.locator('#cards button');
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('memory-demo-state-v1')));
  assert.equal(await cards.count(), 6);
  await cards.nth(0).click(); await cards.nth(1).click();
  assert.equal((await state()).moves, 1); assert.deepEqual((await state()).matched, []);
  checks.push('Actual pointer mismatch increments one move without matching');
  await page.locator('#restart').click();
  await cards.nth(0).focus(); await page.keyboard.press('Enter');
  assert.deepEqual((await state()).open, [0]);
  checks.push('Actual Enter key activates focused card; post-render focus continuity remains N6 work');
  await cards.nth(3).click(); await cards.nth(1).click(); await cards.nth(5).click();
  await cards.nth(2).click(); await cards.nth(4).click();
  const won = await state();
  assert.equal(won.complete, true); assert.equal(won.moves, 3); assert.equal(won.wins, 1);
  assert.equal(await page.locator('#cards button:disabled').count(), 6);
  checks.push('Three actual pairs complete one win and disable all matched cards');
  await page.screenshot({ path: resolve(output, 'completed-phone.png'), fullPage: true });
  const downloadWait = page.waitForEvent('download'); await page.locator('#export').click();
  const download = await downloadWait; const savedPath = resolve(output, 'own-fixture-save.json');
  await download.saveAs(savedPath);
  assert.deepEqual(JSON.parse(await readFile(savedPath, 'utf8')), won);
  await page.locator('#restart').click(); assert.equal((await state()).complete, false);
  await page.locator('#import').setInputFiles(savedPath);
  await page.waitForFunction(() => document.querySelector('#message').textContent === '已导入并保存存档。');
  assert.deepEqual(await state(), won);
  checks.push('Actual browser Blob download and file-input import round-trip the game save');
  await page.locator('#import').setInputFiles({ name: 'invalid-own-fixture.json', mimeType: 'application/json', buffer: Buffer.from('{"game":"wrong"}') });
  await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('未导入：'));
  assert.deepEqual(await state(), won); assert.equal(await page.locator('#import').inputValue(), '');
  checks.push('Invalid actual file import preserves previous state and clears file input');
  await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(await state(), won);
  checks.push('Fresh document restores the actual completed localStorage save');
  assert.deepEqual(errors, []);
  const result = { browser: browser.version(), origin: 'http://127.0.0.1:18404', checks, pageErrors: errors,
    saveSha256: createHash('sha256').update(await readFile(savedPath)).digest('hex'),
    boundary: 'Fresh standalone Chromium; Android production SAF is verified separately. Keyboard focus continuity is not claimed.' };
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
