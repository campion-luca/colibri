import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import type { Database } from './database.types.ts';

/*
 * Client Supabase leggero: solo login (auth-js) e database (postgrest-js).
 * Il pacchetto completo supabase-js porterebbe anche realtime, storage e functions,
 * che l'app non usa (~33 kB compressi in meno). La sessione si salva con la stessa
 * chiave e lo stesso formato di supabase-js: chi è già dentro resta dentro.
 */

const URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Senza configurazione Supabase l'app resta in modalità locale (sviluppo e prove). */
export const SYNC_ENABLED = URL !== '' && KEY !== '';

/** Chiave della sessione salvata nel localStorage. */
export const AUTH_STORAGE_KEY = 'colibri-auth';

function createSupabase() {
  const auth = new AuthClient({
    url: `${URL}/auth/v1`,
    headers: { apikey: KEY },
    storageKey: AUTH_STORAGE_KEY,
    storage: window.localStorage,
    // sessione salvata e rinnovata da sola: non si rifà il login
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  });

  // ogni richiesta al database porta il token dell'utente (se c'è una sessione)
  const authedFetch: typeof fetch = async (input, init) => {
    const { data } = await auth.getSession();
    const headers = new Headers(init?.headers);
    headers.set('apikey', KEY);
    const token = data.session?.access_token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const db = new PostgrestClient<Database>(`${URL}/rest/v1`, {
    headers: { apikey: KEY },
    fetch: authedFetch,
  });

  return { auth, from: db.from.bind(db), rpc: db.rpc.bind(db) };
}

export type Supa = ReturnType<typeof createSupabase>;

export const supabase: Supa | null = SYNC_ENABLED ? createSupabase() : null;

export function sb(): Supa {
  if (!supabase) throw new Error('Supabase non configurato');
  return supabase;
}
