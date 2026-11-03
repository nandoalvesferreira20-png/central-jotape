import { test, expect } from '@playwright/test';
import { createDevServer } from '../../scripts/serve.mjs';
import { installNewsMock, login } from './news-fixture.js';

test.use({ timezoneId: 'Asia/Tokyo' });

let server;
test.beforeAll(async () => {
  server = createDevServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4176, '127.0.0.1', resolve); });
});
test.afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

const event = (number, overrides = {}) => ({
  id: '33333333-3333-4333-8333-' + String(number).padStart(12, '0'),
  title: 'Evento ' + number, event_date: '2026-11-28', event_time: '20:00:00',
  venue: 'Casa de shows', city: 'São Paulo', status: 'published', ...overrides,
});
async function home(page) {
  const loaded = page.waitForResponse(response => response.url().endsWith('/__cms_test') && response.request().postDataJSON()?.table === 'events');
  await page.goto('/');
  await loaded;
  await expect(page.locator('[data-agenda-events]')).not.toHaveAttribute('aria-busy', 'true');
}

test('Agenda existente cria, publica, edita, despublica e exclui; home acompanha ao recarregar', async ({ page, context }) => {
  await page.clock.install({ time: new Date('2026-11-03T15:00:00Z') });
  const state = await installNewsMock(context);
  await login(page);
  await page.goto('/admin/agenda.html');
  await expect(page.locator('#event-form fieldset')).toBeEnabled();
  await page.getByLabel('Título do evento *').fill('Encontro da Central');
  await page.getByLabel('Data *', { exact: true }).fill('2026-11-28');
  await page.getByLabel('Horário (São Paulo)').fill('20:00');
  await page.getByLabel('Cidade *').fill('São Paulo');
  await page.getByLabel('Local', { exact: true }).fill('Casa da Central');
  await page.getByLabel('Descrição', { exact: true }).fill('Apresentação confirmada.');
  await page.getByLabel('URL HTTPS dos ingressos').fill('https://tickets.example.test/central');
  await page.getByLabel('URL HTTPS da imagem').fill('https://test.supabase.co/storage/event.png');
  await page.getByRole('button', { name: 'Salvar evento', exact: true }).click();
  await expect(page.locator('[data-message]')).toHaveText('Evento salvo como rascunho.');
  expect(state.tables.events).toHaveLength(1);
  expect(state.tables.events[0].status).toBe('draft');
  const publicPage = await context.newPage();
  await publicPage.clock.install({ time: new Date('2026-11-03T15:00:00Z') });
  await home(publicPage);
  await expect(publicPage.locator('#agenda [data-event=pending]')).toBeVisible();
  await page.locator('[data-records]').getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('[data-message]')).toHaveText('Evento publicado.');
  await home(publicPage);
  await expect(publicPage.locator('#agenda .event h3')).toHaveText('Encontro da Central');
  await expect(publicPage.locator('#agenda .event-ticket')).toHaveAttribute('href', 'https://tickets.example.test/central');
  await expect(publicPage.locator('#agenda .event-ticket')).toHaveAttribute('target', '_blank');
  await expect(publicPage.locator('#agenda .event-ticket')).toHaveAttribute('rel', 'noopener noreferrer');
  await publicPage.locator('#agenda').scrollIntoViewIfNeeded();
  await expect(publicPage.locator('#agenda .event-image')).toBeVisible();
  await page.locator('[data-records]').getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.locator('#event_time')).toHaveValue('20:00');
  await page.locator('#title').fill('Encontro atualizado');
  await page.locator('#ticket_url').fill('');
  await page.getByRole('button', { name: 'Salvar evento', exact: true }).click();
  await expect(page.locator('[data-records] h2')).toHaveText('Encontro atualizado');
  expect(state.tables.events).toHaveLength(1);
  await expect(page.locator('[data-records]')).toContainText('28/11/2026 · 20:00 · Casa da Central · São Paulo · Publicado');
  await home(publicPage);
  await expect(publicPage.locator('#agenda .event h3')).toHaveText('Encontro atualizado');
  await expect(publicPage.locator('#agenda .event-ticket')).toHaveCount(0);
  await page.locator('[data-records]').getByRole('button', { name: 'Despublicar', exact: true }).click();
  await expect(page.locator('[data-message]')).toHaveText('Evento despublicado.');
  await home(publicPage);
  await expect(publicPage.locator('#agenda [data-event=pending]')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-records]').getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.locator('[data-records]')).toHaveText('Nenhum registro cadastrado.');
  expect(state.tables.events).toHaveLength(0);
});

test('apenas hoje e futuros publicados, ordem por data/horário, texto seguro e fallback em erro', async ({ page, context }) => {
  // 04/11 em UTC ainda é 03/11 em São Paulo; navegador em outro fuso.
  await context.addInitScript(() => localStorage.setItem('test-session', '1'));
  await page.clock.install({ time: new Date('2026-11-04T01:00:00Z') });
  const state = await installNewsMock(context, { events: [
    event(1), event(2, { event_date: '2026-11-02' }), event(3, { status: 'draft' }),
    event(4, { event_date: '2026-11-03', event_time: '22:00:00' }),
    event(5, { event_date: '2026-11-03', event_time: '00:15:00', ticket_url: 'javascript:alert(1)', title: '<img src=x onerror=alert(1)>' }),
  ] });
  await home(page);
  await expect(page.locator('#agenda .event h3')).toHaveText(['<img src=x onerror=alert(1)>', 'Evento 4', 'Evento 1']);
  await expect(page.locator('#agenda h3 img')).toHaveCount(0);
  await expect(page.locator('#agenda .event-ticket')).toHaveCount(0);
  await expect(page.locator('#agenda .event-date').first()).toHaveAttribute('datetime', '2026-11-03');
  await expect(page.locator('#agenda .event-details time').first()).toHaveText('00:15');
  await expect(page.locator('[data-agenda-empty-note]')).toBeHidden();
  expect(state.tables.events).toHaveLength(5);
  state.failRead = true;
  await home(page);
  await expect(page.locator('#agenda [data-event=pending]')).toBeVisible();
  await expect(page.locator('[data-agenda-empty-note]')).toHaveText('Novas datas serão divulgadas aqui após confirmação.');
  await expect(page.locator('h1')).toContainText('CENTRAL');
  state.failRead = false;
  state.tables.events = [];
  await home(page);
  await expect(page.locator('#agenda [data-event=pending]')).toBeVisible();
});

for (const width of [375, 390, 430, 768, 1440]) {
  test('Agenda legível em ' + width + 'px', async ({ page, context }, testInfo) => {
    await page.clock.install({ time: new Date('2026-11-03T15:00:00Z') });
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await installNewsMock(context, { events: [event(1, {
      title: 'Encontro da Central com Jotapê — apresentação confirmada',
      venue: 'LocalComNomeLongo'.repeat(8), ticket_url: 'https://tickets.example.test/central',
      image_url: 'https://test.supabase.co/storage/event.png',
    }), event(2, { event_date: '2026-12-10', event_time: null })] });
    await home(page);
    await expect(page.locator('#agenda .event')).toHaveCount(2);
    await page.locator('#agenda').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(() => page.locator('#agenda').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.locator('#agenda').screenshot({ path: testInfo.outputPath('agenda.png') });
    expect(errors).toEqual([]);
  });
}
