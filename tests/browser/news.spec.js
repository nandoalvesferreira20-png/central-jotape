import { test, expect } from '@playwright/test';
import { createDevServer } from '../../scripts/serve.mjs';
import { installNewsMock, login, fillNews } from './news-fixture.js';
let server;
test.beforeAll(async () => {
  server = createDevServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4176, '127.0.0.1', resolve); });
});
test.afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

test('fluxo completo: login, rascunho, edição, publicação, home, slug duplicado e despublicação', async ({ page, context }) => {
  const state = await installNewsMock(context);
  await login(page);
  await page.goto('/admin/noticia-form.html');
  await fillNews(page);
  await expect(page.locator('#slug')).toHaveValue('vozes-da-central');
  await page.locator('#featured').check();
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('salva como rascunho');
  const editUrl = page.url();
  await page.reload();
  await expect(page.locator('#title')).toHaveValue('Vozes da Central');
  const publicPage = await context.newPage();
  await publicPage.goto('/noticias.html');
  await expect(publicPage.locator('[data-news-status]')).toContainText('Nenhuma notícia');
  await publicPage.goto('/noticia.html?slug=vozes-da-central');
  await expect(publicPage.locator('[data-news-status]')).toHaveText('Notícia não encontrada.');
  await page.locator('#title').fill('Vozes da Central — edição');
  await expect(page.locator('#slug')).toHaveValue('vozes-da-central');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Notícia publicada');
  expect(state.rows).toHaveLength(1);
  await publicPage.goto('/noticias.html');
  await expect(publicPage.locator('.news-card h2')).toHaveText('Vozes da Central — edição');
  await publicPage.locator('.news-card a').click();
  await expect(publicPage.locator('h1')).toHaveText('Vozes da Central — edição');
  await expect(publicPage.locator('.news-body p')).toHaveCount(2);
  await expect(publicPage.locator('.news-body img')).toHaveCount(0);
  await expect(publicPage.locator('.news-body')).toContainText('<img src=x onerror=alert(1)>');
  await publicPage.goto('/');
  await expect(publicPage.locator('#central .story-main h3')).toHaveText('Vozes da Central — edição');
  await expect(publicPage.locator('#central .story-main a')).toHaveAttribute('href', 'noticia.html?slug=vozes-da-central');
  await page.goto('/admin/noticia-form.html');
  await fillNews(page);
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('slug já está em uso');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page).toHaveURL(/admin\/noticias.html$/);
  await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Despublicar', exact: true }).click();
  await expect(page.locator('.badge')).toHaveText('Rascunho');
  await publicPage.goto('/noticia.html?slug=vozes-da-central');
  await expect(publicPage.locator('[data-news-status]')).toHaveText('Notícia não encontrada.');
  await publicPage.goto('/noticias.html');
  await expect(publicPage.locator('.news-card')).toHaveCount(0);
  await page.goto(editUrl);
  await expect(page.locator('#title')).toHaveValue('Vozes da Central — edição');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/login.html/);
  await page.goto(editUrl);
  await expect(page).toHaveURL(/login.html\?reason=session/);
});

