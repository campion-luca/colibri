import { SFX } from '../audio/engine.ts';
import { promiseToast, unpromiseToast } from '../domain/index.ts';
import { centerOf } from '../fx/core.ts';
import { sparks } from '../fx/effects.ts';
import { haptic } from '../fx/haptics.ts';
import { collapseThen, flip, settleAfter } from '../fx/order.ts';
import { useGame } from '../store/game.ts';
import { toast, useUi } from '../store/ui.ts';
import { getNow } from './now.ts';

const rowEl = (id: string) => document.querySelector(`main [data-id="${CSS.escape(id)}"]`);

/** Elimina (soft delete) con "ANNULLA" per 5 secondi: annullando torna nello stesso punto. */
export function softDelete(id: string): void {
  SFX.trash();
  collapseThen(rowEl(id), () => {
    const entry = useGame.getState().remove(id, getNow());
    if (!entry) return;
    const title = entry.type === 'item' ? entry.item.title : entry.idea.text;
    useUi.getState().showActionToast({
      msg: `"${title.slice(0, 28)}" eliminata`,
      label: 'ANNULLA',
      ms: 5000,
      onAction: () => {
        flip(() => {
          useGame.getState().restore(id, getNow());
        });
        SFX.commit();
        haptic(12);
      },
    });
  });
}

/** OGGI / DOM sulle righe. */
export function promise(id: string, when: 0 | 1, btn: Element): void {
  settleAfter(450);
  const r = useGame.getState().togglePromise(id, when, getNow());
  if (!r) return;
  if (r.promised) {
    SFX.commit();
    haptic(12);
    const c = centerOf(btn);
    sparks(c.x, c.y, 8);
    toast(promiseToast(r.item, when));
  } else {
    SFX.undo();
    toast(unpromiseToast(when));
  }
}

/** "→ TASK" sulle idee. */
export function ideaToTask(id: string): void {
  SFX.commit();
  collapseThen(rowEl(id), () => {
    useGame.getState().ideaToTask(id, getNow());
    toast('Spostata in Task');
  });
}

/** "RIPRENDI ORA". */
export function resumePause(): void {
  flip(() => {
    useGame.getState().resume(getNow());
  });
  useUi.getState().closeSheet();
  SFX.commit();
  haptic(20);
  toast('Bentornato. Si riparte.');
}
