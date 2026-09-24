import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('build publica apenas arquivos permitidos e recusa chave administrativa', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const env = { ...process.env, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_01234567890123456789' };
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root, env, stdio: 'pipe' });
  const config = await readFile(new URL('../dist/config/supabase-config.js', import.meta.url), 'utf8');
  assert.ok(config.includes('https://test.supabase.co'));
  assert.ok(config.includes('export const SUPABASE_PUBLISHABLE_KEY'));
  assert.ok(!config.includes('SUPABASE_ANON_KEY'));
  await assert.rejects(access(new URL('../dist/config/supabase-config.example.js', import.meta.url)));
  assert.deepEqual(await readFile(new URL('../dist/index.html', import.meta.url)), await readFile(new URL('../index.html', import.meta.url)));
  for (const file of ['supabase', '.env.example', 'tests', 'README.md', '.git', 'node_modules']) {
    await assert.rejects(access(new URL('../dist/' + file, import.meta.url)));
  }
  assert.throws(() => execFileSync(process.execPath, ['scripts/build.mjs'], {
    cwd: root, env: { ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_invalid' }, stdio: 'pipe',
  }));
});

