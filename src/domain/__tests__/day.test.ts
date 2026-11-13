import { describe, expect, it } from 'vitest';
import { resumePause, startPause, toggle } from '../actions.ts';
import { calendarMonth, dayLog, dueOn, promOn } from '../calendar.ts';
import { celebrationFor, completion, dailiesComplete, promisesComplete } from '../celebrate.ts';
import { dueLabel, fmtDay, reportLabel, windowToast } from '../format.ts';
import { pendingNotifications, type NotifInput } from '../notifications.ts';
import { isPaused, pauseOn, pauseUntil } from '../pause.ts';
import { positionAtEnd, positionAtStart, positionBetween, reorder } from '../position.ts';
import { riskAt } from '../risk.ts';
import { listItems, offToday, todayDailies, todayList, tomorrowList } from '../selectors.ts';
import { heatOf, nextCombo, strikeCount } from '../strike.ts';
import { DEFAULT_NOTIF } from '../config.ts';
import type { DayHistory } from '../types.ts';
import { FRI, MON, TUE, WED, at, daily, ev, item, makeCtx, pause } from './fixtures.ts';

const win = (from: string, to: string) => ({ from, to });

describe('3.10 pausa', () => {
  it('copre i giorni da…a compresi, o senza fine', () => {
    const ps = [pause(MON, WED), pause('2026-12-01', null)];
    expect(isPaused(ps, '2026-11-08')).toBe(false);
    expect(isPaused(ps, MON)).toBe(true);
    expect(isPaused(ps, WED)).toBe(true);
    expect(isPaused(ps, '2026-11-12')).toBe(false);
    expect(pauseOn(ps, '2027-06-01')?.untilDay).toBeNull();
  });

  it('durate: 3 giorni, 1 settimana, senza fine', () => {
    expect(pauseUntil(TUE, 3)).toBe('2026-11-12');
    expect(pauseUntil(TUE, 7)).toBe('2026-11-16');
    expect(pauseUntil(TUE, 0)).toBeNull();
  });

  it('parte da oggi e crea l’evento pause', () => {
    const r = startPause({ reason: 'Malattia', until: FRI }, at(TUE), makeCtx());
    expect(r.pause).toMatchObject({ fromDay: TUE, untilDay: FRI, reason: 'Malattia' });
    expect(r.event).toMatchObject({ type: 'pause', meta: { reason: 'Malattia', until: FRI } });
  });

  it('"Riprendi ora": finisce ieri, o sparisce se iniziata oggi', () => {
    const older = resumePause([pause(MON, null)], [], at(TUE), makeCtx());
    expect(older?.op).toEqual({ kind: 'update', pause: { ...pause(MON, null), untilDay: MON } });
    expect(older?.event.type).toBe('resume');
    const today = resumePause([pause(TUE, FRI)], [], at(TUE), makeCtx());
    expect(today?.op).toEqual({ kind: 'delete', id: pause(TUE, FRI).id });
    expect(resumePause([], [], at(TUE), makeCtx())).toBeNull();
  });

  it('riprendendo, le fasce di oggi già chiuse non vengono penalizzate', () => {
    const closed = daily({ window: win('07:00', '09:00') });
    const open = daily({ window: win('18:00', '20:00') });
    const r = resumePause([pause(MON, null)], [closed, open], at(TUE, '12:00'), makeCtx());
    expect(r?.items).toEqual([{ ...closed, penalizedOn: TUE }]);
  });

  it('in pausa nessun XP a rischio e nessuna notifica, ma gli XP fatti contano', () => {
    const ps = [pause(TUE, null)];
    const items = [daily(), item({ promiseDate: TUE, effort: 4 })];
    expect(riskAt(items, ps, at(TUE))).toBe(0);
    expect(
      pendingNotifications({
        items,
        pauses: ps,
        now: at(TUE, '22:00'),
        settings: DEFAULT_NOTIF,
        gainedToday: 0,
        sent: new Set(),
      }),
    ).toEqual([]);
    const r = toggle(items[1] ?? item(), at(TUE), makeCtx());
    expect(r.ok && r.event.xp).toBe(50);
  });
});

