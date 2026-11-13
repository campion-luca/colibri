import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTIF, type DayHistory, type Pause, type XpEvent } from '../../domain/index.ts';
import { daily, ev, item, MON, TUE } from '../../domain/__tests__/fixtures.ts';
import type { Tables } from '../database.types.ts';
import {
  eventToJson,
  historyToJson,
  ideaToRow,
  itemToRow,
  parseNotif,
  parseRecur,
  pauseToRow,
  rowToEvent,
  rowToHistory,
  rowToIdea,
  rowToItem,
  rowToPause,
} from '../mapping.ts';
import {
  MAX_ATTEMPTS,
  SyncError,
  diffState,
  flushQueue,
  mergePending,
  type Bundle,
  type QueueAccess,
  type SyncedState,
} from '../queue.ts';

const asItemRow = (r: ReturnType<typeof itemToRow>): Tables<'items'> => ({
  ...(r as Tables<'items'>),
  user_id: 'u',
  updated_at: '2026-11-10T10:00:00Z',
  // il database restituisce gli orari con i secondi
  window_from: r.window_from ? `${r.window_from}:00` : null,
  window_to: r.window_to ? `${r.window_to}:00` : null,
  due_time: r.due_time ? `${r.due_time}:00` : null,
});

describe('mapping righe ↔ dominio', () => {
  it('elementi: andata e ritorno identici (anche fascia e ricorrenza)', () => {
    const items = [
      daily({ times: 3, doneOn: TUE, doneCount: 2, window: { from: '07:00', to: '11:00' } }),
      daily({ recur: { type: 'weekly', days: [1, 3, 5] }, penalizedOn: MON }),
      daily({ recur: { type: 'interval', every: 7, start: MON } }),
      daily({ recur: { type: 'monthly', day: 31 } }),
      item({ effort: 3, promiseDate: TUE, due: TUE, duePenalized: MON, note: 'nota' }),
      item({ due: TUE, dueTime: '18:30' }),
      item({ kind: 'buy', done: true, doneOn: TUE, gain: 5 }),
    ];
    for (const it of items) {
      const row = itemToRow(it);
      expect(row.deleted_at).toBeNull();
      expect(rowToItem(asItemRow(row))).toEqual(it);
    }
  });

  it('ricorrenze malformate tornano "ogni giorno"', () => {
    expect(parseRecur(null)).toEqual({ type: 'daily' });
    expect(parseRecur({ type: 'weekly', days: [] })).toEqual({ type: 'daily' });
    expect(parseRecur({ type: 'interval', every: 3 })).toEqual({ type: 'daily' });
  });

  it('idee, pause, eventi e storico', () => {
    const idea = { id: 'i', text: 'x', position: 2, createdOn: MON };
    expect(
      rowToIdea({
        ...ideaToRow(idea),
        user_id: 'u',
        updated_at: '',
        position: 2,
        id: 'i',
        deleted_at: null,
      }),
    ).toEqual(idea);

    const p: Pause = { id: 'p', fromDay: MON, untilDay: null, reason: 'Malattia' };
    expect(rowToPause({ ...pauseToRow(p), user_id: 'u', id: 'p', until_day: null })).toEqual(p);

    const e: XpEvent = ev({
      type: 'penalty',
      day: MON,
      ts: Date.parse('2026-11-09T23:00:00Z'),
      itemId: 'it',
      title: 'Acqua',
      kind: 'daily',
      xp: -5,
      meta: { why: 'mezzanotte', on: MON, miss: 1 },
    });
    const j = eventToJson(e) as Record<string, unknown>;
    expect(j).toMatchObject({ id: e.id, ts: '2026-11-09T23:00:00.000Z', item_id: 'it', xp: -5 });
    expect(
      rowToEvent({
        id: e.id,
        user_id: 'u',
        ts: '2026-11-09T23:00:00+00:00',
        day: MON,
        type: 'penalty',
        item_id: 'it',
        title: 'Acqua',
        kind: 'daily',
        xp: -5,
        meta: { why: 'mezzanotte', on: MON, miss: 1 },
      }),
    ).toEqual(e);

    const h: DayHistory = {
      day: MON,
      gained: 10,
      lost: -5,
      net: 5,
      reps: 3,
      repsDone: 2,
      prom: 1,
      promKept: 1,
      done: 2,
      undone: 0,
      deleted: 0,
      created: 1,
      paused: false,
    };
    const hj = historyToJson(h) as Record<string, unknown>;
    expect(hj).toMatchObject({ reps_done: 2, prom_kept: 1 });
    expect(
      rowToHistory({ ...(hj as Omit<Tables<'day_history'>, 'user_id'>), user_id: 'u' }),
    ).toEqual(h);
  });

  it('impostazioni notifiche con valori mancanti', () => {
    expect(parseNotif({ evening: false })).toEqual({ ...DEFAULT_NOTIF, evening: false });
    expect(parseNotif(null)).toEqual(DEFAULT_NOTIF);
  });
});

const state = (p: Partial<SyncedState> = {}): SyncedState => ({
  items: [],
  ideas: [],
  pauses: [],
  events: [],
  notif: DEFAULT_NOTIF,
  ...p,
});

