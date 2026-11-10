import {
  addDays as dfAddDays,
  addMonths as dfAddMonths,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  getISODay,
} from 'date-fns';
import type { Day, Dow, HHMM, Month } from './types.ts';

/*
 * Aritmetica sui giorni di calendario. I giorni sono stringhe `YYYY-MM-DD` già riferite
 * a Europe/Rome: qui non c'è fuso orario. Si lavora a mezzogiorno locale per non cadere
 * mai in un buco dell'ora legale.
 */
const at = (day: Day) => new Date(`${day}T12:00:00`);
const fmt = (d: Date): Day => format(d, 'yyyy-MM-dd');

export const pad = (n: number) => String(n).padStart(2, '0');

export const addDays = (day: Day, n: number): Day => fmt(dfAddDays(at(day), n));

/** giorni da `a` a `b` (positivo se `b` è dopo `a`) */
export const diffDays = (a: Day, b: Day): number => differenceInCalendarDays(at(b), at(a));

export const dowOf = (day: Day): Dow => getISODay(at(day)) as Dow;

export const daysInMonth = (day: Day): number => getDaysInMonth(at(day));

export const dayOfMonth = (day: Day): number => Number(day.slice(8, 10));

export const monthOf = (day: Day): Month => day.slice(0, 7);

export const addMonths = (month: Month, n: number): Month =>
  format(dfAddMonths(at(`${month}-01`), n), 'yyyy-MM');

/** `dd/mm` */
export const ddmm = (day: Day): string => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** `HH:MM` → minuti dalla mezzanotte */
export const toMin = (h: HHMM): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
