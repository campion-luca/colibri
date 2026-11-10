/** Giorno di calendario in Europe/Rome, formato `YYYY-MM-DD`. Si confronta come stringa. */
export type Day = string;
/** Mese, formato `YYYY-MM`. */
export type Month = string;
/** Orario, formato `HH:MM`. */
export type HHMM = string;

export type Kind = 'daily' | 'todo' | 'buy' | 'hold';
export type Effort = 1 | 2 | 3 | 4;
export type Times = 1 | 2 | 3;
/** 1 = lunedì … 7 = domenica */
export type Dow = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Recur =
  | { type: 'daily' }
  | { type: 'weekly'; days: Dow[] }
  | { type: 'interval'; every: number; start: Day }
  | { type: 'monthly'; day: number };
export type RecurType = Recur['type'];

export interface TimeWindow {
  from: HHMM;
  to: HHMM;
}

/** Elemento attivo (gli eliminati con soft delete non arrivano al dominio). */
export interface Item {
  id: string;
  kind: Kind;
  title: string;
  note: string | null;
  effort: Effort;
  position: number;
  createdOn: Day;
  // — ricorrenti
  recur: Recur;
  times: Times;
  window: TimeWindow | null;
  /** ripetizioni fatte nel giorno `doneOn` */
  doneCount: number;
  /** giorno in cui le ripetizioni mancanti sono già state pagate (o non vanno pagate) */
  penalizedOn: Day | null;
  // — non ricorrenti
  done: boolean;
  /** XP presi al completamento, restituiti se si annulla */
  gain: number | null;
  promiseDate: Day | null;
  due: Day | null;
  duePenalized: Day | null;
  // — comuni
  doneOn: Day | null;
}

export interface Idea {
  id: string;
  text: string;
  position: number;
  createdOn: Day;
}

export type PauseReason = 'Ferie' | 'Malattia' | 'Altro';

export interface Pause {
  id: string;
  fromDay: Day;
  /** ultimo giorno di pausa compreso; `null` = senza fine */
  untilDay: Day | null;
  reason: PauseReason;
}

export type EventType =
  | 'created'
  | 'edited'
  | 'done'
  | 'rep'
  | 'undone'
  | 'deleted'
  | 'restored'
  | 'promised'
  | 'unpromised'
  | 'penalty'
  | 'pause'
  | 'resume';

export type PenaltyReason = 'finestra' | 'mezzanotte' | 'promessa' | 'scadenza';

export interface EventMeta {
  why?: PenaltyReason;
  /** giorno a cui si riferisce la penalità (dopo un'assenza può differire da `day`) */
  on?: Day;
  /** ripetizioni mancate */
  miss?: number;
  /** ripetizione n di `of` */
  n?: number;
  of?: number;
  /** giorno della promessa */
  for?: Day;
  /** "− TOGLI UNA" dal pannello di modifica */
  single?: boolean;
  reason?: PauseReason;
  until?: Day | null;
}

export interface XpEvent {
  /** UUID generato dal client (deterministico per le penalità) */
  id: string;
  /** epoch ms */
  ts: number;
  day: Day;
  type: EventType;
  itemId: string | null;
  title: string;
  kind: Kind | 'idea' | null;
  xp: number;
  meta: EventMeta | null;
}

export interface DayHistory {
  day: Day;
  gained: number;
  lost: number;
  net: number;
  reps: number;
  repsDone: number;
  prom: number;
  promKept: number;
  done: number;
  undone: number;
  deleted: number;
  created: number;
  paused: boolean;
}

export interface ReportLine {
  title: string;
  xp: number;
}

export interface Report {
  /** ultimo giorno coperto dal report = il `last_date` precedente */
  date: Day;
  /** giorni trascorsi da `date` a oggi */
  days: number;
  gained: number;
  lost: ReportLine[];
  lostTot: number;
  net: number;
  reps: number;
  repsDone: number;
  prom: number;
  promKept: number;
  strike: number;
  ev: { done: number; undone: number; deleted: number; created: number };
  /** promesse già scelte per oggi */
  tomorrowPromised: number;
  paused: PauseReason | null;
  rankBefore: number;
  rankAfter: number;
}

export interface NotifSettings {
  start: boolean;
  due: boolean;
  evening: boolean;
  eveningAt: HHMM;
  morning: boolean;
}

/** Istante corrente già convertito in Europe/Rome. */
export interface Now {
  day: Day;
  /** minuti dalla mezzanotte, ora locale di Roma */
  minute: number;
  /** epoch ms */
  ts: number;
}

/** Dipendenze esterne delle azioni, iniettate per tenere il dominio puro. */
export interface Ctx {
  userId: string;
  newId: () => string;
}
