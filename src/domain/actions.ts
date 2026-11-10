import { DAILY_PENALTY } from './config.ts';
import { addDays, toMin } from './date.ts';
import { makeEvent } from './events.ts';
import { fmtDay } from './format.ts';
import { penaltyId } from './ids.ts';
import { canPromise, cntOn, dailyState, isDone, windowClosed } from './items.ts';
import { isPaused, pauseOn } from './pause.ts';
import { isScheduled, nextDate } from './recur.ts';
import { penaltyOf, xpOf } from './xp.ts';
import type {
  Ctx,
  Day,
  Dow,
  Effort,
  HHMM,
  Idea,
  Item,
  Kind,
  Now,
  Pause,
  PauseReason,
  Recur,
  RecurType,
  Times,
  TimeWindow,
  XpEvent,
} from './types.ts';

/* =========================================================
   Spunta
   ========================================================= */

export type ToggleResult =
  | { ok: false; reason: string }
  | { ok: true; action: 'rep' | 'done' | 'undone'; item: Item; event: XpEvent };

/**
 * Tocco sulla casella.
 * Ricorrenti: ogni tocco aggiunge una ripetizione; su una ricorrente completata torna a 0
 * e toglie tutti gli XP del giorno. Non ricorrenti: fatta / non fatta.
 */
export function toggle(it: Item, now: Now, ctx: Ctx): ToggleResult {
  const today = now.day;
  const g = xpOf(it);

  if (it.kind === 'daily') {
    const st = dailyState(it, now);
    if (st === 'off') {
      const nd = nextDate(it, today);
      return { ok: false, reason: nd ? `Prevista ${fmtDay(today, nd)}` : 'Non prevista' };
    }
    if (st === 'soon') {
      return { ok: false, reason: `Si sblocca alle ${it.window?.from ?? ''}` };
    }
    if (st === 'missed') return { ok: false, reason: 'Finestra chiusa per oggi' };

    const c = cntOn(it, today);
    if (st === 'done') {
      const item: Item = { ...it, doneCount: 0, doneOn: null };
      return { ok: true, action: 'undone', item, event: makeEvent(ctx, now, 'undone', it, -g * c) };
    }
    const count = c + 1;
    const item: Item = { ...it, doneOn: today, doneCount: count };
    const complete = count >= it.times;
    const event = makeEvent(ctx, now, complete ? 'done' : 'rep', it, g, { n: count, of: it.times });
    return { ok: true, action: complete ? 'done' : 'rep', item, event };
  }

  if (isDone(it, today)) {
    const back = it.gain ?? g;
    const item: Item = { ...it, done: false, doneOn: null };
    return { ok: true, action: 'undone', item, event: makeEvent(ctx, now, 'undone', it, -back) };
  }
  const item: Item = { ...it, done: true, doneOn: today, gain: g };
  return { ok: true, action: 'done', item, event: makeEvent(ctx, now, 'done', it, g) };
}

/** "− TOGLI UNA": toglie una sola ripetizione di oggi. */
export function removeOneRep(it: Item, now: Now, ctx: Ctx): { item: Item; event: XpEvent } | null {
  if (it.kind !== 'daily') return null;
  const c = cntOn(it, now.day);
  if (c <= 0) return null;
  const count = c - 1;
  const item: Item = { ...it, doneCount: count, doneOn: count ? now.day : null };
  const event = makeEvent(ctx, now, 'undone', it, -xpOf(it), {
    n: count,
    of: it.times,
    single: true,
  });
  return { item, event };
}

/* =========================================================
   Promesse
   ========================================================= */

/** OGGI (0) / DOM (1): imposta la promessa, o la toglie se era già per quel giorno. */
export function togglePromise(
  it: Item,
  when: 0 | 1,
  now: Now,
  ctx: Ctx,
): { item: Item; event: XpEvent; promised: boolean } | null {
  if (!canPromise(it)) return null;
  const target = addDays(now.day, when);
  if (it.promiseDate === target) {
    const item: Item = { ...it, promiseDate: null };
    return {
      item,
      promised: false,
      event: makeEvent(ctx, now, 'unpromised', it, 0, { for: target }),
    };
  }
  const item: Item = { ...it, promiseDate: target };
  return { item, promised: true, event: makeEvent(ctx, now, 'promised', it, 0, { for: target }) };
}

