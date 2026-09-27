import test from 'node:test';
import assert from 'node:assert/strict';
import { galleryPayload, saveGallery, deleteGallery } from '../js/admin/gallery-service.js';

const path = 'gallery/11111111-1111-4111-8111-111111111111.jpg';
const previous = { id: '11111111-1111-4111-8111-111111111111', image_path: path };
const file = new File([new Uint8Array([255, 216, 255, 0])], 'foto.jpg', { type: 'image/jpeg' });
function backend({ uploadFails = false, writeFails = false, removeFails = false } = {}) {
  const calls = [];
  let payload;
  const client = {
    storage: { from: () => ({
      upload: async path => { calls.push(['upload', path]); return { error: uploadFails ? new Error('upload') : null }; },
      getPublicUrl: path => ({ data: { publicUrl: 'https://example.test/' + path } }),
      remove: async paths => { calls.push(['remove', ...paths]); return { error: removeFails ? new Error('remove') : null }; },
    }) },
    from: () => ({
      insert(value) { payload = value; return this; }, update(value) { payload = value; return this; },
      delete() { return this; }, eq() { return this; }, select() { return this; },
      async single() { calls.push(['write']); return { data: { ...previous, ...payload }, error: writeFails ? new Error('write') : null }; },
    }),
  };
  return { client, calls };
}
test('galeria: ordem inteira, status fechado e crédito sem normalização/prefixo', () => {
  const data = new FormData();
  data.set('position', '-1'); data.set('publication_status', 'published');
  data.set('image_credit', '  Foto: João Silva  ');
  const payload = galleryPayload(data);
  assert.equal(payload.image_credit, '  Foto: João Silva  ');
  assert.equal(payload.caption, null); assert.equal(payload.alt_text, null); assert.equal(payload.position, -1);
  for (const value of ['', '1.5', 'NaN', '2147483648']) {
    data.set('position', value); assert.throws(() => galleryPayload(data));
  }
  data.set('position', '0'); data.set('publication_status', 'private'); assert.throws(() => galleryPayload(data));
});
test('upload recusado não grava banco; criação recusada tenta limpar upload', async () => {
  const first = backend({ uploadFails: true });
  await assert.rejects(saveGallery(first.client, {}, file), /upload/);
  assert.deepEqual(first.calls.map(c => c[0]), ['upload']);
  const second = backend({ writeFails: true });
  await assert.rejects(saveGallery(second.client, {}, file), /write/);
  assert.deepEqual(second.calls.map(c => c[0]), ['upload', 'write', 'remove']);
  assert.equal(second.calls[0][1], second.calls[2][1]);
});
test('substituição só apaga imagem antiga depois da confirmação; falha preserva antiga', async () => {
  for (const writeFails of [true, false]) {
    const { client, calls } = backend({ writeFails });
    if (writeFails) await assert.rejects(saveGallery(client, {}, file, previous));
    else await saveGallery(client, {}, file, previous);
    assert.deepEqual(calls.map(c => c[0]), ['upload', 'write', 'remove']);
    assert.equal(calls[2][1], writeFails ? calls[0][1] : path);
  }
});
test('exclusão confirma banco antes de limpar Storage e retorna aviso de limpeza', async () => {
  const denied = backend({ writeFails: true });
  await assert.rejects(deleteGallery(denied.client, previous));
  assert.deepEqual(denied.calls, [['write']]);
  const orphan = backend({ removeFails: true });
  const { warning } = await deleteGallery(orphan.client, previous);
  assert.match(warning, /central-media/); assert.ok(warning.includes(path));
  assert.deepEqual(orphan.calls.map(c => c[0]), ['write', 'remove']);
});
test('galeria recusa AVIF, falsificação, excesso e ausência de imagem nova', async () => {
  for (const file of [new File(['fake'], 'x.jpg', { type: 'image/jpeg' }), new File(['x'], 'x.avif', { type: 'image/avif' }), new File([new Uint8Array(5242881)], 'x.png', { type: 'image/png' }), undefined]) {
    const { client, calls } = backend();
    await assert.rejects(saveGallery(client, {}, file));
    assert.deepEqual(calls, []);
  }
});
