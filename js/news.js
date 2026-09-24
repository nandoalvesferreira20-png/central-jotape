// Regras compartilhadas entre o painel e o portal. Sem dependência de DOM.
export function slugify(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160).replace(/-$/, '');
}
export function publicationLabel(record, now = Date.now()) {
  if (record.status !== 'published') return 'Rascunho';
  return Date.parse(record.published_at) > now ? 'Agendada' : 'Publicada';
}
export function newsDate(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date) : 'Sem data';
}
export function safeCover(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
export async function publishedNews(client, { page = 0, pageSize = 12, featured = false, slug } = {}) {
  const fields = slug !== undefined ? '*' : 'id,title,slug,excerpt,cover_url,category,published_at';
  let query = client.from('news').select(fields, { count: 'exact' })
    .eq('status', 'published').lte('published_at', new Date().toISOString());
  if (featured) query = query.eq('featured', true);
  if (slug !== undefined) query = query.eq('slug', slug);
  query = query.order('published_at', { ascending: false }).order('id', { ascending: false });
  const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}
