import { Router } from 'express';
import { supabase, requireSupabase } from '../config/supabase.js';
import { asyncRoute, normalizeText } from '../utils/http.js';
import { cacheJson, clearCacheAfterMutation } from '../utils/cache.js';

const router = Router();
router.use(requireSupabase);
router.use(clearCacheAfterMutation);

router.get('/', cacheJson(120_000), asyncRoute(async (req, res) => {
  let query = supabase.from('tipos').select('*, familias(id,codigo,nome)').order('codigo');
  if (req.query.familia_id) query = query.eq('familia_id', req.query.familia_id);
  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

router.post('/', asyncRoute(async (req, res) => {
  const codigo = normalizeText(req.body.codigo).padStart(3, '0');
  const nome = normalizeText(req.body.nome);
  const familia_id = normalizeText(req.body.familia_id);
  if (!/^\d{3}$/.test(codigo) || !nome || !familia_id) return res.status(400).json({ error: 'Família, código e nome são obrigatórios.' });

  const { data, error } = await supabase.from('tipos').insert({
    familia_id, codigo, nome, descricao: normalizeText(req.body.descricao), ativo: req.body.ativo ?? true,
  }).select('*, familias(id,codigo,nome)').single();
  if (error) throw error;
  res.status(201).json(data);
}));

router.put('/:id', asyncRoute(async (req, res) => {
  const payload = {};
  for (const field of ['nome','descricao','ativo']) if (req.body[field] !== undefined) payload[field] = req.body[field];
  const { data, error } = await supabase.from('tipos').update(payload).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

router.delete('/:id', asyncRoute(async (req, res) => {
  const { data: current, error: findError } = await supabase.from('tipos').select('id,codigo,nome,ativo,familias(codigo)').eq('id', req.params.id).single();
  if (findError) return res.status(404).json({ error: 'Tipo não encontrado.' });
  if (!current.ativo) return res.status(409).json({ error: 'Este tipo já está excluído.' });
  const expected = `${current.familias?.codigo}.${current.codigo}`;
  if (normalizeText(req.body.confirmacao) !== expected) return res.status(400).json({ error: `Digite exatamente o código ${expected} para confirmar.` });
  const { data, error } = await supabase.from('tipos').update({ ativo: false }).eq('id', current.id).select().single();
  if (error) throw error;
  res.json({ mensagem: 'Tipo excluído. Itens e históricos foram preservados.', tipo: data });
}));

export default router;
