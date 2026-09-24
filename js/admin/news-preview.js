import { articleContent, node } from '../public/news-render.js';

export function previewNews(record) {
  const dialog = node('dialog', undefined, 'news-preview');
  dialog.setAttribute('aria-label', 'Prévia privada da notícia');
  const close = node('button', 'Fechar prévia', 'secondary');
  close.type = 'button';
  close.addEventListener('click', () => dialog.close());
  dialog.append(close, node('p', 'Prévia editorial · não altera a publicação', 'help'), articleContent(record, { heading: 'h2' }));
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  close.focus();
}