test('upload validado, prévia, falha amigável, limpeza ao cancelar e capa persistida', async ({ page, context }) => {
  const state = await installNewsMock(context);
  await login(page);
  await page.goto('/admin/noticia-form.html');
  await fillNews(page);
  const file = { name: 'capa.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXsAAAAASUVORK5CYII=', 'base64') };
  await page.locator('[data-upload]').setInputFiles({ name: 'script.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.locator('[data-upload-status]')).toContainText('Envie uma imagem');
  await page.locator('[data-upload]').setInputFiles(file);
  await expect(page.locator('[data-cover-preview]')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Enviar imagem');
  state.failUpload = true;
  await page.getByRole('button', { name: 'Enviar imagem', exact: true }).click();
  await expect(page.locator('[data-upload-status]')).toContainText('Não foi possível enviar');
  state.failUpload = false;
  await page.getByRole('button', { name: 'Enviar imagem', exact: true }).click();
  await expect(page.locator('#cover_url')).toHaveValue(/news\/covers\/.+\.png$/);
  expect(state.files.size).toBe(1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page).toHaveURL(/admin\/noticias.html$/);
  expect(state.files.size).toBe(0);
  await page.goto('/admin/noticia-form.html');
  await fillNews(page);
  await page.locator('[data-upload]').setInputFiles(file);
  await page.getByRole('button', { name: 'Enviar imagem', exact: true }).click();
  await expect(page.locator('[data-upload-status]')).toContainText('Imagem enviada');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Notícia publicada');
  expect(state.files.size).toBe(1);
  expect(state.rows[0].cover_url).toMatch(/news\/covers\//);
});

const record = (index, status = 'published') => ({ id: '00000000-0000-4000-8000-' + String(index).padStart(12, '0'), title: 'Notícia ' + index, slug: 'noticia-' + index, content: 'Texto seguro.\n\nOutro parágrafo.', excerpt: 'Novidades da Central.', category: 'Música', author_name: 'Central', status, featured: true, published_at: '2026-01-' + String(index).padStart(2, '0') + 'T12:00:00Z', created_at: '2026-01-01T12:00:00Z' });
test('paginação, ordem, limite de destaques, agendamento, erro e recuperação', async ({ page, context }) => {
  const records = Array.from({ length: 14 }, (_, i) => record(i + 1));
  records.push({ ...record(15), published_at: '2099-01-01T12:00:00Z' });
  const state = await installNewsMock(context, { records });
  await page.goto('/noticias.html');
  await expect(page.locator('.news-card')).toHaveCount(12);
  await expect(page.locator('.news-card h2').first()).toHaveText('Notícia 14');
  state.failRead = true;
  await page.getByRole('button', { name: 'Carregar mais notícias' }).click();
  await expect(page.locator('[data-news-status]')).toContainText('Não foi possível');
  state.failRead = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('.news-card')).toHaveCount(14);
  await expect(page.locator('[data-more]')).toBeHidden();
  await page.goto('/');
  await expect(page.locator('#central .story-main h3')).toHaveText('Notícia 14');
  await expect(page.locator('#central .story-small h3')).toHaveText(['Notícia 13', 'Notícia 12']);
  await page.goto('/noticia.html?slug=noticia-15');
  await expect(page.locator('[data-news-status]')).toHaveText('Notícia não encontrada.');
});

for (const width of [375, 390, 430, 1440]) {
  test('notícias públicas e formulário em ' + width + 'px', async ({ page, context }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await installNewsMock(context, { records: [record(1)] });
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/noticias.html', '/noticia.html?slug=noticia-1']) {
      await page.goto(path);
      await expect(page.locator('[data-news-status]')).toBeEmpty();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath(path.includes('?') ? 'noticia.png' : 'noticias.png'), fullPage: true });
    }
    await login(page);
    await page.goto('/admin/noticia-form.html');
    await expect(page.locator('#news-form fieldset')).toBeEnabled();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('sem configuração e slug ausente: mensagens úteis sem quebra da landing', async ({ page }) => {
  await page.route('**/config/supabase-config.js', route => route.fulfill({ contentType: 'text/javascript', body: "export const SUPABASE_URL=''; export const SUPABASE_PUBLISHABLE_KEY='';" }));
  await page.goto('/noticias.html');
  await expect(page.locator('[data-news-status]')).toContainText('aguardando configuração');
  await page.goto('/noticia.html');
  await expect(page.locator('[data-news-status]')).toHaveText('Notícia não encontrada.');
});


test('lista publica, informa falha de operação e exige confirmação de exclusão', async ({ page, context }) => {
  const state = await installNewsMock(context, { records: [record(1, 'draft')] });
  await login(page);
  await page.goto('/admin/noticias.html');
  await expect(page.locator('.badge')).toHaveText('Rascunho');
  state.failWrite = true;
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Sem permissão');
  expect(state.rows[0].status).toBe('draft');
  state.failWrite = false;
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('.badge')).toHaveText('Publicada');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  expect(state.rows).toHaveLength(1);
  state.failWrite = true;
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Sem permissão');
  expect(state.rows).toHaveLength(1);
  state.failWrite = false;
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.locator('[data-records]')).toContainText('Nenhum registro');
  expect(state.rows).toHaveLength(0);
});

test('slug manual é preservado e data futura agenda a publicação', async ({ page, context }) => {
  await installNewsMock(context);
  await login(page);
  await page.goto('/admin/noticia-form.html');
  await fillNews(page);
  await page.locator('#slug').fill('slug-editorial');
  await page.locator('#title').fill('Título alterado');
  await expect(page.locator('#slug')).toHaveValue('slug-editorial');
  await page.locator('#published_at').fill('2099-01-01T12:00');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Notícia agendada');
  await page.goto('/admin/noticias.html');
  await expect(page.locator('.badge')).toHaveText('Agendada');
  await page.goto('/noticias.html');
  await expect(page.locator('[data-news-status]')).toContainText('Nenhuma notícia');
});


