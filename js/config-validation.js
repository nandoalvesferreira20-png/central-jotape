export function validateConfig(url, key) {
  url = typeof url === 'string' ? url.trim() : '';
  key = typeof key === 'string' ? key.trim() : '';
  if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY antes de acessar o painel.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('SUPABASE_URL inválida.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) ||
      parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('Use a URL HTTPS base do projeto Supabase (HTTP somente em localhost).');
  }
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) return { url: parsed.origin, key };
  try {
    const parts = key.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (parts.length === 3 && payload.role === 'anon') return { url: parsed.origin, key };
  } catch { /* Recusar qualquer formato não reconhecido. */ }
  throw new Error('Use somente a chave pública anon ou publishable. Chaves secretas são proibidas.');
}

