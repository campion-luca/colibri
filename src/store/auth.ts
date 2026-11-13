import type { Session } from '@supabase/auth-js';
import { create } from 'zustand';
import { AUTH_STORAGE_KEY, SYNC_ENABLED, supabase } from '../data/client.ts';
import { startSync, stopSync } from '../data/sync.ts';

/** local: senza Supabase (sviluppo e prove) · loading · signedOut · signedIn */
export type AuthStatus = 'local' | 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
}

/**
 * Utente della sessione salvata, letto subito all'avvio. Così l'app si apre con i dati
 * in cache senza aspettare il rinnovo del token (che dopo un'ora passa dalla rete).
 */
function savedUserId(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as { refresh_token?: string; user?: { id?: string } };
    return s.refresh_token && s.user?.id ? s.user.id : null;
  } catch {
    return null;
  }
}

const saved = SYNC_ENABLED ? savedUserId() : null;

export const useAuth = create<AuthState>()(() => ({
  status: !SYNC_ENABLED ? 'local' : saved ? 'signedIn' : 'loading',
  userId: saved,
  email: null,
}));

let started = false;
let syncingFor: string | null = null;

/** Ascolta la sessione (salvata e rinnovata da auth-js) e avvia la sincronizzazione. */
export function initAuth(): void {
  if (started || !supabase) return;
  started = true;
  const apply = (session: Session | null) => {
    const uid = session?.user.id ?? null;
    useAuth.setState({
      status: uid ? 'signedIn' : 'signedOut',
      userId: uid,
      email: session?.user.email ?? null,
    });
    // la sincronizzazione parte solo con la sessione confermata (token valido)
    if (uid && uid !== syncingFor) {
      syncingFor = uid;
      // fuori dalla callback: auth-js sconsiglia chiamate al client da qui dentro
      window.setTimeout(() => {
        startSync(uid);
      }, 0);
    }
    if (!uid && syncingFor) {
      syncingFor = null;
      stopSync();
    }
  };
  supabase.auth.onAuthStateChange((_event, session) => {
    apply(session);
  });
}
