import { element, empty, message, friendlyError } from './ui.js';
import { list, deleteRecord } from './repository.js';

export function createListView(client, name, { order = 'created_at', describe, edit, decorate, extraActions }) {
  const container = document.querySelector('[data-records]');
  const previous = document.querySelector('[data-previous]');
  const next = document.querySelector('[data-next]');
  const summary = document.querySelector('[data-page]');
  let page = 0;
  let busy = false;
  async function refresh() {
    if (busy) return;
    busy = true;
    previous.disabled = next.disabled = true;
    container.setAttribute('aria-busy', 'true');
    message('Carregando registros…');
    try {
      let result = await list(client, name, { page, order });
      if (!result.rows.length && page > 0) {
        page = Math.max(0, Math.ceil(result.count / 20) - 1);
        result = await list(client, name, { page, order });
      }
      container.replaceChildren();
      if (!result.rows.length) empty(container);
      result.rows.forEach(record => {
        const article = element('article', undefined, 'record');
        const info = element('div');
        info.append(element('h2', record.title), element('p', describe(record), 'muted'));
        decorate?.(info, record);
        const actions = element('div', undefined, 'actions');
        const editButton = element('button', 'Editar', 'secondary');
        editButton.type = 'button';
        editButton.addEventListener('click', () => edit(record));
        const remove = element('button', 'Excluir', 'danger');
        remove.type = 'button';
        remove.addEventListener('click', async () => {
          if (!confirm('Excluir definitivamente “' + record.title + '”? Esta ação não pode ser desfeita.')) return;
          remove.disabled = editButton.disabled = true;
          try { await deleteRecord(client, name, record.id); await refresh(); }
          catch (error) { message(friendlyError(error), true); remove.disabled = editButton.disabled = false; }
        });
        actions.append(editButton);
        extraActions?.(actions, record, refresh);
        actions.append(remove);
        article.append(info, actions);
        container.append(article);
      });
      summary.textContent = result.count + ' registro(s) · Página ' + (page + 1);
      previous.disabled = page === 0;
      next.disabled = (page + 1) * 20 >= result.count;
      message('');
    } catch (error) {
      message(friendlyError(error), true);
      empty(container, 'Não foi possível carregar os registros. Use “Atualizar lista” para tentar novamente.');
    } finally { busy = false; container.removeAttribute('aria-busy'); }
  }
  previous.addEventListener('click', () => { if (!busy && page > 0) { page--; refresh(); } });
  next.addEventListener('click', () => { if (!busy) { page++; refresh(); } });
  document.querySelector('[data-refresh]').addEventListener('click', refresh);
  return { refresh };
}

