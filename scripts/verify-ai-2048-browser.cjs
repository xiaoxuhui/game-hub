const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve, join, extname } = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const root = resolve(__dirname, '../examples/ai-2048'), output = resolve(__dirname, '../.build/ai-2048-browser');
  mkdirSync(output, { recursive: true });
  const server = createServer((request, response) => {
    const name = request.url.split('?')[0].slice(1) || 'index.html';
    if (!/^[a-z0-9.-]+$/.test(name)) { response.writeHead(404).end(); return; }
    try {
      response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' })[extname(name)] || 'text/plain');
      response.end(readFileSync(join(root, name)));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.GAME_HUB_CHROMIUM ? { executablePath: process.env.GAME_HUB_CHROMIUM } : {}) });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [], checks = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ai-2048-save-v1')));
    const fixture = async (width, height, cells) => {
      await page.evaluate(({ width, height, cells }) => localStorage.setItem('ai-2048-save-v1', JSON.stringify({
        schemaVersion: 1, game: 'ai-2048', width, height, cells, score: '0', best: '0', moves: 0
      })), { width, height, cells });
      await page.reload();
    };
    assert.equal(await page.locator('.tile').count(), 16);
    await page.locator('#width').fill('7'); await page.locator('#height').fill('3');
    assert.equal(await page.locator('.tile').count(), 16);
    await page.getByRole('button', { name: '应用尺寸并开始新局' }).click();
    assert.equal(await page.locator('.tile').count(), 21);
    assert.equal((await saved()).width, 7); assert.equal((await saved()).height, 3);
    await page.screenshot({ path: join(output, 'desktop-7x3.png'), fullPage: true });
    checks.push('Independent 7-column and 3-row dimensions apply only on submit');

    await fixture(7, 3, [1, ...Array(20).fill(0)]);
    await page.locator('#board').focus(); await page.keyboard.press('ArrowRight');
    assert.equal((await saved()).moves, 1); assert.equal((await saved()).cells[6], 1);
    await page.locator('#step').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ai-2048-save-v1')).moves === 2);
    assert.ok(requests.some(url => url.endsWith('/worker.js')));
    checks.push('Keyboard and actual Worker AI step work on a rectangular board');

    await page.locator('#speed').selectOption('70'); await page.locator('#auto').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ai-2048-save-v1')).moves >= 5);
    await page.locator('#auto').click();
    const paused = await saved(); await page.waitForTimeout(200); assert.deepEqual(await saved(), paused);
    await page.reload(); assert.deepEqual(await saved(), paused);
    assert.equal(await page.locator('#auto').getAttribute('aria-pressed'), 'false');
    checks.push('Auto play pauses without an extra move, and reload restores the saved board while paused');

    await page.evaluate(() => {
      window.Worker = class {
        postMessage() { this.timer = setTimeout(() => this.onmessage?.({ data: { direction: 'right' } }), 300); }
        terminate() { clearTimeout(this.timer); }
      };
    });
    await page.locator('#step').click();
    await page.locator('#width').fill('2'); await page.locator('#height').fill('20');
    await page.getByRole('button', { name: '应用尺寸并开始新局' }).click();
    await page.waitForTimeout(400);
    assert.equal((await saved()).moves, 0); assert.equal((await saved()).height, 20);
    checks.push('Resizing during a pending AI task cancels its result');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#width').fill('20'); await page.locator('#height').fill('2');
    await page.getByRole('button', { name: '应用尺寸并开始新局' }).click();
    assert.equal(await page.locator('.tile').count(), 40);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: join(output, 'phone-20x2.png'), fullPage: true });
    await page.locator('#width').fill('20'); await page.locator('#height').fill('20');
    await page.getByRole('button', { name: '应用尺寸并开始新局' }).click();
    assert.equal(await page.locator('.tile').count(), 400);
    checks.push('Phone layout contains wide boards with horizontal scrolling; maximum 20x20 renders 400 cells');

    await fixture(2, 2, [1, 2, 2, 1]);
    assert.equal(await page.locator('#step').isDisabled(), true);
    assert.equal(await page.locator('#auto').isDisabled(), true);
    assert.match(await page.locator('#status').textContent(), /本局结束/);
    checks.push('Dead board stops AI and shows the end-of-game message');

    await fixture(2, 2, [1, 1, 0, 0]);
    const original = await saved();
    await page.evaluate(() => { window.GameHubBridge = { saveFile: (name, data) => { window.exported = { name, data }; return true; } }; });
    await page.locator('#export-save').click();
    const exported = await page.evaluate(() => window.exported);
    assert.equal(exported.name, 'ai-2048-save.json'); assert.deepEqual(JSON.parse(exported.data), original);
    await page.locator('#import-save').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('未能导入'));
    assert.match(await page.locator('#status').textContent(), /未能导入/); assert.deepEqual(await saved(), original);
    const imported = { ...original, width: 3, height: 2, cells: [1, 1, 0, 0, 0, 0] };
    await page.locator('#import-save').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('存档已导入'));
    assert.deepEqual(await saved(), imported); assert.equal(await page.locator('.tile').count(), 6);
    checks.push('Bridge export and validated import preserve progress; malformed imports do not replace saves');

    await page.evaluate(() => localStorage.setItem('ai-2048-save-v1', 'broken-save'));
    await page.reload();
    assert.match(await page.locator('#status').textContent(), /原存档无法读取/);
    await page.locator('#step').click();
    await page.waitForFunction(() => !document.querySelector('#step').disabled);
    assert.equal(await page.evaluate(() => localStorage.getItem('ai-2048-save-v1')), 'broken-save');
    await page.locator('#restart').click();
    assert.equal((await saved()).moves, 0);
    checks.push('Malformed save remains untouched until an explicit new game');

    await page.addInitScript(() => { window.Worker = function () { throw Error('Worker unavailable'); }; });
    await fixture(2, 2, [1, 1, 0, 0]);
    await page.locator('#step').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ai-2048-save-v1')).moves === 1);
    checks.push('Bounded fallback AI works when Worker is unavailable');
    assert.deepEqual(errors, []);
    assert.ok(requests.every(url => url.startsWith('http://127.0.0.1:')));
    const result = { browser: browser.version(), checks, errors, externalRequests: 0,
      boundary: 'Fresh desktop Chromium with phone viewport. Android device and signed production installation not exercised.' };
    writeFileSync(join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally { if (browser) await browser.close(); await new Promise(done => server.close(done)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
