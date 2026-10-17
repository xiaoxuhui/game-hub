import {test,expect} from '@playwright/test';
import {replaceCanonical,readCanonical} from './save-fixtures.mjs';
import {historicalSample,historicalReader} from '../../tests/fixtures/mini-history/read.mjs';
async function game(page,request,id){const game=(await (await request.get('catalog.json')).json()).games.find(game=>game.id===id);await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');return game;}
for(const version of [1,2,3,4])test(`mini-scratch v${version} legacy slot reads, upgrades and retains exact old slot and backup`,async({page,request})=>{
  const entry=await game(page,request,'mini-scratch'),key=`inspiration-blocks-v${version}`,backup=key+'-legacy-backup',raw=historicalSample(version);
  await page.goto('/hub/');await replaceCanonical(page,entry.id,[[key,raw],...(version%2?[[backup,'existing opaque backup']]:[])]);await page.goto(entry.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode','writable');await expect(page.locator('#projectName')).toHaveValue(JSON.parse(raw).name);
  await page.locator('#projectName').fill('升级后的作品');await expect(page.locator('#game-hub-status')).toHaveText('已保存');const saved=new Map((await readCanonical(page,entry.id)).entries);
  expect(saved.get(key)).toBe(raw);expect(saved.get(backup)).toBe(version%2?'existing opaque backup':raw);expect(JSON.parse(saved.get('inspiration-blocks-v5')).name).toBe('升级后的作品');
  expect(await historicalReader(version,[...saved])).toEqual(JSON.parse(raw));
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await expect(page.locator('#projectName')).toHaveValue('升级后的作品');
});
for(const key of ['lambda-lab-v1','lambda-lab-hub-legacy-v3'])test(`Lambda reads and upgrades ${key} while retaining original legacy bytes`,async({page,request})=>{
  const entry=await game(page,request,'lambda-diagram-game'),raw=JSON.stringify({version:1,draft:'(λz.z) (λw.w)',completed:[1],mode:'free',level:0},null,2);
  await page.goto('/hub/');await replaceCanonical(page,entry.id,[[key,raw]]);await page.goto(entry.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await expect(page.locator('#expression')).toHaveValue('(λz.z) (λw.w)');await expect(page.locator('#game-hub-status')).toHaveAttribute('data-save-mode','writable');
  await page.locator('#convert').click();await expect(page.locator('#game-hub-status')).toHaveText('已保存');const saved=new Map((await readCanonical(page,entry.id)).entries);expect(saved.get(key)).toBe(raw);expect(saved.has('lambda-lab-hub-v3')).toBe(true);
  if(key==='lambda-lab-v1')expect(JSON.parse(saved.get('lambda-lab-hub-upgrade-backup-v2')).legacy).toBe(raw);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');await expect(page.locator('#expression')).toHaveValue('(λz.z) (λw.w)');
});
