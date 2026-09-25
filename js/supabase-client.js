import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config/supabase-config.js';
import { validateConfig } from './config-validation.js';

let clientPromise;
let publicPromise;
async function createSupabase(publicRead = false) {
  let config;
  try { config = validateConfig(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY); }
  catch (error) { error.name = 'ConfigurationError'; throw error; }
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.116.0');
  // Somente o callback de recuperação processa tokens recebidos na URL.
  const fragment = new URLSearchParams(globalThis.location?.hash?.slice(1) || '');
  const recoveryCallback = globalThis.location?.pathname === '/admin/reset-password.html'
    && fragment.get('type') === 'recovery'
    && !!fragment.get('access_token') && !!fragment.get('refresh_token')
    && !fragment.has('error') && !fragment.has('error_code');
  return createClient(config.url, config.key, {
    auth: publicRead
      ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'central-public-anonymous' }
      : { persistSession: true, autoRefreshToken: true, detectSessionInUrl: recoveryCallback },
  });
}
export function getSupabase() {
  if (!clientPromise) clientPromise = createSupabase().catch(error => { clientPromise = undefined; throw error; });
  return clientPromise;
}
// Leitura pública sempre anônima, mesmo quando o editor está logado no painel.
export function getPublicSupabase() {
  if (!publicPromise) publicPromise = createSupabase(true).catch(error => { publicPromise = undefined; throw error; });
  return publicPromise;
}
