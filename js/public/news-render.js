import { safeCover, newsDate } from '../news.js';

export function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}
export function cover(record) {
  const image = node('img', undefined, 'news-cover');
  image.alt = record.title ? 'Capa: ' + record.title : 'Imagem da notícia';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  const fallback = new URL('../../assets/img/central-logo.jpg', import.meta.url).href;
  image.src = safeCover(record.cover_url) || fallback;
  if (!safeCover(record.cover_url)) image.alt = 'Central Jotapê MC — notícia sem capa';
  image.addEventListener('error', () => { image.src = fallback; image.alt = 'Central Jotapê MC'; }, { once: true });
  return image;
}
export function articleContent(record, { heading = 'h1' } = {}) {
  const article = node('article', undefined, 'news-article');
  article.append(node('p', record.category, 'news-category'), node(heading, record.title));
  if (record.excerpt) article.append(node('p', record.excerpt, 'news-excerpt'));
  article.append(node('p', 'Por ' + record.author_name + ' · ' + newsDate(record.published_at), 'news-meta'));
  if (record.cover_url) {
    const credit = String(record.image_credit || '').trim();
    if (credit) {
      const figure = node('figure', undefined, 'news-image');
      figure.append(cover(record), node('figcaption', credit, 'news-image-credit'));
      article.append(figure);
    } else article.append(cover(record));
  }
  const content = node('div', undefined, 'news-body');
  String(record.content || '').split(/\r?\n\s*\r?\n/).filter(Boolean)
    .forEach(paragraph => content.append(node('p', paragraph)));
  article.append(content);
  return article;
}
export function newsCard(record) {
  const article = node('article', undefined, 'news-card');
  const link = node('a');
  link.href = 'noticia.html?slug=' + encodeURIComponent(record.slug);
  link.append(cover(record), node('p', record.category, 'news-category'), node('h2', record.title));
  if (record.excerpt) link.append(node('p', record.excerpt, 'news-excerpt'));
  const date = node('time', newsDate(record.published_at), 'news-meta');
  date.dateTime = record.published_at;
  link.append(date, node('span', 'Ler notícia ↗', 'news-read'));
  article.append(link);
  return article;
}
