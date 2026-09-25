import { test, expect } from '@playwright/test';
import { createDevServer } from '../../scripts/serve.mjs';
import { installNewsMock } from './news-fixture.js';
let server;
test.beforeAll(async()=>{server=createDevServer();await new Promise(r=>server.listen(4176,'127.0.0.1',r));});
test.afterAll(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
for(const width of [375,390,430,768,1024,1440]){
 test('faixa editorial e popover contidos em '+width,async({page,context},info)=>{
  await installNewsMock(context);
  await page.setViewportSize({width,height:900});
  await page.goto('/');
  const section=page.locator('.artist-facts');
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator('.artist-fact')).toHaveCount(4);
  await expect(section.locator('.fact-value')).toHaveText(['3x','847,3 MIL','1,27 MI','2026']);
  await expect(section).not.toContainText(/Visualizações|Streams|Shows|aguardando/);
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('#titles-trigger').focus();
  await expect(page.locator('#titles-trigger')).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#titles-popover li')).toHaveCount(9);
  await expect(page.locator('.titles-mvp p')).toHaveText(['MVP — BDA 7 Anos','MVP — BDA 10 Anos']);
  const box=await page.locator('#titles-popover').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
  expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(900);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('stats.png'), animations:'disabled'});
  await page.keyboard.press('Escape');
  await expect(page.locator('#titles-popover')).toBeHidden();
  await expect(page.locator('#titles-trigger')).toBeFocused();
  await expect(page.locator('#titles-trigger')).toHaveAttribute('aria-expanded','false');
 });
}
test('títulos: mouse, foco, saída e clique fora',async({page,context})=>{
 await installNewsMock(context);await page.goto('/');
 const trigger=page.locator('#titles-trigger'),panel=page.locator('#titles-popover');
 await trigger.hover();await expect(panel).toBeVisible();
 await panel.hover();await expect(panel).toBeVisible();
 await page.locator('.artist-facts > h2').hover();await expect(panel).toBeHidden();
 await trigger.focus();await expect(panel).toBeVisible();
 await page.locator('.artist-facts > h2').click();await expect(panel).toBeHidden();
 await trigger.focus();await expect(panel).toBeVisible();
 await page.keyboard.press('Tab');
 await expect(page.getByRole('button',{name:'Fechar títulos'})).toBeFocused();
 await page.keyboard.press('Enter');await expect(panel).toBeHidden();
 await page.keyboard.press('Enter');await expect(panel).toBeVisible();
 await page.keyboard.press('Escape');await expect(panel).toBeHidden();
});
test('títulos: toque abre, segundo toque fecha e toque fora fecha',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await installNewsMock(context);const page=await context.newPage();
 await page.goto('http://127.0.0.1:4176/');
 const trigger=page.locator('#titles-trigger'),panel=page.locator('#titles-popover');
 await trigger.tap();await expect(panel).toBeVisible();
 await trigger.tap();await expect(panel).toBeHidden();
 await trigger.tap();await expect(panel).toBeVisible();
 await page.locator('.artist-facts > h2').tap();await expect(panel).toBeHidden();
 await context.close();
});
