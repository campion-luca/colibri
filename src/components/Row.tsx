import { Fragment, useRef, type ReactNode } from 'react';
import {
  EFFORT,
  HOLD_MS,
  cntOn,
  dailyState,
  dueLabel,
  fmtDay,
  isDone,
  isDueToday,
  isPromisedToday,
  isPromisedTomorrow,
  nextDate,
  recurLabel,
  requiresHold,
  windowLabel,
  xpOf,
  type Item,
  type Now,
} from '../domain/index.ts';
import { promise } from '../lib/actions.ts';
import { startDrag } from '../lib/drag.ts';
import { getNow } from '../lib/now.ts';
import { useGame } from '../store/game.ts';
import { toast, useUi } from '../store/ui.ts';

export interface RowOptions {
  /** in "Promesse e scadenze": tag PROMESSA / SCADENZA */
  showPromise?: boolean;
  /** tag DA COMPRARE */
  showKind?: boolean;
  /** bottoni OGGI / DOM */
  commitBtn?: boolean;
  noGrip?: boolean;
}

interface RowProps extends RowOptions {
  item: Item;
  /** sezione: il riordino avviene solo tra righe con lo stesso `k` */
  k: string;
  now: Now;
  onReorder?: (from: number, to: number) => void;
}

const EffBars = ({ e }: { e: number }) => (
  <span className="eff">
    {[1, 2, 3, 4].map((k) => (
      <i key={k} className={k <= e ? 'f' : ''} />
    ))}
  </span>
);

