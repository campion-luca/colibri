import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

const URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Senza configurazione Supabase l'app resta in modalità locale (sviluppo e prove). */
export const SYNC_ENABLED = URL !== '' && KEY !== '';

export type Supa = SupabaseClient<Database>;

export const supabase: Supa | null = SYNC_ENABLED
  ? createClient<Database>(URL, KEY, {
      auth: {
        // sessione salvata e rinnovata da sola: non si rifà il login
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'colibri-auth',
      },
    })
  : null;

export function sb(): Supa {
  if (!supabase) throw new Error('Supabase non configurato');
  return supabase;
}
