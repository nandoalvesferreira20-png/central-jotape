import { uploadImage, removeImage, validateImage } from './storage.js';
import { safeCover } from '../news.js';
import { withBusy } from './ui.js';

export function initNewsCover(form, client, onChange) {
  const input = form.querySelector('[data-upload]');
  const field = form.elements.cover_url;
  const preview = form.querySelector('[data-cover-preview]');
  const status = form.querySelector('[data-upload-status]');
  const pending = new Map();
  let objectUrl;
  let uploading = false;
  function show(url) {
    preview.hidden = !url;
    if (url) preview.src = url;
    else preview.removeAttribute('src');
  }
  function revoke() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
  }
  preview.addEventListener('error', () => {
    preview.hidden = true;
    status.textContent = 'Não foi possível exibir a capa. Confira o arquivo ou a URL.';
  });
  field.addEventListener('input', () => { revoke(); input.value = ''; show(safeCover(field.value)); });
  input.addEventListener('change', () => {
    revoke();
    try {
      validateImage(input.files[0]);
      objectUrl = URL.createObjectURL(input.files[0]);
      show(objectUrl);
      status.textContent = 'Prévia local. Clique em Enviar imagem antes de salvar.';
    } catch (error) {
      input.value = '';
      show(safeCover(field.value));
      status.textContent = error.message;
    }
  });
  async function cleanup(keepUrl = '') {
    let failed = false;
    for (const [url, path] of pending) {
      if (url === keepUrl) { pending.delete(url); continue; }
      try { await removeImage(client, path); pending.delete(url); }
      catch { failed = true; }
    }
    if (failed) status.textContent = 'Uma imagem não utilizada não pôde ser removida. Revise a pasta news/covers no Storage.';
    return !failed;
  }
  form.querySelector('[data-upload-button]').addEventListener('click', async () => {
    if (uploading) return;
    const file = input.files[0];
    uploading = true;
    await withBusy(form, async () => {
      status.textContent = 'Enviando imagem…';
      try {
        const result = await uploadImage(client, file, 'news/covers');
        pending.set(result.url, result.path);
        field.value = result.url;
        input.value = '';
        revoke();
        show(result.url);
        onChange();
        status.textContent = 'Imagem enviada. Salve a notícia para associá-la.';
      } catch (error) {
        status.textContent = error.name === 'ValidationError' ? error.message
          : 'Não foi possível enviar. Confira sua conexão, permissão e o bucket central-media.';
      }
    });
    uploading = false;
  });
  show(safeCover(field.value));
  addEventListener('pagehide', revoke);
  return { cleanup, hasSelection: () => Boolean(input.files.length), isUploading: () => uploading };
}
