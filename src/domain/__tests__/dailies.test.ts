import { describe, expect, it } from 'vitest';
import {
  checkWindows,
  createFromDraft,
  editFromDraft,
  draftFromItem,
  newDraft,
  removeOneRep,
  toggle,
} from '../actions.ts';
import { windowLabel } from '../format.ts';
import { penaltyId } from '../ids.ts';
import { cntOn, dailyState } from '../items.ts';
import { rollover } from '../rollover.ts';
import type { Item } from '../types.ts';
import { TUE, USER, WED, at, daily, makeCtx, pause } from './fixtures.ts';

const win = (from: string, to: string) => ({ from, to });

function mustToggle(it: Item, hhmm = '12:00') {
  const r = toggle(it, at(TUE, hhmm), makeCtx());
  if (!r.ok) throw new Error(r.reason);
  return r;
}

describe('3.4 stati della ricorrente', () => {
  it('off quando non è prevista oggi', () => {
    expect(dailyState(daily({ recur: { type: 'weekly', days: [5] } }), at(TUE))).toBe('off');
  });

  it('con fascia: soon prima, active dentro, missed dopo', () => {
    const d = daily({ window: win('09:00', '11:00') });
    expect(dailyState(d, at(TUE, '08:59'))).toBe('soon');
    expect(dailyState(d, at(TUE, '09:00'))).toBe('active');
    expect(dailyState(d, at(TUE, '10:59'))).toBe('active');
    expect(dailyState(d, at(TUE, '11:00'))).toBe('missed');
  });

  it('done con tutte le ripetizioni, anche a fascia chiusa', () => {
    const d = daily({ times: 2, doneOn: TUE, doneCount: 2, window: win('09:00', '11:00') });
    expect(dailyState(d, at(TUE, '12:00'))).toBe('done');
  });

  it('missed se già penalizzata oggi', () => {
    expect(dailyState(daily({ penalizedOn: TUE }), at(TUE))).toBe('missed');
  });

  it('le ripetizioni di ieri non contano oggi', () => {
    const d = daily({ doneOn: '2026-11-09', doneCount: 1 });
    expect(cntOn(d, TUE)).toBe(0);
    expect(dailyState(d, at(TUE))).toBe('active');
  });
});

describe('3.4 ripetizioni', () => {
  const d = daily({ times: 3, effort: 2, title: 'Acqua' });

  it('ogni tocco aggiunge una ripetizione e dà i suoi XP', () => {
    const r1 = mustToggle(d);
    expect(r1.action).toBe('rep');
    expect(r1.item).toMatchObject({ doneOn: TUE, doneCount: 1 });
    expect(r1.event).toMatchObject({ type: 'rep', xp: 10, meta: { n: 1, of: 3 } });

    const r2 = mustToggle(r1.item);
    expect(r2.event).toMatchObject({ type: 'rep', xp: 10, meta: { n: 2, of: 3 } });

    const r3 = mustToggle(r2.item);
    expect(r3.action).toBe('done');
    expect(r3.event).toMatchObject({ type: 'done', xp: 10, meta: { n: 3, of: 3 } });
    expect(dailyState(r3.item, at(TUE))).toBe('done');
  });

  it('toccando una ricorrente completata si torna a 0 e si tolgono tutti gli XP del giorno', () => {
    const doneItem = { ...d, doneOn: TUE, doneCount: 3 };
    const r = mustToggle(doneItem);
    expect(r.action).toBe('undone');
    expect(r.item).toMatchObject({ doneCount: 0, doneOn: null });
    expect(r.event).toMatchObject({ type: 'undone', xp: -30 });
  });

  it('"− TOGLI UNA" toglie una sola ripetizione', () => {
    const two = { ...d, doneOn: TUE, doneCount: 2 };
    const r = removeOneRep(two, at(TUE), makeCtx());
    expect(r?.item).toMatchObject({ doneCount: 1, doneOn: TUE });
    expect(r?.event).toMatchObject({
      type: 'undone',
      xp: -10,
      meta: { n: 1, of: 3, single: true },
    });

    const one = { ...d, doneOn: TUE, doneCount: 1 };
    expect(removeOneRep(one, at(TUE), makeCtx())?.item).toMatchObject({
      doneCount: 0,
      doneOn: null,
    });
    expect(removeOneRep(d, at(TUE), makeCtx())).toBeNull();
  });

  it('caselle bloccate: non prevista, prima della fascia, fascia chiusa', () => {
    const ctx = makeCtx();
    const off = toggle(daily({ recur: { type: 'weekly', days: [5] } }), at(TUE), ctx);
    expect(off).toEqual({ ok: false, reason: 'Prevista ven' });
    const soon = toggle(daily({ window: win('18:00', '20:00') }), at(TUE, '12:00'), ctx);
    expect(soon).toEqual({ ok: false, reason: 'Si sblocca alle 18:00' });
    const missed = toggle(daily({ window: win('18:00', '20:00') }), at(TUE, '21:00'), ctx);
    expect(missed).toEqual({ ok: false, reason: 'Finestra chiusa per oggi' });
  });
});

