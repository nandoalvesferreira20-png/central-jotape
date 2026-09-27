import { protectPage } from './auth.js';
import { message, friendlyError, withBusy, setFields, element, empty } from './ui.js';
import { galleryPayload, listGallery, saveGallery, deleteGallery } from './gallery-service.js';
import { galleryPhoto } from '../public/gallery-service.js';

async function init() {
  const context = await protectPage();
  if (!context) return;
  const { client } = context;
  const form = document.querySelector('#gallery-form');
  const records = document.querySelector('[data-records]');
  const preview = document.querySelector('[data-preview]');
  const heading = document.querySelector('#form-title');
  const refresh = document.querySelector('[data-refresh]');
  let rows = [];
  let editing = null;
  let busy = false;
  let previewURL;

  function showPreview(src) {
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = undefined;
    preview.removeAttribute('src');
    preview.hidden = !src;
    if (src) preview.src = src;
  }
  function reset() {
    editing = null;
    heading.textContent = 'Nova foto';
    form.elements.image.required = true;
    showPreview(null);
  }
  function render() {
    records.replaceChildren();
    if (!rows.length) { empty(records, 'Nenhuma foto cadastrada. Adicione a primeira abaixo.'); return; }
    for (const row of rows) {
      const card = element('article', undefined, 'record gallery-admin-record');
      const photo = galleryPhoto(client, row);
      const image = element('img', undefined, 'gallery-admin-thumb');
      Object.assign(image, { src: photo.src, alt: photo.alt, loading: 'lazy', decoding: 'async' });
      const info = element('div');
      info.append(element('h2', row.caption || 'Sem legenda'), element('p', row.image_credit || 'Sem crédito'),
        element('p', 'Ordem: ' + row.position), element('span', row.publication_status === 'published' ? 'Publicado' : 'Rascunho', 'badge badge-' + row.publication_status));
      const actions = element('div', undefined, 'actions');
      const edit = element('button', 'Editar', 'secondary');
      const remove = element('button', 'Excluir', 'danger');
      edit.type = remove.type = 'button';
      edit.addEventListener('click', () => {
        if (busy) return;
        form.reset();
        editing = row;
        setFields(form, row);
        form.elements.image.required = false;
        heading.textContent = 'Editar foto';
        showPreview(photo.src);
        form.elements.caption.focus();
      });
      remove.addEventListener('click', () => {
        if (busy || !confirm('Excluir esta foto e seu arquivo? Esta ação não pode ser desfeita.')) return;
        run(async () => {
          message('Excluindo foto…');
          const { warning } = await deleteGallery(client, row);
          rows = rows.filter(item => item.id !== row.id);
          if (editing?.id === row.id) {
            reset();
            setFields(form, { caption: '', image_credit: '', alt_text: '', position: 0, publication_status: 'draft' });
            form.elements.image.value = '';
          }
          render();
          message('Foto excluída.' + (warning ? ' ' + warning : ''), Boolean(warning));
        });
      });
      actions.append(edit, remove);
      card.append(image, info, actions);
      records.append(card);
    }
  }
  async function run(task) {
    if (busy) return;
    busy = true;
    refresh.disabled = true;
    records.querySelectorAll('button').forEach(button => { button.disabled = true; });
    await withBusy(form, async () => {
      try { await task(); }
      catch (error) {
        const text = ['PGRST205', '42P01'].includes(error?.code)
          ? 'A galeria ainda não está configurada. Execute manualmente a migration 202609270001_gallery_items.sql no Supabase.'
          : friendlyError(error);
        message(text + (error.cleanupWarning ? ' ' + error.cleanupWarning : ''), true);
      }
    });
    busy = false;
    refresh.disabled = false;
    records.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }
  refresh.addEventListener('click', () => run(async () => {
    message('Carregando fotos…');
    rows = await listGallery(client);
    render();
    message('Lista atualizada.');
  }));
  form.addEventListener('reset', event => {
    if (busy) { event.preventDefault(); return; }
    reset();
  });
  form.elements.image.addEventListener('change', () => {
    const file = form.elements.image.files[0];
    showPreview(file ? null : editing ? galleryPhoto(client, editing).src : null);
    if (file) { previewURL = URL.createObjectURL(file); preview.src = previewURL; preview.hidden = false; }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const data = new FormData(form);
    const file = form.elements.image.files[0];
    run(async () => {
      const payload = galleryPayload(data);
      message(file ? 'Enviando imagem e salvando foto…' : 'Salvando foto…');
      const { record, warning } = await saveGallery(client, payload, file, editing);
      rows = rows.filter(row => row.id !== record.id).concat(record).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      editing = record;
      form.elements.image.value = '';
      form.elements.image.required = false;
      heading.textContent = 'Editar foto';
      showPreview(galleryPhoto(client, record).src);
      render();
      message('Foto salva.' + (warning ? ' ' + warning : ''), Boolean(warning));
    });
  });
  form.querySelector('fieldset').disabled = false;
  await run(async () => { rows = await listGallery(client); render(); });
}
init();
