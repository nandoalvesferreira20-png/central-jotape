import { ValidationError } from './validation.js';
const BUCKET = 'central-media';
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
export function validateImage(file) {
  if (!file || !extensions[file.type]) throw new ValidationError('Envie uma imagem JPEG, PNG, WebP ou AVIF.');
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new ValidationError('A imagem deve ter até 5 MB e não pode estar vazia.');
}
export async function uploadImage(client, file, folder = 'news') {
  validateImage(file);
  if (!['news', 'news/covers', 'news/content', 'news-inline', 'events', 'trajectory'].includes(folder)) throw new ValidationError('Pasta de mídia inválida.');
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const signature = String.fromCharCode(...bytes);
  const valid = file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : file.type === 'image/png' ? bytes[0] === 137 && signature.slice(1, 4) === 'PNG'
    : file.type === 'image/webp' ? signature.startsWith('RIFF') && signature.slice(8, 12) === 'WEBP'
    : signature.slice(4, 8) === 'ftyp' && ['avif', 'avis'].includes(signature.slice(8, 12));
  if (!valid) throw new ValidationError('O conteúdo do arquivo não corresponde ao formato informado.');
  const path = folder + '/' + crypto.randomUUID() + '.' + extensions[file.type];
  const { error } = await client.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' });
  if (error) throw error;
  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}
export async function removeImage(client, path) {
  if (!/^(news(?:\/covers|\/content)?|news-inline|events|trajectory)\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(path)) {
    throw new ValidationError('Caminho de mídia inválido.');
  }
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
// Imagens antigas não são removidas ao salvar: podem ser referenciadas por outros registros.
export function bindUpload(form, client, folder) {
  const fileInput = form.querySelector('[data-upload]');
  if (!fileInput) return;
  form.querySelector('[data-upload-button]').addEventListener('click', async event => {
    const button = event.currentTarget;
    const status = form.querySelector('[data-upload-status]');
    button.disabled = true;
    form.querySelector('[type=submit]').disabled = true;
    status.textContent = 'Enviando imagem…';
    try {
      const result = await uploadImage(client, fileInput.files[0], folder);
      form.elements[fileInput.dataset.upload].value = result.url;
      status.textContent = 'Imagem enviada. Salve o registro para associá-la.';
      fileInput.value = '';
    } catch (error) {
      status.textContent = error instanceof ValidationError ? error.message : 'Não foi possível enviar. Confira acesso, conexão e bucket.';
    } finally {
      button.disabled = false;
      form.querySelector('[type=submit]').disabled = false;
    }
  });
}

