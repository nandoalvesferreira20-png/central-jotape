import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../js/config-validation.js';
import { safeDestination, verifyAdmin, AccessError } from '../js/admin/auth.js';
import { newsPayload } from '../js/admin/noticias.js';
import { eventPayload } from '../js/admin/agenda.js';
import { trajectoryPayload, matchPayload } from '../js/admin/trajetoria.js';
import { validateImage, uploadImage, removeImage } from '../js/admin/storage.js';
import { httpsUrl, dateOnly, integer } from '../js/admin/validation.js';

const jwt = role => 'header.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature';
const publicKey = 'sb_publishable_01234567890123456789';
test('configuração permite só chaves públicas e origem segura', () => {
  for (const key of [jwt('anon'), publicKey]) assert.equal(validateConfig('https://example.supabase.co', key).url, 'https://example.supabase.co');
  for (const key of ['', jwt('service_role'), jwt('authenticated'), 'sb_secret_123456789', 'invalida']) assert.throws(() => validateConfig('https://example.supabase.co', key));
  for (const url of ['http://example.com', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com/?key=1']) assert.throws(() => validateConfig(url, publicKey));
  assert.equal(validateConfig('http://127.0.0.1:54321', publicKey).url, 'http://127.0.0.1:54321');
  assert.equal(validateConfig(' https://example.supabase.co ', ' ' + publicKey + ' ').key, publicKey);
  for (const invalid of ['sb_publishable_' + ' '.repeat(30), 'sb_publishable_bad<script>0123456789', null, 123]) assert.throws(() => validateConfig('https://example.supabase.co', invalid));
});
test('retorno pós-login não admite redirecionamento externo', () => {
  for (const value of ['https://evil.test', '//evil.test', '../../evil', '/admin/../index.html', 'login.html', 'javascript:alert(1)', 'noticias.html?next=https://evil.test']) {
    assert.ok(!safeDestination(value).includes('evil'));
  }
  assert.equal(safeDestination('agenda.html'), 'agenda.html');
});
function fakeAuth({ session = true, user = true, allowed = true, error = null } = {}) {
  return { auth: { getSession: async () => ({ data: { session: session ? {} : null }, error: null }),
    getUser: async () => ({ data: { user: user ? { id: 'admin' } : null }, error }) },
    rpc: async () => ({ data: allowed, error: null }) };
}
test('guard consulta o Auth e a autorização; sessão local sozinha não basta', async () => {
  assert.equal((await verifyAdmin(fakeAuth())).id, 'admin');
  for (const settings of [{ session: false }, { user: false }, { allowed: false }, { allowed: null }]) {
    await assert.rejects(verifyAdmin(fakeAuth(settings)), AccessError);
  }
  await assert.rejects(verifyAdmin(fakeAuth({ error: { status: 401 } })), { reason: 'session' });
});
test('URL, data e placares recusam valores ambíguos', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://test.com', 'https://user:pass@test.com']) assert.throws(() => httpsUrl(url));
  assert.equal(httpsUrl(''), null);
  assert.throws(() => dateOnly('2026-02-30'));
  assert.equal(integer('', 'Placar', 0, 999, true), null);
  assert.equal(integer('0', 'Placar', 0, 999, true), 0);
  assert.throws(() => integer('1.5', 'Placar'));
});
const news = () => new Map(Object.entries({ title: 'Título', slug: 'titulo', content: 'Texto', category: 'Música', author_name: 'Central', status: 'draft' }));
test('notícia começa privada, preserva texto e usa timestamp ao publicar', () => {
  const data = news();
  assert.equal(newsPayload(data).published_at, null);
  data.set('content', '<script>alert(1)</script>');
  assert.equal(newsPayload(data).content, '<script>alert(1)</script>'); // tratado sempre como texto, nunca HTML
  data.set('status', 'published');
  assert.equal(newsPayload(data, new Date('2026-01-01T00:00:00Z')).published_at, '2026-01-01T00:00:00.000Z');
  data.set('published_at', 'inválido'); assert.throws(() => newsPayload(data));
});
test('entidades validam estado de publicação e resultado', () => {
  const event = new Map(Object.entries({ title: 'Evento', event_date: '2026-09-21', city: 'São Paulo', status: 'draft', event_time: '25:00' }));
  assert.throws(() => eventPayload(event));
  event.set('event_time', '20:00'); assert.equal(eventPayload(event).status, 'draft');
  assert.equal(trajectoryPayload(new Map(Object.entries({ title: '2026', publication_status: 'draft' }))).year, 2026);
  const match = new Map(Object.entries({ competition: 'Liga', result: 'pending', position: '0' }));
  assert.equal(matchPayload(match, 'id').jotape_score, null);
});
test('upload recusa SVG, arquivo vazio, excesso e assinatura falsa; delete é restrito', async () => {
  for (const file of [{ type: 'image/svg+xml', size: 100 }, { type: 'image/png', size: 0 }, { type: 'image/jpeg', size: 6000000 }]) assert.throws(() => validateImage(file));
  await assert.rejects(uploadImage({}, new File(['html falso'], 'foto.png', { type: 'image/png' })));
  await assert.rejects(removeImage({}, '../../outro-arquivo'));
});

