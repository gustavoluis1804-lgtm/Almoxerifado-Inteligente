import { Router } from 'express';
import { supabase, requireSupabase } from '../config/supabase.js';
import { asyncRoute, normalizeText } from '../utils/http.js';
import { cacheJson, clearCacheAfterMutation } from '../utils/cache.js';

const router = Router();
router.use(requireSupabase);
router.use(clearCacheAfterMutation);

router.get('/', cacheJson(120_000), asyncRoute(async (_req, res) => {
  const { data, error } = await supabase.from('familias').select('*').order('codigo');
  if (error) throw error;
  res.json(data);
}));

router.post('/', asyncRoute(async (req, res) => {
  const codigo = normalizeText(req.body.codigo).padStart(3, '0');
  const nome = normalizeText(req.body.nome);
  if (!/^\d{3}$/.test(codigo) || !nome) return res.status(400).json({ error: 'Código de 3 dígitos e nome são obrigatórios.' });

  const { data, error } = await supabase.from('familias').insert({
    codigo, nome, descricao: normalizeText(req.body.descricao), ativo: req.body.ativo ?? true,
  }).select().single();
  if (error) throw error;
  res.status(201).json(data);
}));

router.put('/:id', asyncRoute(async (req, res) => {
  const payload = {};
  for (const field of ['nome','descricao','ativo']) if (req.body[field] !== undefined) payload[field] = req.body[field];
  const { data, error } = await supabase.from('familias').update(payload).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

router.delete('/:id', asyncRoute(async (req, res) => {
  const { data: current, error: findError } = await supabase.from('familias').select('id,codigo,nome,ativo').eq('id', req.params.id).single();
  if (findError) return res.status(404).json({ error: 'Família não encontrada.' });
  if (!current.ativo) return res.status(409).json({ error: 'Esta família já está excluída.' });
  if (normalizeText(req.body.confirmacao) !== current.codigo) return res.status(400).json({ error: `Digite exatamente o código ${current.codigo} para confirmar.` });
  const { error: typesError } = await supabase.from('tipos').update({ ativo: false }).eq('familia_id', current.id);
  if (typesError) throw typesError;
  const { data, error } = await supabase.from('familias').update({ ativo: false }).eq('id', current.id).select().single();
  if (error) throw error;
  res.json({ mensagem: 'Família e seus tipos foram excluídos. Itens e históricos foram preservados.', familia: data });
}));

export default router;
