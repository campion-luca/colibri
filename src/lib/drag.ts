import { flushSync } from 'react-dom';
import { reducedMotion } from '../fx/core.ts';

/*
 * Trascina per riordinare (dalla bozza). Si lavora direttamente sul DOM durante il
 * trascinamento; al rilascio si salva il nuovo ordine e React ridisegna.
 * Solo dentro la stessa sezione: righe sorelle con lo stesso `data-k`.
 */

export interface DragHandlers {
  onDrop: (from: number, to: number) => void;
  /** la riga si solleva */
  onLift?: () => void;
  /** cambio di posizione durante il trascinamento */
  onMove?: (to: number) => void;
  /** rilasciata al suo posto */
  onCancel?: () => void;
}

interface DragState {
  el: HTMLElement;
  sibs: HTMLElement[];
  idx: number;
  cur: number;
  startY: number;
  lastY: number;
  rects: DOMRect[];
  h: number;
  sy0: number;
  handlers: DragHandlers;
}

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const GAP = 6; // margin-bottom delle righe
let drag: DragState | null = null;

export function startDrag(grip: HTMLElement, clientY: number, handlers: DragHandlers): void {
  const el = grip.closest<HTMLElement>('[data-id]');
  const parent = el?.parentElement;
  if (!el || !parent) return;
  const k = el.dataset.k;
  const sibs = Array.from(parent.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.dataset.k === k,
  );
  if (sibs.length < 2) {
    if (reducedMotion()) return;
    el.animate(
      [{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }],
      { duration: 220 },
    );
    return;
  }
  const idx = sibs.indexOf(el);
  const rects = sibs.map((s) => s.getBoundingClientRect());
  const r0 = rects[idx];
  if (!r0) return;
  drag = {
    el,
    sibs,
    idx,
    cur: idx,
    startY: clientY,
    lastY: clientY,
    rects,
    h: r0.height + GAP,
    sy0: window.scrollY,
    handlers,
  };
  el.classList.add('dragging');
  document.body.classList.add('is-dragging');
  for (const s of sibs) if (s !== el) s.style.transition = `transform .22s ${EASE}`;
  handlers.onLift?.();

  const loop = () => {
    if (!drag) return;
    // autoscroll ai bordi
    if (drag.lastY < 110) window.scrollBy(0, -7);
    else if (drag.lastY > window.innerHeight - 150) window.scrollBy(0, 7);
    update();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function update(): void {
  const D = drag;
  if (!D) return;
  const dy = D.lastY - D.startY + (window.scrollY - D.sy0);
  D.el.style.transform = `translateY(${dy}px) scale(1.03) rotate(-.6deg)`;
  const r0 = D.rects[D.idx];
  if (!r0) return;
  const center = r0.top + r0.height / 2 + dy;
  let target = 0;
  D.rects.forEach((r, j) => {
    if (j !== D.idx && r.top + r.height / 2 < center) target++;
  });
  D.sibs.forEach((s, j) => {
    if (j === D.idx) return;
    let shift = 0;
    if (D.idx < target && j > D.idx && j <= target) shift = -D.h;
    if (D.idx > target && j >= target && j < D.idx) shift = D.h;
    s.style.transform = shift ? `translateY(${shift}px)` : '';
  });
  if (target !== D.cur) {
    D.cur = target;
    D.handlers.onMove?.(target);
  }
}

function endDrag(): void {
  const D = drag;
  if (!D) return;
  drag = null;
  const r0 = D.rects[D.idx];
  const rt = D.rects[D.cur];
  let off = 0;
  if (r0 && rt) {
    if (D.cur > D.idx) off = rt.bottom - r0.height - r0.top;
    else if (D.cur < D.idx) off = rt.top - r0.top;
  }
  D.el.style.transition = `transform .18s ${EASE}`;
  D.el.style.transform = `translateY(${off - (window.scrollY - D.sy0)}px)`;
  window.setTimeout(() => {
    document.body.classList.remove('is-dragging');
    D.el.classList.remove('dragging');
    for (const s of D.sibs) {
      s.style.transform = '';
      s.style.transition = '';
    }
    // stesso frame: niente salto tra la posizione vecchia e quella nuova
    if (D.cur !== D.idx) {
      flushSync(() => {
        D.handlers.onDrop(D.idx, D.cur);
      });
    } else {
      D.handlers.onCancel?.();
    }
  }, 180);
}

if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointermove',
    (e) => {
      if (!drag) return;
      e.preventDefault();
      drag.lastY = e.clientY;
    },
    { passive: false },
  );
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  document.addEventListener(
    'touchmove',
    (e) => {
      if (drag) e.preventDefault();
    },
    { passive: false },
  );
}

export const isDragging = (): boolean => drag !== null;
