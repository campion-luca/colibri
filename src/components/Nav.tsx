import type { ReactNode } from 'react';
import type { Tab } from '../store/ui.ts';

interface NavProps {
  active: Tab;
  onSelect: (tab: Tab) => void;
  onAdd: () => void;
  onSettings: () => void;
}

/* Icone identiche alla bozza */
const ICONS = {
  oggi: (
    <>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <rect x="7" y="13" width="3" height="3" fill="currentColor" stroke="none" />
    </>
  ),
  liste: <path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1" />,
  set: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <rect x="14" y="4.5" width="4" height="5" />
      <rect x="8" y="14.5" width="4" height="5" />
    </>
  ),
} satisfies Record<Tab | 'set', ReactNode>;

function TabButton({
  label,
  icon,
  on = false,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  on?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={on ? 'page' : undefined}
      className={`flex min-w-0 flex-1 flex-col items-center gap-[3px] pt-2.5 pb-2 text-[10px] font-semibold tracking-[.03em] uppercase transition-colors duration-200 ${on ? 'text-amber' : 'text-dim'}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`size-5 fill-none stroke-current stroke-2 transition-transform duration-300 ease-spring [stroke-linecap:square] ${on ? '-translate-y-0.5 scale-[1.12]' : ''}`}
      >
        {icon}
      </svg>
      {label}
    </button>
  );
}

export function Nav({ active, onSelect, onAdd, onSettings }: NavProps) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="pointer-events-auto mx-auto flex max-w-[448px] items-center gap-2 border border-line bg-s1/92 p-1.5 backdrop-blur-[10px]">
        <TabButton
          label="Oggi"
          icon={ICONS.oggi}
          on={active === 'oggi'}
          onClick={() => {
            onSelect('oggi');
          }}
        />
        <TabButton
          label="Calendario"
          icon={ICONS.cal}
          on={active === 'cal'}
          onClick={() => {
            onSelect('cal');
          }}
        />
        <button
          type="button"
          aria-label="Aggiungi"
          onClick={onAdd}
          className="mx-0.5 -mt-1 grid h-14 w-[58px] flex-none place-items-center bg-amber shadow-press transition-[transform,box-shadow] duration-75 active:translate-y-[3px] active:shadow-pressed"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-6 stroke-bg stroke-3 [stroke-linecap:square]"
          >
            <path d="M12 4v16M4 12h16" />
          </svg>
        </button>
        <TabButton
          label="Liste"
          icon={ICONS.liste}
          on={active === 'liste'}
          onClick={() => {
            onSelect('liste');
          }}
        />
        <TabButton label="Impost." icon={ICONS.set} onClick={onSettings} />
      </div>
    </nav>
  );
}
