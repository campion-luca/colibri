import { describe, expect, it } from 'vitest';
import { penaltyId } from '../ids.ts';
import { rollover, type RolloverInput } from '../rollover.ts';
import { FRI, MON, TUE, USER, WED, daily, ev, item, makeCtx, pause } from './fixtures.ts';

const run = (input: RolloverInput, today: string) => {
  const r = rollover(input, today, makeCtx(), 1_000);
  if (!r) throw new Error('rollover nullo');
  return r;
};

describe('3.9 mezzanotte — un giorno', () => {
  const d1 = daily({ title: 'Skin care', effort: 1 });
  const d2 = daily({ title: 'Acqua', times: 3, effort: 2, doneOn: MON, doneCount: 1 });
  const d3 = daily({ title: 'Pollo', window: { from: '18:00', to: '20:00' }, penalizedOn: MON });
  const d4 = daily({ title: 'Allenamento', recur: { type: 'weekly', days: [2] } });
  const d5 = daily({ title: 'Nuova', createdOn: MON, doneOn: MON, doneCount: 1 });
  const t1 = item({ title: 'CV', effort: 3, promiseDate: MON });
  const t2 = item({ title: 'Barbiere', promiseDate: MON, done: true, doneOn: MON, gain: 5 });
  const t3 = item({ title: 'Bollo', effort: 2, due: MON });
  const t4 = item({ title: 'Carta', effort: 2, promiseDate: MON, due: MON });
  const t5 = item({ title: 'Macchina', promiseDate: TUE });
  const b1 = item({ title: 'Uova', kind: 'buy', due: MON });
  const h1 = item({ title: 'Pacco', kind: 'hold', effort: 2, due: MON });
  const events = [
    ev({ type: 'done', day: MON, xp: 5, itemId: t2.id }),
    ev({ type: 'rep', day: MON, xp: 10, itemId: d2.id }),
    ev({
      type: 'penalty',
      day: MON,
      xp: -5,
      title: 'Pollo',
      meta: { why: 'finestra', on: MON, miss: 1 },
    }),
    ev({ type: 'created', day: MON }),
    ev({ type: 'deleted', day: MON }),
    ev({ type: 'done', day: '2026-11-08', xp: 50 }),
  ];
  const input: RolloverInput = {
    xp: 200,
    lastDate: MON,
    items: [d1, d2, d3, d4, d5, t1, t2, t3, t4, t5, b1, h1],
    pauses: [],
    events,
  };
  const r = run(input, TUE);

  it('ricorrenti: ripetizioni mancanti −1×, saltando quelle già pagate alla fascia', () => {
    const daily = r.events.filter((e) => e.meta?.why === 'mezzanotte');
    expect(daily.map((e) => [e.itemId, e.xp, e.meta?.miss])).toEqual([
      [d1.id, -5, 1],
      [d2.id, -20, 2],
    ]);
  });

  it('promessa non mantenuta: −1.5× (arrotondato) e torna senza promessa', () => {
    const p = r.events.find((e) => e.itemId === t1.id);
    expect(p).toMatchObject({ xp: -38, meta: { why: 'promessa', on: MON } });
    expect(r.items.find((i) => i.id === t1.id)?.promiseDate).toBeNull();
  });

  it('promessa e scadenza lo stesso giorno: solo la promessa, e la scadenza risulta pagata', () => {
    const t4ev = r.events.filter((e) => e.itemId === t4.id);
    expect(t4ev.map((e) => [e.meta?.why, e.xp])).toEqual([['promessa', -15]]);
    expect(r.items.find((i) => i.id === t4.id)).toMatchObject({
      promiseDate: null,
      duePenalized: MON,
    });
  });

  it('scadenza mancata: −1× una sola volta, resta in lista', () => {
    expect(r.events.find((e) => e.itemId === t3.id)).toMatchObject({
      xp: -10,
      meta: { why: 'scadenza', on: MON },
    });
    expect(r.events.find((e) => e.itemId === b1.id)).toMatchObject({ xp: -5 });
    expect(r.items.find((i) => i.id === t3.id)).toMatchObject({ due: MON, duePenalized: MON });
  });

  it('"In sospeso" non toglie XP nemmeno con la scadenza', () => {
    expect(r.events.some((e) => e.itemId === h1.id)).toBe(false);
    expect(r.items.find((i) => i.id === h1.id)?.duePenalized).toBe(MON);
  });

  it('le promesse per oggi (fatte con DOM) restano', () => {
    expect(r.items.find((i) => i.id === t5.id)?.promiseDate).toBe(TUE);
    expect(r.report.tomorrowPromised).toBe(1);
  });

  it('pulizia: le non ricorrenti fatte ieri spariscono dalle liste', () => {
    expect(r.archivedIds).toEqual([t2.id]);
    expect(r.items.some((i) => i.id === t2.id)).toBe(false);
    expect(r.items).toHaveLength(11);
  });

  it('XP aggiornati; penalità datate al giorno a cui si riferiscono, con id deterministici', () => {
    expect(r.xp).toBe(200 - 5 - 20 - 38 - 15 - 10 - 5);
    for (const e of r.events) {
      expect(e).toMatchObject({ day: e.meta?.on, ts: 1_000, type: 'penalty' });
      expect(e.id).toBe(
        penaltyId(USER, e.meta?.on ?? '', e.itemId ?? '', e.meta?.why ?? 'mezzanotte'),
      );
    }
  });

  it('report del mattino', () => {
    expect(r.report).toMatchObject({
      date: MON,
      days: 1,
      gained: 15,
      lostTot: -98,
      net: -83,
      reps: 6,
      repsDone: 2,
      prom: 3,
      promKept: 1,
      strike: 1,
      ev: { done: 1, undone: 0, deleted: 1, created: 1 },
      paused: null,
      rankBefore: 1,
      rankAfter: 1,
    });
    expect(r.report.lost).toEqual([
      { title: 'Pollo (scaduta)', xp: -5 },
      { title: 'Skin care', xp: -5 },
      { title: 'Acqua ×2', xp: -20 },
      { title: 'Promessa mancata: CV', xp: -38 },
      { title: 'Promessa mancata: Carta', xp: -15 },
      { title: 'Scadenza mancata: Bollo', xp: -10 },
      { title: 'Scadenza mancata: Uova', xp: -5 },
    ]);
  });

  it('storico del giorno', () => {
    expect(r.history).toHaveLength(1);
    expect(r.history[0]).toEqual({
      day: MON,
      gained: 15,
      lost: -98,
      net: -83,
      reps: 6,
      repsDone: 2,
      prom: 3,
      promKept: 1,
      done: 1,
      undone: 0,
      deleted: 1,
      created: 1,
      paused: false,
    });
  });
});

