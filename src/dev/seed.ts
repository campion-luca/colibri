import {
  addDays,
  createFromDraft,
  dowOf,
  newDraft,
  type Draft,
  type Dow,
  type Effort,
  type Item,
  type Kind,
  type Now,
} from '../domain/index.ts';
import type { GameData } from '../store/game.ts';

/** Dati di esempio della bozza, relativi a oggi. Solo in sviluppo. */
export function seedData(now: Now, userId: string): Partial<GameData> {
  const ctx = { userId, newId: () => crypto.randomUUID() };
  const t = now.day;
  const dow = dowOf(t);
  const notToday = ([1, 2, 3, 4, 5, 6, 7] as Dow[]).filter((d) => d !== dow);
  let pos = 0;
  const items: Item[] = [];
  const mk = (
    title: string,
    kind: Kind,
    effort: Effort,
    extra: Partial<Draft> = {},
    patch: Partial<Item> = {},
  ) => {
    const r = createFromDraft({ ...newDraft(kind), title, effort, ...extra }, now, ctx, pos++);
    if (r?.type === 'item') items.push({ ...r.item, ...patch });
  };
  const weekly = (days: Dow[]): Draft['recur'] => ({ type: 'weekly', days, every: 2, day: 1 });
  const win = (from: string, to: string): Partial<Draft> => ({ allDay: false, from, to });

  mk('Skin care mattina', 'daily', 1, win('07:00', '11:00'));
  mk("Bere 1 L d'acqua", 'daily', 1, { times: 3 });
  mk('Pollo fuori dal freezer', 'daily', 1, win('18:00', '23:30'));
  mk('Allenamento', 'daily', 3, {
    recur: weekly([1, 3, 5].includes(dow) ? [1, 3, 5] : [2, 4, 6]),
  });
  mk('Pesarsi', 'daily', 1, { recur: weekly([notToday[0] ?? 1]) });
  mk(
    'Cambiare le lenzuola',
    'daily',
    2,
    { recur: { type: 'interval', days: [], every: 7, day: 1 } },
    { recur: { type: 'interval', every: 7, start: addDays(t, 2) } },
  );
  mk('10 min ordine in camera', 'daily', 2);
  mk('Skin care sera', 'daily', 1, win('21:00', '23:59'));
  mk('Sistemare il CV', 'todo', 3, { promise: 0 });
  mk('Prenotare il barbiere', 'todo', 1, { due: addDays(t, 1) });
  mk("Rinnovare la carta d'identità", 'todo', 2, { due: addDays(t, 5) });
  mk('Riordinare la creatina', 'todo', 1, { note: 'Quella da 500 g, non la monodose' });
  mk('Lavare la macchina', 'todo', 2, { promise: 1 });
  mk('Regalo compleanno', 'todo', 2, { due: addDays(t, 9) });
  mk('Pagare bollo auto', 'todo', 1, { due: addDays(t, 9) });
  mk('Uova', 'buy', 1, { due: t });
  mk('Petto di pollo', 'buy', 1);

  return {
    userId,
    xp: 0,
    lastDate: t,
    items,
    ideas: [
      {
        id: crypto.randomUUID(),
        text: 'Il colibrì del badge cambia posa in base al rank',
        position: 0,
        createdOn: t,
      },
    ],
  };
}
