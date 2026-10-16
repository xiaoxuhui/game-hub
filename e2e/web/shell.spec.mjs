import {test,expect} from '@playwright/test';
test('fixed catalog opens eight version-addressed links without script errors',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');await expect(page.getByRole('heading',{name:'游戏大厅',exact:true})).toBeVisible();
  await expect(page.locator('#games a')).toHaveCount(8);
  const hrefs=await page.locator('#games a').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
  for(const href of hrefs)expect(href).toMatch(/^\/hub\/games\/[a-z-]+\/1\/[a-f0-9]{64}\//);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#games a').first().focus();await expect(page.locator('#games a').first()).toBeFocused();
  expect(errors).toEqual([]);
});
test('catalog HTTP failure is visible and never presented as latest',async({page})=>{
  await page.route('**/catalog.json',route=>route.fulfill({status:503,body:'unavailable'}));
  await page.goto('./');await expect(page.getByRole('status')).toHaveText('目录暂不可用');
  await expect(page.locator('#games a')).toHaveCount(0);
});
