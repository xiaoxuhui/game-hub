import {test,expect} from '@playwright/test';
const getCatalog=async request=>(await request.get('catalog.json')).json();
const fulfill=(route,body)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
test('compact original-icon grid fits the viewport and details preserve focus',async({page},testInfo)=>{
  await page.goto('./');await expect(page.locator('#games a')).toHaveCount(8);
  const last=await page.locator('#games article').last().boundingBox();expect(last.y+last.height).toBeLessThanOrEqual(page.viewportSize().height);
  await expect.poll(()=>page.locator('#games img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
  const info=page.getByRole('button',{name:'康威生命游戏详情'});await info.click();await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#detail-source')).toHaveText(/^[a-f0-9]{40}$/);await page.keyboard.press('Escape');await expect(info).toBeFocused();
  await page.getByRole('button',{name:'解谜',exact:true}).click();await expect(page.locator('#games a')).toHaveCount(2);
  await page.getByRole('button',{name:'全部',exact:true}).click();await expect(page.locator('#games a')).toHaveCount(8);
  await page.screenshot({path:testInfo.outputPath('lobby.png')});
});
test('manual update distinguishes content, added games and shell; failure preserves success time and links',async({page,request})=>{
  const initial=await getCatalog(request),next=structuredClone(initial);let current=initial,fail=false;
  const game=next.games[0];game.contentCode++;game.digest='f'.repeat(64);game.entryUrl=game.entryUrl.replace('/1/','/2/').replace(initial.games[0].digest,game.digest);
  next.shellVersion='0.2.0';const extra=structuredClone(initial.games[0]);extra.id='new-game';extra.displayName='新增游戏';extra.storage={keys:[],prefixes:['new-game.']};extra.entryUrl=extra.entryUrl.replace('/conway/','/new-game/');next.games.push(extra);
  await page.route('**/catalog.json',route=>fail?route.fulfill({status:503,body:'unavailable'}):fulfill(route,current));
  await page.goto('./');await expect(page.locator('#games a')).toHaveCount(8);current=next;
  await page.locator('#check-update').click();await expect(page.locator('#update-notice')).toContainText('1 个游戏资源有更新');
  await expect(page.locator('#update-notice')).toContainText('新增 1 个游戏');await expect(page.locator('#reload-shell')).toBeVisible();await expect(page.locator('#games a')).toHaveCount(9);
  const last=await page.locator('#last-check').textContent();fail=true;await page.locator('#check-update').click();
  await expect(page.locator('#status')).toContainText('检查失败');await expect(page.locator('#last-check')).toHaveText(last);await expect(page.locator('#games a')).toHaveCount(9);
});
test('invalid check history cannot block startup and same-code mutation preserves current entries',async({page,request})=>{
  const initial=await getCatalog(request);let current=structuredClone(initial);
  const before={shellVersion:initial.shellVersion,games:initial.games.map(g=>({id:g.id,contentCode:g.contentCode,digest:g.digest,version:g.version,sourceRevision:g.sourceRevision}))};
  before.games[0].contentCode=0; // Invalid check history is ignored, never treated as a verified watermark.
  await page.addInitScript(state=>localStorage.setItem('game-hub-web.check./hub/',JSON.stringify({snapshot:state})),before);
  await page.route('**/catalog.json',route=>fulfill(route,current));await page.goto('./');await expect(page.locator('#games a')).toHaveCount(8);
  const old=await page.locator('#games a').first().getAttribute('href');current.games[0].digest='f'.repeat(64);current.games[0].entryUrl=current.games[0].entryUrl.replace(initial.games[0].digest,'f'.repeat(64));
  await page.locator('#check-update').click();await expect(page.locator('#status')).toContainText('同编号资源身份改变');expect(await page.locator('#games a').first().getAttribute('href')).toBe(old);
});
test('opening hall compares prior valid snapshot and announces new resource bytes',async({page,request})=>{
  const initial=await getCatalog(request),before={shellVersion:initial.shellVersion,games:initial.games.map(g=>({id:g.id,contentCode:g.contentCode,digest:g.digest,version:g.version,sourceRevision:g.sourceRevision}))};
  before.games[0].digest='a'.repeat(64);before.games[0].contentCode=initial.games[0].contentCode-1;
  // Use an artificial higher-number current candidate; no actual game is executed from this fixture.
  const current=structuredClone(initial);current.games[0].contentCode=2;current.games[0].entryUrl=current.games[0].entryUrl.replace('/1/','/2/');before.games[0].contentCode=1;
  await page.addInitScript(state=>localStorage.setItem('game-hub-web.check./hub/',JSON.stringify({snapshot:state,lastSuccess:1,unread:[]})),before);
  await page.route('**/catalog.json',route=>fulfill(route,current));await page.goto('./');await expect(page.locator('#update-notice')).toContainText('1 个游戏资源有更新');await expect(page.locator('.update-dot')).toHaveCount(1);
});