describe('3.4 fascia oraria', () => {
  it('etichette: dalle, fino alle, scade tra Nm nell’ultima ora, SCADUTA', () => {
    const d = daily({ window: win('09:00', '12:00') });
    expect(windowLabel(d, at(TUE, '08:00'))).toEqual({ text: 'dalle 09:00', urgent: false });
    expect(windowLabel(d, at(TUE, '10:00'))).toEqual({ text: 'fino alle 12:00', urgent: false });
    expect(windowLabel(d, at(TUE, '11:00'))).toEqual({ text: 'scade tra 60m', urgent: true });
    expect(windowLabel(d, at(TUE, '11:45'))).toEqual({ text: 'scade tra 15m', urgent: true });
    expect(windowLabel(d, at(TUE, '12:00'))).toEqual({ text: 'SCADUTA', urgent: true });
    const done = { ...d, doneOn: TUE, doneCount: 1 };
    expect(windowLabel(done, at(TUE, '10:00'))).toEqual({ text: '09:00–12:00', urgent: false });
  });

  it('alla chiusura le ripetizioni mancanti costano subito −1× XP ciascuna', () => {
    const d = daily({
      times: 3,
      effort: 2,
      doneOn: TUE,
      doneCount: 1,
      window: win('09:00', '11:00'),
    });
    const r = checkWindows([d], [], at(TUE, '11:00'), makeCtx());
    expect(r.items).toEqual([{ ...d, penalizedOn: TUE }]);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({
      id: penaltyId(USER, TUE, d.id, 'finestra'),
      type: 'penalty',
      day: TUE,
      xp: -20,
      meta: { why: 'finestra', on: TUE, miss: 2 },
    });
    expect(dailyState(r.items[0] ?? d, at(TUE, '11:00'))).toBe('missed');
  });

  it('la penalità di fascia si applica una volta sola e non a mezzanotte', () => {
    const d = daily({ window: win('09:00', '11:00') });
    const first = checkWindows([d], [], at(TUE, '11:30'), makeCtx());
    const after = first.items[0] ?? d;
    expect(checkWindows([after], [], at(TUE, '12:00'), makeCtx()).events).toEqual([]);
    const ro = rollover(
      { xp: 100, lastDate: TUE, items: [after], pauses: [], events: first.events },
      WED,
      makeCtx(),
      0,
    );
    expect(ro?.events).toEqual([]);
    expect(ro?.report.lost).toEqual([{ title: `${d.title} (scaduta)`, xp: -5 }]);
  });

  it('niente penalità prima della chiusura, a fascia completata o senza fascia', () => {
    const ctx = makeCtx();
    const open = daily({ window: win('09:00', '11:00') });
    const done = daily({ window: win('09:00', '11:00'), doneOn: TUE, doneCount: 1 });
    const noWin = daily();
    expect(checkWindows([open], [], at(TUE, '10:59'), ctx).events).toEqual([]);
    expect(checkWindows([done, noWin], [], at(TUE, '23:00'), ctx).events).toEqual([]);
  });

  it('niente penalità di fascia durante una pausa', () => {
    const d = daily({ window: win('09:00', '11:00') });
    expect(checkWindows([d], [pause(TUE, null)], at(TUE, '12:00'), makeCtx()).events).toEqual([]);
  });
});

describe('3.4 ricorrente creata o modificata a fascia chiusa', () => {
  const late = at(TUE, '20:00');

  it('creata a fascia chiusa: oggi non penalizza, né alla chiusura né a mezzanotte', () => {
    const ctx = makeCtx();
    const draft = {
      ...newDraft('daily'),
      title: 'Skin care',
      allDay: false,
      from: '07:00',
      to: '11:00',
    };
    const created = createFromDraft(draft, late, ctx, 0);
    if (created?.type !== 'item') throw new Error('attesa una ricorrente');
    expect(created.item.penalizedOn).toBe(TUE);
    expect(dailyState(created.item, late)).toBe('missed');
    expect(checkWindows([created.item], [], late, ctx).events).toEqual([]);
    const ro = rollover(
      { xp: 50, lastDate: TUE, items: [created.item], pauses: [], events: [] },
      WED,
      ctx,
      0,
    );
    expect(ro?.events).toEqual([]);
  });

  it('modificata a fascia chiusa: oggi non penalizza', () => {
    const ctx = makeCtx();
    const d = daily({ createdOn: '2026-11-01' });
    const draft = { ...draftFromItem(d, TUE), allDay: false, from: '08:00', to: '10:00' };
    const edited = editFromDraft(d, draft, late, ctx, 0);
    if (edited?.type !== 'item') throw new Error('attesa una ricorrente');
    expect(edited.item.penalizedOn).toBe(TUE);
    expect(checkWindows([edited.item], [], late, ctx).events).toEqual([]);
  });

  it('se la fascia viene riaperta torna attiva', () => {
    const d = daily({ penalizedOn: TUE, window: win('08:00', '10:00') });
    const draft = { ...draftFromItem(d, TUE), to: '22:00' };
    const edited = editFromDraft(d, draft, late, makeCtx(), 0);
    if (edited?.type !== 'item') throw new Error('attesa una ricorrente');
    expect(edited.item.penalizedOn).toBeNull();
    expect(dailyState(edited.item, late)).toBe('active');
  });
});
