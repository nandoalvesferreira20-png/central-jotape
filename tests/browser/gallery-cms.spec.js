import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createDevServer } from '../../scripts/serve.mjs';
import { installNewsMock, login } from './news-fixture.js';
let server;
test.beforeAll(async () => { server = createDevServer(); await new Promise(resolve => server.listen(4176, '127.0.0.1', resolve)); });
test.afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
const file = { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXsAAAAASUVORK5CYII=', 'base64') };
const photo = (overrides = {}) => ({ id: randomUUID(), image_path: 'gallery/' + randomUUID() + '.png', caption: 'Legenda', image_credit: 'Foto: Central', alt_text: 'Retrato de Jotapê', publication_status: 'published', position: 0, created_at: '2026-09-27T00:00:00Z', ...overrides });
const save = page => page.getByRole('button', { name: 'Salvar foto', exact: true }).click();

test('galeria CMS: upload, edição, substituição, publicação, ocultação e exclusão', async ({ page, context }) => {
  const state = await installNewsMock(context);
  await login(page);
  await page.getByRole('link', { name: 'Galeria', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Galeria');
  await page.locator('#image').setInputFiles(file);
  await page.getByLabel('Legenda', { exact: true }).fill('No palco');
  await page.getByLabel('Crédito da foto').fill('Foto: João Silva');
  await page.getByLabel('Alt text').fill('Jotapê com microfone');
  await page.getByLabel('Ordem de exibição').fill('7');
  // Dois submits no mesmo instante devem produzir somente um upload/registro.
  await page.locator('#gallery-form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await expect(page.locator('[data-message]')).toHaveText('Foto salva.');
  expect(state.tables.gallery_items).toHaveLength(1);
  const row = state.tables.gallery_items[0];
  expect(row).toMatchObject({ caption: 'No palco', image_credit: 'Foto: João Silva', alt_text: 'Jotapê com microfone', position: 7, publication_status: 'draft' });
  expect(state.files.has(row.image_path)).toBe(true);
  const publicPage = await context.newPage();
  await publicPage.goto('/galeria.html');
  await expect(publicPage.locator('.gallery-item')).toHaveCount(5);
  await expect(publicPage.locator('[data-active-caption]')).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByLabel('Crédito da foto')).toHaveValue('Foto: João Silva');
  const oldPath = row.image_path;
  await page.locator('#image').setInputFiles(file);
  await page.getByLabel('Legenda', { exact: true }).fill('Retrato editado');
  await page.getByLabel('Ordem de exibição').fill('-2');
  await page.getByLabel('Status', { exact: true }).selectOption('published');
  await save(page);
  await expect(page.locator('[data-message]')).toHaveText('Foto salva.');
  expect(state.files.has(oldPath)).toBe(false);
  expect(state.files.size).toBe(1);
  await publicPage.reload();
  await expect(publicPage.locator('.gallery-item')).toHaveCount(1);
  await expect(publicPage.locator('.gallery-item img')).toHaveAttribute('alt', 'Jotapê com microfone');
  await expect(publicPage.locator('[data-active-caption]')).toHaveText('Retrato editadoFoto: João Silva');
  await publicPage.locator('.gallery-item button').click();
  await expect(publicPage.locator('[data-gallery-caption]')).toHaveText('Retrato editadoFoto: João Silva');
  await publicPage.keyboard.press('Escape');
  await publicPage.goto('/');
  await expect(publicPage.locator('.gallery-teaser img')).toHaveCount(1);
  await page.getByLabel('Status', { exact: true }).selectOption('draft');
  await save(page);
  await expect(page.locator('.badge')).toHaveText('Rascunho');
  await publicPage.goto('/galeria.html');
  await expect(publicPage.locator('.gallery-item')).toHaveCount(5);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.locator('.record')).toHaveCount(1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.locator('[data-message]')).toHaveText('Foto excluída.');
  await expect(page.locator('.record')).toHaveCount(0);
  await expect(page.locator('#caption')).toHaveValue('');
  expect(state.tables.gallery_items).toHaveLength(0); expect(state.files.size).toBe(0);
});

test('falhas de upload/banco/limpeza preservam dados e mostram estado consistente', async ({ page, context }) => {
  const existing = photo();
  const state = await installNewsMock(context, { gallery: [existing] });
  state.files.set(existing.image_path, true);
  await login(page); await page.goto('/admin/galeria.html');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.locator('#image').setInputFiles(file);
  state.failUpload = true;
  await save(page); await expect(page.locator('[data-message]')).toHaveClass(/is-error/);
  expect(state.files.size).toBe(1); expect(state.tables.gallery_items[0].image_path).toBe(existing.image_path);
  state.failUpload = false; state.failWrite = true;
  await save(page); await expect(page.locator('[data-message]')).toHaveClass(/is-error/);
  await expect(page.getByRole('button', { name: 'Salvar foto', exact: true })).toBeEnabled();
  expect(state.files.size).toBe(1); expect(state.files.has(existing.image_path)).toBe(true);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.locator('.record')).toHaveCount(1);
  state.failWrite = false; state.failRemove = true;
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Foto excluída. Não foi possível remover');
  await expect(page.locator('.record')).toHaveCount(0);
});

test('publicação anônima ordenada, metadados opcionais e limite de três na home', async ({ page, context }) => {
  await installNewsMock(context, { gallery: [
    photo({ position: 4, caption: 'Última' }),
    photo({ position: -1, caption: 'Só legenda', image_credit: null, alt_text: null }),
    photo({ position: 0, caption: null, image_credit: 'Só crédito', created_at: '2026-09-26T00:00:00Z' }),
    photo({ position: 0, caption: null, image_credit: null }),
    photo({ position: -9, publication_status: 'draft', caption: 'Privada' }),
  ] });
  await login(page); // Mesmo com sessão editorial, a leitura pública é anônima.
  await page.goto('/galeria.html');
  await expect(page.locator('.gallery-item')).toHaveCount(4);
  await expect(page.locator('[data-active-caption]')).toHaveText('Só legenda');
  await expect(page.locator('.is-active img')).toHaveAttribute('alt', 'Foto de Jotapê');
  await page.locator('[data-carousel-next]').click();
  await expect(page.locator('[data-active-caption]')).toHaveText('Só crédito');
  await page.locator('.is-active button').click();
  await expect(page.locator('[data-gallery-caption]')).toHaveText('Só crédito');
  await page.locator('[data-next]').click();
  await expect(page.locator('[data-gallery-caption]')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.locator('[data-carousel-next]').click();
  await expect(page.locator('[data-active-caption]')).toBeHidden();
  await page.goto('/');
  await expect(page.locator('.gallery-teaser img')).toHaveCount(3);
  await expect(page.locator('.gallery-teaser img').first()).toHaveAttribute('alt', 'Foto de Jotapê');
  await page.locator('[data-teaser-next]').click();
  await expect.poll(() => page.locator('.gallery-teaser-photos').evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
});

for (const failure of [false, true]) {
  test('fallback público e home com ' + (failure ? 'falha de consulta' : 'banco vazio'), async ({ page, context }) => {
    const state = await installNewsMock(context); state.failRead = failure;
    await page.goto('/galeria.html');
    await expect(page.locator('.gallery-item')).toHaveCount(5);
    await expect(page.locator('.gallery-item img').first()).toHaveAttribute('src', /assets\/img\/galeria\//);
    await page.goto('/'); await expect(page.locator('.gallery-teaser img')).toHaveCount(3);
    await expect(page.locator('.gallery-teaser img').first()).toHaveAttribute('src', /assets\/img\/galeria\//);
  });
}

for (const width of [375, 390, 430, 1440]) {
  test('CMS e metadados sem sobreposição em ' + width, async ({ page, context }, info) => {
    const text = 'Legenda longa para verificar a leitura abaixo da fotografia. '.repeat(4);
    await installNewsMock(context, { gallery: [photo({ caption: text, image_credit: 'Foto: Central ' + 'x'.repeat(100) })] });
    const portrait = await readFile(new URL('../../assets/img/galeria/IMG_7308.JPG.jpeg', import.meta.url));
    await context.route('https://test.supabase.co/storage/**', route => route.fulfill({ contentType: 'image/jpeg', body: portrait }));
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/galeria.html');
    await expect(page.locator('[data-active-caption]')).toContainText(text.trim());
    const stage = await page.locator('.gallery-stage').boundingBox();
    const details = await page.locator('[data-active-caption]').boundingBox();
    expect(details.y).toBeGreaterThanOrEqual(stage.y + stage.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.is-active img').evaluate(image => image.decode());
    await page.screenshot({ path: info.outputPath('gallery-cms.png'), fullPage: true });
    await page.locator('.is-active button').click();
    await expect(page.locator('[data-gallery-caption]')).toBeVisible();
    const image = await page.locator('[data-full-image]').boundingBox();
    const caption = await page.locator('[data-gallery-caption]').boundingBox();
    expect(caption.y).toBeGreaterThanOrEqual(image.y + image.height);
    expect(await page.locator('dialog').evaluate(e => e.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-full-image]').evaluate(image => image.decode());
    await page.screenshot({ path: info.outputPath('lightbox-cms.png') });
    await page.keyboard.press('Escape');
    await login(page); await page.goto('/admin/galeria.html');
    await expect(page.locator('.record')).toHaveCount(1);
    await page.locator('.gallery-admin-thumb').evaluate(image => image.decode());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('admin-gallery.png'), fullPage: true });
  });
}
