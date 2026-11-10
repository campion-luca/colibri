import { describe, expect, it } from 'vitest';
import { recurLabel } from '../format.ts';
import { isScheduled, nextDate } from '../recur.ts';
import { applyEvents, applyXp, rankIndex, rankProgress, requiresHold, xpOf } from '../xp.ts';
import { FRI, MON, TUE, WED, daily, item } from './fixtures.ts';

describe('3.2 impegno → XP', () => {
  it('Veloce 5 · Breve 10 · Seria 25 · Boss 50', () => {
    expect([1, 2, 3, 4].map((e) => xpOf(item({ effort: e as 1 | 2 | 3 | 4 })))).toEqual([
      5, 10, 25, 50,
    ]);
  });

  it('da comprare vale sempre 5 XP', () => {
    expect(xpOf(item({ kind: 'buy', effort: 4 }))).toBe(5);
  });

  it('da Seria in su si tiene premuto, ma non per le cose da comprare', () => {
    expect(requiresHold(item({ effort: 2 }))).toBe(false);
    expect(requiresHold(item({ effort: 3 }))).toBe(true);
    expect(requiresHold(daily({ effort: 4 }))).toBe(true);
    expect(requiresHold(item({ kind: 'hold', effort: 3 }))).toBe(true);
    expect(requiresHold(item({ kind: 'buy', effort: 4 }))).toBe(false);
  });
});

describe('3.3 XP e rank', () => {
  it('gli XP non scendono sotto 0, anche applicando eventi in sequenza', () => {
    expect(applyXp(10, -25)).toBe(0);
    expect(applyEvents(10, [{ xp: -25 }, { xp: 5 }])).toBe(5);
  });

  it('soglie dei rank', () => {
    expect(rankIndex(0)).toBe(0);
    expect(rankIndex(99)).toBe(0);
    expect(rankIndex(100)).toBe(1);
    expect(rankIndex(299)).toBe(1);
    expect(rankIndex(300)).toBe(2);
    expect(rankIndex(700)).toBe(3);
    expect(rankIndex(1500)).toBe(4);
    expect(rankIndex(3000)).toBe(5);
    expect(rankIndex(99_999)).toBe(5);
  });

  it('sotto la soglia si perde il rank', () => {
    expect(rankIndex(applyXp(105, -10))).toBe(0);
  });

  it('progresso verso il rank successivo', () => {
    expect(rankProgress(0)).toMatchObject({ index: 0, pct: 0, toNext: 100 });
    expect(rankProgress(200)).toMatchObject({ index: 1, pct: 50, toNext: 100 });
    expect(rankProgress(3500)).toMatchObject({ index: 5, next: null, pct: 100, toNext: null });
  });
});

describe('3.4 ricorrenze', () => {
  it('ogni giorno, ma non prima della creazione', () => {
    const d = daily({ createdOn: TUE });
    expect(isScheduled(d, MON)).toBe(false);
    expect(isScheduled(d, TUE)).toBe(true);
    expect(isScheduled(d, WED)).toBe(true);
  });

  it('solo le ricorrenti sono "previste"', () => {
    expect(isScheduled(item(), TUE)).toBe(false);
  });

  it('giorni della settimana', () => {
    const d = daily({ recur: { type: 'weekly', days: [1, 3, 5] } });
    expect([MON, TUE, WED, '2026-11-12', FRI].map((x) => isScheduled(d, x))).toEqual([
      true,
      false,
      true,
      false,
      true,
    ]);
  });

  it('ogni N giorni da una data di partenza', () => {
    const d = daily({ recur: { type: 'interval', every: 3, start: MON } });
    expect(isScheduled(d, '2026-11-08')).toBe(false);
    expect(isScheduled(d, MON)).toBe(true);
    expect(isScheduled(d, TUE)).toBe(false);
    expect(isScheduled(d, '2026-11-12')).toBe(true);
    expect(isScheduled(d, '2026-11-15')).toBe(true);
  });

  it('partenza nel futuro: niente prima della partenza', () => {
    const d = daily({ recur: { type: 'interval', every: 7, start: WED } });
    expect(isScheduled(d, TUE)).toBe(false);
    expect(nextDate(d, TUE)).toBe(WED);
  });

  it('un giorno del mese: nei mesi corti vale l’ultimo giorno', () => {
    const d31 = daily({ recur: { type: 'monthly', day: 31 } });
    expect(isScheduled(d31, '2026-02-28')).toBe(true);
    expect(isScheduled(d31, '2026-02-27')).toBe(false);
    expect(isScheduled(d31, '2028-02-28')).toBe(false);
    expect(isScheduled(d31, '2028-02-29')).toBe(true);
    expect(isScheduled(d31, '2026-04-30')).toBe(true);
    expect(isScheduled(d31, '2026-05-30')).toBe(false);
    expect(isScheduled(d31, '2026-05-31')).toBe(true);
    const d15 = daily({ recur: { type: 'monthly', day: 15 } });
    expect(isScheduled(d15, '2026-11-15')).toBe(true);
    expect(isScheduled(d15, '2026-11-16')).toBe(false);
  });

  it('prossima data prevista', () => {
    expect(nextDate(daily({ recur: { type: 'weekly', days: [5] } }), TUE)).toBe(FRI);
    expect(nextDate(daily({ recur: { type: 'weekly', days: [2] } }), TUE)).toBe('2026-11-17');
    expect(nextDate(daily({ recur: { type: 'monthly', day: 31 } }), '2026-01-31')).toBe(
      '2026-02-28',
    );
  });

  it('etichette della ricorrenza', () => {
    expect(recurLabel({ type: 'daily' })).toBe('');
    expect(recurLabel({ type: 'weekly', days: [1, 2, 3, 4, 5] })).toBe('Lun–Ven');
    expect(recurLabel({ type: 'weekly', days: [6, 7] })).toBe('weekend');
    expect(recurLabel({ type: 'weekly', days: [1, 3] })).toBe('Lun Mer');
    expect(recurLabel({ type: 'interval', every: 7, start: MON })).toBe('ogni 7 gg');
    expect(recurLabel({ type: 'monthly', day: 5 })).toBe('il 5 del mese');
  });
});
