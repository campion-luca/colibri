/*
 * Elementi FX temporanei: creati al volo, animati solo con transform/opacity,
 * rimossi a fine animazione. Al massimo ~40 nodi contemporanei: oltre, le
 * particelle decorative vengono saltate (gli elementi essenziali passano sempre).
 */

export const EASE = 'cubic-bezier(.2,.8,.2,1)';
export const SPRING = 'cubic-bezier(.3,1.6,.5,1)';
export const BURST = 'cubic-bezier(.1,.7,.3,1)';

const MAX_FX = 40;
let live = 0;

export const fxCount = (): number => live;

export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Nuovo nodo FX nel body (o in `parent`). `null` se il budget è esaurito. */
export function spawn(
  className: string,
  opts: { essential?: boolean; parent?: HTMLElement } = {},
): HTMLDivElement | null {
  if (!opts.essential && live >= MAX_FX) return null;
  live++;
  const el = document.createElement('div');
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  (opts.parent ?? document.body).appendChild(el);
  return el;
}

/** Anima un nodo FX e lo rimuove alla fine (anche se l'animazione viene annullata). */
export function playOnce(
  el: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation {
  const a = el.animate(keyframes, options);
  let gone = false;
  const end = () => {
    if (gone) return;
    gone = true;
    el.remove();
    live--;
  };
  a.onfinish = end;
  a.oncancel = end;
  return a;
}

/** Keyframe con la stessa curva su ogni intervallo, come `animation-timing-function` in CSS. */
export const eachEased = (frames: Keyframe[], easing: string): Keyframe[] =>
  frames.map((f, i) => (i < frames.length - 1 ? { easing, ...f } : f));

export const centerOf = (el: Element): { x: number; y: number } => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
