import { test, expect } from '@playwright/test';
import { createDevServer } from '../../scripts/serve.mjs';
let server;
test.beforeAll(async () => {
  server = createDevServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4176, '127.0.0.1', resolve); });
});
test.afterAll(async () => {
  if (!server) return;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

async function mockSupabase(page, { session = false, admin = true, rows = [] } = {}) {
  await page.route('**/config/supabase-config.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: "export const SUPABASE_URL='https://test.supabase.co'; export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_01234567890123456789';",
  }));
  await page.addInitScript(value => {
    if (sessionStorage.getItem('test-initialized')) return;
    sessionStorage.setItem('test-initialized', '1');
    if (value) localStorage.setItem('test-session', '1');
  }, session);
  await page.route('https://esm.sh/**', route => route.fulfill({
    contentType: 'text/javascript',
    body: `
      export function createClient() {
        let callback = () => {};
        const user = { id: '11111111-1111-4111-8111-111111111111', email: 'editor@example.test' };
        return {
          auth: {
            getSession: async () => ({ data: { session: localStorage.getItem('test-session') ? { user } : null }, error: null }),
            getUser: async () => ({ data: { user: localStorage.getItem('test-session') ? user : null }, error: null }),
            signInWithPassword: async ({password}) => {
              if (password !== 'senha-de-teste') return { error: { message: 'Invalid login' } };
              localStorage.setItem('test-session', '1'); return { error: null };
            },
            signOut: async () => { localStorage.removeItem('test-session'); callback('SIGNED_OUT', null); return { error: null }; },
            onAuthStateChange: fn => { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; }
          },
          rpc: async () => ({ data: ${JSON.stringify(admin)}, error: null }),
          from: name => {
            let payload; let one = false; let mutation = false;
            const source = name === 'news' ? ${JSON.stringify(rows)} : [];
            const chain = {
              select() { return this; }, order() { return this; }, eq() { return this; }, range() { return this; },
              insert(value) { payload = value; mutation = true; return this; },
              update(value) { payload = value; mutation = true; return this; },
              delete() { mutation = true; return this; },
              single() { one = true; return this; }, maybeSingle() { one = true; return this; },
              then(resolve) { return Promise.resolve({ data: mutation ? { id: user.id, ...payload } : one ? source[0] || null : source, count: source.length, error: null }).then(resolve); }
            };
            return chain;
          }
        };
      }
    `,
  }));
}
const routes = ['index.html', 'noticias.html', 'noticia-form.html', 'agenda.html', 'trajetoria.html'];
test('configuração ausente bloqueia painel e mantém landing pública', async ({ page }) => {
  await page.route('**/config/supabase-config.js', route => route.fulfill({ contentType: 'text/javascript', body: "export const SUPABASE_URL=''; export const SUPABASE_PUBLISHABLE_KEY='';" }));
  await page.goto('/admin/');
  await expect(page).toHaveURL(/login.html/);
  await expect(page.locator('[data-message]')).toContainText('aguardando configuração');
  await expect(page.getByRole('button', { name: 'Entrar no painel' })).toBeDisabled();
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('CENTRAL');
});
test('todas as rotas privadas redirecionam visitante sem sessão', async ({ page }) => {
  await mockSupabase(page);
  for (const path of routes) {
    await page.goto('/admin/' + path);
    await expect(page).toHaveURL(/login.html\?reason=session/);
  }
});
test('usuário autenticado comum não recebe painel', async ({ page }) => {
  await mockSupabase(page, { session: true, admin: false });
  await page.goto('/admin/');
  await expect(page).toHaveURL(/login.html\?reason=denied/);
  await expect(page.locator('[data-message]')).toContainText('não está autorizada');
});
test('login, erro amigável, proteção de retorno e logout', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/admin/login.html?next=https://evil.test');
  await page.getByLabel('E-mail', { exact: true }).fill('editor@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('errada');
  await page.getByRole('button', { name: 'Entrar no painel' }).click();
  await expect(page.locator('[data-message]')).toContainText('Não foi possível entrar');
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
  await page.getByRole('button', { name: 'Entrar no painel' }).click();
  await expect(page).toHaveURL(/\/admin\/index.html$/);
  await expect(page.locator('[data-admin-content]')).toBeVisible();
  await expect(page.locator('[data-auth-loading]')).toBeHidden();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/login.html/);
  await page.goto('/admin/agenda.html');
  await expect(page).toHaveURL(/login.html\?reason=session/);
});
test('renderização usa texto e não executa conteúdo vindo do banco', async ({ page }) => {
  await mockSupabase(page, { session: true, rows: [{ id: '11111111-1111-4111-8111-111111111111', title: '<img src=x onerror=alert(1)>', category: 'Música', status: 'draft' }] });
  await page.goto('/admin/noticias.html');
  await expect(page.locator('[data-records] h2')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('[data-records] img')).toHaveCount(0);
});
test('formulário salva rascunho e conserva ID para atualizações', async ({ page }) => {
  await mockSupabase(page, { session: true });
  await page.goto('/admin/noticia-form.html');
  await page.getByLabel('Título *', { exact: true }).fill('Notícia de teste');
  await page.getByLabel('Slug *', { exact: true }).fill('noticia-de-teste');
  await page.getByLabel('Conteúdo *', { exact: true }).fill('Conteúdo em texto simples.');
  await page.getByLabel('Categoria *', { exact: true }).fill('Música');
  await page.getByLabel('Nome do autor *', { exact: true }).fill('Central');
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.locator('[data-message]')).toContainText('Notícia salva');
  await expect(page).toHaveURL(/id=11111111/);
});
for (const width of [375, 390, 430, 1440]) {
  test('painel responsivo e sem erros de runtime em ' + width + 'px', async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await mockSupabase(page, { session: true });
    for (const path of routes) {
      await page.goto('/admin/' + path);
      await expect(page.locator('[data-admin-content]')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('[data-auth-loading]')).toBeHidden();
      if (path === 'index.html' && [390,1440].includes(width)) await page.screenshot({path: testInfo.outputPath('dashboard.png'), fullPage: true});
    }
    expect(errors).toEqual([]);
  });
}

