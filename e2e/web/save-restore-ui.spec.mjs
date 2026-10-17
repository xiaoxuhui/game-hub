import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function setup(page,request){const game=(await (await request.get('catalog.json')).json()).games.find(game=>game.id==='red-green-puzzle');await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');}
async function size(page,value){await page.locator('#sizeInput').fill(String(value));await page.locator('#generateBtn').click();await expect(page.locator('#game-hub-status')).toHaveText('已保存');}
async function backup(page,testInfo){const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#game-hub-backup').click()]);const path=testInfo.outputPath('original.json');await download.saveAs(path);return readFile(path);}
const file=buffer=>({name:'backup.json',mimeType:'application/json',buffer});
test('file preview cancel and confirmed restore preserve original backup; old UI stays frozen until reload',async({page,request},testInfo)=>{
  await setup(page,request);await size(page,4);const bytes=await backup(page,testInfo);await size(page,6);
  await expect(page.locator('#game-hub-restore')).toHaveCount(1);await page.locator('#game-hub-restore').click();await page.locator('#hub-restore-file').setInputFiles(file(bytes));
  await expect(page.locator('#hub-restore-confirm')).toBeEnabled();await expect(page.locator('#hub-restore-preview')).toContainText('SHA-256');await expect(page.locator('#hub-restore-preview')).toContainText('red-green-puzzle.parameters.v1');
  const bounds=await page.locator('#hub-restore-dialog').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(page.viewportSize().width);await page.screenshot({path:testInfo.outputPath('restore-preview.png')});
  await page.locator('#hub-restore-close').click();await expect(page.locator('#sizeInput')).toHaveValue('6');
  await page.locator('#game-hub-restore').click();await page.locator('#hub-restore-file').setInputFiles(file(bytes));await expect(page.locator('#hub-restore-confirm')).toBeEnabled();await page.locator('#hub-restore-confirm').click();
  await expect(page.locator('#hub-restore-message')).toContainText('恢复完成');await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode','readonly');await expect(page.locator('#sizeInput')).toHaveValue('6');
  await page.locator('#hub-restore-reload').click();await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await expect(page.locator('#sizeInput')).toHaveValue('4');
  await page.locator('#game-hub-restore').click();await expect(page.locator('#hub-restore-history option')).toHaveCount(2);await page.locator('#hub-restore-history').selectOption('0');await expect(page.locator('#hub-restore-confirm')).toBeEnabled();await expect(page.locator('#hub-restore-preview')).toContainText('原版本未记录');await page.locator('#hub-restore-confirm').click();await expect(page.locator('#hub-restore-message')).toContainText('恢复完成');await page.locator('#hub-restore-close').click();await expect(page.locator('#game-hub-restore')).toHaveText('重新打开');await page.locator('#game-hub-restore').click();await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await expect(page.locator('#sizeInput')).toHaveValue('6');
});
test('changing selected file to foreign, draft or lossy native data cancels confirmation without changing saves',async({page,request},testInfo)=>{
  await setup(page,request);await size(page,5);const bytes=await backup(page,testInfo),original=JSON.parse(bytes);await expect(page.locator('#game-hub-restore')).toHaveCount(1);await page.locator('#game-hub-restore').click();
  for(const patch of [{gameId:'conway'},{pending:true},{entries:[['red-green-puzzle.parameters.v1','{"schemaVersion":1,"size":4,"future":true}']]}]){
    await page.locator('#hub-restore-file').setInputFiles(file(bytes));await expect(page.locator('#hub-restore-confirm')).toBeEnabled();
    await page.locator('#hub-restore-file').setInputFiles(file(Buffer.from(JSON.stringify({...original,...patch}))));await expect(page.locator('#hub-restore-confirm')).toBeDisabled();await expect(page.locator('#hub-restore-message')).toContainText('无法恢复');
  }
  await page.locator('#hub-restore-close').click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await expect(page.locator('#sizeInput')).toHaveValue('5');
});
