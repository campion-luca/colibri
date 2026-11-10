import { BUY_XP, EFFORT, HOLD_FROM_EFFORT, RANKS, type Rank } from './config.ts';
import type { Item, XpEvent } from './types.ts';

/** XP di un completamento (o di una ripetizione). */
export const xpOf = (it: Pick<Item, 'kind' | 'effort'>): number =>
  it.kind === 'buy' ? BUY_XP : EFFORT[it.effort].xp;

/** Penalità arrotondata: `round(xp × moltiplicatore)`. */
export const penaltyOf = (it: Pick<Item, 'kind' | 'effort'>, mult: number): number =>
  Math.round(xpOf(it) * mult);

/** Da "Seria" in su si completa tenendo premuto (non vale per le cose da comprare). */
export const requiresHold = (it: Pick<Item, 'kind' | 'effort'>): boolean =>
  it.kind !== 'buy' && it.effort >= HOLD_FROM_EFFORT;

/** Gli XP non scendono mai sotto 0. */
export const applyXp = (xp: number, delta: number): number => Math.max(0, xp + delta);

/** Applica gli eventi in ordine, con il minimo a 0 dopo ciascuno (come `apply_xp`). */
export const applyEvents = (xp: number, events: readonly Pick<XpEvent, 'xp'>[]): number =>
  events.reduce((acc, e) => applyXp(acc, e.xp), xp);

export function rankIndex(xp: number): number {
  let idx = 0;
  RANKS.forEach((r, k) => {
    if (xp >= r.min) idx = k;
  });
  return idx;
}

export interface RankProgress {
  index: number;
  rank: Rank;
  next: Rank | null;
  /** 0–100 verso il rank successivo (100 al rank massimo) */
  pct: number;
  /** XP mancanti al rank successivo */
  toNext: number | null;
}

export function rankProgress(xp: number): RankProgress {
  const index = rankIndex(xp);
  const rank = RANKS[index] ?? RANKS[0];
  const next = RANKS[index + 1] ?? null;
  const pct = next ? ((xp - rank.min) / (next.min - rank.min)) * 100 : 100;
  return {
    index,
    rank,
    next,
    pct: Math.max(0, Math.min(100, pct)),
    toNext: next ? next.min - xp : null,
  };
}
