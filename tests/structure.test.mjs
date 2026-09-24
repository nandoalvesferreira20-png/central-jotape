import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('landing aprovada permanece intacta exceto pelo módulo de notícias', async () => {
  const expected = {
    'index.html': '788332f7c58dce2fded39db29176b758de3e6bf6b9b5aa05636b063c8b4fc12a',
    'css/style.css': 'ce375d966ed699d4d5677ffc63df5d44327347b383a51001f3fe1b4ec4cb5a70',
    'js/main.js': 'e7d333f31bbf69d3a8924952bb0c59353cddd43dbbfc52cdf937eeeb7c22d7bf',
  };
  for (const [file, hash] of Object.entries(expected)) {
    let source = await readFile(new URL('../' + file, import.meta.url));
    if (file === 'index.html') source = Buffer.from(source.toString().replace('    <link rel="stylesheet" href="css/home-news.css">\n', '').replace('    <script type="module" src="js/public/home-news.js"></script>\n', ''));
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
    if (file !== 'login.html') assert.ok(/data-admin-content hidden/.test(html));
    assert.ok(html.includes('noindex, nofollow'));
  }
});

