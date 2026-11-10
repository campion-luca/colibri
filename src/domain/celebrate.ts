import { dailyState, isDone } from './items.ts';
import { todayList } from './selectors.ts';
import type { Item, Kind, Now } from './types.ts';

/** Tutte le ricorrenti previste sono chiuse (le scadute non bloccano) e almeno una è fatta. */
export function dailiesComplete(items: readonly Item[], now: Now): boolean {
  const states = items
    .filter((i) => i.kind === 'daily')
    .map((i) => dailyState(i, now))
    .filter((s) => s !== 'off');
  return (
    states.length > 0 &&
    states.every((s) => s === 'done' || s === 'missed') &&
    states.some((s) => s === 'done')
  );
}

/** Promesse e scadenze di oggi tutte fatte (e ce n'era almeno una). */
export function promisesComplete(items: readonly Item[], now: Now): boolean {
  const t = now.day;
  const list = todayList(items, t);
  return (
    list.length > 0 &&
    list.some((i) => i.promiseDate === t || i.due === t) &&
    list.every((i) => isDone(i, t))
  );
}

export interface DayCompletion {
  d: boolean;
  p: boolean;
}

export const completion = (items: readonly Item[], now: Now): DayCompletion => ({
  d: dailiesComplete(items, now),
  p: promisesComplete(items, now),
});

export type Celebration = 'daily' | 'promise' | 'perfect';

/** Festeggia solo il passaggio "non completo → completo" della sezione toccata. */
export function celebrationFor(
  before: DayCompletion,
  after: DayCompletion,
  kind: Kind,
): Celebration | null {
  const justD = kind === 'daily' && after.d && !before.d;
  const justP = kind !== 'daily' && after.p && !before.p;
  if (!justD && !justP) return null;
  if (after.d && after.p) return 'perfect';
  return justD ? 'daily' : 'promise';
}
