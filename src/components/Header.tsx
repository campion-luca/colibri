interface RankInfo {
  name: string;
  min: number;
}

export interface HeaderProps {
  /** indice del rank attuale, 0-based */
  rankIndex: number;
  rankCount: number;
  rank: RankInfo;
  next: RankInfo | null;
  xp: number;
  /** es. "3h 12m" */
  midnightIn: string;
  /** XP a rischio a mezzanotte (0 = tutto al sicuro) */
  risk: number;
  onOpenSettings: () => void;
}

/* Segnaposto: lo stemma Uovo della bozza. In F3 diventa il componente Emblem con tutti i rank. */
function EmblemPlaceholder() {
  return (
    <span className="mb-4 block size-[104px] animate-bob shadow-[0_5px_0_var(--color-shadow)]">
      <svg viewBox="0 0 100 100" aria-hidden="true" className="block size-full">
        <rect x="2" y="2" width="96" height="96" fill="#25211d" stroke="#5d564d" strokeWidth="3" />
        <path
          d="M50 24c14 0 22 20 22 35 0 14-10 23-22 23s-22-9-22-23c0-15 8-35 22-35z"
          fill="none"
          stroke="#EFE9DC"
          strokeWidth="4"
        />
      </svg>
    </span>
  );
}

export function Header({
  rankIndex,
  rankCount,
  rank,
  next,
  xp,
  midnightIn,
  risk,
  onOpenSettings,
}: HeaderProps) {
  const pct = next ? ((xp - rank.min) / (next.min - rank.min)) * 100 : 100;
  const width = `${String(Math.max(0, Math.min(100, pct)))}%`;

  return (
    <header className="relative border border-line bg-s1">
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label={`Rank ${rank.name}, ${String(xp)} XP. Apri impostazioni`}
        className="block w-full px-3.5 pt-[22px] pb-3 text-left"
      >
        <span className="flex flex-col items-center text-center">
          <EmblemPlaceholder />
          <span className="block text-[11px] tracking-[.14em] text-muted uppercase">
            Rank {rankIndex + 1}/{rankCount}
          </span>
          <b className="block text-[28px] font-bold tracking-[-.01em]">{rank.name}</b>
          <span className="mt-1 block font-mono text-[15px] text-muted">
            <span className="text-lg text-ivory num">{xp}</span> XP
          </span>
        </span>

        <span className="relative mt-3 block h-2.5 overflow-hidden bg-s2">
          <i
            className="absolute inset-y-0 left-0 bg-amber transition-[width] duration-700 ease-soft after:absolute after:inset-0 after:animate-shine after:bg-linear-to-r after:from-transparent after:via-ivory/35 after:to-transparent"
            style={{ width }}
          />
        </span>
        <span className="mt-1.5 flex justify-between font-mono text-[10px] text-muted">
          <span>
            {rank.name} · {rank.min}
          </span>
          <span>{next ? `${String(next.min - xp)} XP a ${next.name}` : 'Rank massimo'}</span>
        </span>

        <span className="mt-2.5 flex items-center justify-between border-t border-dashed border-line pt-2.5 text-xs text-muted">
          <span>Mezzanotte tra {midnightIn}</span>
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
      </button>
    </header>
  );
}
