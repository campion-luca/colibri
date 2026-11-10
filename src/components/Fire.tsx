import { useEffect, useRef } from 'react';
import { heatOf } from '../domain/index.ts';
import { pop } from '../fx/effects.ts';

/** Fuoco dello strike ×N: fisso nell'header (`top`) o piccolo accanto alla sezione (`sm`). */
export function Fire({ n, size }: { n: number; size: 'top' | 'sm' }) {
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);

  // "bump" quando lo strike sale (anche alla prima comparsa, come nella bozza)
  useEffect(() => {
    if (n > shown.current && el.current) pop(el.current, 500);
    shown.current = n;
  }, [n]);

  return (
    <span ref={el} className={`fire ${size}`} data-heat={heatOf(n)} aria-label={`Strike ×${n}`}>
      <svg viewBox="0 0 24 32" aria-hidden="true">
        <path
          className="fl-o"
          d="M12 1c2 6 9 10 9 19a9 9 0 0 1-18 0c0-5 3-7 4-11 1 3 2 4 3 4 0-4 0-8 2-12z"
          fill="url(#fg)"
        />
        <path
          className="fl-i"
          d="M12 15c1 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-5 .5 1.5 1.2 2 2 2 0-2 0-4 1-6z"
          fill="#FFEBC2"
        />
      </svg>
      <b>×{n}</b>
    </span>
  );
}

/** Gradiente della fiamma, definito una volta sola per tutti i fuochi (anche quelli FX). */
export function FxDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="fg" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#E0533D" />
          <stop offset=".55" stopColor="#F2A33A" />
          <stop offset="1" stopColor="#FFE3A3" />
        </linearGradient>
      </defs>
    </svg>
  );
}
