import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { rollover } from '../domain/index.ts';
import { getNow } from '../lib/now.ts';
import { useGame } from '../store/game.ts';
import { toast } from '../store/ui.ts';
import { diffState, flushQueue, mergePending, type Bundle } from './queue.ts';
import { commitRollover, fetchSnapshot, sendBundle } from './remote.ts';

/*
 * Sincronizzazione con Supabase.
 * - Ogni modifica allo stato di gioco diventa un pacchetto in coda (localStorage) e la
 *   UI non aspetta mai la rete; la coda si invia subito, o al ritorno della connessione.
 * - Al ritorno sull'app (visibilitychange/focus/online) si ricarica lo stato dal server
 *   e ci si riapplicano sopra i pacchetti non ancora inviati.
 * - La mezzanotte passa da commit_rollover, a coda vuota e su stato fresco.
 */

interface SyncState {
  queue: Bundle[];
  /** utente per cui c'è già stato un caricamento completo (la cache locale è valida) */
  readyFor: string | null;
}

export const useSync = create<SyncState>()(
  persist(() => ({ queue: [] as Bundle[], readyFor: null as string | null }), {
    name: 'colibri-queue',
    storage: createJSONStorage(() => localStorage),
  }),
);

let userId: string | null = null;
let applyingRemote = 0;
let unsubscribe: (() => void) | null = null;
let flushing: Promise<void> | null = null;
let syncing: Promise<void> | null = null;

/** Applica dati arrivati dal server senza rimetterli in coda. */
function asRemote(fn: () => void): void {
  applyingRemote++;
  try {
    fn();
  } finally {
    applyingRemote--;
  }
}

const onOnline = () => {
  void syncNow();
};

export function startSync(uid: string): void {
  stopSync();
  userId = uid;
  const g = useGame.getState();
  if (g.userId !== uid) {
    // dati locali di prova (o di un altro account): si scartano e si parte da zero
    asRemote(() => {
      g.replaceAll({ userId: uid });
    });
    useSync.setState({ queue: [], readyFor: null });
  }
  unsubscribe = useGame.subscribe((s, prev) => {
    if (applyingRemote > 0) return;
    const b = diffState(prev, s, crypto.randomUUID());
    if (!b) return;
    useSync.setState((q) => ({ queue: [...q.queue, b] }));
    void flush();
  });
  window.addEventListener('online', onOnline);
  void syncNow();
}

export function stopSync(): void {
  unsubscribe?.();
  unsubscribe = null;
  window.removeEventListener('online', onOnline);
  userId = null;
}

/** Invia la coda in ordine. Non lancia mai: in caso di problemi riprova più tardi. */
export function flush(): Promise<void> {
  if (!userId) return Promise.resolve();
  flushing ??= doFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function doFlush(): Promise<void> {
  const uid = userId;
  if (!uid) return;
  const r = await flushQueue(
    {
      head: () => useSync.getState().queue[0],
      remove: (id) => {
        useSync.setState((q) => ({ queue: q.queue.filter((b) => b.id !== id) }));
      },
      bump: (id) => {
        const cur = useSync.getState().queue.find((b) => b.id === id);
        const n = (cur?.attempts ?? 0) + 1;
        useSync.setState((q) => ({
          queue: q.queue.map((b) => (b.id === id ? { ...b, attempts: n } : b)),
        }));
        return n;
      },
    },
    (b) => sendBundle(b, uid),
  ).catch(() => null);
  if (!r) return;
  if (r.dropped.length) toast('Alcune modifiche non sono state salvate');
  if (r.status !== 'done') return;
  if (useSync.getState().queue.length) {
    // arrivato altro mentre chiudevamo: un altro giro
    window.setTimeout(() => void flush(), 0);
  } else if (r.xp !== null) {
    // coda vuota: gli XP veri sono quelli del server
    const xp = r.xp;
    asRemote(() => {
      useGame.setState({ xp });
    });
  }
}

/** Invia la coda, ricarica dal server, applica la mezzanotte se serve. */
export function syncNow(): Promise<void> {
  if (!userId) return Promise.resolve();
  syncing ??= doSync()
    .catch((e: unknown) => {
      console.warn('[sync]', e);
    })
    .finally(() => {
      syncing = null;
    });
  return syncing;
}

async function doSync(): Promise<void> {
  await flush();
  if (await refresh()) await maybeRollover();
}

async function refresh(): Promise<boolean> {
  const uid = userId;
  if (!uid) return false;
  const snap = await fetchSnapshot(getNow().day);
  if (userId !== uid) return false;
  const merged = mergePending(snap, useSync.getState().queue);
  asRemote(() => {
    useGame.getState().applyRemote({ ...merged, lastDate: snap.lastDate, history: snap.history });
  });
  useSync.setState({ readyFor: uid });
  return true;
}

async function maybeRollover(): Promise<void> {
  const uid = userId;
  if (!uid) return;
  // serve lo stato completo del server: niente rollover con modifiche ancora in coda
  if (useSync.getState().queue.length) return;
  const now = getNow();
  const s = useGame.getState();
  if (s.lastDate !== null && s.lastDate >= now.day) return;
  const r = s.lastDate ? rollover(s, now.day, { userId: uid }, now.ts) : null;
  const res = await commitRollover(s.lastDate, now.day, r);
  if (userId !== uid) return;
  if (res.applied) {
    asRemote(() => {
      useGame.getState().applyRollover(r, res.xp, now.day);
    });
  } else {
    // un altro dispositivo è arrivato prima: si prende il suo risultato
    await refresh();
  }
}

/** Vero se la cache locale è valida per l'utente (altrimenti si mostra lo skeleton). */
export const isReady = (readyFor: string | null, uid: string | null): boolean =>
  uid !== null && readyFor === uid;
