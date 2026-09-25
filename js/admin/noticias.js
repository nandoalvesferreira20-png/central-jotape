import { protectPage } from './auth.js';
import { createListView } from './list-view.js';
import { getRecord, saveRecord } from './repository.js';
import { initNewsCover } from './news-cover.js';
import { previewNews } from './news-preview.js';
import { slugify, publicationLabel, newsDate } from '../news.js';
import { message, friendlyError, withBusy, setFields, element } from './ui.js';
import { required, optional, httpsUrl, enumValue, slug, ValidationError } from './validation.js';

export function newsPayload(formData, now = new Date()) {
  const status = enumValue(formData.get('status'), ['draft', 'published']);
  const value = formData.get('published_at');
  const publication = value ? new Date(value) : (status === 'published' ? now : null);
  if (publication && !Number.isFinite(publication.getTime())) throw new ValidationError('Data de publicação inválida.');
  return {
    title: required(formData.get('title'), 'Título'),
    slug: slug(formData.get('slug')),
    excerpt: optional(formData.get('excerpt'), 500),
    content: required(formData.get('content'), 'Conteúdo', 100000),
    cover_url: httpsUrl(formData.get('cover_url')),
    image_credit: optional(formData.get('image_credit'), 500),
    category: required(formData.get('category'), 'Categoria', 80),
    status, featured: formData.get('featured') === 'on',
    author_name: required(formData.get('author_name'), 'Autor', 120),
    published_at: publication?.toISOString() || null,
  };
}
function localDatetime(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
async function init() {
  const context = await protectPage();
  if (!context) return;
  const { client } = context;
  const form = document.querySelector('#news-form');
  if (!form) {
    const view = createListView(client, 'news', {
      describe: record => record.category + ' · ' + newsDate(record.published_at || record.created_at) + (record.featured ? ' · Destaque' : ''),
      decorate: (info, record) => info.append(element('span', publicationLabel(record), 'badge badge-' + (record.status === 'draft' ? 'draft' : publicationLabel(record) === 'Agendada' ? 'scheduled' : 'published'))),
      edit: record => { location.href = 'noticia-form.html?id=' + encodeURIComponent(record.id); },
      extraActions: (actions, record, refresh) => {
        const preview = element('button', 'Visualizar', 'secondary');
        preview.type = 'button';
        preview.addEventListener('click', () => previewNews(record));
        const toggle = element('button', record.status === 'published' ? 'Despublicar' : 'Publicar', 'secondary');
        toggle.type = 'button';
        toggle.addEventListener('click', async () => {
          const published = record.status === 'published';
          if (!confirm((published ? 'Despublicar' : 'Publicar agora') + ' “' + record.title + '”?')) return;
          await withBusy(actions, async () => {
            try {
              await saveRecord(client, 'news', { status: published ? 'draft' : 'published', published_at: published ? record.published_at : new Date().toISOString() }, record.id);
              await refresh();
            } catch (error) { message(friendlyError(error), true); }
          });
        });
        actions.append(preview, toggle);
      },
    });
    await view.refresh();
    return;
  }
  let id = new URLSearchParams(location.search).get('id');
  let dirty = false;
  let saving = false;
  let manualSlug = Boolean(id);
  if (id) {
    message('Carregando notícia…');
    try {
      const record = await getRecord(client, 'news', id);
      setFields(form, { ...record, published_at: localDatetime(record.published_at) });
      document.querySelector('h1').textContent = 'Editar notícia';
    } catch (error) { message(friendlyError(error), true); return; }
  }
  form.querySelector('fieldset').disabled = false;
  message('');
  const cover = initNewsCover(form, client, () => { dirty = true; });
  form.addEventListener('input', () => { dirty = true; });
  form.elements.slug.addEventListener('input', () => { manualSlug = Boolean(form.elements.slug.value); });
  form.elements.title.addEventListener('input', () => {
    if (!manualSlug) form.elements.slug.value = slugify(form.elements.title.value);
  });
  addEventListener('beforeunload', event => {
    if (dirty || saving || cover.isUploading()) { event.preventDefault(); event.returnValue = ''; }
  });
  form.querySelector('[data-cancel]').addEventListener('click', async () => {
    if (saving || cover.isUploading()) return;
    if (dirty && !confirm('Descartar as alterações não salvas?')) return;
    await withBusy(form, async () => {
      const cleaned = await cover.cleanup();
      if (!cleaned && !confirm('A limpeza de uma imagem falhou. Sair e revisar o Storage depois?')) return;
      dirty = false;
      location.href = 'noticias.html';
    });
  });
  form.querySelector('[data-preview]').addEventListener('click', () => {
    try { previewNews(newsPayload(new FormData(form))); }
    catch (error) { message(friendlyError(error), true); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || cover.isUploading() || !form.reportValidity()) return;
    if (cover.hasSelection()) { message('Clique em Enviar imagem antes de salvar a capa selecionada.', true); return; }
    let payload;
    try {
      const data = new FormData(form);
      data.set('status', event.submitter?.value || form.elements.status.value);
      payload = newsPayload(data);
    } catch (error) { message(friendlyError(error), true); return; }
    saving = true;
    await withBusy(form, async () => {
      message('Salvando notícia…');
      try {
        const record = await saveRecord(client, 'news', payload, id);
        id = record.id;
        history.replaceState(null, '', 'noticia-form.html?id=' + encodeURIComponent(id));
        form.elements.published_at.value = localDatetime(record.published_at);
        form.elements.status.value = record.status;
        document.querySelector('h1').textContent = 'Editar notícia';
        dirty = false;
        manualSlug = true;
        await cover.cleanup(record.cover_url);
        const label = publicationLabel(record);
        message(label === 'Rascunho' ? 'Notícia salva como rascunho. Ela não aparece no site público.'
          : label === 'Agendada' ? 'Notícia agendada. Ficará disponível após a data informada, ao carregar o site.'
          : 'Notícia publicada. Já está disponível nas páginas públicas; recarregue uma página aberta para vê-la.');
      } catch (error) {
        message(error?.code === '23505' ? 'Este slug já está em uso. Altere o slug e tente novamente.' : friendlyError(error), true);
      }
    });
    saving = false;
  });
}
if (typeof document !== 'undefined') init();
