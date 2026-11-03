import { getPublicSupabase } from '../supabase-client.js';
import { upcomingEvents, eventDateParts, eventTime } from '../events.js';
import { safeCover } from '../news.js';

function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function renderEvent(record) {
  const article = node('article', undefined, 'event');
  article.dataset.event = record.id;
  const date = eventDateParts(record.event_date);
  const calendar = node('time', date.day, 'event-date');
  calendar.dateTime = record.event_date;
  calendar.setAttribute('aria-label', date.full);
  calendar.append(node('span', date.month));
  const details = node('div', undefined, 'event-details');
  details.append(node('h3', record.title), node('p', [record.venue, record.city].filter(Boolean).join(' — ')));
  const hour = eventTime(record.event_time);
  if (hour) {
    const time = node('time', hour);
    time.dateTime = hour;
    const line = node('p');
    line.append(time);
    details.append(line);
  }
  if (record.description) details.append(node('p', record.description));
  const imageUrl = safeCover(record.image_url);
  if (imageUrl) {
    const image = node('img', undefined, 'event-image');
    image.src = imageUrl;
    image.alt = 'Imagem: ' + record.title;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    details.append(image);
  }
  const ticketUrl = safeCover(record.ticket_url);
  if (ticketUrl) {
    const link = node('a', 'COMPRAR INGRESSO →', 'text-link event-ticket');
    link.href = ticketUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    details.append(link);
  }
  article.append(calendar, details);
  return article;
}

async function initHomeAgenda() {
  const section = document.querySelector('#agenda');
  const container = section?.querySelector('[data-agenda-events]');
  if (!container) return;
  const fallback = [...container.childNodes].map(item => item.cloneNode(true));
  const note = section.querySelector('[data-agenda-empty-note]');
  let busy = false;
  async function load() {
    if (busy) return;
    busy = true;
    container.setAttribute('aria-busy', 'true');
    try {
      const records = await upcomingEvents(await getPublicSupabase());
      // Montar tudo antes de substituir o fallback preserva a home em caso de erro.
      const events = records.map(renderEvent);
      container.replaceChildren(...(events.length ? events : fallback.map(item => item.cloneNode(true))));
      note.hidden = events.length > 0;
    } catch {
      container.replaceChildren(...fallback.map(item => item.cloneNode(true)));
      note.hidden = false;
    } finally {
      busy = false;
      container.removeAttribute('aria-busy');
    }
  }
  window.addEventListener('pageshow', event => { if (event.persisted) load(); });
  await load();
}
initHomeAgenda();
