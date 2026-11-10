import { addDays } from './date.ts';
import type { Day, Pause } from './types.ts';

export const pauseOn = (pauses: readonly Pause[], day: Day): Pause | undefined =>
  pauses.find((p) => day >= p.fromDay && (p.untilDay === null || day <= p.untilDay));

export const isPaused = (pauses: readonly Pause[], day: Day): boolean => !!pauseOn(pauses, day);

/** Ultimo giorno di pausa per una durata in giorni a partire da oggi (0 = senza fine). */
export const pauseUntil = (today: Day, len: number): Day | null =>
  len === 0 ? null : addDays(today, len - 1);
