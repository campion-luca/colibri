import { DUE_NOTIF_AT_MIN, DUE_PENALTY, START_NOTIF_WINDOW_MIN, URGENT_MIN } from './config.ts';
import { toMin } from './date.ts';
import { dailyState, isDueToday, isPromisedTomorrow, penalizesDue } from './items.ts';
import { isPaused } from './pause.ts';
import { riskAt } from './risk.ts';
import { penaltyOf, xpOf } from './xp.ts';
import type { Item, Now, NotifSettings, Pause } from './types.ts';

export interface PendingNotif {
  /** chiave di deduplica nel giorno (tabella `notif_sent`) */
  key: string;
  title: string;
  body: string;
}

export interface NotifInput {
  items: readonly Item[];
  pauses: readonly Pause[];
  now: Now;
  settings: NotifSettings;
  /** XP guadagnati oggi, per il report serale */
  gainedToday: number;
  /** chiavi già inviate oggi */
  sent: ReadonlySet<string>;
}

/**
 * Notifiche da mandare adesso. Usata dalla Edge Function `notify` (ogni 5 minuti).
 * Niente notifiche durante una pausa.
 */
export function pendingNotifications(input: NotifInput): PendingNotif[] {
  const { items, pauses, now, settings: N, gainedToday, sent } = input;
  const t = now.day;
  const m = now.minute;
  if (isPaused(pauses, t)) return [];
  const out: PendingNotif[] = [];

  if (N.start) {
    for (const i of items) {
      if (i.kind !== 'daily' || !i.window || dailyState(i, now) !== 'active') continue;
      const from = toMin(i.window.from);
      if (m >= from && m - from <= START_NOTIF_WINDOW_MIN) {
        out.push({
          key: `start-${i.id}`,
          title: `È l'ora: ${i.title}`,
          body: `Da adesso fino alle ${i.window.to} · +${xpOf(i)} XP`,
        });
      }
    }
  }

  if (N.due && m >= DUE_NOTIF_AT_MIN) {
    const due = items.filter((i) => isDueToday(i, t));
    const first = due[0];
    if (first) {
      // "In sospeso" compare ma non toglie XP: niente testo sugli XP persi per loro
      const loss = due.filter(penalizesDue).reduce((a, i) => a + penaltyOf(i, DUE_PENALTY), 0);
      const single = `Scade oggi: ${first.title}${first.kind === 'hold' ? ' (in sospeso)' : ''}`;
      out.push({
        key: 'due',
        title: due.length === 1 ? single : `${due.length} cose scadono oggi`,
        body: loss ? `Se salta: −${loss} XP a mezzanotte` : '',
      });
    }
  }

  // scadenze con orario: promemoria nell'ultima ora (il malus resta a mezzanotte)
  if (N.due) {
    for (const i of items) {
      if (!isDueToday(i, t) || !i.dueTime) continue;
      const left = toMin(i.dueTime) - m;
      if (left < 0 || left > URGENT_MIN) continue;
      const hold = i.kind === 'hold';
      out.push({
        key: `due-${i.id}`,
        title: `Scade alle ${i.dueTime}: ${i.title}${hold ? ' (in sospeso)' : ''}`,
        body: penalizesDue(i) ? `Se salta: −${penaltyOf(i, DUE_PENALTY)} XP a mezzanotte` : '',
      });
    }
  }

  if (N.evening && m >= toMin(N.eveningAt)) {
    const risk = riskAt(items, pauses, now);
    const tp = items.filter((i) => isPromisedTomorrow(i, t)).length;
    const head = risk
      ? `+${gainedToday} XP · −${risk} ancora a rischio`
      : `+${gainedToday} XP · tutto al sicuro`;
    out.push({
      key: 'evening',
      title: 'Report di oggi',
      body: head + (tp ? ` · ${tp} promesse per domani` : ' · scegli le promesse di domani'),
    });
  }

  return out.filter((n) => !sent.has(n.key));
}
