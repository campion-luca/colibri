import { SFX, fanfare, flutter, thud, tone, whoosh } from '../audio/engine.ts';
import { heatOf, type Celebration } from '../domain/index.ts';
import { BIRD_SVG, FIRE_SVG, SHOCK_SVG } from './art.ts';
import { BURST, EASE, SPRING, eachEased, playOnce, reducedMotion, spawn } from './core.ts';
import { haptic } from './haptics.ts';

/* Effetti portati dalla bozza: stessi tempi, curve e frequenze. */

/** "+N XP" che sale (con "1/3" sotto per le ripetizioni). */
export function floatText(x: number, y: number, text: string, neg = false, sub = ''): void {
  const el = spawn(`float${neg ? ' neg' : ''}`, { essential: true });
  if (!el) return;
  el.textContent = text;
  if (sub) {
    const em = document.createElement('em');
    em.textContent = sub;
    el.appendChild(em);
  }
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  playOnce(
    el,
    [
      { transform: 'translate(-50%,0) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-18px) scale(1.15)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-56px) scale(1)', opacity: 0 },
    ],
    { duration: 1100, easing: EASE },
  );
}

/** Particelle quadrate. Saltate con prefers-reduced-motion o a budget esaurito. */
export function sparks(x: number, y: number, n = 10, color?: string): void {
  if (reducedMotion()) return;
  for (let i = 0; i < n; i++) {
    const s = spawn('spark');
    if (!s) return;
    if (color) s.style.background = color;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const d = 28 + Math.random() * 26;
    playOnce(
      s,
      [
        { transform: 'translate(-50%,-50%) rotate(0) scale(1)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d}px)) rotate(${180 + Math.random() * 180}deg) scale(.2)`,
          opacity: 0,
        },
      ],
      { duration: 520 + Math.random() * 200, easing: BURST },
    );
  }
}

