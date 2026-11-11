import { useEffect } from 'react';
import { App } from './App.tsx';
import { Login } from './components/Login.tsx';
import { initAuth, useAuth } from './store/auth.ts';

/** Login (se c'è Supabase e non c'è sessione) oppure l'app. */
export function Root() {
  const status = useAuth((s) => s.status);
  useEffect(() => {
    initAuth();
  }, []);
  // la sessione salvata si legge in un attimo: niente schermata intermedia
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Login />;
  return <App />;
}
