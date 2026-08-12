import { Router } from 'express';
import QRCode from 'qrcode';
import { supabase, requireSupabase } from '../config/supabase.js';
import { asyncRoute, normalizeText } from '../utils/http.js';
import { ensureImageBucket, ITEM_IMAGES_BUCKET, itemImagePublicUrl, withItemImage, withItemImages } from '../utils/item-images.js';

const router = Router();
router.use(requireSupabase);

router.get('/', asyncRoute(async (req, res) => {
  let query = supabase
    .from('itens')
    .select('*, familias(id,codigo,nome), tipos(id,codigo,nome)')
    .order('created_at', { ascending: false });

  if (req.query.incluir_inativos !== 'true') query = query.eq('ativo', true);

  const q = normalizeText(req.query.q);
  if (q) {
    const safeQuery = q.replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (safeQuery) query = query.or(`nome.ilike.%${safeQuery}%,sku.ilike.%${safeQuery}%,localizacao.ilike.%${safeQuery}%`);
  }
  if (req.query.familia_id) query = query.eq('familia_id', req.query.familia_id);
  if (req.query.tipo_id) query = query.eq('tipo_id', req.query.tipo_id);

  const { data, error } = await query;
  if (error) throw error;
  res.json(await withItemImages(data));
}));

router.get('/sku/:sku', asyncRoute(async (req, res) => {
  const { data, error } = await supabase
    .from('itens')
    .select('*, familias(id,codigo,nome), tipos(id,codigo,nome)')
    .eq('sku', req.params.sku)
    .eq('ativo', true)
    .single();
  if (error) return res.status(404).json({ error: 'Item não encontrado.' });
  res.json(withItemImage(data));
}));

router.get('/:id', asyncRoute(async (req, res) => {
  const { data, error } = await supabase
    .from('itens')
    .select('*, familias(id,codigo,nome), tipos(id,codigo,nome)')
    .eq('id', req.params.id)
    .eq('ativo', true)
    .single();
  if (error) return res.status(404).json({ error: 'Item não encontrado.' });
  res.json(withItemImage(data));
}));

router.post('/', asyncRoute(async (req, res) => {
  const payload = {
    p_familia_id: req.body.familia_id,
    p_tipo_id: req.body.tipo_id,
    p_nome: normalizeText(req.body.nome),
    p_descricao: normalizeText(req.body.descricao),
    p_localizacao: normalizeText(req.body.localizacao),
    p_quantidade: Number(req.body.quantidade_inicial || 0),
    p_estoque_minimo: Number(req.body.estoque_minimo || 0),
  };

  if (!payload.p_familia_id || !payload.p_tipo_id || !payload.p_nome || !payload.p_localizacao) {
    return res.status(400).json({ error: 'Família, tipo, nome e localização são obrigatórios.' });
  }
  if (!Number.isInteger(payload.p_quantidade) || payload.p_quantidade < 0
      || !Number.isInteger(payload.p_estoque_minimo) || payload.p_estoque_minimo < 0) {
    return res.status(400).json({ error: 'As quantidades devem ser números inteiros iguais ou maiores que zero.' });
  }

  const { data: created, error } = await supabase.rpc('criar_item_com_sku', payload);
  if (error) throw error;
  const item = Array.isArray(created) ? created[0] : created;
  const qr_code = await QRCode.toDataURL(item.sku, { width: 500, margin: 2 });

  const { data, error: updateError } = await supabase
    .from('itens')
    .update({ qr_code })
    .eq('id', item.id)
    .select('*, familias(id,codigo,nome), tipos(id,codigo,nome)')
    .single();
  if (updateError) throw updateError;

  res.status(201).json(withItemImage(data));
}));

router.put('/:id', asyncRoute(async (req, res) => {
  const payload = {};
  for (const field of ['nome','descricao','localizacao']) if (req.body[field] !== undefined) payload[field] = normalizeText(req.body[field]);
  if (req.body.estoque_minimo !== undefined) {
    const minimum = Number(req.body.estoque_minimo);
    if (!Number.isInteger(minimum) || minimum < 0) return res.status(400).json({ error: 'O estoque mínimo deve ser um número inteiro igual ou maior que zero.' });
    payload.estoque_minimo = minimum;
  }
  if (req.body.ativo !== undefined) payload.ativo = Boolean(req.body.ativo);
  if (payload.nome !== undefined && !payload.nome) return res.status(400).json({ error: 'O nome do item é obrigatório.' });
  if (payload.localizacao !== undefined && !payload.localizacao) return res.status(400).json({ error: 'A localização do item é obrigatória.' });
  if (!Object.keys(payload).length) return res.status(400).json({ error: 'Nenhuma alteração foi informada.' });
  payload.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('itens').update(payload).eq('id', req.params.id).select().single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Item não encontrado.' });
  if (error) throw error;
  res.json(withItemImage(data));
}));

router.delete('/:id', asyncRoute(async (req, res) => {
  const confirmacao = normalizeText(req.body.confirmacao);
  const { data: item, error: findError } = await supabase
    .from('itens').select('id,sku,nome,ativo').eq('id', req.params.id).single();
  if (findError) return res.status(404).json({ error: 'Item não encontrado.' });
  if (!item.ativo) return res.status(409).json({ error: 'Este item já está excluído.' });
  if (confirmacao !== item.sku) {
    return res.status(400).json({ error: `Confirmação inválida. Digite exatamente o SKU ${item.sku}.` });
  }
  const { data, error } = await supabase
    .from('itens')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', item.id).eq('ativo', true).select('id,sku,nome,ativo').single();
  if (error) throw error;
  res.json({ mensagem: 'Item excluído com segurança. O histórico de movimentações foi preservado.', item: data });
}));

router.post('/:id/imagem', asyncRoute(async (req, res) => {
  const match = String(req.body.imagem || '').match(/^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ error: 'Envie uma imagem WebP, JPEG ou PNG válida.' });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 1572864) return res.status(400).json({ error: 'A imagem convertida deve ter no máximo 1,5 MB.' });

  const { data: item, error: itemError } = await supabase.from('itens').select('*').eq('id', req.params.id).single();
  if (itemError) {
    if (itemError.code === '22P02') return res.status(400).json({ error: 'Identificador do item inválido.' });
    return res.status(404).json({ error: 'Item não encontrado.' });
  }
  await ensureImageBucket();
  const filePath = `${item.id}/foto.webp`;
  const { error: uploadError } = await supabase.storage.from(ITEM_IMAGES_BUCKET).upload(filePath, buffer, { contentType: 'image/webp', cacheControl: '3600', upsert: true });
  if (uploadError) {
    if (/bucket not found/i.test(uploadError.message)) return res.status(503).json({ error: 'Execute novamente database/schema.sql no Supabase para criar o armazenamento de imagens.' });
    throw uploadError;
  }
  const imagem_url = itemImagePublicUrl(item.id);
  const { data: updated, error: updateError } = await supabase
    .from('itens')
    .update({ imagem_url, updated_at: new Date().toISOString() })
    .eq('id', item.id)
    .select('*')
    .single();
  if (updateError) throw updateError;
  res.json(withItemImage(updated));
}));

export default router;