/** Pop della casella (spring su ogni intervallo, come l'animazione CSS della bozza). */
export function pop(el: Element, duration = 450): void {
  el.animate(
    eachEased(
      [{ transform: 'scale(.7)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      SPRING,
    ),
    { duration },
  );
}

const HIT: Keyframe[] = eachEased(
  [
    { transform: 'none' },
    { transform: 'translateX(-6px)', offset: 0.2 },
    { transform: 'translateX(5px)', offset: 0.4 },
    { transform: 'translateX(-3px)', offset: 0.6 },
    { transform: 'translateX(2px)', offset: 0.8 },
    { transform: 'none' },
  ],
  'ease',
);

/** Scossa breve ("no" della casella, header che perde XP). Niente con reduced motion. */
export function shake(el: Element | null | undefined, duration = 300): void {
  if (!el || reducedMotion()) return;
  el.animate(HIT, { duration });
}

/** Scossa del campo vuoto nel pannello. */
export function nudge(el: Element | null | undefined): void {
  if (!el || reducedMotion()) return;
  el.animate(
    [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }],
    { duration: 250 },
  );
}

/** Lo schermo che trema sotto il timbro. */
export function shakeApp(): void {
  if (reducedMotion()) return;
  document
    .getElementById('app')
    ?.animate(
      [
        { transform: 'none' },
        { transform: 'translate(-7px,3px)' },
        { transform: 'translate(6px,-4px)' },
        { transform: 'translate(-4px,2px)' },
        { transform: 'translate(3px,-1px)' },
        { transform: 'none' },
      ],
      { duration: 420 },
    );
}

/** Fiamma che sale dalla casella con "STRIKE ×N", vampata e particelle. */
export function fireBurst(x0: number, y: number, n: number): void {
  const x = Math.min(window.innerWidth - 70, Math.max(70, x0));
  const el = spawn('fireburst', { essential: true });
  if (!el) return;
  el.dataset.heat = String(heatOf(n));
  el.innerHTML = `${FIRE_SVG}<b>STRIKE ×${n}</b>`;
  el.style.left = `${x}px`;
  el.style.top = `${y - 30}px`;
  playOnce(
    el,
    [
      { transform: 'translate(-50%,-30%) scale(.3)', opacity: 0 },
      { transform: 'translate(-50%,-60%) scale(1.15)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-70%) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-110%) scale(.8)', opacity: 0 },
    ],
    { duration: 1300, easing: EASE },
  );
  sparks(x, y, 14, '#E0533D');
  sparks(x, y, 8, '#FFE3A3');
  whoosh(n);
  haptic([12, 40, 18]);
}

/* ---------- coriandoli: canvas-confetti caricato solo al primo uso ---------- */

type Confetti = typeof import('canvas-confetti');
let confettiLib: Promise<Confetti> | null = null;
const loadConfetti = (): Promise<Confetti> =>
  (confettiLib ??= import('canvas-confetti').then((m) => m.default));

export function confettiBurst(big = false): void {
  void loadConfetti().then((confetti) => {
    const c = {
      colors: ['#F2A33A', '#EFE9DC', '#a8661a', '#9BC27A'],
      shapes: ['square' as const],
      disableForReducedMotion: true,
    };
    void confetti({
      ...c,
      particleCount: big ? 160 : 90,
      spread: big ? 110 : 75,
      origin: { y: 0.7 },
      startVelocity: big ? 55 : 42,
      scalar: 1,
    });
    if (big) {
      window.setTimeout(() => {
        void confetti({
          ...c,
          particleCount: 80,
          spread: 140,
          origin: { y: 0.4 },
          startVelocity: 35,
        });
      }, 220);
    }
  });
}

/** Coriandoli dagli angoli in basso. */
export function sideCannons(big: boolean): void {
  void loadConfetti().then((confetti) => {
    const c = {
      colors: ['#F2A33A', '#EFE9DC', '#a8661a', '#E0533D'],
      shapes: ['square' as const],
      particleCount: big ? 90 : 55,
      spread: 55,
      startVelocity: big ? 68 : 55,
      disableForReducedMotion: true,
    };
    void confetti({ ...c, angle: 60, origin: { x: 0, y: 0.9 } });
    void confetti({ ...c, angle: 120, origin: { x: 1, y: 0.9 } });
    if (big) {
      window.setTimeout(() => {
        void confetti({ ...c, angle: 75, origin: { x: 0, y: 0.7 } });
        void confetti({ ...c, angle: 105, origin: { x: 1, y: 0.7 } });
        confettiBurst(true);
      }, 350);
    }
  });
}

/* ---------- celebrazioni ---------- */

/** Timbro con flash, colpo, schermo che trema, onde d'urto quadrate e scintille. */
export function stamp(lines: string[], sub: string, big = false): void {
  const fl = spawn('flash', { essential: true });
  if (fl) {
    playOnce(fl, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }], { duration: 900 });
  }
  const el = spawn(`stamp${big ? ' big' : ''}`, { essential: true });
  if (el) {
    const inner = document.createElement('div');
    inner.className = 'stamp-in';
    lines.forEach((l, i) => {
      if (i) inner.appendChild(document.createElement('br'));
      inner.appendChild(document.createTextNode(l));
    });
    const small = document.createElement('small');
    small.textContent = sub;
    inner.appendChild(small);
    el.appendChild(inner);
    playOnce(
      el,
      [
        { transform: 'translate(-50%,-50%) scale(3) rotate(-14deg)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(.92) rotate(-5deg)', opacity: 1, offset: 0.12 },
        { transform: 'translate(-50%,-50%) scale(1.04) rotate(-6deg)', opacity: 1, offset: 0.18 },
        { transform: 'translate(-50%,-50%) scale(1) rotate(-6deg)', opacity: 1, offset: 0.8 },
        { transform: 'translate(-50%,-50%) scale(1.1) rotate(-6deg)', opacity: 0 },
      ],
      { duration: big ? 2600 : 2000, easing: EASE },
    );
  }
  window.setTimeout(() => {
    thud();
    shakeApp();
    haptic([30, 30, 60]);
    for (let k = 0; k < (big ? 3 : 2); k++) {
      const sh = spawn('shock', { essential: true });
      if (!sh) continue;
      sh.innerHTML = SHOCK_SVG;
      playOnce(
        sh,
        [
          { transform: 'translate(-50%,-50%) scale(1) rotate(-6deg)', opacity: 1 },
          { transform: 'translate(-50%,-50%) scale(12) rotate(-6deg)', opacity: 0 },
        ],
        { duration: 700 + k * 200, delay: k * 110, easing: BURST, fill: 'backwards' },
      );
    }
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.4;
    sparks(cx, cy, big ? 26 : 18);
    sparks(cx, cy, 10, '#EFE9DC');
  }, 240);
}

