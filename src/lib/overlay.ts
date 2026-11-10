import { useEffect, useRef } from 'react';

/*
 * Predictive back: finché c'è un pannello aperto teniamo una voce in più nella
 * cronologia, così il gesto (o il tasto) indietro chiude il pannello invece di
 * uscire dall'app. Una sola voce per tutta la pila di pannelli.
 */

const stack: (() => void)[] = [];
let pushed = false;
let ignorePops = 0;
let pending: number | undefined;

function onPop() {
  if (ignorePops > 0) {
    ignorePops--;
    return;
  }
  pushed = false;
  const top = stack[stack.length - 1];
  top?.();
  // sotto c'è ancora un pannello: rimetti la voce per il prossimo indietro
  if (stack.length > 1) {
    history.pushState({ colibriOverlay: true }, '');
    pushed = true;
  }
}

if (typeof window !== 'undefined') window.addEventListener('popstate', onPop);

function register(close: () => void): () => void {
  stack.push(close);
  window.clearTimeout(pending);
  if (!pushed) {
    history.pushState({ colibriOverlay: true }, '');
    pushed = true;
  }
  return () => {
    const i = stack.lastIndexOf(close);
    if (i >= 0) stack.splice(i, 1);
    if (stack.length > 0 || !pushed) return;
    // aspetta un attimo: se si apre subito un altro pannello la voce resta
    pending = window.setTimeout(() => {
      if (stack.length === 0 && pushed) {
        pushed = false;
        ignorePops++;
        history.back();
      }
    }, 60);
  };
}

/** Collega un pannello al gesto indietro mentre `open` è vero. */
export function useBackToClose(open: boolean, close: () => void): void {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    return register(() => {
      closeRef.current();
    });
  }, [open]);
}