export function Row({ item: it, k, now, onReorder, ...opts }: RowProps) {
  const today = now.day;
  const daily = it.kind === 'daily';
  const state = daily ? dailyState(it, now) : isDone(it, today) ? 'done' : 'active';
  const done = state === 'done';
  const locked = state === 'soon' || state === 'missed' || state === 'off';
  const hold = requiresHold(it) && !locked;
  const xp = xpOf(it);
  const tm = daily ? it.times : 1;
  const c = daily ? cntOn(it, today) : 0;
  const part = daily && !done && c > 0;

  const meta: ReactNode[] = [];
  if (it.kind !== 'buy') {
    meta.push(
      <>
        <EffBars e={it.effort} /> {EFFORT[it.effort].t}
      </>,
    );
  }
  if (daily && tm > 1) {
    meta.push(
      <span className="pips">
        {Array.from({ length: tm }, (_, j) => (
          <i key={j} className={j < c ? 'f' : ''} />
        ))}
      </span>,
    );
  }
  meta.push(`+${xp} XP${tm > 1 ? ` ×${tm}` : ''}`);
  if (daily && recurLabel(it.recur)) meta.push(recurLabel(it.recur));
  if (state === 'off') {
    const nd = nextDate(it, today);
    meta.push(nd ? `prossima: ${fmtDay(today, nd)}` : '—');
  }
  if (!daily && !done && !(opts.showPromise && isDueToday(it, today))) {
    const d = dueLabel(it, today);
    if (d) meta.push(d.urgent ? <span className="urg">{d.text}</span> : d.text);
  }
  if (daily) {
    const w = windowLabel(it, now);
    if (w) meta.push(w.urgent ? <span className="urg">{w.text}</span> : w.text);
  }
  if (isPromisedTomorrow(it, today) && !done)
    meta.push(<span className="tag tomorrow">DOMANI</span>);
  if (it.note) {
    meta.push(
      <span className="note-ic" title="Nota">
        ✎
      </span>,
    );
  }
  if (opts.showPromise && isPromisedToday(it, today) && !done) {
    meta.push(<span className="tag">PROMESSA</span>);
  } else if (opts.showPromise && isDueToday(it, today)) {
    meta.push(<span className="tag due">SCADENZA</span>);
  }
  if (it.kind === 'buy' && opts.showKind) meta.push(<span className="tag">DA COMPRARE</span>);
  if (it.kind === 'hold') meta.push(<span className="tag parked">IN SOSPESO</span>);

  const onToggle = (): boolean => {
    const r = useGame.getState().toggle(it.id, getNow());
    if (r && !r.ok) {
      toast(r.reason);
      return false;
    }
    return true;
  };

  return (
    <div className={`row ${done ? 'done' : ''} ${locked ? state : ''}`} data-id={it.id} data-k={k}>
      <Check
        hold={hold && !done}
        part={part}
        pct={Math.round((c / tm) * 100)}
        onToggle={onToggle}
      />
      <button
        type="button"
        className="ttl"
        onClick={() => {
          useUi.getState().openSheet({ type: 'edit', id: it.id });
        }}
      >
        <span className="t">{it.title}</span>
        <span className="meta">
          {meta.map((m, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="sep">·</span>}
              <span className="mi">{m}</span>
            </Fragment>
          ))}
        </span>
        {it.note && <span className="note-prev">{it.note.split('\n')[0]?.slice(0, 70)}</span>}
      </button>
      {opts.commitBtn && !done && (
        <span className="prm">
          {([0, 1] as const).map((when) => {
            const on = when === 0 ? isPromisedToday(it, today) : isPromisedTomorrow(it, today);
            return (
              <button
                key={when}
                type="button"
                className={`oggi ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => {
                  promise(it.id, when);
                }}
              >
                {when === 0 ? 'OGGI' : 'DOM'}
              </button>
            );
          })}
        </span>
      )}
      {!opts.noGrip && onReorder && <Grip onReorder={onReorder} />}
    </div>
  );
}

/* ---------- casella ---------- */

interface CheckProps {
  /** da "Seria" in su: tieni premuto 750 ms */
  hold: boolean;
  part: boolean;
  pct: number;
  /** false = tocco rifiutato (la casella fa "no") */
  onToggle: () => boolean;
}

function Check({ hold, part, pct, onToggle }: CheckProps) {
  const box = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const justHeld = useRef(false);

  const nope = () => {
    const el = box.current;
    if (!el) return;
    el.classList.remove('nope');
    el.getBoundingClientRect(); // riflusso: riparte l'animazione
    el.classList.add('nope');
  };

  const cancelHold = () => {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
    box.current?.classList.remove('holding');
    nope();
    toast('Tieni premuto per completare');
  };

  return (
    <button
      type="button"
      className="chk-btn"
      aria-label={hold ? 'Tieni premuto per completare' : 'Completa'}
      onPointerDown={(e) => {
        if (!hold) return;
        e.preventDefault();
        box.current?.classList.add('holding');
        timer.current = window.setTimeout(() => {
          timer.current = null;
          box.current?.classList.remove('holding');
          justHeld.current = true;
          if (!onToggle()) nope();
        }, HOLD_MS);
      }}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      onClick={(e) => {
        if (justHeld.current) {
          justHeld.current = false;
          return;
        }
        // con il dito si tiene premuto; da tastiera (detail = 0) basta Invio
        if (hold && e.detail !== 0) return;
        if (!onToggle()) nope();
      }}
    >
      <span
        ref={box}
        className={`chk ${hold ? 'hold' : ''} ${part ? 'part' : ''}`}
        style={{ '--p': `${pct}%` } as React.CSSProperties}
      >
        <svg className="tick" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        {hold && (
          <>
            <svg className="hold-ring" viewBox="0 0 46 46" aria-hidden="true">
              <rect x="1.5" y="1.5" width="43" height="43" />
            </svg>
            <span className="hold-ico" />
          </>
        )}
      </span>
    </button>
  );
}

/* ---------- grip ---------- */

export function Grip({ onReorder }: { onReorder: (from: number, to: number) => void }) {
  return (
    <span
      className="grip"
      role="button"
      aria-label="Tieni premuto e trascina"
      onPointerDown={(e) => {
        e.preventDefault();
        startDrag(e.currentTarget, e.clientY, { onDrop: onReorder });
      }}
    >
      <i />
      <i />
      <i />
    </span>
  );
}
