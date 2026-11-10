import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEFAULT_NOTIF,
  addDays,
  applyEvents,
  celebrationFor,
  checkWindows,
  completion,
  createFromDraft,
  createIdea,
  deletedEvent,
  editFromDraft,
  editIdeaFromDraft,
  ideaToTask,
  positionAtEnd,
  positionAtStart,
  rankIndex,
  removeOneRep,
  reorder,
  restoredEvent,
  resumePause,
  rollover,
  strikeCount,
  toggle,
  togglePromise,
  type Celebration,
  type Ctx,
  type Day,
  type DayHistory,
  type Draft,
  type Idea,
  type Item,
  type NotifSettings,
  type Now,
  type Pause,
  type Report,
  type RolloverResult,
  type XpEvent,
} from '../domain/index.ts';

export type TrashEntry =
  { type: 'item'; item: Item; deletedAt: number } | { type: 'idea'; idea: Idea; deletedAt: number };

export interface GameData {
  userId: string;
  xp: number;
  lastDate: Day | null;
  items: Item[];
  ideas: Idea[];
  /** eliminati con soft delete: si possono ripristinare, spariscono dopo 30 giorni */
  trash: TrashEntry[];
  pauses: Pause[];
  events: XpEvent[];
  history: Record<Day, DayHistory>;
  lastReport: Report | null;
  notif: NotifSettings;
}

export interface ToggleDone {
  ok: true;
  action: 'rep' | 'done' | 'undone';
  item: Item;
  event: XpEvent;
  strike: number;
  celebration: Celebration | null;
  rankBefore: number;
  rankAfter: number;
}
export type ToggleOutcome = { ok: false; reason: string } | ToggleDone;

export interface TickResult {
  rollover: RolloverResult | null;
  windowEvents: XpEvent[];
}

interface GameActions {
  /** mezzanotte e chiusura delle fasce: all'apertura e ogni 30 s */
  tick: (now: Now) => TickResult;
  toggle: (id: string, now: Now) => ToggleOutcome | null;
  removeOneRep: (id: string, now: Now) => void;
  togglePromise: (id: string, when: 0 | 1, now: Now) => { promised: boolean; item: Item } | null;
  create: (draft: Draft, now: Now) => { item?: Item; idea?: Idea } | null;
  edit: (id: string, draft: Draft, now: Now) => boolean;
  editIdea: (id: string, draft: Draft, now: Now) => boolean;
  addIdea: (text: string, now: Now) => boolean;
  ideaToTask: (id: string, now: Now) => void;
  remove: (id: string, now: Now) => TrashEntry | null;
  restore: (id: string, now: Now) => void;
  reorder: (ids: readonly string[], from: number, to: number, ideas?: boolean) => void;
  resume: (now: Now) => void;
  setNotif: (patch: Partial<NotifSettings>) => void;
  /** solo sviluppo */
  replaceAll: (data: Partial<GameData>) => void;
}

const LOCAL_USER = 'local';
const EVENTS_KEEP_DAYS = 120;
const TRASH_KEEP_MS = 30 * 86_400_000;

export const emptyData = (): GameData => ({
  userId: LOCAL_USER,
  xp: 0,
  lastDate: null,
  items: [],
  ideas: [],
  trash: [],
  pauses: [],
  events: [],
  history: {},
  lastReport: null,
  notif: { ...DEFAULT_NOTIF },
});

const ctxOf = (s: GameData): Ctx => ({ userId: s.userId, newId: () => crypto.randomUUID() });

function replace<T extends { id: string }>(list: T[], changed: readonly T[]): T[] {
  if (!changed.length) return list;
  const byId = new Map(changed.map((x) => [x.id, x]));
  return list.map((x) => byId.get(x.id) ?? x);
}

/** Aggiunge eventi e XP; un id già visto non si applica due volte (come `apply_xp`). */
function withEvents(s: GameData, events: readonly XpEvent[]): Pick<GameData, 'xp' | 'events'> {
  const seen = new Set(s.events.map((e) => e.id));
  const fresh = events.filter((e) => !seen.has(e.id));
  return { xp: applyEvents(s.xp, fresh), events: [...s.events, ...fresh] };
}