const promiseFor = (kind: Kind, prm: 0 | 1 | null, today: Day): Day | null =>
  (kind === 'todo' || kind === 'buy') && prm !== null ? addDays(today, prm) : null;

/* =========================================================
   Bozza del pannello Aggiungi / Modifica
   ========================================================= */

export interface Draft {
  kind: Kind | 'idea';
  title: string;
  effort: Effort;
  note: string;
  /** promessa: null = nessuna, 0 = oggi, 1 = domani */
  promise: 0 | 1 | null;
  due: Day | null;
  times: Times;
  allDay: boolean;
  from: HHMM;
  to: HHMM;
  recur: { type: RecurType; days: Dow[]; every: number; day: number };
}

export function newDraft(kind: Kind | 'idea', promise: 0 | 1 | null = null): Draft {
  return {
    kind,
    title: '',
    effort: 1,
    note: '',
    promise,
    due: null,
    times: 1,
    allDay: true,
    from: '08:00',
    to: '12:00',
    recur: { type: 'daily', days: [1, 2, 3, 4, 5], every: 2, day: 1 },
  };
}

export function draftFromItem(it: Item, today: Day): Draft {
  const r = it.recur;
  return {
    kind: it.kind,
    title: it.title,
    effort: it.effort,
    note: it.note ?? '',
    promise: it.promiseDate === today ? 0 : it.promiseDate === addDays(today, 1) ? 1 : null,
    due: it.due,
    times: it.times,
    allDay: !it.window,
    from: it.window?.from ?? '08:00',
    to: it.window?.to ?? '12:00',
    recur: {
      type: r.type,
      days: r.type === 'weekly' ? r.days : [1, 2, 3, 4, 5],
      every: r.type === 'interval' ? r.every : 2,
      day: r.type === 'monthly' ? r.day : 1,
    },
  };
}

export function draftFromIdea(idea: Idea): Draft {
  return { ...newDraft('idea'), title: idea.text, effort: 2 };
}

/** Stepper "ogni N giorni": 2–90. */
export const stepEvery = (every: number, delta: number): number =>
  Math.max(2, Math.min(90, every + delta));

/** Stepper "il N del mese": 1–31 ciclico. */
export const stepMonthDay = (day: number, delta: number): number =>
  ((((day - 1 + delta) % 31) + 31) % 31) + 1;

/**
 * Applica ricorrenza, ripetizioni e fascia della bozza a una ricorrente.
 * Se la fascia di oggi è già chiusa, oggi non si penalizza.
 */
export function applyDaily(it: Item, d: Draft, now: Now): Item {
  const r = d.recur;
  let recur: Recur;
  if (r.type === 'weekly' && r.days.length > 0 && r.days.length < 7) {
    recur = { type: 'weekly', days: [...r.days].sort((a, b) => a - b) };
  } else if (r.type === 'interval') {
    const keep = it.recur.type === 'interval' && it.recur.every === r.every;
    recur = {
      type: 'interval',
      every: r.every,
      start: keep && it.recur.type === 'interval' ? it.recur.start : now.day,
    };
  } else if (r.type === 'monthly') {
    recur = { type: 'monthly', day: r.day };
  } else {
    recur = { type: 'daily' };
  }

  let window: TimeWindow | null = null;
  if (!d.allDay) {
    // fascia nello stesso giorno: se "alle" non è dopo "dalle", finisce a mezzanotte
    window = { from: d.from, to: toMin(d.to) <= toMin(d.from) ? '23:59' : d.to };
  }

  const next: Item = {
    ...it,
    times: d.times,
    recur,
    window,
    doneCount: Math.min(it.doneCount, d.times),
  };
  const closed = windowClosed(next, now);
  if (closed && cntOn(next, now.day) < next.times) next.penalizedOn = now.day;
  else if (next.penalizedOn === now.day && !closed) next.penalizedOn = null;
  return next;
}