describe('3.9 mezzanotte — idempotenza', () => {
  const input: RolloverInput = {
    xp: 100,
    lastDate: MON,
    items: [daily({ createdOn: '2026-11-01' }), item({ promiseDate: MON })],
    pauses: [],
    events: [],
  };

  it('primo avvio o già fatto oggi: niente da fare', () => {
    expect(rollover({ ...input, lastDate: null }, TUE, makeCtx(), 0)).toBeNull();
    expect(rollover({ ...input, lastDate: TUE }, TUE, makeCtx(), 0)).toBeNull();
    expect(rollover({ ...input, lastDate: WED }, TUE, makeCtx(), 0)).toBeNull();
  });

  it('rieseguito sul proprio risultato non fa niente', () => {
    const r = run(input, TUE);
    expect(
      rollover(
        { xp: r.xp, lastDate: TUE, items: r.items, pauses: [], events: r.events },
        TUE,
        makeCtx(),
        0,
      ),
    ).toBeNull();
  });

  it('due dispositivi calcolano gli stessi id di penalità', () => {
    const a = run(input, TUE);
    const b = run(input, TUE);
    expect(a.events.map((e) => e.id)).toEqual(b.events.map((e) => e.id));
    expect(new Set(a.events.map((e) => e.id)).size).toBe(a.events.length);
  });
});