test('home preserva mobile com títulos dinâmicos longos', async ({ page, context }) => {
  await installNewsMock(context, { records: [1, 2, 3].map(index => ({ ...record(index), title: 'A'.repeat(240) })) });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  await expect(page.locator('#central')).toHaveAttribute('data-news-loaded', 'true');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('home filtra destaque, rascunho, data futura e data nula; limita e abre slug', async ({ page, context }) => {
  await installNewsMock(context, { records: [record(1), record(2), record(3), record(4),
    { ...record(5), featured: false }, record(6, 'draft'),
    { ...record(7), published_at: '2099-01-01T00:00:00Z' }, { ...record(8), published_at: null }] });
  await page.goto('/');
  await expect(page.locator('#central .story-main h3')).toHaveText('Notícia 4');
  await expect(page.locator('#central .story-small h3')).toHaveText(['Notícia 3', 'Notícia 2']);
  await expect(page.locator('#central .story-small img').first()).toBeVisible();
  const links = page.locator('#central .story-main a, #central .story-small a');
  await expect(links).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(links.nth(i)).toHaveAttribute('href', 'noticia.html?slug=noticia-' + (4 - i));
  await links.first().click();
  await expect(page.locator('h1')).toHaveText('Notícia 4');
});

test('home remove despublicação e preserva conteúdo original sem destaques ou com erro', async ({ page, context }) => {
  const state = await installNewsMock(context);
  async function load() {
    const response = page.waitForResponse(r => r.url().endsWith('/__cms_test'));
    await page.goto('/');
    await response;
  }
  await load();
  const titles = await page.locator('#central h3').allTextContents();
  const originalLinks = await page.locator('#central .story-main a, #central .story-small a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
  state.rows.push(record(1), record(2));
  await load();
  await expect(page.locator('#central .story-main h3')).toHaveText('Notícia 2');
  await expect(page.locator('#central .story-small').nth(1)).toBeHidden();
  state.rows[1].status = 'draft';
  await load();
  await expect(page.locator('#central .story-main h3')).toHaveText('Notícia 1');
  await expect(page.locator('#central .story-small').first()).toBeHidden();
  state.rows[0].featured = false;
  for (const failure of [false, true]) {
    state.failRead = failure;
    await load();
    expect(await page.locator('#central h3').allTextContents()).toEqual(titles);
    expect(await page.locator('#central .story-main a, #central .story-small a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')))).toEqual(originalLinks);
    await expect(page.locator('#central .story-small').first()).toBeVisible();
    await expect(page.locator('#central')).not.toHaveAttribute('data-news-loaded', 'true');
  }
});


test('crédito: criar, recarregar, editar, exibir com segurança e remover', async ({ page, context }) => {
  const state = await installNewsMock(context);
  await login(page);
  await page.goto('/admin/noticia-form.html');
  await fillNews(page);
  await page.locator('#cover_url').fill('https://test.supabase.co/storage/capa.png');
  await page.getByLabel('Crédito da imagem', { exact: true }).fill('Foto: João Silva');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Notícia publicada');
  expect(state.rows[0].image_credit).toBe('Foto: João Silva');
  await page.reload();
  await expect(page.locator('#image_credit')).toHaveValue('Foto: João Silva');
  await page.locator('#image_credit').fill('Crédito: <img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Notícia publicada');
  const publicPage = await context.newPage();
  await publicPage.goto('/noticia.html?slug=vozes-da-central');
  await expect(publicPage.locator('figcaption')).toHaveText('Crédito: <img src=x onerror=alert(1)>');
  await expect(publicPage.locator('figcaption img')).toHaveCount(0);
  const image = await publicPage.locator('.news-image img').boundingBox();
  const caption = await publicPage.locator('figcaption').boundingBox();
  expect(caption.y).toBeGreaterThanOrEqual(image.y + image.height);
  await page.locator('#image_credit').fill('');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Notícia publicada');
  expect(state.rows[0].image_credit).toBeNull();
  await publicPage.reload();
  await expect(publicPage.locator('.news-article > .news-cover')).toBeVisible();
  await expect(publicPage.locator('.news-image, figcaption')).toHaveCount(0);
  delete state.rows[0].image_credit;
  await publicPage.reload();
  await expect(publicPage.locator('.news-article > .news-cover')).toBeVisible();
  await expect(publicPage.locator('figcaption')).toHaveCount(0);
});

for (const width of [375, 390, 430, 768, 1024, 1440]) {
  test('novo EP e crédito em ' + width + 'px', async ({ page, context }, testInfo) => {
    await installNewsMock(context, { records: [{ ...record(1), featured: false, cover_url: 'https://test.supabase.co/storage/capa.png', image_credit: 'Foto: João Silva / Central' }] });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('#destaque img')).toBeHidden();
    await expect(page.locator('#featured-title')).toHaveText('ENTRE PRAÇAS, PAPÉIS E PASTÉIS DE NATA');
    await expect(page.locator('a[href="https://www.youtube.com/playlist?list=OLAK5uy_nS_Tahace_x4UOiPGky-GZSWduPlLXhjk"]')).toHaveCount(4);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#destaque').scrollIntoViewIfNeeded();
    await page.locator('#destaque').screenshot({ path: testInfo.outputPath('ep.png'), animations: 'disabled' });
    await page.goto('/noticia.html?slug=noticia-1');
    await expect(page.locator('figcaption')).toHaveText('Foto: João Silva / Central');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
