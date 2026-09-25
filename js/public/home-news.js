import { getPublicSupabase } from '../supabase-client.js';
import { publishedNews, safeCover } from '../news.js';

async function initHomeNews() {
  const section = document.querySelector('#central');
  if (!section) return;
  try {
    const { rows } = await publishedNews(await getPublicSupabase(), { featured: true, pageSize: 3 });
    if (!rows.length) return;
    section.dataset.newsLoaded = 'true';
    const slots = [...section.querySelectorAll('.story-main, .story-small')];
    slots.forEach((slot, index) => {
      const record = rows[index];
      if (!record) { slot.hidden = true; return; }
      slot.querySelectorAll('a').forEach(link => {
        link.href = 'noticia.html?slug=' + encodeURIComponent(record.slug);
        link.removeAttribute('target');
        link.removeAttribute('rel');
        link.setAttribute('aria-label', 'Ler: ' + record.title);
      });
      const title = slot.querySelector('h3');
      title.textContent = record.title;
      const category = slot.querySelector('.eyebrow');
      if (category) category.textContent = record.category;
      const description = [...slot.querySelectorAll('p')].find(item => !item.classList.contains('eyebrow'));
      if (description) description.textContent = record.excerpt || '';
      const cta = slot.querySelector('.text-link');
      if (cta) cta.textContent = 'Ler notícia ↗';
      const image = slot.querySelector('img');
      if (image) {
        image.hidden = false; // Inclui o slot editorial que aguarda a capa oficial do EP.
        const fallback = new URL('../../assets/img/central-logo.jpg', import.meta.url).href;
        image.addEventListener('error', () => { image.src = fallback; }, { once: true });
        image.removeAttribute('srcset');
        image.src = safeCover(record.cover_url) || fallback;
        image.alt = safeCover(record.cover_url) ? 'Capa: ' + record.title : 'Central Jotapê MC';
      }
    });
    const note = section.querySelector('.editorial-note');
    if (note) note.textContent = 'Últimas notícias publicadas pela Central.';
    const link = section.querySelector('.title-row .text-link');
    if (link) {
      link.href = 'noticias.html';
      link.textContent = 'Todas as notícias ↗';
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
  } catch {
    // Configuração ausente, erro ou nenhum destaque: preserva o editorial aprovado.
  }
}
initHomeNews();
