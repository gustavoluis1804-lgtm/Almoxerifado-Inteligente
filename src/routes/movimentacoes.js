import { Router } from 'express';
import { supabase, requireSupabase } from '../config/supabase.js';
import { asyncRoute, normalizeText, positiveInt } from '../utils/http.js';
import { withNestedItemImages } from '../utils/item-images.js';
import { cacheJson, clearApiCache, clearCacheAfterMutation } from '../utils/cache.js';

const router = Router();
router.use(requireSupabase);
router.use(clearCacheAfterMutation);

router.get('/', cacheJson(20_000), asyncRoute(async (req, res) => {
  let query = supabase
    .from('movimentacoes')
    .select('*, itens(id,sku,nome,localizacao,imagem_url)')
    .order('created_at', { ascending: false });
  if (req.query.tipo) query = query.eq('tipo', req.query.tipo.toUpperCase());
  if (req.query.item_id) query = query.eq('item_id', req.query.item_id);
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 200;
  const { data, error } = await query.limit(limit);
  if (error) throw error;
  res.json(await withNestedItemImages(data));
}));

async function registrar(req, res, tipo) {
  const quantidade = positiveInt(req.body.quantidade, 'Quantidade');
  const responsavel = normalizeText(req.body.responsavel);
  if (!req.body.item_id || !responsavel) return res.status(400).json({ error: 'Item e responsável são obrigatórios.' });

  const { data, error } = await supabase.rpc('registrar_movimentacao', {
    p_item_id: req.body.item_id,
    p_tipo: tipo,
    p_quantidade: quantidade,
    p_responsavel: responsavel,
    p_motivo: normalizeText(req.body.motivo),
  });
  if (error) {
    if (String(error.message).toLowerCase().includes('saldo insuficiente')) return res.status(409).json({ error: 'Saldo insuficiente para esta retirada.' });
    throw error;
  }
  clearApiCache();
  res.status(201).json(Array.isArray(data) ? data[0] : data);
}

router.post('/entrada', asyncRoute((req, res) => registrar(req, res, 'ENTRADA')));
router.post('/saida', asyncRoute((req, res) => registrar(req, res, 'SAIDA')));

export default router;