describe('3.9 mezzanotte — giorni saltati e pausa', () => {
  it('ogni giorno saltato conta, al massimo 7', () => {
    const d = daily({ title: 'Acqua', createdOn: '2026-01-01' });
    const r = run({ xp: 500, lastDate: '2026-10-01', items: [d], pauses: [], events: [] }, TUE);
    expect(r.report.days).toBe(40);
    expect(r.events.map((e) => e.meta?.on)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ]);
    expect(r.xp).toBe(500 - 35);
  });

  it('i giorni in pausa non si pagano (pausa a metà dell’assenza)', () => {
    const d = daily({ title: 'Acqua', createdOn: '2026-10-01' });
    // assente da lun 02/11 a lun 09/11, in pausa mer 04 e gio 05
    const r = run(
      {
        xp: 500,
        lastDate: '2026-11-02',
        items: [d],
        pauses: [pause('2026-11-04', '2026-11-05')],
        events: [],
      },
      TUE,
    );
    expect(r.events.map((e) => e.meta?.on)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(r.report.lost[0]?.title).toBe('Acqua · 02/11');
  });

  it('pausa sul giorno precedente: nessuna penalità, report e storico in pausa', () => {
    const r = run(
      {
        xp: 100,
        lastDate: MON,
        items: [daily(), item({ promiseDate: MON }), item({ due: MON })],
        pauses: [pause('2026-11-05', MON, 'Malattia')],
        events: [ev({ type: 'done', day: MON, xp: 10 })],
      },
      TUE,
    );
    expect(r.events).toEqual([]);
    expect(r.report).toMatchObject({ paused: 'Malattia', gained: 10, net: 10 });
    expect(r.history).toMatchObject([{ day: MON, paused: true, net: 10 }]);
    expect(r.items.every((i) => i.promiseDate === null)).toBe(true);
  });

  it('le ricorrenti contano solo nei giorni previsti', () => {
    const d = daily({ recur: { type: 'weekly', days: [1, 3] }, createdOn: '2026-10-01' });
    const r = run({ xp: 100, lastDate: '2026-11-02', items: [d], pauses: [], events: [] }, TUE);
    // lun 02, mer 04, lun 09 (09 è oltre i 7 giorni: 02…08)
    expect(r.events.map((e) => e.meta?.on)).toEqual(['2026-11-02', '2026-11-04']);
  });

  it('XP a 0 e rank perso dopo un’assenza lunga', () => {
    const d = daily({ effort: 4, createdOn: '2026-01-01' });
    const r = run({ xp: 120, lastDate: '2026-11-02', items: [d], pauses: [], events: [] }, TUE);
    expect(r.xp).toBe(0);
    expect(r.report).toMatchObject({ rankBefore: 1, rankAfter: 0 });
  });
});

describe('Decisione 1 — promesse durante un’assenza', () => {
  const prev = '2026-11-02';
  const pauses = [pause('2026-11-04', '2026-11-05')];
  const tA = item({ title: 'A', promiseDate: '2026-11-03' });
  const tB = item({ title: 'B', promiseDate: '2026-11-04' });
  const tC = item({ title: 'C', promiseDate: '2026-10-20' });
  const tD = item({ title: 'D', effort: 2, due: '2026-11-05' });
  const tE = item({ title: 'E', effort: 2, due: MON });
  const tF = item({ title: 'F', promiseDate: MON });
  const tG = item({ title: 'G', effort: 2, promiseDate: '2026-11-06', due: '2026-11-06' });
  const r = run(
    { xp: 500, lastDate: prev, items: [tA, tB, tC, tD, tE, tF, tG], pauses, events: [] },
    TUE,
  );
  const whyOf = (id: string) => r.events.filter((e) => e.itemId === id).map((e) => e.meta?.why);

  it('si paga ogni promessa non mantenuta caduta in un giorno penalizzato', () => {
    expect(whyOf(tA.id)).toEqual(['promessa']);
    expect(r.events.find((e) => e.itemId === tA.id)?.xp).toBe(-8);
  });

  it('niente penalità per promesse in pausa o oltre i 7 giorni, ma vengono tolte tutte', () => {
    expect(whyOf(tB.id)).toEqual([]);
    expect(whyOf(tC.id)).toEqual([]);
    expect(whyOf(tF.id)).toEqual([]);
    expect(r.items.every((i) => i.promiseDate === null)).toBe(true);
  });

  it('promessa + scadenza nello stesso giorno saltato: una sola penalità (1.5×)', () => {
    expect(r.events.filter((e) => e.itemId === tG.id).map((e) => [e.meta?.why, e.xp])).toEqual([
      ['promessa', -15],
    ]);
    expect(r.items.find((i) => i.id === tG.id)?.duePenalized).toBe('2026-11-06');
  });

  it('scadenze: niente in pausa, sì anche oltre i 7 giorni', () => {
    expect(whyOf(tD.id)).toEqual([]);
    expect(r.items.find((i) => i.id === tD.id)?.duePenalized).toBe('2026-11-05');
    expect(whyOf(tE.id)).toEqual(['scadenza']);
  });

  it('nel report le righe dopo un’assenza riportano il giorno', () => {
    expect(r.report.lost.map((l) => l.title)).toEqual([
      'Promessa mancata: A · 03/11',
      'Promessa mancata: G · 06/11',
      'Scadenza mancata: E · 09/11',
    ]);
  });
});

