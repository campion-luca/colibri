import { flushSync } from 'react-dom';
import { isDragging } from '../lib/drag.ts';
import { useUi } from '../store/ui.ts';
import { EASE } from './core.ts';

/*
 * "Pausa, poi la riga scorre al suo posto".
 * Al tocco l'ordine delle sezioni resta congelato (la riga cambia aspetto dov'è);
 * dopo la pausa si riordina con un FLIP: solo transform, nessun salto.
 */

let timer: number | undefined;

const ROWS = 'main [data-id][data-k]';
const keyOf = (el: HTMLElement) => `${el.dataset.id ?? ''}|${el.dataset.k ?? ''}`;

function captureOrder(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  document.querySelectorAll<HTMLElement>(ROWS).forEach((el) => {
    const k = el.dataset.k;
    const id = el.dataset.id;
    if (!k || !id) return;
    (out[k] ??= []).push(id);
  });
  return out;
}

/** Congela l'ordine adesso e lo sblocca (con animazione) tra `ms`. Va chiamata prima della modifica. */
export function settleAfter(ms: number): void {
  if (!useUi.getState().frozen) useUi.setState({ frozen: captureOrder() });
  window.clearTimeout(timer);
  timer = window.setTimeout(release, ms);
}

function release(): void {
  if (isDragging()) {
    timer = window.setTimeout(release, 200);
    return;
  }
  flip(() => {
    useUi.setState({ frozen: null });
  });
}

/** Applica una modifica e anima le righe dalla vecchia alla nuova posizione. */
export function flip(mutate: () => void): void {
  if (isDragging()) {
    mutate();
    return;
  }
  const first = new Map<string, number>();
  document.querySelectorAll<HTMLElement>(ROWS).forEach((el) => {
    first.set(keyOf(el), el.getBoundingClientRect().top);
  });
  flushSync(mutate);
  document.querySelectorAll<HTMLElement>(ROWS).forEach((el) => {
    const f = first.get(keyOf(el));
    const l = el.getBoundingClientRect().top;
    if (f === undefined) {
      el.animate(
        [
          { opacity: 0, transform: 'translateY(-8px) scale(.97)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 300, easing: EASE },
      );
    } else if (Math.abs(f - l) > 1) {
      el.animate([{ transform: `translateY(${f - l}px)` }, { transform: 'none' }], {
        duration: 420,
        easing: EASE,
      });
    }
  });
}

/** Esce scivolando a destra, poi la si toglie e le altre salgono (solo transform/opacity). */
export function collapseThen(el: Element | null | undefined, remove: () => void): void {
  if (!el) {
    flip(remove);
    return;
  }
  const a = el.animate(
    [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateX(40px)' },
    ],
    { duration: 190, easing: EASE, fill: 'forwards' },
  );
  a.onfinish = () => {
    flip(remove);
  };
}

/** Ordina gli elementi secondo l'ordine congelato (i nuovi in fondo). */
export function frozenOrder<T extends { id: string }>(items: T[], ids: readonly string[]): T[] {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
}