export type Created =
  { type: 'item'; item: Item; event: XpEvent } | { type: 'idea'; idea: Idea; event: XpEvent };

/** Nuovo elemento dal pannello. `null` se il titolo è vuoto. */
export function createFromDraft(d: Draft, now: Now, ctx: Ctx, position: number): Created | null {
  const title = d.title.trim();
  if (!title) return null;
  if (d.kind === 'idea') {
    const idea: Idea = { id: ctx.newId(), text: title, position, createdOn: now.day };
    return { type: 'idea', idea, event: makeEvent(ctx, now, 'created', idea) };
  }
  const item = buildItem(ctx.newId(), d.kind, title, d, now, position);
  return { type: 'item', item, event: makeEvent(ctx, now, 'created', item) };
}

function buildItem(
  id: string,
  kind: Kind,
  title: string,
  d: Draft,
  now: Now,
  position: number,
): Item {
  const item: Item = {
    id,
    kind,
    title,
    note: d.note.trim() || null,
    effort: kind === 'buy' ? 1 : d.effort,
    position,
    createdOn: now.day,
    recur: { type: 'daily' },
    times: 1,
    window: null,
    doneCount: 0,
    penalizedOn: null,
    done: false,
    gain: null,
    promiseDate: promiseFor(kind, d.promise, now.day),
    due: kind === 'daily' ? null : d.due,
    duePenalized: null,
    doneOn: null,
  };
  return kind === 'daily' ? applyDaily(item, d, now) : item;
}

export type Edited =
  | { type: 'item'; item: Item; event: XpEvent }
  | { type: 'toIdea'; idea: Idea; removedItemId: string; event: XpEvent };

/** Salva le modifiche a un elemento, anche cambiando tipo. `null` se il titolo è vuoto. */
export function editFromDraft(
  it: Item,
  d: Draft,
  now: Now,
  ctx: Ctx,
  ideaPosition: number,
): Edited | null {
  const title = d.title.trim();
  if (!title) return null;
  const today = now.day;

  if (d.kind === 'idea') {
    const idea: Idea = { id: it.id, text: title, position: ideaPosition, createdOn: it.createdOn };
    return {
      type: 'toIdea',
      idea,
      removedItemId: it.id,
      event: makeEvent(ctx, now, 'edited', idea),
    };
  }

  const kind = d.kind;
  const wasDone = isDone(it, today);
  let next: Item = {
    ...it,
    title,
    effort: kind === 'buy' ? 1 : d.effort,
    note: d.note.trim() || null,
  };
  if (it.kind !== kind) {
    if (kind === 'daily') {
      next = { ...next, done: false, gain: null, doneOn: wasDone ? today : null };
      next.doneCount = wasDone ? d.times : 0;
    } else if (it.kind === 'daily') {
      next = { ...next, done: wasDone, doneOn: wasDone ? today : null, doneCount: 0, gain: null };
    }
    next.kind = kind;
  }
  next.promiseDate = promiseFor(kind, d.promise, today);
  if (kind === 'daily') {
    next = applyDaily({ ...next, due: null, duePenalized: null }, d, now);
  } else {
    if (it.due !== d.due) next.duePenalized = null;
    next.due = d.due;
  }
  return { type: 'item', item: next, event: makeEvent(ctx, now, 'edited', next) };
}

/* =========================================================
   Idee
   ========================================================= */

export function createIdea(
  text: string,
  now: Now,
  ctx: Ctx,
  position: number,
): { idea: Idea; event: XpEvent } | null {
  const t = text.trim();
  if (!t) return null;
  const idea: Idea = { id: ctx.newId(), text: t, position, createdOn: now.day };
  return { idea, event: makeEvent(ctx, now, 'created', idea) };
}

export type IdeaEdited =
  | { type: 'idea'; idea: Idea; event: XpEvent }
  | { type: 'toItem'; item: Item; removedIdeaId: string; event: XpEvent };

