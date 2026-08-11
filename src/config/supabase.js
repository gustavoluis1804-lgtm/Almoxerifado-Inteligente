import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();

export const hasSupabaseConfig = Boolean(
  url && key && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url),
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
    return res.status(503).json({
      error: 'Supabase não configurado. Preencha SUPABASE_URL e SUPABASE_SECRET_KEY no arquivo .env.',
    });
  }
  next();
}

export async function getSupabaseStatus() {
  const projectRef = url ? new URL(url).hostname.split('.')[0] : null;
  if (!supabase) return { configured: false, connected: false, projectRef };
  const { count, error } = await supabase
    .from('familias')
    .select('id', { count: 'exact', head: true });
  return {
    configured: true,
    connected: !error,
    projectRef,
    familias: error ? null : (count || 0),
    empty: !error && !count,
    error: error?.message,
  };
}
