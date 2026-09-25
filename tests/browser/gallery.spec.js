import { test, expect } from '@playwright/test';
import { createDevServer } from '../../scripts/serve.mjs';
let server;
test.beforeAll(async () => {
  server = createDevServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4176, '127.0.0.1', resolve); });
});
test.afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
test('galeria: imagens locais, teclado, controles, swipe e retorno de foco', async ({ page }) => {
  await page.goto('/galeria.html');
  const buttons = page.locator('.gallery-item button');
  await expect(buttons).toHaveCount(5);
  for (const img of await page.locator('.gallery-item img').all()) {
    await img.evaluate(i => { i.loading = 'eager'; });
    await expect.poll(() => img.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
  }
  await buttons.first().click();
  const modal = page.locator('dialog');
  await expect(modal).toBeVisible();
  await page.getByRole('button', {name: 'Próxima fotografia',exact:true}).click();
  await expect(page.locator('[data-gallery-count]')).toHaveText('2 / 5');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-gallery-count]')).toHaveText('1 / 5');
  await page.getByRole('button', {name: 'Fotografia anterior',exact:true}).click();
  await expect(page.locator('[data-gallery-count]')).toHaveText('5 / 5');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-gallery-count]')).toHaveText('1 / 5');
  await page.locator('[data-full-image]').dispatchEvent('touchstart', { touches: [{identifier:1,clientX:250,clientY:100}] });
  await page.locator('[data-full-image]').dispatchEvent('touchend', { changedTouches: [{identifier:1,clientX:100,clientY:105}] });
  await expect(page.locator('[data-gallery-count]')).toHaveText('2 / 5');
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
  await expect(buttons.first()).toBeFocused();
  await buttons.first().click();
  await page.getByRole('button',{name:'Fechar fotografia'}).click();
  await expect(modal).not.toBeVisible();
  await buttons.first().click();
  await page.mouse.click(2,2);
  await expect(modal).not.toBeVisible();
});
for (const width of [375,390,430,768,1440]) {
  test('galeria e lightbox sem overflow em '+width, async ({ page }, testInfo) => {
    await page.setViewportSize({width,height:900});
    await page.goto('/galeria.html');
    await expect(page.locator('.gallery-item')).toHaveCount(5);
    await page.evaluate(() => document.fonts.ready);
    for (const img of await page.locator('.gallery-item img').all()) {
      await img.evaluate(i => { i.loading = 'eager'; });
      await img.evaluate(i => i.decode());
    }
    await page.evaluate(() => scrollTo(0,0));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('gallery.png'),fullPage:true});
    await page.locator('.gallery-item button').first().click();
    await expect.poll(() => page.locator('dialog').evaluate(d => d.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-full-image]').evaluate(i => i.decode());
    await page.screenshot({path:testInfo.outputPath('lightbox.png')});
  });
}
test('home: teaser e menu mobile levam à galeria', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('.gallery-teaser img')).toHaveCount(3);
  await page.locator('.menu-toggle').click();
  await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded','true');
  await page.locator('#navigation').getByRole('link',{name:'Galeria',exact:true}).click();
  await expect(page).toHaveURL(/galeria.html$/);
  await page.goto('/');
  const strip = page.locator('.gallery-teaser-photos');
  await strip.evaluate(e => { e.scrollLeft = e.clientWidth; });
  await expect.poll(() => strip.evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
  await page.getByRole('link',{name:'VER GALERIA'}).click();
  await expect(page).toHaveURL(/galeria.html$/);
});

test('carrossel: circular, teclado, arrasto, swipe e movimento reduzido', async ({page}) => {
  await page.goto('/galeria.html');
  const counter = page.locator('[data-carousel-count]');
  await expect(counter).toHaveText('01 / 05');
  await page.locator('[data-carousel-previous]').click();
  await expect(counter).toHaveText('05 / 05');
  await page.locator('[data-carousel-next]').click();
  await expect(counter).toHaveText('01 / 05');
  await page.locator('.gallery-carousel').focus();
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('02 / 05');
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText('01 / 05');
  const stage = page.locator('.gallery-stage');
  const box = await stage.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + 100, { steps: 10 });
  await page.mouse.up();
  await expect(counter).toHaveText('02 / 05');
  await expect(page.locator('dialog')).not.toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await stage.scrollIntoViewIfNeeded();
  const mobileBox = await stage.boundingBox();
  const y = mobileBox.y + mobileBox.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:270,y}]});
  for (const x of [240,210,180,150,120]) await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  await cdp.detach();
  await expect(counter).toHaveText('03 / 05');
  await expect(page.locator('.gallery-item.is-active button')).toHaveAttribute('tabindex','0');
  await expect(page.locator('[data-active-caption]')).toBeHidden();
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.locator('.gallery-item').first().evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');
});
