import { addDays } from './date.ts';
import { dailyState, isDone, type DailyState } from './items.ts';
import { nextDate } from './recur.ts';
import type { Day, Idea, Item, Kind, Now } from './types.ts';

/*
 * Cosa mostrare e in che ordine. L'ordine è quello manuale (`position`); l'unico
 * ordinamento automatico è per stato: da fare sopra, fatte/scadute sotto.
 */

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

const GROUP: Record<DailyState, number> = { active: 0, soon: 0, off: 0, done: 1, missed: 1 };

/** Ricorrenti previste oggi. */
export function todayDailies(items: readonly Item[], now: Now): Item[] {
  return items
    .filter((i) => i.kind === 'daily' && dailyState(i, now) !== 'off')
    .sort((a, b) => GROUP[dailyState(a, now)] - GROUP[dailyState(b, now)] || byPosition(a, b));
}

/**
 * "Non previste oggi": per prossima data, come nella bozza. Lì non si può fare niente
 * e serve vedere cosa arriva prima (niente riordino manuale).
 */
export function offToday(items: readonly Item[], now: Now): Item[] {
  return items
    .filter((i) => i.kind === 'daily' && dailyState(i, now) === 'off')
    .map((i) => ({ i, next: nextDate(i, now.day) ?? '9999-12-31' }))
    .sort((a, b) => a.next.localeCompare(b.next) || byPosition(a.i, b.i))
    .map(({ i }) => i);
}

const doneLast = (today: Day) => (a: Item, b: Item) =>
  Number(isDone(a, today)) - Number(isDone(b, today)) || byPosition(a, b);

/** "Promesse e scadenze": promesse di oggi, scadenze di oggi, fatte oggi. */
export function todayList(items: readonly Item[], today: Day): Item[] {
  return items
    .filter(
      (i) =>
        i.kind !== 'daily' &&
        (i.promiseDate === today || i.due === today || (i.done && i.doneOn === today)),
    )
    .sort(doneLast(today));
}

/** "Promesse per domani". */
export function tomorrowList(items: readonly Item[], today: Day): Item[] {
  const tomorrow = addDays(today, 1);
  return items
    .filter((i) => i.kind !== 'daily' && !i.done && i.promiseDate === tomorrow)
    .sort(byPosition);
}

/** Liste per tipo: da fare + fatte oggi. */
export function listItems(
  items: readonly Item[],
  kind: Exclude<Kind, 'daily'>,
  today: Day,
): Item[] {
  return items
    .filter((i) => i.kind === kind && (!i.done || i.doneOn === today))
    .sort(doneLast(today));
}

export const sortedIdeas = (ideas: readonly Idea[]): Idea[] => [...ideas].sort(byPosition);
