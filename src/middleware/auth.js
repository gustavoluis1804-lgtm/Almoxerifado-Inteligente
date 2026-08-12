import { supabase } from '../config/supabase.js';

const COOKIE_NAME = 'almox_session';
const userCache = new Map();
const USER_CACHE_TTL = 60_000;

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

export async function getSessionUser(token) {
  if (!token || !supabase) return null;
  const cached = userCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    userCache.delete(token);
    return null;
  }

  userCache.set(token, { user: data.user, expiresAt: Date.now() + USER_CACHE_TTL });
  return data.user;
}

export async function requireAuth(req, res, next) {
  const token = getAccessToken(req);
  if (!token || !supabase) return res.status(401).json({ error: 'Faca login para continuar.' });
  const user = await getSessionUser(token);
  if (!user) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Sua sessao expirou. Entre novamente.' });
  }
  req.user = user;
  next();
}

export async function requirePageAuth(req, res, next) {
  const token = getAccessToken(req);
  if (await getSessionUser(token)) return next();
  clearSessionCookie(res);
  res.redirect('/login.html');
}
