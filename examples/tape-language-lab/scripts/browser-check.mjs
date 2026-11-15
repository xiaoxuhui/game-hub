import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { server } = await import('./serve.mjs');
if (!server.listening) await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const out = fileURLToPath(new URL('../evidence/', import.meta.url));
await mkdir(out, { recursive: true });
const errors = [], external = [];
const resourceMode = process.env.TAPE_RESOURCE_CHECK === '1';
const bridge = resourceMode ? readFileSync(new URL('../../../android/app/src/main/java/com/xiaoxuhui/gamehub/MainActivity.kt', import.meta.url), 'utf8').match(/private val EXPORT_BRIDGE_JS = """([\s\S]*?)"""\.trimIndent\(\)/)[1].replaceAll('__BRIDGE__', 'TestBridge') : '';
let checks = 0;
const check = async (name, callback) => { await callback(); checks++; console.log(`PASS ${name}`); };
const setSpeed = async (page, value) => {
  if (value === 'turbo') await page.locator('#speed-unlimited').check();
  else { await page.locator('#speed').fill(value); await page.locator('#speed').press('Enter'); }
};
try {
  for (const [label, viewport] of [['desktop', { width: 1440, height: 1100 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    if (resourceMode) await context.addInitScript({ content: 'window.__saved=[];window.TestBridge={saveFile:(name,content)=>window.__saved.push({name,content})};\n' + bridge });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).origin !== origin) external.push(request.url()); });
    await page.goto(origin);
    await check(`${label}: correct viewport and no horizontal overflow`, async () => {
      assert.equal(await page.evaluate(() => innerWidth), viewport.width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.title(), '编程语言实验 · 纸带上的小宇宙');
    });
    await check(`${label}: single step updates pointer, current command and tape`, async () => {
      await page.locator('#source').fill('<+');
      await page.locator('#step').click();
      assert.equal(await page.locator('#pointer').innerText(), '-1');
      await page.locator('#step').click();
      assert.equal(await page.locator('#cell-value').innerText(), '1');
      assert.equal(await page.locator('#status').innerText(), '执行完成');
      assert.match(await page.locator('#tape .current').getAttribute('aria-label'), /-1 号格：1/);
    });
    await check(`${label}: expanded code stays fixed while the blue cursor moves and loops back`, async () => {
      const native = '++[->+<]'; await page.locator('#source').fill(native);
      assert.equal(await page.locator('#instruction-code').innerText(), native);
      await page.locator('#instruction-code').evaluate(element => { window.__instructionText = element.firstChild; });
      assert.equal(await page.locator('#instruction-cursor').getAttribute('data-pc'), '0');
      for (let step = 0; step < 7; step++) await page.locator('#step').click();
      assert.equal(await page.locator('#instruction-cursor').getAttribute('data-pc'), '7');
      assert.equal(await page.locator('#instruction-cursor').innerText(), ']');
      const right = await page.locator('#instruction-cursor').boundingBox();
      await page.locator('#step').click();
      assert.equal(await page.locator('#instruction-cursor').getAttribute('data-pc'), '3');
      assert.ok((await page.locator('#instruction-cursor').boundingBox()).x < right.x);
      assert.equal(await page.locator('#instruction-code').innerText(), native);
      assert.equal(await page.locator('#instruction-code').evaluate(element => element.firstChild === window.__instructionText), true);
      await page.locator('#run').click(); await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#instruction-code').innerText(), native);
      assert.equal(await page.locator('#instruction-cursor').isVisible(), false);
    });
    await check(`${label}: long expanded code remains complete and scrolls only its own viewer`, async () => {
      const native = '+'.repeat(600) + '>'; await page.locator('#source').fill(native);
      const scrollBefore = await page.evaluate(() => scrollY);
      await page.evaluate(() => { for (let index = 0; index < 350; index++) document.getElementById('step').click(); });
      assert.equal(await page.locator('#instruction-code').innerText(), native);
      assert.equal(await page.locator('#instruction-cursor').getAttribute('data-pc'), '350');
      assert.ok(await page.locator('#instruction').evaluate(element => element.scrollTop > 0));
      const cursor = await page.locator('#instruction-cursor').boundingBox(), viewer = await page.locator('#instruction').boundingBox();
      assert.ok(cursor.y >= viewer.y && cursor.y + cursor.height <= viewer.y + viewer.height + 1);
      assert.equal(await page.evaluate(() => scrollY), scrollBefore);
      await page.screenshot({ path: out + `${label}-code-cursor${resourceMode ? '-resource' : ''}.png`, fullPage: true });
      await page.locator('#source').fill('<+'); await page.locator('#step').click(); await page.locator('#step').click();
    });
    await check(`${label}: left drag pans tape and reset preserves follow choice and manual position`, async () => {
      const tape = page.locator('#tape-viewport'); await tape.scrollIntoViewIfNeeded();
      const bounds = await tape.boundingBox(), before = await page.locator('#tape-range').innerText();
      const x = bounds.x + bounds.width * .35, y = bounds.y + bounds.height / 2;
      await page.mouse.move(x, y); await page.mouse.down({ button: 'left' });
      await page.mouse.move(x + bounds.width * .35, y, { steps: 8 }); await page.mouse.up({ button: 'left' });
      assert.equal(await page.locator('#follow').getAttribute('aria-pressed'), 'false');
      const manual = await page.locator('#tape-range').innerText(); assert.notEqual(manual, before);
      assert.equal(await page.locator('#pan-left').count(), 0); assert.equal(await page.locator('#pan-right').count(), 0);
      await page.locator('#reset').click();
      assert.equal(await page.locator('#follow').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('#tape-range').innerText(), manual);
      await page.locator('#source').fill('>>'); await page.locator('#step').click(); await page.locator('#step').click();
      assert.equal(await page.locator('#tape-range').innerText(), manual);
      await page.locator('#follow').click();
      assert.equal(await page.locator('#follow').getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('#tape .current').getAttribute('aria-label'), /2 号格/);
      await page.locator('#reset').click();
      assert.equal(await page.locator('#follow').getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('#tape .current').getAttribute('aria-label'), /0 号格/);
    });
    await check(`${label}: tape moves by pixels, preserves fractional pan and eases pointer following`, async () => {
      await page.locator('#source').fill('>');
      if (await page.locator('#follow').getAttribute('aria-pressed') === 'false') await page.locator('#follow').click();
      await page.waitForFunction(() => Math.abs(Number(document.getElementById('tape-viewport').dataset.viewCenter)) < .001);
      const tape = page.locator('#tape-viewport'); await tape.scrollIntoViewIfNeeded();
      const box = await tape.boundingBox(), cell = page.locator('#tape .cell[data-index="0"]');
      const before = (await cell.boundingBox()).x;
      await cell.evaluate(element => { window.__tapeCell = element; });
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + 4, y);
      assert.ok(Math.abs((await cell.boundingBox()).x - before - 4) < 1);
      await page.mouse.move(x + 9, y);
      assert.ok(Math.abs((await cell.boundingBox()).x - before - 9) < 1);
      assert.equal(await cell.evaluate(element => element === window.__tapeCell), true);
      await page.mouse.up();
      const fractional = Number(await tape.getAttribute('data-view-center'));
      assert.ok(Math.abs(fractional - Math.round(fractional)) > .01);
      await page.locator('#reset').click();
      assert.equal(Number(await tape.getAttribute('data-view-center')), fractional);
      assert.equal(await page.locator('#follow').getAttribute('aria-pressed'), 'false');
      await page.locator('#follow').click();
      await page.waitForFunction(() => Math.abs(Number(document.getElementById('tape-viewport').dataset.viewCenter)) < .001);
      await page.evaluate(() => {
        window.__smoothSamples = [];
        document.getElementById('step').addEventListener('click', () => {
          const capture = () => { window.__smoothSamples.push(Number(document.getElementById('tape-viewport').dataset.viewCenter)); if (window.__smoothSamples.length < 40) requestAnimationFrame(capture); };
          requestAnimationFrame(capture);
        }, { once: true });
      });
      await page.locator('#step').click();
      await page.waitForFunction(() => Math.abs(Number(document.getElementById('tape-viewport').dataset.viewCenter) - 1) < .001);
      const samples = await page.evaluate(() => window.__smoothSamples);
      assert.ok(samples.some(value => value > 0 && value < .95));
      for (let index = 1; index < samples.length; index++) assert.ok(samples[index] >= samples[index - 1]);
      assert.equal(await page.locator('#pointer').innerText(), '1');
    });
    await check(`${label}: run BF hello, render text and HEX`, async () => {
      await page.locator('#example').selectOption('0'); await setSpeed(page, 'turbo');
      await page.locator('#run').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#output').innerText(), 'Hello World!\n');
      await page.locator('#output-hex').click();
      assert.match(await page.locator('#output').innerText(), /^48 65 6C 6C 6F/);
      await page.locator('#output-text').click();
    });
    await check(`${label}: UTF-8 input is read as bytes`, async () => {
      await page.locator('#example').selectOption('1'); await page.locator('#input-policy').selectOption('preset'); await page.locator('#run').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#output').innerText(), '你好，纸带！\n');
    });
    await check(`${label}: decimal input uses numeric bytes and survives JSON round trip`, async () => {
      await page.locator('#source').fill(',.,.,.');
      await page.locator('#input-mode').selectOption('decimal');
      await page.locator('#input').fill('3 72\n255');
      assert.match(await page.locator('#input-format-hint').innerText(), /0～255/);
      await page.locator('#run').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      await page.locator('#output-hex').click();
      assert.equal(await page.locator('#output').innerText(), '03 48 FF');
      await page.reload();
      assert.equal(await page.locator('#input-mode').inputValue(), 'decimal');
      assert.equal(await page.locator('#input').inputValue(), '3 72\n255');
      await page.locator('#input').fill('256'); await page.locator('#step').click();
      assert.match(await page.locator('#message').innerText(), /0～255/);
      assert.equal(await page.locator('#steps').innerText(), '0 步');
      await page.locator('#input').fill('3 72\n255');
      await page.locator('#output-text').click();
    });
    await check(`${label}: decimal output displays zero and byte values without restarting the program`, async () => {
      await page.locator('#source').fill(',.,.,.'); await page.locator('#input').fill('0,72,255');
      await page.locator('#output-decimal').click();
      assert.equal(await page.locator('#output .placeholder').isVisible(), true);
      await page.locator('#run').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#output').innerText(), '0 72 255');
      assert.equal(await page.locator('#output-decimal').getAttribute('aria-pressed'), 'true');
      const steps = await page.locator('#steps').innerText();
      await page.locator('#output-hex').click(); assert.equal(await page.locator('#output').innerText(), '00 48 FF');
      await page.locator('#output-decimal').click(); assert.equal(await page.locator('#output').innerText(), '0 72 255');
      assert.equal(await page.locator('#steps').innerText(), steps);
      await page.locator('#output-text').click();
      assert.equal(await page.locator('#output-decimal').getAttribute('aria-pressed'), 'false');
    });
    await check(`${label}: BF requests input, reads comma-separated values, asks again and preserves cancel`, async () => {
      await page.locator('#source').fill(',.>,>,'); await page.locator('#input-policy').selectOption('ask');
      await page.locator('#run').click(); await page.locator('#input-dialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#input-dialog-title').innerText(), 'BF 等待输入');
      assert.equal(await page.locator('#steps').innerText(), '0 步');
      await page.locator('#input-request').fill('256'); await page.locator('#input-submit').click();
      assert.match(await page.locator('#input-error').innerText(), /0～255/);
      assert.equal(await page.locator('#steps').innerText(), '0 步');
      await page.locator('#input-request').fill('3,72'); await page.locator('#input-submit').click();
      await page.waitForFunction(() => document.getElementById('input-dialog').open && document.getElementById('pointer').textContent === '2');
      assert.equal(await page.locator('#steps').innerText(), '5 步');
      await page.screenshot({ path: out + `${label}-input${resourceMode ? '-resource' : ''}.png`, fullPage: true });
      await page.locator('#input-cancel').click();
      assert.equal(await page.locator('#status').innerText(), '等待输入');
      await page.locator('#run').click(); await page.locator('#input-dialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#steps').innerText(), '5 步');
      await page.locator('#input-request').fill('255'); await page.locator('#input-submit').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#cell-value').innerText(), '255');
      await page.locator('#output-hex').click(); assert.equal(await page.locator('#output').innerText(), '03');
      await page.locator('#output-text').click();
    });
    await check(`${label}: input in single-step mode executes only that instruction and EOF is explicit`, async () => {
      await page.locator('#source').fill(',+,'); await page.locator('#step').click();
      await page.locator('#input-dialog').waitFor({ state: 'visible' });
      await page.locator('#input-request').fill('5'); await page.locator('#input-submit').click();
      assert.equal(await page.locator('#steps').innerText(), '1 步'); assert.equal(await page.locator('#cell-value').innerText(), '5');
      assert.equal(await page.locator('#input-dialog').isVisible(), false);
      await page.locator('#step').click(); assert.equal(await page.locator('#cell-value').innerText(), '6');
      await page.locator('#step').click(); await page.locator('#input-dialog').waitFor({ state: 'visible' });
      await page.locator('#input-end').click(); assert.equal(await page.locator('#status').innerText(), '执行完成');
      assert.equal(await page.locator('#cell-value').innerText(), '0');
    });
    await check(`${label}: large BF values, input range and cell size persist across reload`, async () => {
      await page.locator('#cell-bits').selectOption('32'); await page.locator('#source').fill(',.>,.');
      assert.match(await page.locator('#cell-range').innerText(), /4294967295/);
      await page.locator('#run').click(); await page.locator('#input-dialog').waitFor({ state: 'visible' });
      assert.match(await page.locator('#input-dialog-hint').innerText(), /4294967295/);
      await page.locator('#input-request').fill('1000,4294967295'); await page.locator('#input-submit').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#cell-value').innerText(), '4294967295');
      assert.match(await page.locator('#tape .current').getAttribute('aria-label'), /4294967295/);
      await page.locator('#output-decimal').click(); assert.equal(await page.locator('#output').innerText(), '1000 4294967295');
      assert.equal(await page.locator('#io-count').innerText(), '2 个数值输出');
      const outputSteps = await page.locator('#steps').innerText();
      await page.locator('#output-hex').click(); assert.equal(await page.locator('#output').innerText(), 'E8 FF');
      await page.locator('#output-decimal').click(); assert.equal(await page.locator('#output').innerText(), '1000 4294967295');
      assert.equal(await page.locator('#steps').innerText(), outputSteps);
      await page.reload(); assert.equal(await page.locator('#cell-bits').inputValue(), '32');
      await page.locator('#cell-bits').selectOption('8'); await page.locator('#output-text').click();
      assert.match(await page.locator('#cell-range').innerText(), /0～255/);
    });
    await check(`${label}: signed BF accepts negatives, keeps wrapping and remembers the setting`, async () => {
      await page.locator('#signed-cells').check(); await page.locator('#source').fill('-');
      assert.match(await page.locator('#cell-range').innerText(), /-128～127/);
      await page.locator('#step').click(); assert.equal(await page.locator('#cell-value').innerText(), '-1');
      assert.match(await page.locator('#tape .current').getAttribute('aria-label'), /：-1/);
      await page.locator('#source').fill(',.>,.'); await page.locator('#run').click();
      await page.locator('#input-dialog').waitFor({ state: 'visible' });
      assert.match(await page.locator('#input-dialog-hint').innerText(), /-128～127/);
      await page.locator('#input-request').fill('128'); await page.locator('#input-submit').click();
      assert.match(await page.locator('#input-error').innerText(), /-128～127/);
      await page.locator('#input-request').fill('-1,-128'); await page.locator('#input-submit').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#cell-value').innerText(), '-128');
      await page.locator('#output-hex').click(); assert.equal(await page.locator('#output').innerText(), 'FF 80');
      await page.locator('#output-decimal').click(); assert.equal(await page.locator('#output').innerText(), '-1 -128');
      await page.reload(); assert.equal(await page.locator('#signed-cells').isChecked(), true);
      await page.locator('#cell-bits').selectOption('32'); await page.locator('#source').fill(',+.');
      await page.locator('#run').click(); await page.locator('#input-dialog').waitFor({ state: 'visible' });
      await page.locator('#input-request').fill('2147483647'); await page.locator('#input-submit').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#cell-value').innerText(), '-2147483648');
      await page.locator('#output-decimal').click(); assert.equal(await page.locator('#output').innerText(), '-2147483648');
      await page.screenshot({ path: out + `${label}-signed${resourceMode ? '-resource' : ''}.png`, fullPage: true });
      await page.locator('#signed-cells').uncheck(); await page.locator('#cell-bits').selectOption('8');
    });
    await check(`${label}: P double prime input extension asks and consumes queued numbers`, async () => {
      await page.locator('#lang-pdouble').click(); await page.locator('#example').selectOption('4'); await page.locator('#run').click();
      await page.locator('#input-dialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#input-dialog-title').innerText(), 'P′′ 等待输入');
      await page.locator('#input-request').fill('3,72'); await page.locator('#input-submit').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.match(await page.locator('#tape-result').innerText(), /\[-1\] = 72.*\[0\] = 4/);
      assert.equal(await page.locator('#pointer').innerText(), '-1');
    });
    await check(`${label}: P double prime supports a larger alphabet and numeric input`, async () => {
      await page.locator('#symbols').fill('65536'); await page.locator('#source').fill(',λ,');
      assert.match(await page.locator('#cell-range').innerText(), /0～65535/);
      await page.locator('#run').click(); await page.locator('#input-dialog').waitFor({ state: 'visible' });
      await page.locator('#input-request').fill('65535,1000'); await page.locator('#input-submit').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.match(await page.locator('#tape-result').innerText(), /\[-1\] = 1000/);
      assert.equal(await page.locator('#io-count').innerText(), '1 个非零格');
    });
    await check(`${label}: P double prime clears initial tape and has no fabricated IO`, async () => {
      await page.locator('#lang-pdouble').click(); await page.locator('#example').selectOption('1');
      await page.locator('#run').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#pointer').innerText(), '-4');
      assert.equal(await page.locator('#tape-result').innerText(), '全部为空白 0');
      assert.equal(await page.locator('#bf-io').isVisible(), false);
      assert.equal(await page.locator('#pdouble-result').isVisible(), true);
    });
    await check(`${label}: P double prime rejects crossing right boundary`, async () => {
      await page.locator('#source').fill('R'); await page.locator('#run').click();
      await page.waitForFunction(() => document.getElementById('status').dataset.state === 'error');
      assert.match(await page.locator('#message').innerText(), /右边界/);
      assert.equal(await page.locator('#pointer').innerText(), '0');
    });
    await check(`${label}: parser exposes exact error location`, async () => {
      await page.locator('#source').fill('λR\n+'); await page.locator('#step').click();
      assert.match(await page.locator('#message').innerText(), /不认识/);
      assert.equal(await page.locator('#source').evaluate(element => element.selectionStart), 3);
    });
    await check(`${label}: BF functions can be stepped, converted and replaced with equivalent original code`, async () => {
      await page.locator('#lang-bf').click(); await page.locator('#example').selectOption('4');
      assert.equal(await page.locator('#functions-enabled').isChecked(), true);
      await page.locator('#step').click();
      assert.match(await page.locator('#function-context').innerText(), /add3/);
      assert.equal(await page.locator('#cell-value').innerText(), '1');
      await page.locator('#run').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#pointer').innerText(), '1'); assert.equal(await page.locator('#cell-value').innerText(), '3');
      await page.locator('#convert-native').click();
      assert.equal(await page.locator('#native-source').inputValue(), '+++>+++');
      assert.equal(await page.locator('#instruction-code').innerText(), '+++>+++');
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.locator('#copy-native').click();
      await page.waitForFunction(() => document.getElementById('message').textContent === '已复制原始代码。');
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '+++>+++');
      await page.screenshot({ path: out + `${label}-functions${resourceMode ? '-resource' : ''}.png`, fullPage: true });
      await page.reload(); assert.equal(await page.locator('#functions-enabled').isChecked(), true);
      await page.locator('#convert-native').click(); await page.locator('#use-native').click();
      assert.equal(await page.locator('#source').inputValue(), '+++>+++');
      assert.equal(await page.locator('#functions-enabled').isChecked(), false);
      await page.locator('#run').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#cell-value').innerText(), '3');
    });
    await check(`${label}: P double prime functions convert to original four-symbol code and recursion is explained`, async () => {
      await page.locator('#lang-pdouble').click(); await page.locator('#example').selectOption('5');
      await page.locator('#run').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '执行完成');
      assert.equal(await page.locator('#cell-value').innerText(), '3');
      await page.locator('#convert-native').click(); assert.equal(await page.locator('#native-source').inputValue(), 'λRλRλR');
      await page.locator('#source').fill('fn read { , } @read'); await page.locator('#convert-native').click();
      assert.match(await page.locator('#message').innerText(), /原始 P′′ 没有/);
      assert.equal(await page.locator('#source').inputValue(), 'fn read { , } @read');
      await page.locator('#source').fill('fn a { @a } @a'); await page.locator('#step').click();
      assert.match(await page.locator('#message').innerText(), /递归/);
      await page.locator('#source').fill('λR'); await page.locator('#functions-enabled').uncheck();
    });
    await check(`${label}: paused loops can resume and editing resets them`, async () => {
      await page.locator('#lang-bf').click(); await page.locator('#source').fill('+[]');
      await page.locator('#input-policy').selectOption('preset');
      await page.locator('#input-mode').selectOption('decimal'); await page.locator('#input').fill('3 72\n255');
      await page.locator('#run').click(); await page.waitForFunction(() => document.getElementById('steps').textContent !== '0 步');
      await page.locator('#pause').click(); assert.equal(await page.locator('#status').innerText(), '已暂停');
      const before = await page.locator('#steps').innerText(); await page.waitForTimeout(100);
      assert.equal(await page.locator('#steps').innerText(), before);
      await page.locator('#run').click(); await page.waitForFunction(value => document.getElementById('steps').textContent !== value, before);
      await page.locator('#source').fill('+++'); assert.equal(await page.locator('#steps').innerText(), '0 步');
    });
    await check(`${label}: execution passes one million real steps and manual pause still responds`, async () => {
      await page.locator('#source').fill('+[]');
      await setSpeed(page, 'turbo'); await page.locator('#run').click();
      await page.waitForFunction(() => Number(document.getElementById('steps').textContent.replace(/[^\d]/g, '')) > 1000100, null, { timeout: 20000 });
      assert.equal(await page.locator('#status').innerText(), '运行中');
      assert.equal(await page.locator('#pause').isEnabled(), true);
      await page.locator('#pause').click(); assert.equal(await page.locator('#status').innerText(), '已暂停');
      const before = await page.locator('#steps').innerText(); await page.waitForTimeout(100);
      assert.equal(await page.locator('#steps').innerText(), before);
      await setSpeed(page, 'turbo');
      await page.locator('#source').fill('+++');
    });
    await check(`${label}: live turbo switching keeps progress, responds to pause and remembers selected speed`, async () => {
      await page.locator('#source').fill('+[]'); await setSpeed(page, '20');
      await page.locator('#run').click();
      await page.waitForFunction(() => Number(document.getElementById('steps').textContent.replace(/[^\d]/g, '')) >= 3);
      const before = Number((await page.locator('#steps').innerText()).replace(/[^\d]/g, ''));
      await setSpeed(page, 'turbo');
      await page.waitForFunction(previous => Number(document.getElementById('steps').textContent.replace(/[^\d]/g, '')) > previous + 100000, before);
      assert.equal(await page.locator('#status').innerText(), '运行中');
      const pauseAt = Date.now(); await page.locator('#pause').click();
      assert.ok(Date.now() - pauseAt < 1000); assert.equal(await page.locator('#status').innerText(), '已暂停');
      await setSpeed(page, '2'); await page.reload();
      assert.equal(await page.locator('#speed').inputValue(), '2');
      await setSpeed(page, 'turbo'); await page.locator('#source').fill('+++');
    });
    await check(`${label}: arbitrary typed speed persists, invalid input keeps running and huge rates stay responsive`, async () => {
      await page.locator('#source').fill('+[]'); await setSpeed(page, '1234');
      assert.equal(await page.locator('#speed').evaluate(element => element.tagName), 'INPUT');
      assert.equal(await page.locator('#speed-unlimited').isChecked(), false);
      await page.locator('#run').click();
      await page.waitForFunction(() => Number(document.getElementById('steps').textContent.replace(/[^\d]/g, '')) >= 10);
      await page.locator('#speed').fill('0'); await page.locator('#speed').press('Enter');
      assert.equal(await page.locator('#speed').getAttribute('aria-invalid'), 'true');
      assert.equal(await page.locator('#status').innerText(), '运行中');
      await page.locator('#pause').click();
      await setSpeed(page, '1234'); await page.reload();
      assert.equal(await page.locator('#speed').inputValue(), '1234');
      assert.equal(await page.locator('#speed-unlimited').isChecked(), false);
      await setSpeed(page, '1000000000'); await page.locator('#run').click();
      await page.waitForFunction(() => Number(document.getElementById('steps').textContent.replace(/[^\d]/g, '')) > 100000);
      const started = Date.now(); await page.locator('#pause').click(); assert.ok(Date.now() - started < 1000);
      assert.equal(await page.locator('#status').innerText(), '已暂停');
      await setSpeed(page, 'turbo'); await page.locator('#source').fill('+++');
    });
    await check(`${label}: JSON export/import round trip and rejected import is atomic`, async () => {
      let file;
      if (resourceMode) {
        await page.locator('#export').click();
        await page.waitForFunction(() => window.__saved.length > 0);
        const saved = await page.evaluate(() => window.__saved.at(-1));
        assert.equal(saved.name, 'tape-lab-bf.json');
        assert.equal(JSON.parse(saved.content).source, '+++');
        assert.equal(JSON.parse(saved.content).inputMode, 'decimal');
        file = { name: saved.name, mimeType: 'application/json', buffer: Buffer.from(saved.content) };
      } else {
        const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click();
        const download = await downloadPromise; file = await download.path();
      }
      await page.locator('#source').fill('---');
      await page.locator('#file').setInputFiles(file);
      await page.waitForFunction(() => document.getElementById('source').value === '+++');
      assert.equal(await page.locator('#input-mode').inputValue(), 'decimal');
      await page.locator('#file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"wrong"}') });
      await page.waitForFunction(() => document.getElementById('message').textContent.includes('导入失败'));
      assert.equal(await page.locator('#source').inputValue(), '+++');
    });
    await check(`${label}: isolated drafts survive switches and reload`, async () => {
      await page.evaluate(() => localStorage.setItem('other-experiment', 'keep'));
      await page.locator('#lang-pdouble').click(); await page.locator('#source').fill('λR');
      await page.locator('#lang-bf').click(); assert.equal(await page.locator('#source').inputValue(), '+++');
      await page.reload(); assert.equal(await page.locator('#source').inputValue(), '+++');
      assert.equal(await page.evaluate(() => localStorage.getItem('other-experiment')), 'keep');
    });
    await check(`${label}: ${resourceMode ? 'hall resources run offline without service worker' : 'service worker reopens experiment offline'}`, async () => {
      if (resourceMode) {
        assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
        await context.setOffline(true);
      } else {
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
        await context.setOffline(true); await page.reload();
      }
      assert.equal(await page.locator('#source').inputValue(), '+++');
      await page.locator('#step').click(); assert.equal(await page.locator('#cell-value').innerText(), '1');
      await context.setOffline(false);
    });
    await check(`${label}: TM executes custom rules one at a time and restores its own project`, async () => {
      await page.locator('#lang-tm').click();
      assert.equal(await page.locator('#tm-state').innerText(), 'q0');
      assert.equal(await page.locator('#cell-value').innerText(), '1');
      assert.match(await page.locator('#instruction-code').innerText(), /q0 1 -> q0 1 R/);
      await page.locator('#step').click();
      assert.equal(await page.locator('#pointer').innerText(), '1');
      assert.equal(await page.locator('#instruction-cursor').getAttribute('data-pc'), '0');
      await page.locator('#example').selectOption('2');
      await page.locator('#initial-settings').evaluate(details => { details.open = true; });
      await page.locator('#initial-tape').fill('1, 1 1');
      await page.locator('#step').click();
      assert.equal(await page.locator('#tm-state').innerText(), 'odd');
      assert.equal(await page.locator('#instruction-cursor').getAttribute('data-pc'), '1');
      await setSpeed(page, 'turbo');
      await page.locator('#run').click();
      await page.waitForFunction(() => document.getElementById('status').textContent === '拒绝');
      assert.equal(await page.locator('#tm-state').innerText(), 'reject');
      assert.equal(await page.locator('#steps').innerText(), '4 步');
      await page.reload();
      assert.equal(await page.locator('#lang-tm').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#initial-tape').inputValue(), '1, 1 1');
      assert.match(await page.locator('#source').inputValue(), /odd 0 -> reject/);
      await page.locator('#tm-start').fill('开始');
      await page.locator('#tm-halt').fill('完成');
      await page.locator('#tm-accept').fill('合格');
      await page.locator('#tm-reject').fill('不合格');
      await page.locator('#source').fill('开始 1 -> 合格 0 N');
      assert.equal(await page.locator('#tm-state').innerText(), '开始');
      await page.locator('#step').click();
      assert.equal(await page.locator('#tm-state').innerText(), '合格');
      assert.equal(await page.locator('#status').innerText(), '接受');
      assert.equal(await page.locator('#pointer').innerText(), '0');
      assert.equal(await page.locator('#cell-value').innerText(), '0');
      await page.reload();
      for (const [role, name] of Object.entries({ start: '开始', halt: '完成', accept: '合格', reject: '不合格' })) {
        assert.equal(await page.locator(`#tm-${role}`).inputValue(), name);
      }
      assert.equal(await page.locator('#tm-state').innerText(), '开始');
    });
    await check(`${label}: TM accepts □, optional outcomes, and keeps writing beyond the former limit`, async () => {
      assert.equal(await page.locator('#symbols').isVisible(), false);
      await page.locator('#tm-blank').fill('□');
      await page.locator('#tm-start').fill('开始.0');
      await page.locator('#tm-halt').fill('完成.0.0');
      await page.locator('#tm-accept').fill('');
      await page.locator('#tm-reject').fill('');
      await page.locator('#initial-settings').evaluate(details => { details.open = true; });
      await page.locator('#initial-tape').fill('');
      await page.locator('#source').fill('# 写入标记\n开始.0,□->完成.0.0，# N # 停机');
      assert.equal(await page.locator('#cell-value').innerText(), '□');
      assert.match(await page.locator('#tm-alphabet-count').innerText(), /2 个符号/);
      await page.locator('#step').click();
      assert.equal(await page.locator('#status').innerText(), '停机');
      assert.equal(await page.locator('#io-count').innerText(), '1 个非空白格');
      assert.equal(await page.locator('#tape-result').innerText(), '[0] = #');
      await page.reload();
      assert.equal(await page.locator('#tm-blank').inputValue(), '□');
      assert.equal(await page.locator('#tm-start').inputValue(), '开始.0');
      assert.equal(await page.locator('#tm-halt').inputValue(), '完成.0.0');
      assert.equal(await page.locator('#tm-accept').inputValue(), '');
      assert.equal(await page.locator('#tm-reject').inputValue(), '');
      assert.equal(await page.locator('#tape-result').innerText(), '全部为空白 □');
      await page.locator('#tm-halt').fill('');
      await page.locator('#source').fill('开始.0 □ -> 开始.0 A01 R');
      await setSpeed(page, 'turbo');
      await page.locator('#run').click();
      await page.waitForFunction(() => Number(document.getElementById('pointer').textContent) > 100000);
      await page.locator('#pause').click();
      assert.equal(await page.locator('#status').innerText(), '已暂停');
      assert.match(await page.locator('#tape-result').innerText(), /\[0\] = A01/);
      await page.locator('#tm-blank').fill('A B');
      assert.match(await page.locator('#instruction-help').innerText(), /空白符号/);
      await page.locator('#lang-bf').click();
      assert.equal(await page.locator('#tm-settings').isVisible(), false);
      assert.equal(await page.locator('#tm-blank').isVisible(), false);
      assert.equal(await page.locator('#source').inputValue(), '+++');
      await page.reload();
      await page.locator('#lang-tm').click();
      assert.equal(await page.locator('#tm-blank').inputValue(), '□');
      await page.locator('#lang-bf').click();
    });
    await check(`${label}: BF, P double prime, and TM share custom encodings`, async () => {
      await page.locator('#project-encoding > summary').click();
      for (const [field, value] of [['zero', '○'], ['one', '红蓝'], ['two', '🔴']]) {
        await page.locator(`#encoding-${field}`).fill(value);
      }
      const encoded = page.locator('#encoded-project');
      const modes = [
        { from: 'bf', to: 'pdouble', code: '+++', output: '3' },
        { from: 'pdouble', to: 'tm', code: 'λR', output: '1' },
        { from: 'tm', to: 'bf', code: 'q0,□->HALT,结束,N', output: '结束' }
      ];
      await page.locator('#initial-settings').evaluate(details => { details.open = true; });
      for (const { from, to, code, output } of modes) {
        await page.locator(`#lang-${from}`).click();
        await page.locator('#source').fill(code);
        await page.locator('#initial-tape').fill('');
        if (from === 'tm') {
          await page.locator('#tm-start').fill('q0');
          await page.locator('#tm-halt').fill('HALT');
          await page.locator('#tm-blank').fill('□');
        }
        await page.locator('#encode-project').click();
        const text = await encoded.inputValue();
        assert.match(text, /^(?:○|红蓝|🔴)(?: (?:○|红蓝|🔴))+$/u);

        await page.locator(`#lang-${to}`).click();
        const previous = await page.locator('#source').inputValue();
        await encoded.fill('未知符号');
        await page.locator('#decode-project').click();
        assert.equal(await page.locator('#encoding-status').getAttribute('data-error'), 'true');
        assert.equal(await page.locator('#source').inputValue(), previous);

        await encoded.fill(text);
        await page.locator('#decode-project').click();
        assert.equal(await page.locator(`#lang-${from}`).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('#source').inputValue(), code);
        assert.equal(await page.locator('#initial-tape').inputValue(), '');
        await setSpeed(page, 'turbo');
        await page.locator('#run').click();
        await page.waitForFunction(() => document.getElementById('status').dataset.state === 'done');
        assert.equal(await page.locator('#cell-value').innerText(), output);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('#project-encoding > summary').click();
      await page.locator('#lang-bf').click();
    });
    await page.locator('#example').selectOption('0');
    await page.screenshot({ path: out + `${label}${resourceMode ? '-resource' : ''}.png`, fullPage: true });
    await page.locator('#lang-pdouble').click(); await page.locator('#example').selectOption('1');
    await page.screenshot({ path: out + `${label}-pdouble${resourceMode ? '-resource' : ''}.png`, fullPage: true });
    await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log(`${checks} browser checks passed; no page errors or external requests.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
