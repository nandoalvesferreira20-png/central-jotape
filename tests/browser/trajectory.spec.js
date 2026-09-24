import { test, expect } from '@playwright/test';
import { createDevServer } from '../../scripts/serve.mjs';
import { installNewsMock, login } from './news-fixture.js';
let server;
test.beforeAll(async () => {
  server = createDevServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4176, '127.0.0.1', resolve); });
});
test.afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
const trajectory = { id: '11111111-1111-4111-8111-111111111111', year: 2026, title: 'Rumo ao Nacional', subtitle: 'Uma caminhada construída batalha por batalha.', current_stage: 'Regional', current_status: 'Classificado', next_stage: 'Nacional', publication_status: 'published' };
const battles = ['CZP', 'Rafael Z.O', 'Youngui', 'Bask'].map((opponent, i) => ({ id: '22222222-2222-4222-8222-' + String(i).padStart(12, '0'), trajectory_id: trajectory.id, competition: 'Seletiva da Norte', opponent, jotape_score: 2, opponent_score: i === 1 ? 0 : 1, result: 'win', position: i + 1 }));

test('trajetória pública respeita publicação, ordem, zero no placar e despublicação', async ({ page, context }) => {
  const state = await installNewsMock(context, { trajectories: [{ ...trajectory, publication_status: 'draft' }], matches: [...battles].reverse() });
  await page.goto('/trajetoria-2026.html');
  await expect(page.locator('[data-trajectory-status]')).toHaveText('Trajetória ainda não publicada.');
  await expect(page.locator('.journey-match')).toHaveCount(0);
  state.tables.trajectory[0].publication_status = 'published';
  await page.reload();
  await expect(page.locator('h1')).toHaveText('RUMO AO NACIONAL');
  await expect(page.locator('.match-name:last-child')).toHaveText(['CZP', 'Rafael Z.O', 'Youngui', 'Bask']);
  await expect(page.locator('.score-value')).toHaveText(['2 × 1', '2 × 0', '2 × 1', '2 × 1']);
  await expect(page.locator('.journey-result h2')).toHaveText('CAMPEÃO');
  await expect(page.locator('.journey-route h3')).toHaveText(['Seletiva da Norte', 'Regional', 'Estadual', 'Nacional']);
  await expect(page.locator('[aria-current=step] h3')).toHaveText('Regional');
  await expect(page.locator('.journey-route li').nth(2)).toContainText('Próxima meta');
  await expect(page.locator('.journey-photo')).toHaveClass(/is-local-photo/);
  await expect.poll(() => page.locator('.journey-hero-image').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.journey-route li').last()).toContainText('Objetivo final');
  state.tables.trajectory[0].publication_status = 'draft';
  await page.reload();
  await expect(page.locator('[data-trajectory-status]')).toHaveText('Trajetória ainda não publicada.');
  await expect(page.locator('.journey-match')).toHaveCount(0);
});

test('admin edita trajetória, cria, edita, reordena e exclui batalha', async ({ page, context }) => {
  const state = await installNewsMock(context, { trajectories: [trajectory], matches: battles });
  await login(page);
  await page.goto('/admin/trajetoria.html');
  await expect(page.locator('#title')).toHaveValue('Rumo ao Nacional');
  await page.locator('#subtitle').fill('Texto editorial atualizado');
  await page.getByRole('button', { name: 'Salvar trajetória', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Trajetória publicada');
  expect(state.tables.trajectory[0].subtitle).toBe('Texto editorial atualizado');
  await page.locator('#competition').fill('Competição de teste');
  await page.locator('#opponent').fill('Adversário de teste');
  await page.locator('#jotape_score').fill('0');
  await page.locator('#opponent_score').fill('0');
  await page.locator('#position').fill('8');
  await page.getByRole('button', { name: 'Salvar batalha', exact: true }).click();
  await expect(page.locator('[data-matches] .record')).toHaveCount(5);
  await page.locator('[data-matches] .record').last().getByRole('button', { name: 'Editar', exact: true }).click();
  await page.locator('#opponent').fill('Nome editado');
  await page.locator('#position').fill('0');
  await page.getByRole('button', { name: 'Salvar batalha', exact: true }).click();
  await expect(page.locator('[data-matches] .record').first()).toContainText('Nome editado');
  const publicPage = await context.newPage();
  await publicPage.goto('/trajetoria-2026.html');
  await expect(publicPage.locator('.match-name:last-child').first()).toHaveText('Nome editado');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-matches] .record').first().getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.locator('[data-matches] .record')).toHaveCount(4);
  await page.locator('#publication_status').selectOption('draft');
  await page.getByRole('button', { name: 'Salvar trajetória', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('rascunho');
  await publicPage.reload();
  await expect(publicPage.locator('[data-trajectory-status]')).toHaveText('Trajetória ainda não publicada.');
});

test('estados vazio e erro, texto seguro e teaser da home', async ({ page, context }) => {
  const state = await installNewsMock(context, { trajectories: [{ ...trajectory, title: '<img src=x onerror=alert(1)>' }] });
  await page.goto('/trajetoria-2026.html');
  await expect(page.locator('h1')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('h1 img')).toHaveCount(0);
  await expect(page.locator('.journey-empty')).toHaveText('Nenhuma batalha cadastrada.');
  await expect(page.locator('.journey-result')).toHaveCount(0);
  state.failRead = true;
  await page.reload();
  await expect(page.locator('[data-trajectory-status]')).toContainText('Erro ao carregar trajetória');
  state.failRead = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('h1')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'ACOMPANHAR TRAJETÓRIA' })).toHaveAttribute('href', 'trajetoria-2026.html');
});

for (const width of [375, 390, 430, 768, 1440]) {
  test('trajetória legível e sem overflow em ' + width + 'px', async ({ page, context }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await installNewsMock(context, { trajectories: [trajectory], matches: battles });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/trajetoria-2026.html');
    await expect(page.locator('.journey-match')).toHaveCount(4);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('trajectory.png'), fullPage: true });
    await page.evaluate(() => document.querySelector('.match-name:last-child').textContent = 'AdversárioComNomeMuitoLongo'.repeat(8));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}


test('foto do CMS tem prioridade; falha retorna à foto real local sem afetar publicação', async ({ page, context }) => {
  const state = await installNewsMock(context, { trajectories: [{ ...trajectory, hero_image_url: 'https://test.supabase.co/storage/hero.png', next_stage: 'Estadual' }], matches: battles });
  await page.goto('/trajetoria-2026.html');
  await expect(page.locator('.journey-hero-image')).toHaveAttribute('src', 'https://test.supabase.co/storage/hero.png');
  await expect(page.locator('.journey-photo')).not.toHaveClass(/is-local-photo/);
  await expect(page.locator('.journey-route li').nth(2)).toContainText('Próxima meta');
  state.tables.trajectory[0].hero_image_url = 'https://unavailable.example.test/hero.jpg';
  await context.route('https://unavailable.example.test/**', route => route.abort());
  await page.reload();
  await expect(page.locator('.journey-photo')).toHaveClass(/is-local-photo/);
  await expect(page.locator('.journey-hero-image')).toHaveAttribute('src', /assets\/img\/jotape-hero.jpg$/);
  state.tables.trajectory[0].current_stage = 'Estadual';
  state.tables.trajectory[0].current_status = 'Etapa atual de teste';
  state.tables.trajectory[0].next_stage = 'Nacional';
  await page.reload();
  await expect(page.locator('[aria-current=step] h3')).toHaveText('Estadual');
  await expect(page.locator('.journey-route li').last()).toContainText('Objetivo final');
});