/** Il colibrì attraversa lo schermo con una scia. Con reduced motion resta solo il frullo. */
export function colibriFly(): void {
  flutter(1.6);
  if (reducedMotion()) return;
  const el = spawn('flyer', { essential: true });
  if (!el) return;
  el.innerHTML = BIRD_SVG('#F2A33A');
  const W = window.innerWidth;
  const H = window.innerHeight;
  const pts: [number, number, number][] = [
    [-90, H * 0.78, -10],
    [W * 0.25, H * 0.55, -18],
    [W * 0.5, H * 0.66, 8],
    [W * 0.72, H * 0.36, -22],
    [W + 100, H * 0.12, -25],
  ];
  const anim = playOnce(
    el,
    pts.map(([x, y, r], i) => ({
      transform: `translate(${x}px,${y}px) rotate(${r}deg)`,
      offset: i / (pts.length - 1),
    })),
    { duration: 1600, easing: 'ease-in-out' },
  );
  const trail = window.setInterval(() => {
    const r = el.getBoundingClientRect();
    if (r.width) sparks(r.left + 14, r.top + r.height * 0.6, 3);
  }, 45);
  anim.addEventListener('finish', () => {
    window.clearInterval(trail);
  });
  anim.addEventListener('cancel', () => {
    window.clearInterval(trail);
  });
}

/** Onda sulle righe della sezione: spinta + bagliore ambra (solo transform/opacity). */
export function waveSection(k: string): void {
  const rows = document.querySelectorAll<HTMLElement>(`main .row[data-k="${k}"]`);
  rows.forEach((row, i) => {
    window.setTimeout(() => {
      if (!reducedMotion()) {
        row.animate(
          eachEased(
            [
              { transform: 'none' },
              { transform: 'translateX(6px) scale(1.025)', offset: 0.35 },
              { transform: 'none' },
            ],
            SPRING,
          ),
          { duration: 550 },
        );
      }
      const glow = spawn('wave-glow', { parent: row });
      if (glow) {
        playOnce(
          glow,
          eachEased([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], SPRING),
          {
            duration: 550,
          },
        );
      }
      tone(392 + i * 60, 0.05, 'square', 0.04, 0, 2000);
    }, i * 70);
  });
}

export function celebrate(kind: Celebration): void {
  if (kind === 'daily') {
    waveSection('d');
    window.setTimeout(() => {
      stamp(['Quotidiane', 'chiuse'], 'tutto fatto oggi');
      fanfare(false);
      colibriFly();
    }, 250);
  } else if (kind === 'promise') {
    waveSection('p');
    window.setTimeout(() => {
      stamp(['Promesse', 'mantenute'], 'parola data, parola tenuta');
      fanfare(false);
      sideCannons(false);
    }, 250);
  } else {
    waveSection('d');
    waveSection('p');
    window.setTimeout(() => {
      stamp(['Giornata', 'perfetta'], 'zero xp a rischio', true);
      fanfare(true);
      colibriFly();
      sideCannons(true);
    }, 300);
  }
}

/** "No": scossa della casella, suono e vibrazione. */
export function nope(el: Element | null | undefined): void {
  shake(el);
  SFX.undo();
  haptic(20);
}
