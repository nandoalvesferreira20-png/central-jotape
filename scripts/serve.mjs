// Servidor local de desenvolvimento, sem dependências e sem expor SQL/.env/.git.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicDirectories = new Set(['admin', 'assets', 'css', 'js', 'config']);
const publicPages = new Set(['index.html', 'noticias.html', 'noticia.html', 'trajetoria-2026.html']);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
export function createDevServer() {
  return http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (!relative) relative = 'index.html';
    if (relative === 'admin') { res.writeHead(302, { Location: '/admin/' }); res.end(); return; }
    if (relative.endsWith('/')) relative += 'index.html';
    const parts = relative.split('/');
    if (parts.some(part => part.startsWith('.') || part.includes('\\')) ||
        !(publicPages.has(relative) || publicDirectories.has(parts[0]))) throw new Error('Not public');
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile()) throw new Error('Not found');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Não encontrado.'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createDevServer().listen(Number(process.env.PORT || 4175), '127.0.0.1', () => console.log('Prévia: http://127.0.0.1:' + (process.env.PORT || 4175)));
}

