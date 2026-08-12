import { hasServiceRoleKey, supabase } from '../config/supabase.js';

export const ITEM_IMAGES_BUCKET = 'item-images';

export function withItemImage(item) {
  if (!item?.id) return item;
  const { data } = supabase.storage.from(ITEM_IMAGES_BUCKET).getPublicUrl(`${item.id}/foto.webp`);
  return { ...item, imagem_url: data.publicUrl };
}

export function withNestedItemImage(record) {
  return record ? { ...record, itens: withItemImage(record.itens) } : record;
}

export async function withItemImages(items = []) {
  const { data, error } = await supabase.storage.from(ITEM_IMAGES_BUCKET).list('', { limit: 1000 });
  if (error) return items.map(item => ({ ...item, imagem_url: null }));
  const storedIds = new Set(data.map(entry => entry.name));
  return items.map(item => storedIds.has(item?.id) ? withItemImage(item) : { ...item, imagem_url: null });
}

export async function withNestedItemImages(records = []) {
  const items = records.map(record => record.itens).filter(Boolean);
  const enriched = await withItemImages(items);
  const byId = new Map(enriched.map(item => [item.id, item]));
  return records.map(record => ({ ...record, itens: record.itens ? byId.get(record.itens.id) || record.itens : record.itens }));
}

export async function ensureImageBucket() {
  if (!hasServiceRoleKey) return;
  const { error: findError } = await supabase.storage.getBucket(ITEM_IMAGES_BUCKET);
  if (!findError) return;
  const { error } = await supabase.storage.createBucket(ITEM_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: 1572864,
    allowedMimeTypes: ['image/webp'],
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}
