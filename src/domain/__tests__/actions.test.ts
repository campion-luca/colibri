import { describe, expect, it } from 'vitest';
import {
  createFromDraft,
  createIdea,
  deletedEvent,
  draftFromIdea,
  draftFromItem,
  editFromDraft,
  editIdeaFromDraft,
  ideaToTask,
  newDraft,
  restoredEvent,
  stepEvery,
  stepMonthDay,
  toggle,
  togglePromise,
  type Draft,
} from '../actions.ts';
import { promiseToast, unpromiseToast } from '../format.ts';
import type { Idea } from '../types.ts';
import { MON, TUE, WED, at, daily, item, makeCtx } from './fixtures.ts';

const now = at(TUE, '12:00');
const draft = (p: Partial<Draft>): Draft => ({ ...newDraft('todo'), title: 'Prova', ...p });

function created(d: Draft) {
  const r = createFromDraft(d, now, makeCtx(), 7);
  if (r?.type !== 'item') throw new Error('atteso un elemento');
  return r;
}

describe('3.11 eventi delle azioni', () => {
  it('completare e annullare una task: done +XP, undone −XP presi', () => {
    const ctx = makeCtx();
    const t = item({ effort: 2, title: 'CV' });
    const r = toggle(t, now, ctx);
    if (!r.ok) throw new Error();
    expect(r.item).toMatchObject({ done: true, doneOn: TUE, gain: 10 });
    expect(r.event).toMatchObject({
      type: 'done',
      xp: 10,
      day: TUE,
      itemId: t.id,
      title: 'CV',
      kind: 'todo',
    });
    // anche se nel frattempo cambia l'impegno, si restituisce quanto preso
    const back = toggle({ ...r.item, effort: 4 }, now, ctx);
    if (!back.ok) throw new Error();
    expect(back.item).toMatchObject({ done: false, doneOn: null });
    expect(back.event).toMatchObject({ type: 'undone', xp: -10 });
  });

  it('creare, eliminare, ripristinare', () => {
    const r = created(draft({}));
    expect(r.event).toMatchObject({ type: 'created', itemId: r.item.id, xp: 0 });
    expect(deletedEvent(r.item, now, makeCtx())).toMatchObject({
      type: 'deleted',
      itemId: r.item.id,
    });
    expect(restoredEvent(r.item, now, makeCtx())).toMatchObject({ type: 'restored' });
  });
});

describe('3.5 promesse OGGI / DOM', () => {
  it('OGGI imposta la promessa, ritoccare la toglie', () => {
    const ctx = makeCtx();
    const t = item({ effort: 3 });
    const on = togglePromise(t, 0, now, ctx);
    expect(on?.item.promiseDate).toBe(TUE);
    expect(on?.event).toMatchObject({ type: 'promised', meta: { for: TUE } });
    const off = togglePromise(on?.item ?? t, 0, now, ctx);
    expect(off?.item.promiseDate).toBeNull();
    expect(off?.event).toMatchObject({ type: 'unpromised', meta: { for: TUE } });
  });

  it('DOM sposta la promessa a domani', () => {
    const r = togglePromise(item({ promiseDate: TUE }), 1, now, makeCtx());
    expect(r?.item.promiseDate).toBe(WED);
    expect(r?.promised).toBe(true);
  });

  it('solo task e cose da comprare si promettono', () => {
    expect(togglePromise(item({ kind: 'buy' }), 0, now, makeCtx())).not.toBeNull();
    expect(togglePromise(item({ kind: 'hold' }), 0, now, makeCtx())).toBeNull();
    expect(togglePromise(daily(), 0, now, makeCtx())).toBeNull();
  });

  it('testi dei toast', () => {
    expect(promiseToast(item({ effort: 3 }), 0)).toBe('Promesso. Se salta: −38 XP');
    expect(promiseToast(item({ kind: 'buy' }), 1)).toBe('Promessa per domani · se salta −8 XP');
    expect(unpromiseToast(0)).toBe('Tolta da oggi');
    expect(unpromiseToast(1)).toBe('Tolta da domani');
  });
});

