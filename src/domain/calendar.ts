import { dowOf, daysInMonth, pad } from './date.ts';
import { isPaused } from './pause.ts';
import type { Day, DayHistory, EventType, Item, Month, Pause, XpEvent } from './types.ts';

/** Scadenze del giorno (non ricorrenti). */
export const dueOn = (items: readonly Item[], date: Day): Item[] =>
  items.filter((i) => i.kind !== 'daily' && i.due === date);

/** Promesse del giorno che non sono anche scadenze dello stesso giorno. */
export const promOn = (items: readonly Item[], date: Day): Item[] =>
  items.filter((i) => i.kind !== 'daily' && i.promiseDate === date && i.due !== date);

export interface CalCell {
  date: Day;
  n: number;
  /** scadenze aperte */
  open: number;
  /** intensità del colore: 0, 1, 2, 3+ scadenze aperte */
  heat: 0 | 1 | 2 | 3;
  /** quadratino: c'è una promessa aperta */
  promise: boolean;
  /** bordo rosso: giorno passato con scadenze non fatte */
  late: boolean;
  past: boolean;
  today: boolean;
  paused: boolean;
  /** saldo XP dei giorni passati (null se manca o era in pausa) */
  net: number | null;
}

export interface CalMonth {
  /** celle vuote prima del giorno 1 (settimana da lunedì) */
  lead: number;
  cells: CalCell[];
  /** scadenze aperte nel mese */
  openInMonth: number;
}

export function calendarMonth(
  month: Month,
  items: readonly Item[],
  pauses: readonly Pause[],
  history: Readonly<Record<Day, DayHistory | undefined>>,
  today: Day,
): CalMonth {
  const first = `${month}-01`;
  const cells: CalCell[] = [];
  for (let d = 1; d <= daysInMonth(first); d++) {
    const date = `${month}-${pad(d)}`;
    const open = dueOn(items, date).filter((i) => !i.done).length;
    const h = history[date];
    const past = date < today;
    cells.push({
      date,
      n: d,
      open,
      heat: open >= 3 ? 3 : (open as 0 | 1 | 2),
      promise: promOn(items, date).some((i) => !i.done),
      late: past && open > 0,
      past,
      today: date === today,
      paused: isPaused(pauses, date),
      net: h && !h.paused ? h.net : null,
    });
  }
  const openInMonth = items.filter(
    (i) => i.kind !== 'daily' && !i.done && i.due?.startsWith(month),
  ).length;
  return { lead: dowOf(first) - 1, cells, openInMonth };
}

const LOG_TYPES: readonly EventType[] = [
  'done',
  'undone',
  'deleted',
  'restored',
  'created',
  'penalty',
  'rep',
];

/** Storico ora per ora del giorno, dal più recente. */
export const dayLog = (events: readonly XpEvent[], day: Day): XpEvent[] =>
  events.filter((e) => e.day === day && LOG_TYPES.includes(e.type)).sort((a, b) => b.ts - a.ts);
