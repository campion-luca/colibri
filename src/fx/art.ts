/* SVG della bozza usati dagli FX (markup costante). */

/** Il gradiente `#fg` è definito una sola volta nell'app (FxDefs). */
export const FIRE_SVG = `<svg viewBox="0 0 24 32"><path class="fl-o" d="M12 1c2 6 9 10 9 19a9 9 0 0 1-18 0c0-5 3-7 4-11 1 3 2 4 3 4 0-4 0-8 2-12z" fill="url(#fg)"/><path class="fl-i" d="M12 15c1 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-5 .5 1.5 1.2 2 2 2 0-2 0-4 1-6z" fill="#FFEBC2"/></svg>`;

export const BIRD_SVG = (fill = '#13110f'): string =>
  `<svg viewBox="0 0 32 32" fill="${fill}"><path d="M1.5 11.6l9.2.9-.2 1z"/><circle cx="13.2" cy="12.6" r="3.1"/><path d="M14.6 10.2l9.6 6.6-3.6 7.4-7.2-8.3z"/><path d="M15.8 11.8L28.5 3.5l-5.6 11.4z"/><path d="M20.4 22.4l2.6 8 3.4-7.6z"/></svg>`;

/** Onda d'urto quadrata: il bordo resta di 3px anche quando il quadrato si ingrandisce. */
export const SHOCK_SVG = `<svg viewBox="0 0 60 60"><rect x="1.5" y="1.5" width="57" height="57" fill="none" stroke="#F2A33A" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>`;
