import { SFX } from '../audio/engine.ts';
import { STRIKE_FROM, nextCombo } from '../domain/index.ts';
import type { ToggleDone } from '../store/game.ts';
import { centerOf } from './core.ts';
import { celebrate, fireBurst, floatText, pop, sparks } from './effects.ts';
import { haptic } from './haptics.ts';
import { settleAfter } from './order.ts';

/* Sequenza della spunta, come nella bozza. */

let combo = 0;
let lastDoneAt = -Infinity;

/** Pausa prima che la riga scorra al suo posto. */
export const SETTLE_DONE_MS = 560;
export const SETTLE_UNDO_MS = 350;

export function feelToggle(r: ToggleDone, chk: Element): void {
  const { x: cx, y: cy } = centerOf(chk);

  if (r.action === 'undone') {
    settleAfter(SETTLE_UNDO_MS);
    SFX.undo();
    haptic(8);
    floatText(cx, cy - 10, `−${-r.event.xp}`, true);
    combo = 0;
    return;
  }

  // pop, tratto della spunta e barrato partono dal cambio di stato (CSS)
  const now = performance.now();
  combo = nextCombo(combo, lastDoneAt, now);
  lastDoneAt = now;
  pop(chk);
  SFX.done(combo);
  haptic(14);
  sparks(cx, cy, 10 + Math.min(combo, 6) * 2);

  const xp = `+${r.event.xp} XP`;
  if (r.item.kind === 'daily') {
    const tm = r.item.times;
    const sub = r.action === 'done' ? (tm > 1 ? `${tm}/${tm}` : '') : `${r.item.doneCount}/${tm}`;
    floatText(cx, cy - 14, xp, false, sub);
  } else if (r.strike >= STRIKE_FROM) {
    fireBurst(cx, cy, r.strike);
    floatText(cx + 46, cy - 14, xp);
  } else {
    floatText(cx, cy - 14, xp);
  }

  const c = r.celebration;
  if (c) {
    window.setTimeout(() => {
      celebrate(c);
    }, 650);
  }
}
