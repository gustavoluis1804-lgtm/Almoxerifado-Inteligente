import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { supabase, requireSupabase } from '../config/supabase.js';
import { asyncRoute, normalizeText } from '../utils/http.js';

const router = Router();
router.use(requireSupabase);

router.post('/perguntar', asyncRoute(async (req, res) => {
  const pergunta = normalizeText(req.body.pergunta);
  if (!pergunta) return res.status(400).json({ error: 'Digite uma pergunta.' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Gemini não configurado. Preencha GEMINI_API_KEY no .env.' });

  const [{ data: itens, error: itensError }, { data: movimentos, error: movError }] = await Promise.all([
    supabase.from('itens').select('sku,nome,localizacao,quantidade,estoque_minimo,familias(nome),tipos(nome)').eq('ativo', true).limit(300),
    supabase.from('movimentacoes').select('tipo,quantidade,responsavel,motivo,created_at,itens(sku,nome)').order('created_at', { ascending: false }).limit(200),
  ]);
  if (itensError) throw itensError; if (movError) throw movError;

  const contexto = {
    geradoEm: new Date().toISOString(),
    itens,
    movimentacoesRecentes: movimentos,
  };

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    contents: `Você é o Assistente do Almoxerifado SENAI-SP. Responda somente com base nos dados fornecidos. Seja objetivo, em português do Brasil, e não invente dados. Você pode analisar e recomendar, mas não pode afirmar que alterou o estoque.\n\nDADOS DO SISTEMA:\n${JSON.stringify(contexto)}\n\nPERGUNTA DO USUÁRIO:\n${pergunta}`,
  });

  res.json({ resposta: response.text || 'Não foi possível gerar uma resposta.' });
}));

export default router;
