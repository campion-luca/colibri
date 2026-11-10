import { DAILY_PENALTY, DUE_PENALTY, MAX_MISSED_DAYS, PROMISE_PENALTY } from './config.ts';
import { addDays, diffDays } from './date.ts';
import { countOn, gainedOn } from './events.ts';
import { penaltyLine } from './format.ts';
import { penaltyId } from './ids.ts';
import { cntOn, penalizesDue } from './items.ts';
import { isPaused, pauseOn } from './pause.ts';
import { isScheduled } from './recur.ts';
import { strikeCount } from './strike.ts';
import { applyEvents, penaltyOf, rankIndex } from './xp.ts';
import type {
  Ctx,
  Day,
  DayHistory,
  EventMeta,
  Item,
  Pause,
  PenaltyReason,
  Report,
  XpEvent,
} from './types.ts';

export interface RolloverInput {
  xp: number;
  lastDate: Day | null;
  items: readonly Item[];
  pauses: readonly Pause[];
  /** almeno gli eventi del giorno `lastDate` (guadagni, conteggi, penalità già prese) */
  events: readonly XpEvent[];
}

export interface RolloverResult {
  /** il `last_date` precedente */
  from: Day;
  today: Day;
  xp: number;
  /** lista aggiornata, senza le non ricorrenti fatte nei giorni passati */
  items: Item[];
  /** elementi modificati (promessa tolta, scadenza segnata), archiviati compresi */
  changed: Item[];
  /** non ricorrenti fatte nei giorni passati: spariscono dalle liste, restano nello storico */
  archivedIds: string[];
  /**
   * Penalità nuove, con id deterministici. `day` è il giorno a cui si riferiscono,
   * `ts` il momento in cui sono state applicate.
   */
  events: XpEvent[];
  /** una riga per `from` e per ogni altro giorno che ha ricevuto penalità, in ordine */
  history: DayHistory[];
  report: Report;
}

/**
 * La mezzanotte. Da chiamare all'apertura se `lastDate < today`.
 * Restituisce `null` se non c'è niente da fare (primo avvio o già fatto oggi): così è
 * idempotente anche lato client. `ts` è l'istante in cui si applica.
 */