describe('4 pannello Aggiungi', () => {
  it('titolo vuoto: niente', () => {
    expect(createFromDraft(draft({ title: '   ' }), now, makeCtx(), 0)).toBeNull();
  });

  it('task con promessa, scadenza e nota', () => {
    const r = created(draft({ effort: 3, promise: 1, due: '2026-11-20', note: '  500 g  ' }));
    expect(r.item).toMatchObject({
      kind: 'todo',
      title: 'Prova',
      effort: 3,
      promiseDate: WED,
      due: '2026-11-20',
      note: '500 g',
      createdOn: TUE,
      position: 7,
    });
  });

  it('da comprare: impegno fisso; in sospeso: niente promessa ma scadenza sì', () => {
    expect(created(draft({ kind: 'buy', effort: 4 })).item.effort).toBe(1);
    const h = created(draft({ kind: 'hold', promise: 0, due: '2026-11-20' })).item;
    expect(h).toMatchObject({ promiseDate: null, due: '2026-11-20' });
  });

  it('ricorrente: niente promessa né scadenza, ricorrenza normalizzata', () => {
    const weekly = created(
      draft({
        kind: 'daily',
        promise: 0,
        due: '2026-11-20',
        times: 2,
        recur: { type: 'weekly', days: [5, 1, 3], every: 2, day: 1 },
      }),
    ).item;
    expect(weekly).toMatchObject({
      promiseDate: null,
      due: null,
      times: 2,
      recur: { type: 'weekly', days: [1, 3, 5] },
    });
    const all = created(
      draft({
        kind: 'daily',
        recur: { type: 'weekly', days: [1, 2, 3, 4, 5, 6, 7], every: 2, day: 1 },
      }),
    );
    expect(all.item.recur).toEqual({ type: 'daily' });
    const none = created(
      draft({ kind: 'daily', recur: { type: 'weekly', days: [], every: 2, day: 1 } }),
    );
    expect(none.item.recur).toEqual({ type: 'daily' });
    const every = created(
      draft({ kind: 'daily', recur: { type: 'interval', days: [], every: 7, day: 1 } }),
    );
    expect(every.item.recur).toEqual({ type: 'interval', every: 7, start: TUE });
    const month = created(
      draft({ kind: 'daily', recur: { type: 'monthly', days: [], every: 2, day: 31 } }),
    );
    expect(month.item.recur).toEqual({ type: 'monthly', day: 31 });
  });

  it('fascia: "alle" non dopo "dalle" → fino a mezzanotte; tutto il giorno → nessuna fascia', () => {
    const w = created(draft({ kind: 'daily', allDay: false, from: '21:00', to: '02:00' })).item;
    expect(w.window).toEqual({ from: '21:00', to: '23:59' });
    expect(created(draft({ kind: 'daily', allDay: true })).item.window).toBeNull();
  });

  it('idea', () => {
    const r = createFromDraft(
      draft({ kind: 'idea', title: ' Stemma che cambia ' }),
      now,
      makeCtx(),
      -1,
    );
    expect(r).toMatchObject({
      type: 'idea',
      idea: { text: 'Stemma che cambia', position: -1, createdOn: TUE },
      event: { type: 'created', kind: 'idea' },
    });
    expect(createIdea('  ', now, makeCtx(), 0)).toBeNull();
  });

  it('stepper', () => {
    expect(stepEvery(2, -1)).toBe(2);
    expect(stepEvery(90, 1)).toBe(90);
    expect(stepEvery(7, 1)).toBe(8);
    expect(stepMonthDay(31, 1)).toBe(1);
    expect(stepMonthDay(1, -1)).toBe(31);
    expect(stepMonthDay(15, 1)).toBe(16);
  });
});

