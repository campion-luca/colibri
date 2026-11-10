import { addDays, dayOfMonth, daysInMonth, diffDays, dowOf } from './date.ts';
import type { Day, Item } from './types.ts';

type Recurring = Pick<Item, 'kind' | 'createdOn' | 'recur'>;

/** La ricorrente è prevista in quel giorno? */
export function isScheduled(it: Recurring, date: Day): boolean {
  if (it.kind !== 'daily') return false;
  if (date < it.createdOn) return false;
  const r = it.recur;
  switch (r.type) {
    case 'weekly':
      return r.days.includes(dowOf(date));
    case 'interval': {
      const n = diffDays(r.start, date);
      return n >= 0 && n % r.every === 0;
    }
    case 'monthly':
      // se il mese è più corto vale l'ultimo giorno
      return Math.min(r.day, daysInMonth(date)) === dayOfMonth(date);
    case 'daily':
      return true;
  }
}

/** Prossimo giorno previsto dopo `from` (escluso), entro 400 giorni. */
export function nextDate(it: Recurring, from: Day): Day | null {
  for (let k = 1; k <= 400; k++) {
    const d = addDays(from, k);
    if (isScheduled(it, d)) return d;
  }
  return null;
}
