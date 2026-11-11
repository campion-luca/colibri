import { addDays, type Day, type DayHistory, type RolloverResult } from '../domain/index.ts';
import { sb } from './client.ts';
import type { Database, Json } from './database.types.ts';
import {
  eventToJson,
  historyToJson,
  ideaToRow,
  itemToRow,
  parseNotif,
  pauseToRow,
  rowToEvent,
  rowToHistory,
  rowToIdea,
  rowToItem,
  rowToPause,
} from './mapping.ts';
import { SyncError, type Bundle, type SyncedState } from './queue.ts';

/* Letture e scritture su Supabase. */

/** Eventi tenuti in locale (il calendario completo li caricherà per mese in F5). */
const EVENTS_DAYS = 7;
const HISTORY_DAYS = 400;

interface ApiError {
  message: string;
  code?: string;
}

/** Rete assente, server giù, troppe richieste o sessione scaduta: errore temporaneo. */
export function toSyncError(error: ApiError, status: number): SyncError {
  const network =
    status === 0 ||
    (typeof navigator !== 'undefined' && !navigator.onLine) ||
    /fetch|network|load failed/i.test(error.message);
  const transient = network || status >= 500 || status === 401 || status === 408 || status === 429;
  return new SyncError(`${error.code ?? status}: ${error.message}`, transient);
}

function check(res: { error: ApiError | null; status: number }): void {
  if (res.error) throw toSyncError(res.error, res.status);
}

/** Invia un pacchetto della coda. Restituisce gli XP del server se c'erano eventi. */
export async function sendBundle(b: Bundle, userId: string): Promise<{ xp: number | null }> {
  const db = sb();
  const now = new Date().toISOString();
  if (b.items?.length) check(await db.from('items').upsert(b.items.map(itemToRow)));
  if (b.deleteItems?.length) {
    check(await db.from('items').update({ deleted_at: now }).in('id', b.deleteItems));
  }
  if (b.ideas?.length) check(await db.from('ideas').upsert(b.ideas.map(ideaToRow)));
  if (b.deleteIdeas?.length) {
    check(await db.from('ideas').update({ deleted_at: now }).in('id', b.deleteIdeas));
  }
  if (b.pauses?.length) check(await db.from('pauses').upsert(b.pauses.map(pauseToRow)));
  if (b.deletePauses?.length) check(await db.from('pauses').delete().in('id', b.deletePauses));
  if (b.notif) {
    check(
      await db
        .from('profiles')
        .update({ notif: b.notif as unknown as Json })
        .eq('id', userId),
    );
  }
  if (b.events?.length) {
    const res = await db.rpc('apply_xp', { evs: b.events.map(eventToJson) });
    check(res);
    return { xp: res.data };
  }
  return { xp: null };
}

export interface Snapshot extends SyncedState {
  xp: number;
  lastDate: Day | null;
  history: Record<Day, DayHistory>;
}

/**
 * Stato fresco dal server. Le non ricorrenti fatte nei giorni passati restano fuori,
 * tranne quelle dall'ultimo `last_date` (servono al rollover per le statistiche).
 */
export async function fetchSnapshot(today: Day): Promise<Snapshot> {
  const db = sb();
  const prof = await db.from('profiles').select('xp, last_date, notif').maybeSingle();
  check(prof);
  if (!prof.data) throw new SyncError('profilo non trovato', true);
  const last = prof.data.last_date;
  const since = last && last < today ? last : today;
  const evSince = last && last < addDays(today, -EVENTS_DAYS) ? last : addDays(today, -EVENTS_DAYS);

  const [items, ideas, pauses, events, hist] = await Promise.all([
    db
      .from('items')
      .select('*')
      .is('deleted_at', null)
      .or(`kind.eq.daily,done.eq.false,done_on.gte.${since}`),
    db.from('ideas').select('*').is('deleted_at', null),
    db.from('pauses').select('*'),
    db.from('events').select('*').gte('day', evSince).order('ts'),
    db.from('day_history').select('*').gte('day', addDays(today, -HISTORY_DAYS)),
  ]);
  for (const r of [items, ideas, pauses, events, hist]) check(r);

  const history: Record<Day, DayHistory> = {};
  for (const h of (hist.data ?? []).map(rowToHistory)) history[h.day] = h;
  return {
    xp: prof.data.xp,
    lastDate: last,
    notif: parseNotif(prof.data.notif),
    items: (items.data ?? []).map(rowToItem),
    ideas: (ideas.data ?? []).map(rowToIdea),
    pauses: (pauses.data ?? []).map(rowToPause),
    events: (events.data ?? []).map(rowToEvent),
    history,
  };
}

export interface RolloverCommit {
  applied: boolean;
  xp: number;
  lastDate: Day | null;
}

/** Applica la mezzanotte calcolata dal client (vedi commit_rollover nella migrazione). */
export async function commitRollover(
  from: Day | null,
  today: Day,
  r: RolloverResult | null,
): Promise<RolloverCommit> {
  const args = {
    // al primo avvio last_date è null: la funzione lo accetta (il tipo generato no)
    p_from: from,
    p_today: today,
    p_events: (r?.events ?? []).map(eventToJson),
    p_items: (r?.changed ?? []).map((i) => ({
      id: i.id,
      promise_date: i.promiseDate,
      due_penalized: i.duePenalized,
    })),
    p_history: (r?.history ?? []).map(historyToJson),
  } as unknown as Database['public']['Functions']['commit_rollover']['Args'];
  const res = await sb().rpc('commit_rollover', args);
  check(res);
  const d = res.data as { applied?: boolean; xp?: number; last_date?: string | null } | null;
  return { applied: d?.applied === true, xp: d?.xp ?? 0, lastDate: d?.last_date ?? null };
}
