import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('estrutura da landing preservada com integrações e sistema visual autorizado', async () => {
  const expected = {
    'index.html': '750247e443760148cf4289030a9768b37a4858aaa5f3eda4b8668fde05851516',
    'css/style.css': 'ce375d966ed699d4d5677ffc63df5d44327347b383a51001f3fe1b4ec4cb5a70',
    'js/main.js': 'e7d333f31bbf69d3a8924952bb0c59353cddd43dbbfc52cdf937eeeb7c22d7bf',
  };
  for (const [file, hash] of Object.entries(expected)) {
    let source = await readFile(new URL('../' + file, import.meta.url));
    if (file === 'index.html') source = Buffer.from(source.toString().replace(/    <link rel="stylesheet" href="css\/galeria.css">\r?\n/, '').replace(/        <!-- gallery-nav:start -->.*<!-- gallery-nav:end -->\r?\n/, '').replace(/      <!-- gallery-teaser:start -->[\s\S]*?      <!-- gallery-teaser:end -->\r?\n/, '').replace(/    <link rel="stylesheet" href="css\/editorial-system.css">\r?\n/, '').replace(/      <!-- trajectory-teaser:start -->[\s\S]*?      <!-- trajectory-teaser:end -->\n/, '').replace(/    <link rel="stylesheet" href="css\/home-news.css">\r?\n/, '').replace(/    <script type="module" src="js\/public\/home-news.js"><\/script>\r?\n/, ''));
    const actual = createHash('sha256').update(source).digest('hex');
    assert.equal(actual, hash, file + ' alterado');
  }
});
test('páginas administrativas não contêm lógica inline nem importam main.js', async () => {
  for (const file of await readdir(new URL('../admin/', import.meta.url))) {
    const html = await readFile(new URL('../admin/' + file, import.meta.url), 'utf8');
    assert.ok(!/\son\w+=|<style\b|\sstyle=/i.test(html));
    assert.ok(!html.includes('js/main.js'));
    assert.ok(/<script type="module" src="[^"]+"><\/script>/.test(html));
    if (!['login.html', 'reset-password.html'].includes(file)) assert.ok(/data-admin-content hidden/.test(html));
    assert.ok(html.includes('noindex, nofollow'));
  }
});

test('entrega oficial: metadados públicos e exemplos sem credenciais', async () => {
  const pages = ['index.html', 'noticias.html', 'noticia.html', 'trajetoria-2026.html', 'galeria.html'];
  for (const file of pages) {
    const html = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    const visible = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');
    assert.ok(!/\bdemo\b|demonstra(?:ção|tiv[oa])|protótipo|sem vínculo oficial/i.test(visible), file);
    assert.match(html, /name="robots" content="index, follow"/);
    assert.match(html, /property="og:image" content="https:\/\/central-jotape\.vercel\.app\/assets\/img\/central-logo\.jpg"/);
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
    assert.match(html, /Desenvolvido pela/);
    if (file !== 'noticia.html') assert.match(html, /rel="canonical" href="https:\/\/central-jotape\.vercel\.app\//);
  }
  const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(example, /^SUPABASE_URL=$/m);
  assert.match(example, /^SUPABASE_PUBLISHABLE_KEY=$/m);
});
