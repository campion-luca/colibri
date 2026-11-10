import { COMBO_MS } from './config.ts';
import type { Day, Item } from './types.ts';

/** Task non ricorrenti completate nel giorno. Si azzera a mezzanotte. */
export const strikeCount = (items: readonly Item[], day: Day): number =>
  items.filter((i) => i.kind !== 'daily' && i.done && i.doneOn === day).length;

/** Colore della fiamma: 2–3 normale, 4–5 più rossa e veloce, 6+ blu. */
export const heatOf = (n: number): 1 | 2 | 3 => (n >= 6 ? 3 : n >= 4 ? 2 : 1);

/** Combo sonora: completamenti entro 10 s l'uno dall'altro alzano la nota. */
export const nextCombo = (combo: number, lastAt: number, at: number): number =>
  at - lastAt < COMBO_MS ? combo + 1 : 0;
