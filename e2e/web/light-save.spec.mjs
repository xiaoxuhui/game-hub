import {test,expect} from '@playwright/test';
test('light native workbench really persists a placed mirror and named snapshot through reload',async({page,request})=>{
  const game=(await (await request.get('catalog.json')).json()).games.find(g=>g.id==='light');
  await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');
  if(await page.locator('#overlay').isVisible())await page.keyboard.press('Escape');
  await page.locator('#btn-levels').click();await page.getByRole('button',{name:/折一下/}).click();
  await page.keyboard.press('1');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  await page.locator('#btn-snapshots').click();await page.getByRole('button',{name:'保存当前布局',exact:true}).click();
  await page.locator('#snapshot-name').fill('大厅真实持久化');await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.locator('#sheet-body')).toContainText('大厅真实持久化');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('light-game/save')||'null')?.snapshots?.some(s=>s.name==='大厅真实持久化'))).toBe(true);
  await expect(page.locator('#game-hub-status')).toHaveText('已保存');
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');
  if(await page.locator('#overlay').isVisible())await page.keyboard.press('Escape');
  await page.locator('#btn-levels').click();await page.getByRole('button',{name:/折一下/}).click();await page.locator('#btn-snapshots').click();
  await expect(page.locator('#sheet-body')).toContainText('大厅真实持久化');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('light-game/save')).boards.t02)).toContainEqual({type:'mirror',x:1,y:0,orient:0});
});
