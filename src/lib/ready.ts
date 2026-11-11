import { SYNC_ENABLED } from '../data/client.ts';
import { isReady, useSync } from '../data/sync.ts';
import { useAuth } from '../store/auth.ts';

/** Vero quando i dati locali sono validi (sempre in modalità locale). */
export function useReady(): boolean {
  const uid = useAuth((s) => s.userId);
  const readyFor = useSync((s) => s.readyFor);
  return !SYNC_ENABLED || isReady(readyFor, uid);
}
