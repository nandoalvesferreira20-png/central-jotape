import { protectPage } from './auth.js';
import { createListView } from './list-view.js';
import { saveRecord } from './repository.js';
import { bindUpload } from './storage.js';
import { message, friendlyError, withBusy, setFields, element } from './ui.js';
import { eventDateParts, eventTime } from '../events.js';
import { required, optional, httpsUrl, enumValue, dateOnly, ValidationError } from './validation.js';

export function eventPayload(data) {
  const time = data.get('event_time') || null;
  if (time && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) throw new ValidationError('Horário inválido.');
  return {
    title: required(data.get('title'), 'Título'),
    description: optional(data.get('description'), 10000),
    event_date: dateOnly(data.get('event_date')), event_time: time,
    city: required(data.get('city'), 'Cidade', 120),
    venue: optional(data.get('venue'), 240),
    ticket_url: httpsUrl(data.get('ticket_url')), image_url: httpsUrl(data.get('image_url')),
    status: enumValue(data.get('status'), ['draft', 'published']),
  };
}
async function init() {
  const context = await protectPage();
  if (!context) return;
  const { client } = context;
  const form = document.querySelector('#event-form');
  let id = null;
  const heading = document.querySelector('#form-title');
  const view = createListView(client, 'events', {
    order: 'event_date',
    describe: row => [eventDateParts(row.event_date).full, eventTime(row.event_time), row.venue, row.city,
      row.status === 'published' ? 'Publicado' : 'Rascunho'].filter(Boolean).join(' · '),
    edit: row => {
      id = row.id;
      setFields(form, { ...row, event_time: row.event_time?.slice(0, 5) });
      heading.textContent = 'Editar evento';
      form.elements.title.focus();
    },
    extraActions: (actions, row, refresh) => {
      const button = element('button', row.status === 'published' ? 'Despublicar' : 'Publicar', 'secondary');
      button.type = 'button';
      button.addEventListener('click', async () => {
        await withBusy(actions, async () => {
          const status = row.status === 'published' ? 'draft' : 'published';
          try {
            await saveRecord(client, 'events', { status }, row.id);
            if (id === row.id) form.elements.status.value = status;
            await refresh();
            message(status === 'published' ? 'Evento publicado.' : 'Evento despublicado.');
          } catch (error) { message(friendlyError(error), true); }
        });
      });
      actions.append(button);
    },
  });
  form.querySelector('fieldset').disabled = false;
  bindUpload(form, client, 'events');
  form.querySelector('[type=reset]').addEventListener('click', () => { id = null; heading.textContent = 'Novo evento'; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    let payload;
    try { payload = eventPayload(new FormData(form)); }
    catch (error) { message(friendlyError(error), true); return; }
    await withBusy(form, async () => {
      message('Salvando evento…');
      try {
        const record = await saveRecord(client, 'events', payload, id);
        id = record.id;
        heading.textContent = 'Editar evento';
        await view.refresh();
        message(payload.status === 'published' ? 'Evento publicado. A home exibirá a data se for hoje ou futura, ao carregar a página.' : 'Evento salvo como rascunho.');
      } catch (error) { message(friendlyError(error), true); }
    });
  });
  await view.refresh();
}
if (typeof document !== 'undefined') init();