export function rollover(
  input: RolloverInput,
  today: Day,
  ctx: Pick<Ctx, 'userId'>,
  ts: number,
): RolloverResult | null {
  const prev = input.lastDate;
  if (!prev || prev >= today) return null;

  const { items, pauses } = input;
  const days = diffDays(prev, today);
  const nonDaily = items.filter((i) => i.kind !== 'daily');

  // — 1. giorni penalizzati: al massimo 7, saltando quelli in pausa
  const penDays = new Set<Day>();
  for (let d = 0; d < Math.min(days, MAX_MISSED_DAYS); d++) {
    const date = addDays(prev, d);
    if (!isPaused(pauses, date)) penDays.add(date);
  }

  const events: XpEvent[] = [];
  const penalize = (
    it: Item,
    on: Day,
    why: PenaltyReason,
    xp: number,
    extra: EventMeta = {},
  ): void => {
    events.push({
      id: penaltyId(ctx.userId, on, it.id, why),
      ts,
      day: on,
      type: 'penalty',
      itemId: it.id,
      title: it.title,
      kind: it.kind,
      xp,
      meta: { why, on, ...extra },
    });
  };

  const patched = new Map<string, Item>();
  const current = (it: Item): Item => patched.get(it.id) ?? it;
  const patch = (it: Item, p: Partial<Item>): void => {
    patched.set(it.id, { ...current(it), ...p });
  };

  // ripetizioni mancanti delle ricorrenti previste e non già pagate alla chiusura della fascia
  for (const date of penDays) {
    for (const it of items) {
      if (!isScheduled(it, date) || it.penalizedOn === date) continue;
      const miss = it.times - cntOn(it, date);
      if (miss > 0)
        penalize(it, date, 'mezzanotte', -miss * penaltyOf(it, DAILY_PENALTY), { miss });
    }
  }

  // promesse: si paga ogni promessa non mantenuta caduta in un giorno penalizzato;
  // poi si tolgono tutte le promesse con data passata, anche le più vecchie
  for (const it of nonDaily) {
    const pd = it.promiseDate;
    if (!pd || pd >= today) continue;
    if (!it.done && penDays.has(pd)) {
      penalize(it, pd, 'promessa', -penaltyOf(it, PROMISE_PENALTY));
      // promessa e scadenza nello stesso giorno: una sola penalità, quella della promessa
      if (it.due === pd) patch(it, { duePenalized: pd });
    }
    patch(it, { promiseDate: null });
  }

  // scadenze tra il giorno precedente e ieri non fatte: una sola volta
  for (const orig of nonDaily) {
    const it = current(orig);
    const due = it.due;
    if (it.done || !due || due < prev || due >= today || it.duePenalized === due) continue;
    if (penalizesDue(it) && !isPaused(pauses, due)) {
      penalize(it, due, 'scadenza', -penaltyOf(it, DUE_PENALTY));
    }
    patch(it, { duePenalized: due });
  }

  // — 2. pulizia
  const merged = items.map(current);
  const archivedIds = merged
    .filter((i) => i.kind !== 'daily' && i.done && i.doneOn !== null && i.doneOn < today)
    .map((i) => i.id);
  const archived = new Set(archivedIds);
  const kept = merged.filter((i) => !archived.has(i.id));

  // — 3. storico: statistiche di ogni giorno toccato, calcolate sullo stato prima della pulizia
  const statsFor = (d: Day): DayHistory => {
    const sched = items.filter((i) => isScheduled(i, d));
    const promised = nonDaily.filter((i) => i.promiseDate === d);
    const dayEvents = input.events.filter((e) => e.day === d);
    const gained = gainedOn(dayEvents, d);
    const lost = [...dayEvents.filter((e) => e.type === 'penalty'), ...events]
      .filter((e) => e.day === d)
      .reduce((a, e) => a + e.xp, 0);
    return {
      day: d,
      gained,
      lost,
      net: gained + lost,
      reps: sched.reduce((a, i) => a + i.times, 0),
      repsDone: sched.reduce((a, i) => a + Math.min(i.times, cntOn(i, d)), 0),
      prom: promised.length,
      promKept: promised.filter((i) => i.done && i.doneOn === d).length,
      done: countOn(dayEvents, d, ['done']),
      undone: countOn(dayEvents, d, ['undone']),
      deleted: countOn(dayEvents, d, ['deleted']),
      created: countOn(dayEvents, d, ['created']),
      paused: isPaused(pauses, d),
    };
  };
  const touched = [...new Set([prev, ...events.map((e) => e.day)])].sort();
  const history = touched.map(statsFor);
  const last = history[0] ?? statsFor(prev);

  // — 4. report del mattino: il giorno precedente + tutte le penalità di questo rollover
  const earlier = input.events.filter((e) => e.day === prev && e.type === 'penalty');
  const allLost = [...earlier, ...events];
  const lostTot = allLost.reduce((a, e) => a + e.xp, 0);
  const xp = applyEvents(input.xp, events);

  const report: Report = {
    date: prev,
    days,
    gained: last.gained,
    lost: allLost.map((e) => ({ title: penaltyLine(e, days > 1), xp: e.xp })),
    lostTot,
    net: last.gained + lostTot,
    reps: last.reps,
    repsDone: last.repsDone,
    prom: last.prom,
    promKept: last.promKept,
    strike: strikeCount(items, prev),
    ev: { done: last.done, undone: last.undone, deleted: last.deleted, created: last.created },
    tomorrowPromised: kept.filter((i) => i.kind !== 'daily' && i.promiseDate === today).length,
    paused: pauseOn(pauses, prev)?.reason ?? null,
    rankBefore: rankIndex(input.xp),
    rankAfter: rankIndex(xp),
  };

  return {
    from: prev,
    today,
    xp,
    items: kept,
    changed: [...patched.values()],
    archivedIds,
    events,
    history,
    report,
  };
}
