import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { TZ } from './config.ts';
import { addDays, pad, toMin } from './date.ts';
import type { Day, HHMM, Now } from './types.ts';

/** Converte un istante nel giorno e nel minuto di Europe/Rome. */
export function nowIn(date: Date, tz: string = TZ): Now {
  return {
    day: formatInTimeZone(date, tz, 'yyyy-MM-dd'),
    minute: toMin(formatInTimeZone(date, tz, 'HH:mm')),
    ts: date.getTime(),
  };
}

/** Istante (epoch ms) della mezzanotte che apre `day` a Roma. */
export function startOfDayTs(day: Day, tz: string = TZ): number {
  return fromZonedTime(`${day}T00:00:00`, tz).getTime();
}

/** Millisecondi alla prossima mezzanotte di Roma (gestisce i giorni da 23 e 25 ore). */
export function msToMidnight(date: Date, tz: string = TZ): number {
  const day = formatInTimeZone(date, tz, 'yyyy-MM-dd');
  return startOfDayTs(addDays(day, 1), tz) - date.getTime();
}

/** "3h 07m" */
export function formatLeft(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  return `${Math.floor(mins / 60)}h ${pad(mins % 60)}m`;
}

/** Ora `HH:MM` di un timestamp, a Roma. */
export function timeOf(ts: number, tz: string = TZ): HHMM {
  return formatInTimeZone(new Date(ts), tz, 'HH:mm');
}
