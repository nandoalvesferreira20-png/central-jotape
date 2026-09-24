import { cp, mkdir, writeFile, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../js/config-validation.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = path.resolve(root, 'dist');
const { url, key } = validateConfig(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);
// Somente esta pasta gerada é removida; nunca seguir links simbólicos.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Diretório de build inválido.');
const stat = await lstat(output).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
if (stat?.isSymbolicLink()) throw new Error('dist não pode ser um link simbólico.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const publicFiles = ['index.html', 'noticias.html', 'noticia.html', 'trajetoria-2026.html', 'admin', 'assets', 'css', 'js'];
for (const name of publicFiles) await cp(path.join(root, name), path.join(output, name), { recursive: true });
await mkdir(path.join(output, 'config'));
await writeFile(path.join(output, 'config/supabase-config.js'),
  '// Configuração pública gerada no build.\nexport const SUPABASE_URL = ' + JSON.stringify(url) +
  ';\nexport const SUPABASE_PUBLISHABLE_KEY = ' + JSON.stringify(key) + ';\n', 'utf8');
console.log('Build estático gerado em dist. Nenhuma credencial privada é necessária.');

