import { toMin } from '../date.ts';
import type { Ctx, Day, Item, Now, Pause, XpEvent } from '../types.ts';

/* Settimana di riferimento: lun 09/11/2026 … dom 15/11/2026. */
export const MON = '2026-11-09';
export const TUE = '2026-11-10';
export const WED = '2026-11-11';
export const FRI = '2026-11-13';

export const USER = 'user-1';

export function makeCtx(): Ctx {
  let n = 0;
  return { userId: USER, newId: () => `id-${++n}` };
}

/** Istante a Roma: giorno + ora `HH:MM`. */
export const at = (day: Day, hhmm = '12:00'): Now => ({
  day,
  minute: toMin(hhmm),
  ts: Date.parse(`${day}T${hhmm}:00Z`),
});

let seq = 0;

export function item(p: Partial<Item> = {}): Item {
  seq++;
  return {
    id: `it-${seq}`,
    kind: 'todo',
    title: `Elemento ${seq}`,
    note: null,
    effort: 1,
    position: seq,
    createdOn: '2026-01-01',
    recur: { type: 'daily' },
    times: 1,
    window: null,
    doneCount: 0,
    penalizedOn: null,
    done: false,
    gain: null,
    promiseDate: null,
    due: null,
    duePenalized: null,
    doneOn: null,
    ...p,
  };
}

export const daily = (p: Partial<Item> = {}): Item => item({ kind: 'daily', ...p });

export const pause = (
  fromDay: Day,
  untilDay: Day | null,
  reason: Pause['reason'] = 'Ferie',
): Pause => ({
  id: `p-${fromDay}`,
  fromDay,
  untilDay,
  reason,
});

export function ev(p: Partial<XpEvent> & Pick<XpEvent, 'type' | 'day'>): XpEvent {
  seq++;
  return {
    id: `ev-${seq}`,
    ts: 0,
    itemId: null,
    title: '',
    kind: null,
    xp: 0,
    meta: null,
    ...p,
  };
}
