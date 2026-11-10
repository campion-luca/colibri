import { useEffect, useRef, useState } from 'react';
import { RANKS, STRIKE_FROM, type RankProgress } from '../domain/index.ts';
import { SPRING, eachEased } from '../fx/core.ts';
import { shake } from '../fx/effects.ts';
import { Emblem } from './Emblem.tsx';
import { Fire } from './Fire.tsx';

export interface HeaderProps {
  progress: RankProgress;
  xp: number;
  strike: number;
  /** es. "3h 12m" */
  midnightIn: string;
  /** XP a rischio a mezzanotte (0 = tutto al sicuro) */
  risk: number;
  /** pausa attiva: motivo e "fino a …" */
  paused: { reason: string; until: string } | null;
  onOpenSettings: () => void;
}

/** Contatore che corre al nuovo valore (700 ms, ease-out cubica come nella bozza). */
function useTweened(value: number, dur = 700): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3)));
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [value, dur]);
  return shown;
}

const GAIN: Keyframe[] = eachEased(
  [
    { transform: 'scale(1)' },
    { transform: 'scale(1.12) rotate(-4deg)', offset: 0.4 },
    { transform: 'scale(1)' },
  ],
  SPRING,
);

export function Header({
  progress,
  xp,
  strike,
  midnightIn,
  risk,
  paused,
  onOpenSettings,
}: HeaderProps) {
  const { index, rank, next, pct, toNext } = progress;
  const shownXp = useTweened(xp);
  const box = useRef<HTMLElement>(null);
  const emblem = useRef<HTMLSpanElement>(null);
  const lastXp = useRef(xp);

  // scossa quando perdi XP, scatto dello stemma quando guadagni
  useEffect(() => {
    if (xp < lastXp.current) shake(box.current, 450);
    else if (xp > lastXp.current) emblem.current?.animate(GAIN, { duration: 600 });
    lastXp.current = xp;
  }, [xp]);

  return (
    <header ref={box} className="relative border border-line bg-s1">
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label={`Rank ${rank.n}, ${xp} XP. Apri impostazioni`}
        className="block w-full px-3.5 pt-[22px] pb-3 text-left"
      >
        <span className="flex flex-col items-center text-center">
          <Emblem
            ref={emblem}
            rank={index}
            className={`mb-4 size-[104px] animate-bob ${paused ? 'brightness-75 grayscale-[.85]' : ''}`}
          />
          <span className="block text-[11px] tracking-[.14em] text-muted uppercase">
            Rank {index + 1}/{RANKS.length}
          </span>
          <b className="block text-[28px] font-bold tracking-[-.01em]">{rank.n}</b>
          <span className="mt-1 block font-mono text-[15px] text-muted">
            <span className="text-lg text-ivory num">{shownXp}</span> XP
          </span>
        </span>

        <span className="relative mt-3 block h-2.5 overflow-hidden bg-s2">
          <i
            className={`absolute inset-y-0 left-0 transition-[width] duration-700 ease-soft after:absolute after:inset-0 after:animate-shine after:bg-linear-to-r after:from-transparent after:via-ivory/35 after:to-transparent ${paused ? 'bg-muted' : 'bg-amber'}`}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="mt-1.5 flex justify-between font-mono text-[10px] text-muted">
          <span>
            {rank.n} · {rank.min}
          </span>
          <span>{next ? `${toNext ?? 0} XP a ${next.n}` : 'Rank massimo'}</span>
        </span>

        {paused ? (
          <span className="mt-2.5 flex items-center justify-between border-t border-dashed border-line pt-2.5 text-xs text-ivory">
            <span>⏸ In pausa · {paused.reason}</span>
            <span>{paused.until}</span>
          </span>
        ) : (
          <span className="mt-2.5 flex items-center justify-between border-t border-dashed border-line pt-2.5 text-xs text-muted">
            <span className="num">Mezzanotte tra {midnightIn}</span>
            {risk > 0 ? (
              <span>
                a rischio <b className="font-mono font-semibold text-red">−{risk} XP</b>
              </span>
            ) : (
              <span>
                <b className="font-mono font-semibold text-green">tutto al sicuro</b>
              </span>
            )}
          </span>
        )}
        {strike >= STRIKE_FROM && <Fire n={strike} size="top" />}
      </button>
    </header>
  );
}
