import { DAILY_PENALTY, DUE_PENALTY, PROMISE_PENALTY } from './config.ts';
import { cntOn, dailyState, isDueToday, penalizesDue } from './items.ts';
import { isPaused } from './pause.ts';
import { penaltyOf } from './xp.ts';
import type { Item, Now, Pause } from './types.ts';

/** XP che si perderebbero a mezzanotte se non si fa più niente. 0 durante una pausa. */
export function riskAt(items: readonly Item[], pauses: readonly Pause[], now: Now): number {
  const t = now.day;
  if (isPaused(pauses, t)) return 0;
  let risk = 0;
  for (const i of items) {
    if (i.kind === 'daily') {
      const st = dailyState(i, now);
      if (st === 'active' || st === 'soon') {
        risk += (i.times - cntOn(i, t)) * penaltyOf(i, DAILY_PENALTY);
      }
    } else if (i.promiseDate === t && !i.done) {
      risk += penaltyOf(i, PROMISE_PENALTY);
    } else if (isDueToday(i, t) && penalizesDue(i)) {
      // scadenza senza promessa (con la promessa conta solo quella)
      risk += penaltyOf(i, DUE_PENALTY);
    }
  }
  return risk;
}