describe('diffState: ogni modifica diventa un pacchetto', () => {
  const a = item({ title: 'A' });
  const b = item({ title: 'B' });

  it('niente cambiato: nessun pacchetto', () => {
    const s = state({ items: [a] });
    expect(diffState(s, s, 'x')).toBeNull();
    expect(diffState(s, { ...s }, 'x')).toBeNull();
  });

  it('nuovi, modificati e tolti', () => {
    const a2 = { ...a, done: true };
    const d = diffState(state({ items: [a, b] }), state({ items: [a2, item({ id: 'c' })] }), 'x');
    expect(d?.items?.map((i) => i.id)).toEqual([a.id, 'c']);
    expect(d?.deleteItems).toEqual([b.id]);
  });

  it('eventi nuovi in ordine, notifiche, pause', () => {
    const e1 = ev({ type: 'done', day: TUE, xp: 5 });
    const e2 = ev({ type: 'rep', day: TUE, xp: 10 });
    const p: Pause = { id: 'p', fromDay: TUE, untilDay: null, reason: 'Ferie' };
    const d = diffState(
      state({ events: [e1] }),
      state({ events: [e1, e2], notif: { ...DEFAULT_NOTIF, evening: false }, pauses: [p] }),
      'x',
    );
    expect(d?.events).toEqual([e2]);
    expect(d?.notif?.evening).toBe(false);
    expect(d?.pauses).toEqual([p]);
  });
});

describe('mergePending: lo stato del server più la coda', () => {
  it('riapplica modifiche, eliminazioni ed eventi non ancora inviati', () => {
    const a = item({ title: 'A' });
    const b = item({ title: 'B' });
    const done = { ...a, done: true, doneOn: TUE };
    const e = ev({ type: 'done', day: TUE, xp: 5 });
    const known = ev({ type: 'rep', day: TUE, xp: 10 });
    const queue: Bundle[] = [
      { id: '1', attempts: 0, items: [done], events: [e, known] },
      { id: '2', attempts: 0, deleteItems: [b.id], items: [item({ id: 'nuovo' })] },
    ];
    const m = mergePending({ ...state({ items: [a, b], events: [known] }), xp: 40 }, queue);
    expect(m.items.map((i) => i.id)).toEqual([a.id, 'nuovo']);
    expect(m.items[0]).toEqual(done);
    // l'evento già sul server non conta due volte
    expect(m.xp).toBe(45);
    expect(m.events.map((x) => x.id)).toEqual([known.id, e.id]);
  });

  it('senza coda resta lo stato del server', () => {
    const base = { ...state({ items: [item()] }), xp: 12 };
    expect(mergePending(base, [])).toEqual(base);
  });
});

describe('flushQueue: invio in ordine, sicuro da ripetere', () => {
  function memQueue(
    bundles: Bundle[],
  ): QueueAccess & { list: () => Bundle[]; push: (b: Bundle) => void } {
    let q = [...bundles];
    return {
      push: (b) => {
        q = [...q, b];
      },
      head: () => q[0],
      remove: (id) => {
        q = q.filter((b) => b.id !== id);
      },
      bump: (id) => {
        const cur = q.find((b) => b.id === id);
        const n = (cur?.attempts ?? 0) + 1;
        q = q.map((b) => (b.id === id ? { ...b, attempts: n } : b));
        return n;
      },
      list: () => q,
    };
  }
  const B = (id: string): Bundle => ({ id, attempts: 0, events: [] });

  it('svuota la coda in ordine e restituisce gli ultimi XP del server', async () => {
    const q = memQueue([B('1'), B('2'), B('3')]);
    const sent: string[] = [];
    const r = await flushQueue(q, (b) => {
      sent.push(b.id);
      return Promise.resolve({ xp: Number(b.id) * 10 });
    });
    expect(sent).toEqual(['1', '2', '3']);
    expect(r).toEqual({ status: 'done', xp: 30, dropped: [] });
    expect(q.list()).toEqual([]);
  });

  it('senza rete si ferma e tiene tutto (anche il pacchetto in corso)', async () => {
    const q = memQueue([B('1'), B('2')]);
    const r = await flushQueue(q, () => Promise.reject(new SyncError('Failed to fetch', true)));
    expect(r.status).toBe('offline');
    expect(q.list().map((b) => [b.id, b.attempts])).toEqual([
      ['1', 0],
      ['2', 0],
    ]);
  });

  it('errore vero: riprova più tardi; dopo 5 tentativi scarta solo quel pacchetto', async () => {
    const q = memQueue([B('bad'), B('ok')]);
    const send = (b: Bundle) =>
      b.id === 'bad'
        ? Promise.reject(new SyncError('23514: check', false))
        : Promise.resolve({ xp: 7 });
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      expect((await flushQueue(q, send)).status).toBe('retry');
      expect(q.list()[0]?.attempts).toBe(i);
    }
    const r = await flushQueue(q, send);
    expect(r.status).toBe('done');
    expect(r.dropped.map((b) => b.id)).toEqual(['bad']);
    expect(r.xp).toBe(7);
    expect(q.list()).toEqual([]);
  });

  it('i pacchetti aggiunti durante l’invio partono nello stesso giro', async () => {
    const q = memQueue([B('1')]);
    const sent: string[] = [];
    await flushQueue(q, (b) => {
      sent.push(b.id);
      if (b.id === '1') q.push(B('2'));
      return Promise.resolve({ xp: null });
    });
    expect(sent).toEqual(['1', '2']);
  });
});
