import { PROMISE_PENALTY, URGENT_MIN } from './config.ts';
import { ddmm, diffDays, dowOf, toMin } from './date.ts';
import { dailyState, dueIn } from './items.ts';
import { penaltyOf } from './xp.ts';
import type { Day, EventType, Item, Kind, Now, Recur, Report, XpEvent } from './types.ts';

/* Testi dell'interfaccia, identici alla bozza. */

export const DOW_LBL = ['', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] as const;
export const MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
] as const;
export const GIORNI = [
  '',
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato',
  'domenica',
] as const;
export const KIND_LBL: Record<Kind | 'idea', string> = {
  daily: 'Ricorrente',
  todo: 'Task',
  buy: 'Da comprare',
  idea: 'Idea',
  hold: 'In sospeso',
};
export const EVENT_LBL: Partial<Record<EventType, string>> = {
  done: 'fatta',
  rep: 'ripetizione',
  undone: 'annullata',
  deleted: 'eliminata',
  restored: 'ripristinata',
  created: 'creata',
  penalty: 'penalità',
};

/** "oggi", "domani", "ven" entro la settimana, altrimenti "dd/mm". */
export function fmtDay(today: Day, date: Day): string {
  const n = diffDays(today, date);
  if (n === 0) return 'oggi';
  if (n === 1) return 'domani';
  if (n > 1 && n < 7) return DOW_LBL[dowOf(date)].toLowerCase();
  return ddmm(date);
}

export function recurLabel(r: Recur): string {
  switch (r.type) {
    case 'weekly': {
      const d = r.days.join('');
      if (d === '12345') return 'Lun–Ven';
      if (d === '67') return 'weekend';
      return r.days.map((x) => DOW_LBL[x]).join(' ');
    }
    case 'interval':
      return `ogni ${r.every} gg`;
    case 'monthly':
      return `il ${r.day} del mese`;
    case 'daily':
      return '';
  }
}

export interface Label {
  text: string;
  urgent: boolean;
}

/** Metadato della scadenza per le righe: "scaduta da 3g", "scade oggi", "scade ven". */
/**
 * Metadato della scadenza per le righe: "scaduta da 3g", "scade oggi", "scade ven".
 * Con l'orario: "scade alle 18:00", rosso nell'ultima ora ("scade tra 35m"),
 * "scaduta alle 18:00" quando l'ora è passata (il malus resta a mezzanotte).
 */
export function dueLabel(it: Item, now: Pick<Now, 'day' | 'minute'>): Label | null {
  const today = now.day;
  const n = dueIn(it, today);
  if (n === null || !it.due) return null;
  if (n < 0) return { text: `scaduta da ${-n}g`, urgent: true };
  const t = it.dueTime;
  if (n === 0) {
    if (!t) return { text: 'scade oggi', urgent: true };
    const left = toMin(t) - now.minute;
    if (left <= 0) return { text: `scaduta alle ${t}`, urgent: true };
    if (left <= URGENT_MIN) return { text: `scade tra ${left}m`, urgent: true };
    return { text: `scade alle ${t}`, urgent: false };
  }
  return { text: `scade ${fmtDay(today, it.due)}${t ? ` ${t}` : ''}`, urgent: false };
}

/** Metadato della fascia oraria di una ricorrente. */
export function windowLabel(it: Item, now: Now): Label | null {
  if (!it.window) return null;
  const state = dailyState(it, now);
  switch (state) {
    case 'off':
      return null;
    case 'soon':
      return { text: `dalle ${it.window.from}`, urgent: false };
    case 'missed':
      return { text: 'SCADUTA', urgent: true };
    case 'active': {
      const left = toMin(it.window.to) - now.minute;
      return left <= URGENT_MIN
        ? { text: `scade tra ${left}m`, urgent: true }
        : { text: `fino alle ${it.window.to}`, urgent: false };
    }
    case 'done':
      return { text: `${it.window.from}–${it.window.to}`, urgent: false };
  }
}

/** Riga di una penalità nel report. */
export function penaltyLine(ev: XpEvent, multiDay: boolean): string {
  // dopo un'assenza ogni voce riporta il giorno a cui si riferisce
  const when = multiDay ? ` · ${ddmm(ev.meta?.on ?? ev.day)}` : '';
  switch (ev.meta?.why) {
    case 'finestra':
      return `${ev.title} (scaduta)${when}`;
    case 'promessa':
      return `Promessa mancata: ${ev.title}${when}`;
    case 'scadenza':
      return `Scadenza mancata: ${ev.title}${when}`;
    default: {
      const miss = ev.meta?.miss ?? 1;
      return `${ev.title}${miss > 1 ? ` ×${miss}` : ''}${when}`;
    }
  }
}

export function promiseToast(it: Item, when: 0 | 1): string {
  const p = penaltyOf(it, PROMISE_PENALTY);
  return when ? `Promessa per domani · se salta −${p} XP` : `Promesso. Se salta: −${p} XP`;
}

export const unpromiseToast = (when: 0 | 1): string => (when ? 'Tolta da domani' : 'Tolta da oggi');

/** Toast quando si chiudono una o più fasce. */
export function windowToast(events: readonly XpEvent[]): string {
  const tot = events.reduce((a, e) => a + e.xp, 0);
  const first = events[0];
  return events.length === 1 && first
    ? `${first.title}: finestra chiusa ${tot} XP`
    : `${events.length} ricorrenti scadute: ${tot} XP`;
}

/** Intestazione del report: "Ieri · Lun 09/11" oppure "Dal 05/11 a ieri". */
export function reportLabel(r: Pick<Report, 'date' | 'days'>): string {
  return r.days > 1
    ? `Dal ${ddmm(r.date)} a ieri`
    : `Ieri · ${DOW_LBL[dowOf(r.date)]} ${ddmm(r.date)}`;
}
