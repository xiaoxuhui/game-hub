import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('old red-green reader can show base fields but cannot erase future fields; original stays exportable',async({page,request},testInfo)=>{
  const game=(await (await request.get('catalog.json')).json()).games.find(game=>game.id==='red-green-puzzle');await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');
  await page.evaluate(()=>localStorage.setItem('red-green-puzzle.parameters.v1','{"schemaVersion":1,"size":4,"future":{"opaque":"retain"}}'));await expect(page.locator('#game-hub-status')).toHaveText('已保存');
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await expect(page.locator('#sizeInput')).toHaveValue('4');await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode','readonly');
  const blocked=await page.evaluate(()=>{try{localStorage.setItem('red-green-puzzle.parameters.v1','{"schemaVersion":1,"size":6}');return false;}catch{return true;}});expect(blocked).toBe(true);
  await page.locator('#game-hub-restore').click();const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#hub-restore-export-original').click()]);const path=testInfo.outputPath('protected-original.json');await download.saveAs(path);const backup=JSON.parse(await readFile(path,'utf8'));
  expect(backup.pending).toBe(false);expect(JSON.parse(backup.entries.find(([key])=>key==='red-green-puzzle.parameters.v1')[1]).future).toEqual({opaque:'retain'});
});
