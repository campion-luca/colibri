import { promiseToast, unpromiseToast } from '../domain/index.ts';
import { useGame } from '../store/game.ts';
import { toast, useUi } from '../store/ui.ts';
import { getNow } from './now.ts';

/** Elimina (soft delete) con "ANNULLA" per 5 secondi: annullando torna nello stesso punto. */
export function softDelete(id: string): void {
  const entry = useGame.getState().remove(id, getNow());
  if (!entry) return;
  const title = entry.type === 'item' ? entry.item.title : entry.idea.text;
  useUi.getState().showActionToast({
    msg: `"${title.slice(0, 28)}" eliminata`,
    label: 'ANNULLA',
    ms: 5000,
    onAction: () => {
      useGame.getState().restore(id, getNow());
    },
  });
}

/** OGGI / DOM sulle righe. */
export function promise(id: string, when: 0 | 1): void {
  const r = useGame.getState().togglePromise(id, when, getNow());
  if (r) toast(r.promised ? promiseToast(r.item, when) : unpromiseToast(when));
}
