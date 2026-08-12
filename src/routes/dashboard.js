import { Router } from 'express';
import { supabase, requireSupabase } from '../config/supabase.js';
import { asyncRoute } from '../utils/http.js';
import { withItemImages } from '../utils/item-images.js';
import { cacheJson } from '../utils/cache.js';

const router = Router();
router.use(requireSupabase);

async function dashboardData() {
  const [{ data: itens, error: e1 }, { count: movMes, error: e2 }] = await Promise.all([
    supabase.from('itens').select('id,sku,nome,localizacao,quantidade,estoque_minimo,familia_id,familias(nome),tipos(nome)', { count: 'exact' }).eq('ativo', true),
    supabase.from('movimentacoes').select('id', { head: true, count: 'exact' }).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);
  if (e1) throw e1; if (e2) throw e2;

  const totalItens = itens.length;
  const emEstoque = itens.reduce((sum, i) => sum + Number(i.quantidade || 0), 0);
  const estoqueBaixo = itens.filter(i => Number(i.quantidade) <= Number(i.estoque_minimo)).length;
  const categorias = {};
  for (const item of itens) {
    const nome = item.familias?.nome || 'Outros';
    categorias[nome] = (categorias[nome] || 0) + Number(item.quantidade || 0);
  }
  return { itens, resumo: { totalItens, emEstoque, estoqueBaixo, movimentacoesMes: movMes || 0, categorias } };
}

router.get('/inicial', cacheJson(25_000), asyncRoute(async (_req, res) => {
  const { itens, resumo } = await dashboardData();
  const baixo = itens
    .filter(i => Number(i.quantidade) <= Number(i.estoque_minimo))
    .sort((a, b) => Number(a.quantidade) - Number(b.quantidade))
    .slice(0, 10);
  res.json({ resumo, estoqueBaixo: await withItemImages(baixo) });
}));

router.get('/resumo', cacheJson(25_000), asyncRoute(async (_req, res) => {
  const { resumo } = await dashboardData();
  res.json(resumo);
}));

router.get('/estoque-baixo', cacheJson(25_000), asyncRoute(async (_req, res) => {
  const { data, error } = await supabase
    .from('itens')
    .select('id,sku,nome,localizacao,quantidade,estoque_minimo,familias(nome),tipos(nome)')
    .eq('ativo', true)
    .order('quantidade', { ascending: true });
  if (error) throw error;
  res.json(await withItemImages(data.filter(i => Number(i.quantidade) <= Number(i.estoque_minimo)).slice(0, 10)));
}));

export default router;
