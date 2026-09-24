import { getPublicSupabase } from '../supabase-client.js';
import { publishedNews } from '../news.js';
import { newsCard, articleContent } from './news-render.js';

async function initNews() {
  const list = document.querySelector('#news-list');
  const container = list || document.querySelector('#article-content');
  const status = document.querySelector('[data-news-status]');
  const retry = document.querySelector('[data-retry]');
  const more = document.querySelector('[data-more]');
  let page = 0;
  let busy = false;
  async function load() {
    if (busy) return;
    busy = true;
    retry.hidden = true;
    if (more) more.disabled = true;
    container.setAttribute('aria-busy', 'true');
    status.textContent = 'Carregando notícias…';
    status.setAttribute('role', 'status');
    try {
      const slug = list ? undefined : new URLSearchParams(location.search).get('slug');
      if (!list && (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160)) {
        status.textContent = 'Notícia não encontrada.';
        return;
      }
      const client = await getPublicSupabase();
      const result = await publishedNews(client, { page, slug, pageSize: list ? 12 : 1 });
      if (!page) container.replaceChildren();
      if (list) {
        result.rows.forEach(record => container.append(newsCard(record)));
        more.hidden = (page + 1) * 12 >= result.count;
        status.textContent = result.count ? '' : 'Nenhuma notícia publicada por enquanto. Acompanhe as novidades da Central em breve.';
      } else {
        const record = result.rows[0];
        status.textContent = record ? '' : 'Notícia não encontrada.';
        if (record) {
          container.append(articleContent(record));
          document.title = record.title + ' | Central Jotapê MC';
          document.querySelector('meta[name=description]').content = record.excerpt || record.title;
        }
      }
    } catch (error) {
      status.setAttribute('role', 'alert');
      status.textContent = error.name === 'ConfigurationError'
        ? 'As notícias estão aguardando configuração. O restante da Central continua disponível.'
        : error.code === 'PGRST205'
          ? 'As notícias ainda estão sendo preparadas. Volte em breve.'
          : 'Não foi possível carregar as notícias. Confira sua conexão e tente novamente.';
      retry.hidden = false;
    } finally {
      busy = false;
      container.removeAttribute('aria-busy');
      if (more) more.disabled = false;
    }
  }
  retry.addEventListener('click', load);
  more?.addEventListener('click', async () => {
    if (busy) return;
    page++;
    await load();
    // Se falhar, a tentativa deve repetir a mesma página antes de avançar.
    if (!retry.hidden) more.hidden = true;
  });
  await load();
}
initNews();
