import type {
  DayHistory,
  Dow,
  Effort,
  EventMeta,
  EventType,
  Idea,
  Item,
  Kind,
  NotifSettings,
  Pause,
  PauseReason,
  Recur,
  Times,
  XpEvent,
} from '../domain/index.ts';
import { DEFAULT_NOTIF } from '../domain/index.ts';
import type { Json, Tables, TablesInsert } from './database.types.ts';

/* Righe del database ↔ oggetti del dominio. */

const KINDS: readonly Kind[] = ['daily', 'todo', 'buy', 'hold'];
const REASONS: readonly PauseReason[] = ['Ferie', 'Malattia', 'Altro'];

const asKind = (k: string): Kind =>
  (KINDS as readonly string[]).includes(k) ? (k as Kind) : 'todo';
const asEffort = (e: number): Effort => (e >= 1 && e <= 4 ? (e as Effort) : 1);
const asTimes = (t: number): Times => (t >= 1 && t <= 3 ? (t as Times) : 1);
const hhmm = (t: string | null): string | null => (t ? t.slice(0, 5) : null);
const isObj = (j: Json | null | undefined): j is Record<string, Json | undefined> =>
  typeof j === 'object' && j !== null && !Array.isArray(j);

export function parseRecur(j: Json): Recur {
  if (!isObj(j)) return { type: 'daily' };
  const { type } = j;
  if (type === 'weekly' && Array.isArray(j.days)) {
    const days = j.days.filter(
      (d): d is number => typeof d === 'number' && d >= 1 && d <= 7,
    ) as Dow[];
    return days.length ? { type: 'weekly', days } : { type: 'daily' };
  }
  if (type === 'interval' && typeof j.every === 'number' && typeof j.start === 'string') {
    return { type: 'interval', every: j.every, start: j.start };
  }
  if (type === 'monthly' && typeof j.day === 'number') return { type: 'monthly', day: j.day };
  return { type: 'daily' };
}

export function itemToRow(it: Item): TablesInsert<'items'> {
  return {
    id: it.id,
    kind: it.kind,
    title: it.title,
    note: it.note,
    effort: it.effort,
    position: it.position,
    created_on: it.createdOn,
    recur: it.recur,
    times: it.times,
    window_from: it.window?.from ?? null,
    window_to: it.window?.to ?? null,
    done_on: it.doneOn,
    done_count: it.doneCount,
    penalized_on: it.penalizedOn,
    done: it.done,
    gain: it.gain,
    promise_date: it.promiseDate,
    due: it.due,
    due_time: it.dueTime,
    due_penalized: it.duePenalized,
    // un elemento vivo non è eliminato: così l'upsert fa anche da ripristino
    deleted_at: null,
  };
}

export function rowToItem(r: Tables<'items'>): Item {
  const from = hhmm(r.window_from);
  const to = hhmm(r.window_to);
  return {
    id: r.id,
    kind: asKind(r.kind),
    title: r.title,
    note: r.note,
    effort: asEffort(r.effort),
    position: r.position,
    createdOn: r.created_on,
    recur: parseRecur(r.recur),
    times: asTimes(r.times),
    window: from && to ? { from, to } : null,
    doneCount: r.done_count,
    penalizedOn: r.penalized_on,
    done: r.done,
    gain: r.gain,
    promiseDate: r.promise_date,
    due: r.due,
    dueTime: hhmm(r.due_time),
    duePenalized: r.due_penalized,
    doneOn: r.done_on,
  };
}

export function ideaToRow(d: Idea): TablesInsert<'ideas'> {
  return {
    id: d.id,
    text: d.text,
    position: d.position,
    created_on: d.createdOn,
    deleted_at: null,
  };
}

export const rowToIdea = (r: Tables<'ideas'>): Idea => ({
  id: r.id,
  text: r.text,
  position: r.position,
  createdOn: r.created_on,
});

export const pauseToRow = (p: Pause): TablesInsert<'pauses'> => ({
  id: p.id,
  from_day: p.fromDay,
  until_day: p.untilDay,
  reason: p.reason,
});

export const rowToPause = (r: Tables<'pauses'>): Pause => ({
  id: r.id,
  fromDay: r.from_day,
  untilDay: r.until_day,
  reason: (REASONS as readonly string[]).includes(r.reason) ? (r.reason as PauseReason) : 'Altro',
});

/** Evento come lo leggono `apply_xp` e `commit_rollover`. */
export const eventToJson = (e: XpEvent): Json => ({
  id: e.id,
  ts: new Date(e.ts).toISOString(),
  day: e.day,
  type: e.type,
  item_id: e.itemId,
  title: e.title,
  kind: e.kind,
  xp: e.xp,
  meta: e.meta as Json,
});

export const rowToEvent = (r: Tables<'events'>): XpEvent => ({
  id: r.id,
  ts: Date.parse(r.ts),
  day: r.day,
  type: r.type as EventType,
  itemId: r.item_id,
  title: r.title ?? '',
  kind: r.kind as XpEvent['kind'],
  xp: r.xp,
  meta: (r.meta ?? null) as EventMeta | null,
});

export const historyToJson = (h: DayHistory): Json => ({
  day: h.day,
  gained: h.gained,
  lost: h.lost,
  net: h.net,
  reps: h.reps,
  reps_done: h.repsDone,
  prom: h.prom,
  prom_kept: h.promKept,
  done: h.done,
  undone: h.undone,
  deleted: h.deleted,
  created: h.created,
  paused: h.paused,
});

export const rowToHistory = (r: Tables<'day_history'>): DayHistory => ({
  day: r.day,
  gained: r.gained,
  lost: r.lost,
  net: r.net,
  reps: r.reps,
  repsDone: r.reps_done,
  prom: r.prom,
  promKept: r.prom_kept,
  done: r.done,
  undone: r.undone,
  deleted: r.deleted,
  created: r.created,
  paused: r.paused,
});

export function parseNotif(j: Json): NotifSettings {
  if (!isObj(j)) return { ...DEFAULT_NOTIF };
  const b = (k: keyof NotifSettings, d: boolean) => {
    const v = j[k];
    return typeof v === 'boolean' ? v : d;
  };
  return {
    start: b('start', DEFAULT_NOTIF.start),
    due: b('due', DEFAULT_NOTIF.due),
    evening: b('evening', DEFAULT_NOTIF.evening),
    eveningAt: typeof j.eveningAt === 'string' ? j.eveningAt : DEFAULT_NOTIF.eveningAt,
    morning: b('morning', DEFAULT_NOTIF.morning),
  };
}
