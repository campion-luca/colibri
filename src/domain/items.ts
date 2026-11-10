import { addDays, diffDays, toMin } from './date.ts';
import { isScheduled } from './recur.ts';
import type { Day, Item, Now } from './types.ts';

/** Ripetizioni fatte in un giorno. */
export const cntOn = (it: Pick<Item, 'doneOn' | 'doneCount'>, date: Day): number =>
  it.doneOn === date ? it.doneCount : 0;

export const isDone = (it: Item, today: Day): boolean =>
  it.kind === 'daily' ? cntOn(it, today) >= it.times : it.done;

export type DailyState = 'off' | 'soon' | 'active' | 'done' | 'missed';

/**
 * Stato di una ricorrente adesso:
 * off (non prevista oggi) · soon (prima della fascia, bloccata) · active · done · missed.
 */
export function dailyState(it: Item, now: Now): DailyState {
  if (!isScheduled(it, now.day)) return 'off';
  if (cntOn(it, now.day) >= it.times) return 'done';
  if (it.penalizedOn === now.day) return 'missed';
  if (it.window) {
    if (now.minute < toMin(it.window.from)) return 'soon';
    if (now.minute >= toMin(it.window.to)) return 'missed';
  }
  return 'active';
}

/** La fascia di oggi è già chiusa? */
export const windowClosed = (it: Pick<Item, 'window'>, now: Pick<Now, 'minute'>): boolean =>
  !!it.window && now.minute >= toMin(it.window.to);

export const isPromisedFor = (it: Item, day: Day): boolean =>
  it.kind !== 'daily' && it.promiseDate === day;

export const isPromisedToday = (it: Item, today: Day): boolean => isPromisedFor(it, today);

export const isPromisedTomorrow = (it: Item, today: Day): boolean =>
  isPromisedFor(it, addDays(today, 1));

export const isDueToday = (it: Item, today: Day): boolean =>
  it.kind !== 'daily' && !it.done && it.due === today;

/** Giorni alla scadenza (negativo se passata). */
export const dueIn = (it: Item, today: Day): number | null =>
  it.due ? diffDays(today, it.due) : null;

/**
 * Le scadenze mancate tolgono XP solo a task e cose da comprare:
 * "In sospeso" è parcheggiata e non toglie XP (vedi DECISIONI.md).
 */
export const penalizesDue = (it: Pick<Item, 'kind'>): boolean =>
  it.kind === 'todo' || it.kind === 'buy';

/** Le promesse si fanno solo su task e cose da comprare. */
export const canPromise = (it: Pick<Item, 'kind'>): boolean =>
  it.kind === 'todo' || it.kind === 'buy';