describe('4 pannello Modifica', () => {
  it('la bozza riflette l’elemento', () => {
    const d = daily({
      times: 2,
      window: { from: '07:00', to: '09:00' },
      recur: { type: 'interval', every: 3, start: MON },
    });
    expect(draftFromItem(d, TUE)).toMatchObject({
      kind: 'daily',
      times: 2,
      allDay: false,
      from: '07:00',
      to: '09:00',
      recur: { type: 'interval', every: 3 },
    });
    expect(draftFromItem(item({ promiseDate: WED }), TUE).promise).toBe(1);
  });

  it('ogni N giorni: la partenza resta se N non cambia, riparte da oggi se cambia', () => {
    const d = daily({ recur: { type: 'interval', every: 3, start: MON } });
    const same = editFromDraft(d, draftFromItem(d, TUE), now, makeCtx(), 0);
    expect(same?.type === 'item' && same.item.recur).toEqual({
      type: 'interval',
      every: 3,
      start: MON,
    });
    const changed = editFromDraft(
      d,
      { ...draftFromItem(d, TUE), recur: { type: 'interval', days: [], every: 4, day: 1 } },
      now,
      makeCtx(),
      0,
    );
    expect(changed?.type === 'item' && changed.item.recur).toEqual({
      type: 'interval',
      every: 4,
      start: TUE,
    });
  });

  it('meno volte al giorno: le ripetizioni fatte vengono limitate', () => {
    const d = daily({ times: 3, doneOn: TUE, doneCount: 3 });
    const r = editFromDraft(d, { ...draftFromItem(d, TUE), times: 1 }, now, makeCtx(), 0);
    expect(r?.type === 'item' && r.item).toMatchObject({ times: 1, doneCount: 1 });
  });

  it('orario della scadenza: solo con una data, e cambiarlo non riarma la scadenza', () => {
    const r = created(draft({ due: '2026-11-20', dueTime: '18:00' }));
    expect(r.item).toMatchObject({ due: '2026-11-20', dueTime: '18:00' });
    expect(created(draft({ due: null, dueTime: '18:00' })).item.dueTime).toBeNull();
    expect(created(draft({ kind: 'daily', due: TUE, dueTime: '18:00' })).item.dueTime).toBeNull();

    const t = item({ due: MON, dueTime: '09:00', duePenalized: MON });
    const onlyTime = editFromDraft(
      t,
      { ...draftFromItem(t, TUE), dueTime: '10:00' },
      now,
      makeCtx(),
      0,
    );
    expect(onlyTime?.type === 'item' && onlyTime.item).toMatchObject({
      dueTime: '10:00',
      duePenalized: MON,
    });
    const noDue = editFromDraft(t, { ...draftFromItem(t, TUE), due: null }, now, makeCtx(), 0);
    expect(noDue?.type === 'item' && noDue.item).toMatchObject({ due: null, dueTime: null });
  });

  it('cambiare la scadenza la riarma', () => {
    const t = item({ due: MON, duePenalized: MON });
    const r = editFromDraft(t, { ...draftFromItem(t, TUE), due: '2026-11-20' }, now, makeCtx(), 0);
    expect(r?.type === 'item' && r.item).toMatchObject({ due: '2026-11-20', duePenalized: null });
  });

  it('cambiare tipo conserva lo stato fatto/non fatto', () => {
    const t = item({ done: true, doneOn: TUE });
    const toDaily = editFromDraft(
      t,
      { ...draftFromItem(t, TUE), kind: 'daily', times: 2 },
      now,
      makeCtx(),
      0,
    );
    expect(toDaily?.type === 'item' && toDaily.item).toMatchObject({
      kind: 'daily',
      done: false,
      doneOn: TUE,
      doneCount: 2,
    });
    const d = daily({ doneOn: TUE, doneCount: 1 });
    const toTodo = editFromDraft(d, { ...draftFromItem(d, TUE), kind: 'todo' }, now, makeCtx(), 0);
    expect(toTodo?.type === 'item' && toTodo.item).toMatchObject({
      kind: 'todo',
      done: true,
      doneOn: TUE,
    });
  });

  it('un elemento può diventare idea e un’idea un elemento, con lo stesso id', () => {
    const t = item({ title: 'X', createdOn: MON });
    const toIdea = editFromDraft(t, { ...draftFromItem(t, TUE), kind: 'idea' }, now, makeCtx(), -5);
    expect(toIdea).toMatchObject({
      type: 'toIdea',
      removedItemId: t.id,
      idea: { id: t.id, text: 'X', position: -5, createdOn: MON },
    });

    const idea: Idea = { id: 'idea-1', text: 'Y', position: 0, createdOn: MON };
    const toItem = editIdeaFromDraft(
      idea,
      { ...draftFromIdea(idea), kind: 'todo' },
      now,
      makeCtx(),
      3,
    );
    expect(toItem).toMatchObject({
      type: 'toItem',
      removedIdeaId: 'idea-1',
      item: { id: 'idea-1', kind: 'todo', title: 'Y', effort: 2, createdOn: TUE, position: 3 },
    });
  });

  it('"→ TASK": task Breve con titolo al massimo di 80 caratteri', () => {
    const idea: Idea = { id: 'i', text: 'a'.repeat(100), position: 0, createdOn: MON };
    const r = ideaToTask(idea, now, makeCtx(), 9);
    expect(r.item).toMatchObject({ kind: 'todo', effort: 2, position: 9 });
    expect(r.item.title).toHaveLength(80);
    expect(r.removedIdeaId).toBe('i');
    expect(r.event.type).toBe('created');
  });
});
