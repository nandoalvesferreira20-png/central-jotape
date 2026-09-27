import { getPublicSupabase } from '../supabase-client.js';

export function galleryPhoto(client, row) {
  return {
    src: client.storage.from('central-media').getPublicUrl(row.image_path).data.publicUrl,
    alt: row.alt_text?.trim() || 'Foto de Jotapê',
    caption: row.caption || '',
    image_credit: row.image_credit || '',
  };
}

// Prazo também cobre falhas/lentidão do CDN. O fallback nunca espera indefinidamente.
export async function loadPublishedGallery(limit) {
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const client = await getPublicSupabase();
        let query = client.from('gallery_items').select('id,image_path,caption,image_credit,alt_text,position,created_at')
          .eq('publication_status', 'published').order('position', { ascending: true })
          .order('created_at', { ascending: true }).order('id', { ascending: true });
        if (limit) query = query.limit(limit);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(row => galleryPhoto(client, row));
      })(),
      new Promise(resolve => { timer = setTimeout(() => resolve([]), 4000); }),
    ]);
  } catch { return []; }
  finally { clearTimeout(timer); }
}