describe('3.7 strike e 3.8 combo', () => {
  it('conta le non ricorrenti completate oggi', () => {
    const items = [
      item({ done: true, doneOn: TUE }),
      item({ kind: 'buy', done: true, doneOn: TUE }),
      item({ done: true, doneOn: MON }),
      daily({ doneOn: TUE, doneCount: 1 }),
    ];
    expect(strikeCount(items, TUE)).toBe(2);
  });

  it('colore della fiamma', () => {
    expect([2, 3, 4, 5, 6, 9].map(heatOf)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('combo entro 10 secondi', () => {
    expect(nextCombo(2, 1_000, 10_999)).toBe(3);
    expect(nextCombo(2, 1_000, 11_000)).toBe(0);
  });
});

describe('3.14 celebrazioni', () => {
  const now = at(TUE, '12:00');

  it('ricorrenti chiuse: tutte fatte o scadute, almeno una fatta', () => {
    const done = daily({ doneOn: TUE, doneCount: 1 });
    const missed = daily({ window: win('07:00', '09:00') });
    const active = daily();
    const off = daily({ recur: { type: 'weekly', days: [5] } });
    expect(dailiesComplete([done, missed, off], now)).toBe(true);
    expect(dailiesComplete([missed], now)).toBe(false);
    expect(dailiesComplete([done, active], now)).toBe(false);
    expect(dailiesComplete([off], now)).toBe(false);
  });

  it('promesse mantenute: promesse e scadenze di oggi tutte fatte', () => {
    const p = item({ promiseDate: TUE, done: true, doneOn: TUE });
    const d = item({ kind: 'buy', due: TUE, done: true, doneOn: TUE });
    const open = item({ due: TUE });
    const extra = item({ done: true, doneOn: TUE });
    expect(promisesComplete([p, d, extra], now)).toBe(true);
    expect(promisesComplete([p, open], now)).toBe(false);
    expect(promisesComplete([extra], now)).toBe(false);
  });

  it('scattano solo nel passaggio non completo → completo', () => {
    const no = { d: false, p: false };
    expect(celebrationFor(no, { d: true, p: false }, 'daily')).toBe('daily');
    expect(celebrationFor(no, { d: false, p: true }, 'todo')).toBe('promise');
    expect(celebrationFor({ d: true, p: false }, { d: true, p: true }, 'buy')).toBe('perfect');
    expect(celebrationFor({ d: false, p: true }, { d: true, p: true }, 'daily')).toBe('perfect');
    expect(celebrationFor({ d: true, p: false }, { d: true, p: false }, 'daily')).toBeNull();
    expect(celebrationFor(no, { d: true, p: false }, 'todo')).toBeNull();
  });

  it('completamento calcolato dallo stato', () => {
    expect(completion([daily({ doneOn: TUE, doneCount: 1 })], now)).toEqual({ d: true, p: false });
  });
});

describe('header: XP a rischio a mezzanotte', () => {
  it('ripetizioni mancanti + promesse + scadenze senza promessa', () => {
    const now = at(TUE, '12:00');
    const items = [
      daily({ times: 2, effort: 2, doneOn: TUE, doneCount: 1 }), // 10
      daily({ window: win('18:00', '20:00') }), // soon: 5
      daily({ window: win('07:00', '09:00') }), // scaduta: 0
      daily({ recur: { type: 'weekly', days: [5] } }), // non prevista: 0
      item({ effort: 3, promiseDate: TUE }), // 38
      item({ effort: 2, promiseDate: TUE, due: TUE }), // solo la promessa: 15
      item({ effort: 2, due: TUE }), // 10
      item({ kind: 'hold', effort: 2, due: TUE }), // non toglie XP: 0
      item({ effort: 4, promiseDate: TUE, done: true, doneOn: TUE }), // fatta: 0
    ];
    expect(riskAt(items, [], now)).toBe(10 + 5 + 38 + 15 + 10);
    expect(riskAt([], [], now)).toBe(0);
  });
});

describe('4 schermata Oggi e Liste', () => {
  const now = at(TUE, '12:00');

  it('ricorrenti di oggi: da fare sopra, fatte/scadute sotto, poi ordine manuale', () => {
    const missed = daily({ title: 'missed', position: 0, window: win('07:00', '09:00') });
    const done = daily({ title: 'done', position: 1, doneOn: TUE, doneCount: 1 });
    const soon = daily({ title: 'soon', position: 2, window: win('18:00', '20:00') });
    const active = daily({ title: 'active', position: 3 });
    const off = daily({ title: 'off', position: 4, recur: { type: 'weekly', days: [5] } });
    expect(todayDailies([missed, done, soon, active, off], now).map((i) => i.title)).toEqual([
      'soon',
      'active',
      'missed',
      'done',
    ]);
    expect(offToday([missed, off], now).map((i) => i.title)).toEqual(['off']);
  });

  it('non previste oggi: per prossima data, non per ordine manuale', () => {
    const sat = daily({ title: 'sab', position: 0, recur: { type: 'weekly', days: [6] } });
    const wed = daily({ title: 'mer', position: 1, recur: { type: 'weekly', days: [3] } });
    const month = daily({ title: 'mese', position: 2, recur: { type: 'monthly', day: 1 } });
    expect(offToday([sat, month, wed], now).map((i) => i.title)).toEqual(['mer', 'sab', 'mese']);
  });

  it('promesse e scadenze: promesse di oggi, scadenze di oggi, fatte oggi', () => {
    const p = item({ title: 'p', position: 3, promiseDate: TUE });
    const d = item({ title: 'd', position: 1, kind: 'hold', due: TUE });
    const f = item({ title: 'f', position: 0, done: true, doneOn: TUE });
    const tomorrow = item({ title: 't', promiseDate: WED });
    const later = item({ title: 'l', due: FRI });
    expect(todayList([p, d, f, tomorrow, later], TUE).map((i) => i.title)).toEqual(['d', 'p', 'f']);
    expect(tomorrowList([p, tomorrow, later], TUE).map((i) => i.title)).toEqual(['t']);
  });

  it('liste per tipo: da fare e fatte oggi, non quelle fatte prima', () => {
    const a = item({ title: 'a', position: 2 });
    const b = item({ title: 'b', position: 1, done: true, doneOn: TUE });
    const c = item({ title: 'c', position: 0, done: true, doneOn: MON });
    const buy = item({ title: 'buy', kind: 'buy' });
    expect(listItems([a, b, c, buy], 'todo', TUE).map((i) => i.title)).toEqual(['a', 'b']);
    expect(listItems([a, buy], 'buy', TUE).map((i) => i.title)).toEqual(['buy']);
  });
});

describe('3.13 ordine manuale', () => {
  const s = [
    { id: 'a', position: 0 },
    { id: 'b', position: 1 },
    { id: 'c', position: 2 },
  ];

  it('inserimento tra due vicini', () => {
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(1, undefined)).toBe(2);
    expect(positionBetween(undefined, 1)).toBe(0);
    expect(positionBetween()).toBe(0);
    expect(reorder(s, 0, 1)).toEqual([{ id: 'a', position: 1.5 }]);
    expect(reorder(s, 0, 2)).toEqual([{ id: 'a', position: 3 }]);
    expect(reorder(s, 2, 0)).toEqual([{ id: 'c', position: -1 }]);
    expect(reorder(s, 1, 1)).toEqual([]);
  });

  it('se lo spazio finisce si rinumera la sezione', () => {
    const tight = [
      { id: 'a', position: 0 },
      { id: 'b', position: 1e-7 },
      { id: 'c', position: 1 },
    ];
    expect(reorder(tight, 2, 1)).toEqual([
      { id: 'a', position: 0 },
      { id: 'c', position: 1 },
      { id: 'b', position: 2 },
    ]);
  });

  it('nuovi elementi in fondo, nuove idee in cima', () => {
    expect(positionAtEnd(s)).toBe(3);
    expect(positionAtStart(s)).toBe(-1);
    expect(positionAtEnd([])).toBe(0);
  });
});

describe('4 calendario', () => {
  const items = [
    item({ due: '2026-11-12' }),
    item({ due: '2026-11-12' }),
    item({ kind: 'buy', due: '2026-11-12' }),
    item({ due: FRI }),
    item({ due: FRI, done: true, doneOn: TUE }),
    item({ due: '2026-11-05' }),
    item({ promiseDate: WED }),
    item({ promiseDate: FRI, due: FRI }),
    daily(),
  ];
  const history: Record<string, DayHistory> = {
    '2026-11-03': {
      day: '2026-11-03',
      gained: 20,
      lost: -30,
      net: -10,
      reps: 4,
      repsDone: 2,
      prom: 1,
      promKept: 0,
      done: 2,
      undone: 0,
      deleted: 0,
      created: 1,
      paused: false,
    },
  };
  const cal = calendarMonth('2026-11', items, [pause('2026-11-06', '2026-11-07')], history, TUE);
  const cell = (d: number) => cal.cells[d - 1];

  it('griglia con settimana da lunedì', () => {
    // 1 novembre 2026 è domenica
    expect(cal.lead).toBe(6);
    expect(cal.cells).toHaveLength(30);
  });

  it('colore e numero dalle scadenze aperte, quadratino per le promesse', () => {
    expect(cell(12)).toMatchObject({ open: 3, heat: 3, promise: false });
    expect(cell(13)).toMatchObject({ open: 2, heat: 2, promise: false });
    expect(cell(11)).toMatchObject({ open: 0, heat: 0, promise: true });
  });

  it('scadenze passate non fatte, saldo, pausa, oggi', () => {
    expect(cell(5)).toMatchObject({ late: true, past: true });
    expect(cell(3)).toMatchObject({ net: -10, past: true });
    expect(cell(6)?.paused).toBe(true);
    expect(cell(10)).toMatchObject({ today: true, past: false });
    expect(cal.openInMonth).toBe(6);
  });

  it('dettaglio del giorno', () => {
    expect(dueOn(items, FRI)).toHaveLength(3);
    expect(promOn(items, FRI)).toHaveLength(0);
    expect(promOn(items, WED)).toHaveLength(1);
    const log = dayLog(
      [
        ev({ type: 'done', day: TUE, ts: 1 }),
        ev({ type: 'promised', day: TUE, ts: 2 }),
        ev({ type: 'penalty', day: TUE, ts: 3 }),
        ev({ type: 'done', day: MON, ts: 4 }),
      ],
      TUE,
    );
    expect(log.map((e) => e.type)).toEqual(['penalty', 'done']);
  });
});

describe('6 notifiche', () => {
  const base: NotifInput = {
    items: [],
    pauses: [],
    now: at(TUE, '12:00'),
    settings: DEFAULT_NOTIF,
    gainedToday: 0,
    sent: new Set(),
  };

  it('inizio fascia: entro 30 minuti dall’apertura', () => {
    const d = daily({ title: 'Pollo', effort: 2, window: win('18:00', '23:30') });
    const at1810 = pendingNotifications({ ...base, items: [d], now: at(TUE, '18:10') });
    expect(at1810).toEqual([
      { key: `start-${d.id}`, title: "È l'ora: Pollo", body: 'Da adesso fino alle 23:30 · +10 XP' },
    ]);
    expect(pendingNotifications({ ...base, items: [d], now: at(TUE, '18:31') })).toEqual([]);
    expect(pendingNotifications({ ...base, items: [d], now: at(TUE, '17:59') })).toEqual([]);
    const done = { ...d, doneOn: TUE, doneCount: 1 };
    expect(pendingNotifications({ ...base, items: [done], now: at(TUE, '18:10') })).toEqual([]);
  });

  it('scadenze: dalle 9:00 se qualcosa scade oggi', () => {
    const one = item({ title: 'Bollo', effort: 2, due: TUE });
    const two = item({ kind: 'buy', due: TUE });
    expect(pendingNotifications({ ...base, items: [one], now: at(TUE, '08:59') })).toEqual([]);
    expect(pendingNotifications({ ...base, items: [one], now: at(TUE, '09:00') })).toEqual([
      { key: 'due', title: 'Scade oggi: Bollo', body: 'Se salta: −10 XP a mezzanotte' },
    ]);
    expect(
      pendingNotifications({ ...base, items: [one, two], now: at(TUE, '09:00') })[0],
    ).toMatchObject({
      title: '2 cose scadono oggi',
      body: 'Se salta: −15 XP a mezzanotte',
    });
  });

  it('scadenze: "In sospeso" compare senza il testo sugli XP persi', () => {
    const h = item({ title: 'Pacco', kind: 'hold', effort: 3, due: TUE });
    const t = item({ title: 'Bollo', effort: 2, due: TUE });
    const at9 = at(TUE, '09:00');
    expect(pendingNotifications({ ...base, items: [h], now: at9 })).toEqual([
      { key: 'due', title: 'Scade oggi: Pacco (in sospeso)', body: '' },
    ]);
    expect(pendingNotifications({ ...base, items: [h, t], now: at9 })[0]).toMatchObject({
      title: '2 cose scadono oggi',
      body: 'Se salta: −10 XP a mezzanotte',
    });
  });

  it('scadenza con orario: promemoria nell’ultima ora, il malus resta a mezzanotte', () => {
    const t = item({ title: 'Bollo', effort: 2, due: TUE, dueTime: '18:00' });
    const h = item({ title: 'Pacco', kind: 'hold', due: TUE, dueTime: '18:00' });
    const keys = (hhmm: string) =>
      pendingNotifications({ ...base, items: [t, h], now: at(TUE, hhmm) })
        .filter((n) => n.key.startsWith('due-'))
        .map((n) => [n.title, n.body]);
    expect(keys('16:59')).toEqual([]);
    expect(keys('17:00')).toEqual([
      ['Scade alle 18:00: Bollo', 'Se salta: −10 XP a mezzanotte'],
      ['Scade alle 18:00: Pacco (in sospeso)', ''],
    ]);
    expect(keys('18:01')).toEqual([]);
    const done = { ...t, done: true, doneOn: TUE };
    expect(
      pendingNotifications({ ...base, items: [done], now: at(TUE, '17:30') }).filter((n) =>
        n.key.startsWith('due-'),
      ),
    ).toEqual([]);
  });

  it('report serale all’ora scelta', () => {
    const now = at(TUE, '21:30');
    expect(pendingNotifications({ ...base, now, gainedToday: 40 })).toEqual([
      {
        key: 'evening',
        title: 'Report di oggi',
        body: '+40 XP · tutto al sicuro · scegli le promesse di domani',
      },
    ]);
    const items = [
      item({ effort: 2, promiseDate: TUE }),
      item({ promiseDate: WED }),
      item({ promiseDate: WED }),
    ];
    expect(pendingNotifications({ ...base, items, now, gainedToday: 40 })[0]?.body).toBe(
      '+40 XP · −15 ancora a rischio · 2 promesse per domani',
    );
    expect(pendingNotifications({ ...base, now: at(TUE, '21:29') })).toEqual([]);
  });

  it('si rispettano le impostazioni e le notifiche già mandate', () => {
    const now = at(TUE, '21:30');
    const off = { ...DEFAULT_NOTIF, evening: false };
    expect(pendingNotifications({ ...base, now, settings: off })).toEqual([]);
    expect(pendingNotifications({ ...base, now, sent: new Set(['evening']) })).toEqual([]);
  });
});

describe('testi', () => {
  it('giorni relativi', () => {
    expect(fmtDay(TUE, TUE)).toBe('oggi');
    expect(fmtDay(TUE, WED)).toBe('domani');
    expect(fmtDay(TUE, FRI)).toBe('ven');
    expect(fmtDay(TUE, '2026-11-17')).toBe('17/11');
    expect(fmtDay(TUE, MON)).toBe('09/11');
  });

  it('scadenze', () => {
    const now = at(TUE);
    expect(dueLabel(item({ due: '2026-11-07' }), now)).toEqual({
      text: 'scaduta da 3g',
      urgent: true,
    });
    expect(dueLabel(item({ due: TUE }), now)).toEqual({ text: 'scade oggi', urgent: true });
    expect(dueLabel(item({ due: FRI }), now)).toEqual({ text: 'scade ven', urgent: false });
    expect(dueLabel(item(), now)).toBeNull();
  });

  it('scadenze con orario: rosso nell’ultima ora, poi "scaduta alle"', () => {
    const t = item({ due: TUE, dueTime: '18:00' });
    expect(dueLabel(t, at(TUE, '12:00'))).toEqual({ text: 'scade alle 18:00', urgent: false });
    expect(dueLabel(t, at(TUE, '17:00'))).toEqual({ text: 'scade tra 60m', urgent: true });
    expect(dueLabel(t, at(TUE, '17:25'))).toEqual({ text: 'scade tra 35m', urgent: true });
    expect(dueLabel(t, at(TUE, '18:00'))).toEqual({ text: 'scaduta alle 18:00', urgent: true });
    expect(dueLabel(item({ due: FRI, dueTime: '09:30' }), at(TUE))).toEqual({
      text: 'scade ven 09:30',
      urgent: false,
    });
    expect(dueLabel(item({ due: WED, dueTime: '08:00' }), at(TUE))).toEqual({
      text: 'scade domani 08:00',
      urgent: false,
    });
  });

  it('report e toast', () => {
    expect(reportLabel({ date: MON, days: 1 })).toBe('Ieri · Lun 09/11');
    expect(reportLabel({ date: '2026-11-05', days: 5 })).toBe('Dal 05/11 a ieri');
    const p = (title: string, xp: number) => ev({ type: 'penalty', day: TUE, title, xp });
    expect(windowToast([p('Pollo', -5)])).toBe('Pollo: finestra chiusa -5 XP');
    expect(windowToast([p('A', -5), p('B', -10)])).toBe('2 ricorrenti scadute: -15 XP');
  });
});