describe('3.7 strike', () => {
  it('si azzera a mezzanotte: le fatte di ieri non contano più', () => {
    const items = [
      item({ done: true, doneOn: MON }),
      item({ done: true, doneOn: MON }),
      item({ done: true, doneOn: MON }),
    ];
    const r = run({ xp: 0, lastDate: MON, items, pauses: [], events: [] }, TUE);
    expect(r.report.strike).toBe(3);
    expect(r.items).toEqual([]);
  });

  it('una scadenza futura non viene toccata', () => {
    const t = item({ due: FRI });
    const r = run({ xp: 0, lastDate: MON, items: [t], pauses: [], events: [] }, TUE);
    expect(r.items[0]).toEqual(t);
    expect(r.changed).toEqual([]);
  });
});

describe('Decisione 6 — penalità sul giorno a cui si riferiscono', () => {
  // ultimo accesso lun 02/11 (fatto +10, una fascia scaduta −5), poi assente fino a mar 10/11
  const prev = '2026-11-02';
  const d = daily({ title: 'Acqua', createdOn: '2026-10-01' });
  const p = item({ title: 'Regalo', effort: 2, promiseDate: '2026-11-03' });
  const late = item({ title: 'Bollo', effort: 2, due: MON });
  const events = [
    ev({ type: 'done', day: prev, xp: 10 }),
    ev({ type: 'penalty', day: prev, xp: -5, title: 'Pollo', meta: { why: 'finestra', on: prev } }),
  ];
  const r = run(
    {
      xp: 500,
      lastDate: prev,
      items: [d, p, late],
      pauses: [pause('2026-11-04', '2026-11-05')],
      events,
    },
    TUE,
  );

  it('`day` è il giorno della penalità, `ts` il momento in cui è stata applicata', () => {
    expect(r.events.map((e) => [e.day, e.meta?.why, e.xp])).toEqual([
      ['2026-11-02', 'mezzanotte', -5],
      ['2026-11-03', 'mezzanotte', -5],
      ['2026-11-06', 'mezzanotte', -5],
      ['2026-11-07', 'mezzanotte', -5],
      ['2026-11-08', 'mezzanotte', -5],
      ['2026-11-03', 'promessa', -15],
      [MON, 'scadenza', -10],
    ]);
    expect(r.events.every((e) => e.ts === 1_000)).toBe(true);
  });

  it('day_history ha il rosso sul giorno giusto', () => {
    expect(r.history.map((h) => [h.day, h.gained, h.lost, h.net])).toEqual([
      ['2026-11-02', 10, -10, 0],
      ['2026-11-03', 0, -20, -20],
      ['2026-11-06', 0, -5, -5],
      ['2026-11-07', 0, -5, -5],
      ['2026-11-08', 0, -5, -5],
      [MON, 0, -10, -10],
    ]);
    expect(r.history[1]).toMatchObject({ reps: 1, repsDone: 0, prom: 1, promKept: 0 });
  });

  it('il report somma tutte le penalità del rollover, con la data accanto a ogni voce', () => {
    expect(r.report).toMatchObject({ date: prev, days: 8, gained: 10, lostTot: -55, net: -45 });
    expect(r.report.lost.map((l) => l.title)).toEqual([
      'Pollo (scaduta) · 02/11',
      'Acqua · 02/11',
      'Acqua · 03/11',
      'Acqua · 06/11',
      'Acqua · 07/11',
      'Acqua · 08/11',
      'Promessa mancata: Regalo · 03/11',
      'Scadenza mancata: Bollo · 09/11',
    ]);
  });
});