export const useGame = create<GameData & GameActions>()(
  persist(
    (set, get) => ({
      ...emptyData(),

      tick(now) {
        const out: TickResult = { rollover: null, windowEvents: [] };
        const s = get();
        if (s.lastDate === null) {
          set({ lastDate: now.day });
        } else if (s.lastDate < now.day) {
          const r = rollover(s, now.day, ctxOf(s), now.ts);
          if (r) {
            const history = { ...s.history };
            for (const h of r.history) history[h.day] = h;
            const keepFrom = addDays(now.day, -EVENTS_KEEP_DAYS);
            const ev = withEvents(s, r.events);
            set({
              xp: ev.xp,
              events: ev.events.filter((e) => e.day >= keepFrom),
              lastDate: now.day,
              items: r.items,
              history,
              lastReport: r.report,
              trash: s.trash.filter((t) => now.ts - t.deletedAt < TRASH_KEEP_MS),
            });
            out.rollover = r;
          }
        }
        const cur = get();
        const w = checkWindows(cur.items, cur.pauses, now, ctxOf(cur));
        if (w.events.length) {
          set({ items: replace(cur.items, w.items), ...withEvents(cur, w.events) });
          out.windowEvents = w.events;
        }
        return out;
      },

      toggle(id, now) {
        const s = get();
        const it = s.items.find((i) => i.id === id);
        if (!it) return null;
        const r = toggle(it, now, ctxOf(s));
        if (!r.ok) return r;
        const before = completion(s.items, now);
        const items = replace(s.items, [r.item]);
        const ev = withEvents(s, [r.event]);
        set({ items, ...ev });
        return {
          ...r,
          strike: strikeCount(items, now.day),
          celebration:
            r.action === 'undone' ? null : celebrationFor(before, completion(items, now), it.kind),
          rankBefore: rankIndex(s.xp),
          rankAfter: rankIndex(ev.xp),
        };
      },

      removeOneRep(id, now) {
        const s = get();
        const it = s.items.find((i) => i.id === id);
        const r = it && removeOneRep(it, now, ctxOf(s));
        if (r) set({ items: replace(s.items, [r.item]), ...withEvents(s, [r.event]) });
      },

      togglePromise(id, when, now) {
        const s = get();
        const it = s.items.find((i) => i.id === id);
        const r = it && togglePromise(it, when, now, ctxOf(s));
        if (!r) return null;
        set({ items: replace(s.items, [r.item]), ...withEvents(s, [r.event]) });
        return { promised: r.promised, item: r.item };
      },

      create(draft, now) {
        const s = get();
        const position = draft.kind === 'idea' ? positionAtStart(s.ideas) : positionAtEnd(s.items);
        const r = createFromDraft(draft, now, ctxOf(s), position);
        if (!r) return null;
        if (r.type === 'idea') {
          set({ ideas: [...s.ideas, r.idea], ...withEvents(s, [r.event]) });
          return { idea: r.idea };
        }
        set({ items: [...s.items, r.item], ...withEvents(s, [r.event]) });
        return { item: r.item };
      },

      edit(id, draft, now) {
        const s = get();
        const it = s.items.find((i) => i.id === id);
        const r = it && editFromDraft(it, draft, now, ctxOf(s), positionAtStart(s.ideas));
        if (!r) return false;
        if (r.type === 'toIdea') {
          set({
            items: s.items.filter((i) => i.id !== r.removedItemId),
            ideas: [...s.ideas, r.idea],
            ...withEvents(s, [r.event]),
          });
        } else {
          set({ items: replace(s.items, [r.item]), ...withEvents(s, [r.event]) });
        }
        return true;
      },

      editIdea(id, draft, now) {
        const s = get();
        const idea = s.ideas.find((x) => x.id === id);
        const r = idea && editIdeaFromDraft(idea, draft, now, ctxOf(s), positionAtEnd(s.items));
        if (!r) return false;
        if (r.type === 'toItem') {
          set({
            ideas: s.ideas.filter((x) => x.id !== r.removedIdeaId),
            items: [...s.items, r.item],
            ...withEvents(s, [r.event]),
          });
        } else {
          set({ ideas: replace(s.ideas, [r.idea]), ...withEvents(s, [r.event]) });
        }
        return true;
      },

      addIdea(text, now) {
        const s = get();
        const r = createIdea(text, now, ctxOf(s), positionAtStart(s.ideas));
        if (!r) return false;
        set({ ideas: [...s.ideas, r.idea], ...withEvents(s, [r.event]) });
        return true;
      },

      ideaToTask(id, now) {
        const s = get();
        const idea = s.ideas.find((x) => x.id === id);
        if (!idea) return;
        const r = ideaToTask(idea, now, ctxOf(s), positionAtEnd(s.items));
        set({
          ideas: s.ideas.filter((x) => x.id !== r.removedIdeaId),
          items: [...s.items, r.item],
          ...withEvents(s, [r.event]),
        });
      },

      remove(id, now) {
        const s = get();
        const item = s.items.find((i) => i.id === id);
        const idea = item ? undefined : s.ideas.find((x) => x.id === id);
        const subject = item ?? idea;
        if (!subject) return null;
        const entry: TrashEntry = item
          ? { type: 'item', item, deletedAt: now.ts }
          : { type: 'idea', idea: subject as Idea, deletedAt: now.ts };
        set({
          items: s.items.filter((i) => i.id !== id),
          ideas: s.ideas.filter((x) => x.id !== id),
          trash: [...s.trash, entry],
          ...withEvents(s, [deletedEvent(subject, now, ctxOf(s))]),
        });
        return entry;
      },

      restore(id, now) {
        const s = get();
        const entry = s.trash.find((t) => (t.type === 'item' ? t.item.id : t.idea.id) === id);
        if (!entry) return;
        const subject = entry.type === 'item' ? entry.item : entry.idea;
        // la posizione è rimasta quella di prima: torna nello stesso punto
        set({
          trash: s.trash.filter((t) => t !== entry),
          items: entry.type === 'item' ? [...s.items, entry.item] : s.items,
          ideas: entry.type === 'idea' ? [...s.ideas, entry.idea] : s.ideas,
          ...withEvents(s, [restoredEvent(subject, now, ctxOf(s))]),
        });
      },

      reorder(ids, from, to, ideas = false) {
        const s = get();
        const list: { id: string; position: number }[] = ideas ? s.ideas : s.items;
        const byId = new Map(list.map((x) => [x.id, x.position]));
        const section = ids.map((id) => ({ id, position: byId.get(id) ?? 0 }));
        const patches = new Map(reorder(section, from, to).map((p) => [p.id, p.position]));
        if (!patches.size) return;
        const move = <T extends { id: string; position: number }>(xs: T[]) =>
          xs.map((x) => {
            const p = patches.get(x.id);
            return p === undefined ? x : { ...x, position: p };
          });
        set(ideas ? { ideas: move(s.ideas) } : { items: move(s.items) });
      },

      resume(now) {
        const s = get();
        const r = resumePause(s.pauses, s.items, now, ctxOf(s));
        if (!r) return;
        const op = r.op;
        const pauses =
          op.kind === 'delete'
            ? s.pauses.filter((p) => p.id !== op.id)
            : replace(s.pauses, [op.pause]);
        set({ pauses, items: replace(s.items, r.items), ...withEvents(s, [r.event]) });
      },

      setNotif(patch) {
        set((s) => ({ notif: { ...s.notif, ...patch } }));
      },

      replaceAll(data) {
        set({ ...emptyData(), ...data });
      },
    }),
    {
      name: 'colibri-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): GameData => ({
        userId: s.userId,
        xp: s.xp,
        lastDate: s.lastDate,
        items: s.items,
        ideas: s.ideas,
        trash: s.trash,
        pauses: s.pauses,
        events: s.events,
        history: s.history,
        lastReport: s.lastReport,
        notif: s.notif,
      }),
    },
  ),
);
