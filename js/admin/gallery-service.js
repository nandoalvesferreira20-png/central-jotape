import { uploadImage, removeImage } from './storage.js';
import { ValidationError, uuid } from './validation.js';

export function galleryPayload(data) {
  const raw = String(data.get('position') ?? '').trim();
  const position = Number(raw);
  if (!/^-?\d+$/.test(raw) || !Number.isInteger(position) || position < -2147483648 || position > 2147483647) {
    throw new ValidationError('Informe uma ordem inteira válida.');
  }
  const publication_status = data.get('publication_status');
  if (!['draft', 'published'].includes(publication_status)) throw new ValidationError('Status inválido.');
  // Preserva o conteúdo digitado, inclusive crédito e prefixos fornecidos pelo editor.
  const text = name => String(data.get(name) ?? '') || null;
  return { caption: text('caption'), image_credit: text('image_credit'), alt_text: text('alt_text'), position, publication_status };
}

export async function listGallery(client) {
  const { data, error } = await client.from('gallery_items').select('*')
    .order('position', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function cleanup(client, path) {
  try { await removeImage(client, path); return ''; }
  catch { return 'Não foi possível remover o arquivo ' + path + ' do Storage. Confira esse caminho em central-media antes de removê-lo manualmente.'; }
}

export async function saveGallery(client, payload, file, previous = null) {
  if (!previous && !file) throw new ValidationError('Selecione uma imagem.');
  let uploaded;
  if (file) uploaded = await uploadImage(client, file, 'gallery');
  let record;
  try {
    const values = { ...payload, image_path: uploaded?.path || previous.image_path };
    // Evita que uma edição com imagem antiga sobrescreva uma substituição concorrente.
    const query = previous
      ? client.from('gallery_items').update(values).eq('id', uuid(previous.id)).eq('image_path', previous.image_path)
      : client.from('gallery_items').insert(values);
    const { data, error } = await query.select().single();
    if (error) throw error;
    record = data;
  } catch (error) {
    if (uploaded) error.cleanupWarning = await cleanup(client, uploaded.path);
    throw error;
  }
  const warning = uploaded && previous ? await cleanup(client, previous.image_path) : '';
  return { record, warning };
}

export async function deleteGallery(client, row) {
  const { error } = await client.from('gallery_items').delete()
    .eq('id', uuid(row.id)).eq('image_path', row.image_path).select('id').single();
  if (error) throw error;
  return { warning: await cleanup(client, row.image_path) };
}
