import {test,expect} from '@playwright/test';
const games=[['conway','#stepButton'],['eml','#addButton'],['light','#btn-levels'],['turing','#generateRoute'],['abelian-sandpile','#drop-selected'],['lambda-diagram-game','#convert'],['red-green-puzzle','#generateBtn'],['mini-scratch','#runButton']];
for(const [id,control] of games)test(`${id} loads fixed resources, survives refresh and returns to hall`,async({page,request})=>{
  const response=await request.get('catalog.json');const catalog=await response.json(),game=catalog.games.find(g=>g.id===id);
  const errors=[],violations=[],requests=[],failures=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/Content Security Policy|violates|Refused to/.test(message.text()))violations.push(message.text());});
  page.on('request',r=>requests.push(r.url()));page.on('response',r=>{if(r.status()>=400)failures.push(r.status()+' '+r.url());});
  await page.goto(game.entryUrl);await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');
  await expect(page.locator(control)).toBeVisible();
  if(id==='red-green-puzzle'){await page.locator('#sizeInput').fill('4');await page.locator(control).click();await expect(page.locator('#summary')).toContainText('4');}
  else if(id==='abelian-sandpile')await page.locator(control).click();
  else if(id==='conway')await page.locator(control).click();
  else if(id==='lambda-diagram-game')await page.locator(control).click();
  else if(id==='mini-scratch'){await page.locator(control).click();await page.locator('#stopButton').click();}
  else if(id==='light'){await page.locator(control).click();await page.keyboard.press('Escape');}
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-hub-game-ready','true');
  const prefix=new URL('.',new URL(game.entryUrl,'http://127.0.0.1:18427')).href;
  for(const url of requests.filter(url=>/^http/.test(url)))expect(url.startsWith(prefix),url).toBe(true);
  expect(errors).toEqual([]);expect(violations).toEqual([]);expect(failures).toEqual([]);
  await page.locator('#game-hub-return').click();await expect(page.locator('#games a')).toHaveCount(8);
});
