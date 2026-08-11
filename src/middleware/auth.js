import { supabase } from '../config/supabase.js';

const COOKIE_NAME = 'almox_session';

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((part) => {
    const [name, ...value] = part.trim().split('=');
    return [name, decodeURIComponent(value.join('='))];
  }));
}

export function getAccessToken(req) {
  return cookies(req)[COOKIE_NAME] || null;
}

export function setSessionCookie(res, accessToken, expiresIn = 3600) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${expiresIn}${secure}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

export async function requireAuth(req, res, next) {
  const token = getAccessToken(req);
  if (!token || !supabase) return res.status(401).json({ error: 'Faça login para continuar.' });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });
  }
  req.user = data.user;
  next();
}

export async function requirePageAuth(req, res, next) {
  const token = getAccessToken(req);
  if (token && supabase) {
    const { data } = await supabase.auth.getUser(token);
    if (data.user) return next();
  }
  clearSessionCookie(res);
  res.redirect('/login.html');
}
