import { Router } from 'express';
import { supabaseAuth, requireSupabase } from '../config/supabase.js';
import { asyncRoute, normalizeText } from '../utils/http.js';
import { clearSessionCookie, getAccessToken, getSessionUser, setSessionCookie } from '../middleware/auth.js';

const router = Router();
router.use(requireSupabase);

function userName(user) {
  const metadata = user.user_metadata || {};
  const savedName = metadata.full_name || metadata.name || metadata.nome;
  if (savedName?.trim()) return savedName.trim();
  return (user.email?.split('@')[0] || 'Usuario')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

router.post('/login', asyncRoute(async (req, res) => {
  const email = normalizeText(req.body.email).toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Informe seu e-mail e sua senha.' });

  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error || !data.session) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  setSessionCookie(res, data.session.access_token, data.session.expires_in);
  res.json({ user: { id: data.user.id, email: data.user.email, nome: userName(data.user) } });
}));

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get('/me', asyncRoute(async (req, res) => {
  const token = getAccessToken(req);
  if (!token) return res.status(401).json({ error: 'Nao autenticado.' });
  const user = await getSessionUser(token);
  if (!user) return res.status(401).json({ error: 'Sessao expirada.' });
  res.json({ id: user.id, email: user.email, nome: userName(user) });
}));

export default router;
