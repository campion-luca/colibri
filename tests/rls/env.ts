import { createClient } from '@supabase/supabase-js';

/*
 * Ambiente dei test RLS. Le variabili arrivano SOLO da .env.local (caricato da
 * vitest.rls.config.ts o da `node --env-file=.env.local`). Questo file non è mai
 * importato da codice in src/.
 */

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Manca ${name} in .env.local (vedi README, sezione Supabase).`);
  return v;
}

export const URL = need('VITE_SUPABASE_URL');
export const PUBLISHABLE_KEY = need('VITE_SUPABASE_PUBLISHABLE_KEY');
const SECRET_KEY = need('SUPABASE_SECRET_KEY');

/** Utenti di test riconoscibili: rls-test+<uuid>@colibri.test */
export const TEST_EMAIL_PREFIX = 'rls-test+';
export const TEST_EMAIL_DOMAIN = '@colibri.test';
export const isTestEmail = (email: string | undefined): boolean =>
  !!email && email.startsWith(TEST_EMAIL_PREFIX) && email.endsWith(TEST_EMAIL_DOMAIN);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Client con la secret key: bypassa RLS, solo per creare e cancellare gli utenti di test. */
export const admin = createClient(URL, SECRET_KEY, noSession);

/** Client "come l'app": chiave publishable, soggetto a RLS. */
export const publicClient = () => createClient(URL, PUBLISHABLE_KEY, noSession);

/** Cancella tutti gli utenti rls-test+* rimasti (anche da esecuzioni interrotte). */
export async function deleteLeftoverTestUsers(): Promise<number> {
  let removed = 0;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (!isTestEmail(u.email)) continue;
      const del = await admin.auth.admin.deleteUser(u.id);
      if (del.error) throw del.error;
      removed++;
    }
    if (data.users.length < 200) break;
  }
  return removed;
}
