import {
  applyXp,
  type Idea,
  type Item,
  type NotifSettings,
  type Pause,
  type XpEvent,
} from '../domain/index.ts';

/*
 * Coda delle scritture. Ogni azione dell'utente diventa un pacchetto: la UI l'ha già
 * applicato in locale (aggiornamento ottimistico) e il pacchetto si invia appena c'è
 * rete. Ripeterlo è sicuro: gli elementi si scrivono con upsert e gli eventi hanno
 * id generati dal client (apply_xp ignora quelli già visti).
 */

export interface Bundle {
  id: string;
  /** tentativi falliti per errori non di rete */
  attempts: number;
  items?: Item[];
  deleteItems?: string[];
  ideas?: Idea[];
  deleteIdeas?: string[];
  pauses?: Pause[];
  deletePauses?: string[];
  events?: XpEvent[];
  notif?: NotifSettings;
}

/** La parte dello stato che si sincronizza (XP, last_date e storico li decide il server). */
export interface SyncedState {
  items: Item[];
  ideas: Idea[];
  pauses: Pause[];
  events: XpEvent[];
  notif: NotifSettings;
}

function diffList<T extends { id: string }>(
  prev: T[],
  next: T[],
): { upsert: T[]; removed: string[] } {
  if (prev === next) return { upsert: [], removed: [] };
  const before = new Map(prev.map((x) => [x.id, x]));
  const upsert = next.filter((x) => before.get(x.id) !== x);
  const nextIds = new Set(next.map((x) => x.id));
  const removed = prev.filter((x) => !nextIds.has(x.id)).map((x) => x.id);
  return { upsert, removed };
}

/** Cosa è cambiato tra due stati, come pacchetto da inviare. `null` se niente. */
export function diffState(prev: SyncedState, next: SyncedState, id: string): Bundle | null {
  const b: Bundle = { id, attempts: 0 };
  const items = diffList(prev.items, next.items);
  const ideas = diffList(prev.ideas, next.ideas);
  const pauses = diffList(prev.pauses, next.pauses);
  if (items.upsert.length) b.items = items.upsert;
  // tolti dalla lista (eliminati o convertiti): soft delete, si possono ripristinare
  if (items.removed.length) b.deleteItems = items.removed;
  if (ideas.upsert.length) b.ideas = ideas.upsert;
  if (ideas.removed.length) b.deleteIdeas = ideas.removed;
  if (pauses.upsert.length) b.pauses = pauses.upsert;
  if (pauses.removed.length) b.deletePauses = pauses.removed;
  if (prev.events !== next.events) {
    const seen = new Set(prev.events.map((e) => e.id));
    const fresh = next.events.filter((e) => !seen.has(e.id));
    if (fresh.length) b.events = fresh;
  }
  if (prev.notif !== next.notif && JSON.stringify(prev.notif) !== JSON.stringify(next.notif)) {
    b.notif = next.notif;
  }
  return Object.keys(b).length > 2 ? b : null;
}

function upsertList<T extends { id: string }>(list: T[], changed: T[]): T[] {
  const byId = new Map(changed.map((x) => [x.id, x]));
  const out = list.map((x) => byId.get(x.id) ?? x);
  const have = new Set(list.map((x) => x.id));
  for (const x of changed) if (!have.has(x.id)) out.push(x);
  return out;
}

/**
 * Stato del server + modifiche ancora in coda: dopo un ricaricamento la UI non perde
 * le azioni non ancora inviate. Gli XP sono quelli del server più gli eventi in coda.
 */
export function mergePending(
  base: SyncedState & { xp: number },
  queue: readonly Bundle[],
): SyncedState & { xp: number } {
  let { items, ideas, pauses, events, xp, notif } = base;
  const seen = new Set(events.map((e) => e.id));
  for (const b of queue) {
    if (b.items) items = upsertList(items, b.items);
    if (b.deleteItems) {
      const del = new Set(b.deleteItems);
      items = items.filter((i) => !del.has(i.id));
    }
    if (b.ideas) ideas = upsertList(ideas, b.ideas);
    if (b.deleteIdeas) {
      const del = new Set(b.deleteIdeas);
      ideas = ideas.filter((i) => !del.has(i.id));
    }
    if (b.pauses) pauses = upsertList(pauses, b.pauses);
    if (b.deletePauses) {
      const del = new Set(b.deletePauses);
      pauses = pauses.filter((p) => !del.has(p.id));
    }
    if (b.events) {
      for (const e of b.events) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        events = [...events, e];
        xp = applyXp(xp, e.xp);
      }
    }
    if (b.notif) notif = b.notif;
  }
  return { items, ideas, pauses, events, xp, notif };
}

/* ---------- invio della coda ---------- */

export class SyncError extends Error {
  /** rete assente, server momentaneamente giù, sessione da rinnovare: si riprova dopo */
  readonly transient: boolean;
  constructor(message: string, transient: boolean) {
    super(message);
    this.name = 'SyncError';
    this.transient = transient;
  }
}

export interface QueueAccess {
  head: () => Bundle | undefined;
  remove: (id: string) => void;
  /** segna un tentativo fallito e restituisce quanti ne ha fatti */
  bump: (id: string) => number;
}

export interface FlushResult {
  /** done: coda vuota · offline: rete assente, si riprova · retry: errore, si riprova */
  status: 'done' | 'offline' | 'retry';
  /** XP restituiti dall'ultimo apply_xp riuscito */
  xp: number | null;
  /** pacchetti scartati dopo troppi errori non di rete */
  dropped: Bundle[];
}

export const MAX_ATTEMPTS = 5;

/** Invia i pacchetti in ordine. Si ferma al primo errore di rete; scarta solo dopo 5 errori veri. */
export async function flushQueue(
  q: QueueAccess,
  send: (b: Bundle) => Promise<{ xp: number | null }>,
): Promise<FlushResult> {
  let xp: number | null = null;
  const dropped: Bundle[] = [];
  for (let b = q.head(); b; b = q.head()) {
    try {
      const r = await send(b);
      if (r.xp !== null) xp = r.xp;
      q.remove(b.id);
    } catch (e) {
      if (e instanceof SyncError && e.transient) return { status: 'offline', xp, dropped };
      if (q.bump(b.id) >= MAX_ATTEMPTS) {
        dropped.push(b);
        q.remove(b.id);
        continue;
      }
      return { status: 'retry', xp, dropped };
    }
  }
  return { status: 'done', xp, dropped };
}
