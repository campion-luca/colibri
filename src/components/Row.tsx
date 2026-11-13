import { Fragment, memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { thud, tone } from '../audio/engine.ts';
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
import { nope, shake } from '../fx/effects.ts';
import { SETTLE_DONE_MS, feelToggle } from '../fx/feel.ts';
import { haptic, hapticNeedsGesture } from '../fx/haptics.ts';
import { settleAfter } from '../fx/order.ts';
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

function RowView({ item: it, k, now, onReorder, ...opts }: RowProps) {
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
  // in "Promesse e scadenze" la scadenza di oggi è già nel tag, tranne l'orario
  if (!daily && !done && !(opts.showPromise && isDueToday(it, today) && !it.dueTime)) {
    const d = dueLabel(it, now);
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

  const onToggle = (chk: HTMLElement): boolean => {
    // la riga cambia aspetto dov'è; scorre al suo posto dopo la pausa
    settleAfter(SETTLE_DONE_MS);
    const r = useGame.getState().toggle(it.id, getNow());
    if (!r) return true;
    if (!r.ok) {
      toast(r.reason);
      return false;
    }
    feelToggle(r, chk);
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
                onClick={(e) => {
                  promise(it.id, when, e.currentTarget);
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

/** Ridisegna solo la riga che cambia: le altre restano ferme durante le animazioni. */
export const Row = memo(RowView);

/* ---------- casella ---------- */

interface CheckProps {
  /** da "Seria" in su: tieni premuto 750 ms */
  hold: boolean;
  part: boolean;
  pct: number;
  /** false = tocco rifiutato (la casella fa "no") */
  onToggle: (chk: HTMLElement) => boolean;
}

function Check({ hold, part, pct, onToggle }: CheckProps) {
  const box = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const buzz = useRef<number | null>(null);
  const justHeld = useRef(false);
  /** completata a tempo: su iOS si ripete la vibrazione al rilascio (gesto utente) */
  const heldDone = useRef(false);
  const [holding, setHolding] = useState(false);

  const stopBuzz = () => {
    if (buzz.current !== null) window.clearInterval(buzz.current);
    buzz.current = null;
  };

  const toggleNow = (): boolean => {
    const el = box.current;
    if (!el) return false;
    if (onToggle(el)) return true;
    nope(el);
    return false;
  };

  const cancelHold = () => {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
    stopBuzz();
    setHolding(false);
    shake(box.current);
    toast('Tieni premuto per completare');
  };

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      stopBuzz();
    },
    [],
  );

  return (
    <button
      type="button"
      className="chk-btn"
      aria-label={hold ? 'Tieni premuto per completare' : 'Completa'}
      onPointerDown={(e) => {
        if (!hold) return;
        e.preventDefault();
        setHolding(true);
        haptic(6);
        // ronzio che sale mentre il bordo si riempie
        let k = 0;
        buzz.current = window.setInterval(() => {
          k++;
          tone(200 + k * 40, 0.04, 'square', 0.07, 0, 1600);
        }, 110);
        timer.current = window.setTimeout(() => {
          timer.current = null;
          stopBuzz();
          setHolding(false);
          justHeld.current = true;
          window.setTimeout(() => {
            justHeld.current = false;
          }, 600);
          // la vibrazione parte subito (feelToggle); su iOS può non arrivare perché
          // scatta a tempo e non dentro un gesto: la si ripete al rilascio
          heldDone.current = toggleNow();
        }, HOLD_MS);
      }}
      onPointerUp={() => {
        if (heldDone.current) {
          heldDone.current = false;
          if (hapticNeedsGesture()) haptic(14);
          return;
        }
        cancelHold();
      }}
      onPointerCancel={() => {
        heldDone.current = false;
        cancelHold();
      }}
      onPointerLeave={() => {
        heldDone.current = false;
        cancelHold();
      }}
      onClick={(e) => {
        if (justHeld.current) {
          justHeld.current = false;
          return;
        }
        // con il dito si tiene premuto; da tastiera (detail = 0) basta Invio
        if (hold && e.detail !== 0) return;
        toggleNow();
      }}
    >
      <span
        ref={box}
        className={`chk ${hold ? 'hold' : ''} ${part ? 'part' : ''} ${holding ? 'holding' : ''}`}
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
        startDrag(e.currentTarget, e.clientY, {
          onLift: () => {
            haptic(18);
            tone(262, 0.06, 'square', 0.09, 0, 1400);
            tone(392, 0.06, 'square', 0.07, 0.04, 1600);
          },
          onMove: (target) => {
            tone(300 + target * 30, 0.03, 'square', 0.05, 0, 1800);
            haptic(5);
          },
          onDrop: (from, to) => {
            onReorder(from, to);
            thud();
            haptic(14);
          },
          onCancel: () => {
            tone(262, 0.05, 'square', 0.06, 0, 1400);
          },
        });
      }}
    >
      <i />
      <i />
      <i />
    </span>
  );
}