/** Salva un'idea dal pannello: resta idea o diventa un elemento con lo stesso id. */
export function editIdeaFromDraft(
  idea: Idea,
  d: Draft,
  now: Now,
  ctx: Ctx,
  position: number,
): IdeaEdited | null {
  const title = d.title.trim();
  if (!title) return null;
  if (d.kind === 'idea') {
    const next: Idea = { ...idea, text: title };
    return { type: 'idea', idea: next, event: makeEvent(ctx, now, 'edited', next) };
  }
  const item = buildItem(idea.id, d.kind, title, d, now, position);
  return {
    type: 'toItem',
    item,
    removedIdeaId: idea.id,
    event: makeEvent(ctx, now, 'edited', item),
  };
}

/** "→ TASK": l'idea diventa una task Breve. */
export function ideaToTask(
  idea: Idea,
  now: Now,
  ctx: Ctx,
  position: number,
): { item: Item; removedIdeaId: string; event: XpEvent } {
  const d: Draft = { ...newDraft('todo'), effort: 2 };
  const item = buildItem(ctx.newId(), 'todo', idea.text.slice(0, 80), d, now, position);
  return { item, removedIdeaId: idea.id, event: makeEvent(ctx, now, 'created', item) };
}

/* =========================================================
   Eliminazione (soft delete) e ripristino
   ========================================================= */

export const deletedEvent = (subject: Item | Idea, now: Now, ctx: Ctx): XpEvent =>
  makeEvent(ctx, now, 'deleted', subject);

export const restoredEvent = (subject: Item | Idea, now: Now, ctx: Ctx): XpEvent =>
  makeEvent(ctx, now, 'restored', subject);

/* =========================================================
   Fasce orarie: alla chiusura le ripetizioni mancanti si pagano subito
   ========================================================= */

export function checkWindows(
  items: readonly Item[],
  pauses: readonly Pause[],
  now: Now,
  ctx: Ctx,
): { items: Item[]; events: XpEvent[] } {
  const today = now.day;
  const out = { items: [] as Item[], events: [] as XpEvent[] };
  if (isPaused(pauses, today)) return out;
  for (const it of items) {
    if (!isScheduled(it, today) || !it.window || it.penalizedOn === today) continue;
    if (!windowClosed(it, now)) continue;
    const miss = it.times - cntOn(it, today);
    if (miss <= 0) continue;
    out.items.push({ ...it, penalizedOn: today });
    out.events.push({
      ...makeEvent(ctx, now, 'penalty', it, -miss * penaltyOf(it, DAILY_PENALTY), {
        why: 'finestra',
        on: today,
        miss,
      }),
      id: penaltyId(ctx.userId, today, it.id, 'finestra'),
    });
  }
  return out;
}

/* =========================================================
   Pausa
   ========================================================= */

export function startPause(
  opts: { reason: PauseReason; until: Day | null },
  now: Now,
  ctx: Ctx,
): { pause: Pause; event: XpEvent } {
  const pause: Pause = {
    id: ctx.newId(),
    fromDay: now.day,
    untilDay: opts.until,
    reason: opts.reason,
  };
  const event = makeEvent(ctx, now, 'pause', null, 0, { reason: opts.reason, until: opts.until });
  return { pause, event };
}

export type PauseOp = { kind: 'delete'; id: string } | { kind: 'update'; pause: Pause };

/**
 * "Riprendi ora": la pausa finisce ieri (o sparisce se iniziata oggi).
 * Le fasce di oggi già chiuse non vengono penalizzate.
 */
export function resumePause(
  pauses: readonly Pause[],
  items: readonly Item[],
  now: Now,
  ctx: Ctx,
): { op: PauseOp; items: Item[]; event: XpEvent } | null {
  const today = now.day;
  const p = pauseOn(pauses, today);
  if (!p) return null;
  const op: PauseOp =
    p.fromDay === today
      ? { kind: 'delete', id: p.id }
      : { kind: 'update', pause: { ...p, untilDay: addDays(today, -1) } };
  const changed = items
    .filter((i) => isScheduled(i, today) && windowClosed(i, now) && i.penalizedOn !== today)
    .map((i) => ({ ...i, penalizedOn: today }));
  return {
    op,
    items: changed,
    event: makeEvent(ctx, now, 'resume', null, 0, { reason: p.reason }),
  };
}
