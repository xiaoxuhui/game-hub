const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.resolve(path.dirname(process.execPath), '../node_modules/playwright')); }

const html = fs.readFileSync(path.join(__dirname, '../examples/lambda-diagram-game/lambda-lab.html'));
const server = http.createServer((req, res) => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html));

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await playwright.chromium.launch({ headless: true });
  const errors = [];
  let checks = 0;
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true, acceptDownloads: true });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/lambda-lab.html`);
      const initial = await page.locator('#expression').inputValue();
      const edit = '(λa.a) u ((λb.b) v)';
      await page.locator('#expression').fill(edit);
      await page.locator('#convert').click();
      await page.locator('#step').click();
      const savedResult = await page.locator('#current-expression').textContent();
      await page.locator('#save-state').click();
      const stored = await page.evaluate(() => localStorage.getItem('lambda-lab-hub-v4'));
      assert.ok(stored, 'save should create a local snapshot');

      await page.reload();
      await page.waitForTimeout(250);
      assert.equal(await page.locator('#expression').inputValue(), initial, 'startup must show the fresh page, not silently apply an old save');
      assert.equal(await page.evaluate(() => localStorage.getItem('lambda-lab-hub-v4')), stored, 'startup must preserve the previous save');
      assert.equal(await page.locator('#restore-state').isEnabled(), true, 'manual local restore must be available');
      await page.locator('#import-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":999}') });
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => localStorage.getItem('lambda-lab-hub-v4')), stored, 'a rejected import must not enable autosave or replace the old save');
      await page.locator('#expression').press('ArrowLeft');
      await page.locator('#diagram-viewport').click({ position: { x: 5, y: 5 } });
      assert.equal(await page.evaluate(() => localStorage.getItem('lambda-lab-hub-v4')), stored, 'navigation keys and empty diagram taps must not enable autosave');
      await page.reload();
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => localStorage.getItem('lambda-lab-hub-v4')), stored, 'leaving an untouched fresh session must not overwrite the previous save');
      assert.equal(await page.locator('#restore-state').isEnabled(), true, 'the previous save must remain restorable after a second open');
      await page.locator('#restore-state').click();
      assert.equal(await page.locator('#current-expression').textContent(), savedResult, 'manual restore must recover the saved session');
      console.log(`PASS ${++checks} ${width}px: fresh startup, local save retained, manual restore works`);

      const downloadEvent = page.waitForEvent('download');
      await page.locator('#export-state').click();
      const download = await downloadEvent;
      const file = await download.path();
      await page.locator('#expression').fill('λz.z');
      await page.locator('#convert').click();
      await page.locator('#import-file').setInputFiles(file);
      await page.waitForFunction(expected => document.getElementById('expression').value === expected, edit);
      assert.equal(await page.locator('#current-expression').textContent(), savedResult, 'manual file import must apply the selected snapshot');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'layout must fit the viewport');
      console.log(`PASS ${++checks} ${width}px: Import button loads selected JSON save without overflow`);
      await context.close();

      const levelContext = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true });
      const levelPage = await levelContext.newPage();
      levelPage.on('pageerror', error => errors.push(error.message));
      await levelPage.goto(`http://127.0.0.1:${server.address().port}/lambda-lab.html`);
      await levelPage.locator('#level-list button').nth(1).click();
      const selectedLevel = await levelPage.locator('#level-title').textContent();
      await levelPage.waitForFunction(() => Boolean(localStorage.getItem('lambda-lab-hub-v4')));
      await levelPage.reload();
      assert.equal(await levelPage.locator('#restore-state').isEnabled(), true, 'a selected level must be available as a manual save after reopen');
      await levelPage.locator('#restore-state').click();
      assert.equal(await levelPage.locator('#level-title').textContent(), selectedLevel, 'dynamic level buttons must enable autosave after a user selection');
      console.log(`PASS ${++checks} ${width}px: dynamic level selection autosaves and can be manually restored`);
      await levelContext.close();
    }
    assert.deepEqual(errors, []);
    console.log(`Lambda manual restore browser checks: ${checks} passed, 0 failed; page errors 0.`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
