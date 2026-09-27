import { test, expect } from '@playwright/test';
import { createDevServer } from '../../scripts/serve.mjs';
import { installNewsMock } from './news-fixture.js';
let server;
test.beforeAll(async () => { server = createDevServer(); await new Promise(resolve => server.listen(4176, '127.0.0.1', resolve)); });
test.afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

test('configuração ausente (404) mantém fotos locais, lightbox e controles da home', async ({ page }) => {
  await page.route('**/config/supabase-config.js', route => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/galeria.html');
  await expect(page.locator('.gallery-item')).toHaveCount(5);
  await page.locator('.is-active img').evaluate(image => image.decode());
  await page.locator('.is-active button').click();
  await expect(page.locator('dialog')).toBeVisible();
  await page.locator('[data-full-image]').evaluate(image => image.decode());
  await page.keyboard.press('Escape');
  await page.goto('/');
  await expect(page.locator('.gallery-teaser img')).toHaveCount(3);
  await expect(page.locator('.gallery-teaser-controls')).toBeVisible();
});

for (const scenario of ['empty', 'draft', 'published', 'error', 'unconfigured']) {
  test('fonte correta na galeria e home: ' + scenario, async ({ page, context }) => {
    const gallery = ['draft', 'published'].includes(scenario) ? [{
      id: '11111111-1111-4111-8111-111111111111',
      image_path: 'gallery/11111111-1111-4111-8111-111111111111.png',
      publication_status: scenario, position: 0, created_at: '2026-09-27T00:00:00Z',
      caption: 'Foto publicada', image_credit: 'Central', alt_text: 'Retrato',
    }] : [];
    const state = await installNewsMock(context, { gallery });
    state.failRead = scenario === 'error';
    if (scenario === 'unconfigured') await page.route('**/config/supabase-config.js', route => route.fulfill({
      contentType: 'text/javascript', body: "export const SUPABASE_URL=''; export const SUPABASE_PUBLISHABLE_KEY='';",
    }));
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/galeria.html', '/']) {
      const queried = scenario === 'unconfigured' ? Promise.resolve() : page.waitForResponse(response => {
        if (!response.url().endsWith('/__cms_test')) return false;
        return response.request().postDataJSON()?.table === 'gallery_items';
      });
      await page.goto(path);
      await queried;
      await page.waitForLoadState('networkidle');
      const photos = page.locator(path === '/' ? '.gallery-teaser img' : '.gallery-item img');
      const published = scenario === 'published';
      await expect(photos).toHaveCount(published ? 1 : path === '/' ? 3 : 5);
      await expect(photos.first()).toHaveAttribute('src', published ? /storage\/v1\/object\/public\/central-media\/gallery\// : /^assets\/img\/galeria\//);
      await photos.first().evaluate(image => { image.loading = 'eager'; return image.decode(); });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (path !== '/') {
        await page.locator('.is-active button').click();
        await expect(page.locator('dialog')).toBeVisible();
        await page.locator('[data-full-image]').evaluate(image => image.decode());
        await page.keyboard.press('Escape');
        await expect(page.locator('.is-active button')).toBeFocused();
      } else await expect(page.locator('.gallery-teaser-controls')).toBeVisible();
    }
  });
}

test('arquivo local file:// mantém galeria e teaser sem depender de módulos ESM', async ({ page }) => {
  await page.goto(new URL('../../galeria.html', import.meta.url).href);
  await expect(page.locator('.gallery-item')).toHaveCount(5);
  await page.locator('.is-active img').evaluate(image => image.decode());
  await page.locator('.is-active button').click();
  await expect(page.locator('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto(new URL('../../index.html', import.meta.url).href);
  await expect(page.locator('.gallery-teaser img')).toHaveCount(3);
  await expect(page.locator('.gallery-teaser-controls')).toBeVisible();
});

test('integração lenta nunca deixa a galeria vazia nem bloqueia controles locais', async ({ page, context }) => {
  await installNewsMock(context);
  for (const path of ['/galeria.html', '/']) {
    let release;
    let handled;
    const pending = new Promise(resolve => { release = resolve; });
    const completed = new Promise(resolve => { handled = resolve; });
    await page.route('**/js/public/gallery-service.js', async route => {
      await pending;
      await route.continue();
      handled();
    });
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (path === '/') await expect(page.locator('.gallery-teaser-controls')).toBeVisible({ timeout: 1000 });
      else {
        await expect(page.locator('.gallery-item')).toHaveCount(5, { timeout: 1000 });
        await page.locator('[data-carousel-next]').click();
        await expect(page.locator('[data-carousel-count]')).toHaveText('02 / 05');
      }
    } finally { release(); await completed; await page.unroute('**/js/public/gallery-service.js'); }
  }
});
