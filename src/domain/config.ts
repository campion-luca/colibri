import type { Effort, NotifSettings } from './types.ts';

/* =========================================================
   CONFIG — valori presi dalla bozza
   ========================================================= */

export const EFFORT: Record<Effort, { n: string; t: string; xp: number }> = {
  1: { n: 'Veloce', t: "≤5'", xp: 5 },
  2: { n: 'Breve', t: "~15'", xp: 10 },
  3: { n: 'Seria', t: "~45'", xp: 25 },
  4: { n: 'Boss', t: '1h+', xp: 50 },
};

export const BUY_XP = 5;
/** promessa non mantenuta */
export const PROMISE_PENALTY = 1.5;
/** ripetizione di ricorrente mancata */
export const DAILY_PENALTY = 1;
/** scadenza mancata (non si somma alla promessa dello stesso giorno) */
export const DUE_PENALTY = 1;
/** giorni di assenza penalizzati al massimo */
export const MAX_MISSED_DAYS = 7;
/** da "Seria" in su si completa tenendo premuto */
export const HOLD_FROM_EFFORT = 3;
export const HOLD_MS = 750;
/** strike dalla 2ª task non ricorrente fatta in giornata */
export const STRIKE_FROM = 2;
/** ultima ora della fascia: "scade tra Nm" in rosso */
export const URGENT_MIN = 60;
/** completamenti entro 10 s alzano la nota */
export const COMBO_MS = 10_000;

export const RANKS = [
  { n: 'Uovo', min: 0 },
  { n: 'Pulcino', min: 100 },
  { n: 'Passero', min: 300 },
  { n: 'Rondine', min: 700 },
  { n: 'Falco', min: 1500 },
  { n: 'Colibrì', min: 3000 },
] as const;
export type Rank = (typeof RANKS)[number];

export const TZ = 'Europe/Rome';

/** notifica "inizio fascia": entro 30 min dall'apertura */
export const START_NOTIF_WINDOW_MIN = 30;
/** notifica scadenze: dalle 9:00 */
export const DUE_NOTIF_AT_MIN = 9 * 60;

export const DEFAULT_NOTIF: NotifSettings = {
  start: true,
  due: true,
  evening: true,
  eveningAt: '21:30',
  morning: true,
};
