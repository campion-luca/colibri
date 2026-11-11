import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { SYNC_ENABLED, supabase } from '../data/client.ts';
import { startSync, stopSync } from '../data/sync.ts';

/** local: senza Supabase (sviluppo e prove) · loading · signedOut · signedIn */
export type AuthStatus = 'local' | 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
}

export const useAuth = create<AuthState>()(() => ({
  status: SYNC_ENABLED ? 'loading' : 'local',
  userId: null,
  email: null,
}));

let started = false;

/** Ascolta la sessione (salvata e rinnovata da supabase-js) e avvia la sincronizzazione. */
export function initAuth(): void {
  if (started || !supabase) return;
  started = true;
  const apply = (session: Session | null) => {
    const uid = session?.user.id ?? null;
    const prev = useAuth.getState().userId;
    useAuth.setState({
      status: uid ? 'signedIn' : 'signedOut',
      userId: uid,
      email: session?.user.email ?? null,
    });
    // fuori dalla callback: supabase-js sconsiglia chiamate al client da qui dentro
    if (uid && uid !== prev) {
      window.setTimeout(() => {
        startSync(uid);
      }, 0);
    }
    if (!uid && prev) stopSync();
  };
  supabase.auth.onAuthStateChange((_event, session) => {
    apply(session);
  });
}
