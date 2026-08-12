import { hasServiceRoleKey, supabase } from '../config/supabase.js';

export const ITEM_IMAGES_BUCKET = 'item-images';

export function itemImagePublicUrl(itemId) {
  if (!itemId) return null;
  const { data } = supabase.storage.from(ITEM_IMAGES_BUCKET).getPublicUrl(`${itemId}/foto.webp`);
  return data.publicUrl;
}

export function withItemImage(item) {
  if (!item?.id) return item;
  return { ...item, imagem_url: item.imagem_url || itemImagePublicUrl(item.id) };
}

function withStoredItemImage(item) {
  if (!item?.id) return item;
  return { ...item, imagem_url: item.imagem_url || itemImagePublicUrl(item.id) };
}

export function withNestedItemImage(record) {
  return record ? { ...record, itens: withStoredItemImage(record.itens) } : record;
}

export async function withItemImages(items = []) {
  return items.map(withStoredItemImage);
}

export async function withNestedItemImages(records = []) {
  return records.map(withNestedItemImage);
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
