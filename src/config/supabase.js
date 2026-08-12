import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.SUPABASE_URL?.trim();
const url = rawUrl?.replace(/\/+$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const legacySecretKey = process.env.SUPABASE_SECRET_KEY?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
const key = serviceRoleKey || legacySecretKey || publishableKey;
const isValidProjectUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url || '');

export const supabaseKeyType = serviceRoleKey
  ? 'service_role'
  : legacySecretKey
    ? 'legacy_secret'
    : publishableKey
      ? 'publishable'
      : null;

export const hasServiceRoleKey = supabaseKeyType === 'service_role' || supabaseKeyType === 'legacy_secret';

export const hasSupabaseConfig = Boolean(
  url && key && isValidProjectUrl,
);

export const supabase = hasSupabaseConfig
  ? createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

export const supabaseAuth = hasSupabaseConfig
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;

export function requireSupabase(req, res, next) {
  if (!supabase) {
    const reason = rawUrl && !isValidProjectUrl
      ? 'SUPABASE_URL deve ser a Project URL base, sem /rest/v1. Exemplo: https://seu-projeto.supabase.co.'
      : 'Preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env ou nas variáveis da Vercel.';
    return res.status(503).json({
      error: `Supabase não configurado. ${reason}`,
    });
  }
  next();
}

export async function getSupabaseStatus() {
  const projectRef = url && isValidProjectUrl ? new URL(url).hostname.split('.')[0] : null;
  if (!supabase) {
    return {
      configured: false,
      connected: false,
      projectRef,
      urlOk: Boolean(rawUrl && isValidProjectUrl),
      keyType: supabaseKeyType,
    };
  }
  const { count, error } = await supabase
    .from('familias')
    .select('id', { count: 'exact', head: true });
  return {
    configured: true,
    connected: !error,
    projectRef,
    urlOk: true,
    keyType: supabaseKeyType,
    familias: error ? null : (count || 0),
    empty: !error && !count,
    error: error?.message,
  };
}
