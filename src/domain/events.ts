import type { Ctx, Day, EventMeta, EventType, Idea, Item, Now, XpEvent } from './types.ts';

type Subject = Pick<Item, 'id' | 'title' | 'kind'> | Idea | null;

export function makeEvent(
  ctx: Pick<Ctx, 'newId'>,
  now: Pick<Now, 'day' | 'ts'>,
  type: EventType,
  subject: Subject,
  xp = 0,
  meta: EventMeta | null = null,
): XpEvent {
  return {
    id: ctx.newId(),
    ts: now.ts,
    day: now.day,
    type,
    itemId: subject?.id ?? null,
    title: subject ? ('text' in subject ? subject.text : subject.title) : '',
    kind: subject ? ('text' in subject ? 'idea' : subject.kind) : null,
    xp,
    meta,
  };
}

export const eventsOn = (events: readonly XpEvent[], day: Day): XpEvent[] =>
  events.filter((e) => e.day === day);

export const countOn = (
  events: readonly XpEvent[],
  day: Day,
  types: readonly EventType[],
): number => events.filter((e) => e.day === day && types.includes(e.type)).length;

/** XP guadagnati nel giorno: completamenti e ripetizioni meno gli annullamenti (penalità escluse). */
export const gainedOn = (events: readonly XpEvent[], day: Day): number =>
  events
    .filter((e) => e.day === day && (e.type === 'done' || e.type === 'rep' || e.type === 'undone'))
    .reduce((a, e) => a + e.xp, 0);
