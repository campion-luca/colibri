import { useEffect, useRef, useState } from 'react';
import { SFX, thud } from '../audio/engine.ts';
import { RANKS, rankIndex } from '../domain/index.ts';
import { EASE } from '../fx/core.ts';
import { confettiBurst, sparks } from '../fx/effects.ts';
import { haptic } from '../fx/haptics.ts';
import { useBackToClose } from '../lib/overlay.ts';
import { useGame } from '../store/game.ts';
import { useUi, type Overlay as OverlayData } from '../store/ui.ts';
import { Emblem } from './Emblem.tsx';

/** Overlay a tutto schermo: salita/discesa di rank e anteprima degli stemmi. */
export function Overlay() {
  const ov = useUi((s) => s.overlay);
  const open = useUi((s) => s.overlayOpen);
  const close = useUi((s) => s.closeOverlay);
  useBackToClose(open, close);
  if (!ov) return null;
  return <OverlayView key={ov.id} ov={ov} open={open} close={close} />;
}

function OverlayView({ ov, open, close }: { ov: OverlayData; open: boolean; close: () => void }) {
  // entra con una dissolvenza: la classe "on" arriva al frame dopo il montaggio
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setShown(true);
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={`ovl ${shown && open ? 'on' : ''}`} role="dialog" aria-modal="true">
      <div className="ovl-c">
        {ov.type === 'rank' ? (
          <RankChange rank={ov.rank} up={ov.up} close={close} />
        ) : (
          <RankPreview rank={ov.rank} close={close} />
        )}
      </div>
    </div>
  );
}

function RankChange({ rank, up, close }: { rank: number; up: boolean; close: () => void }) {
  const xp = useGame((s) => s.xp);
  const emb = useRef<HTMLSpanElement>(null);
  const played = useRef(false);
  const next = RANKS[rank + 1];

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    const el = emb.current;
    if (up) {
      SFX.up();
      confettiBurst(true);
      haptic(40);
      el?.animate(
        [
          { transform: 'scale(.2) rotate(-200deg)', opacity: 0 },
          { transform: 'scale(1.2) rotate(10deg)', opacity: 1, offset: 0.6 },
          { transform: 'none' },
        ],
        { duration: 900, easing: EASE },
      );
      window.setTimeout(() => {
        const r = el?.getBoundingClientRect();
        if (r) {
          sparks(r.left + r.width / 2, r.top + r.height / 2, 24);
          thud();
        }
      }, 550);
    } else {
      SFX.down();
      haptic(80);
      el?.animate(
        [
          { transform: 'translateY(-30px) rotate(-8deg)' },
          { transform: 'translateY(6px) rotate(4deg)' },
          { transform: 'none' },
        ],
        { duration: 600, easing: 'cubic-bezier(.3,1.6,.5,1)' },
      );
    }
  }, [up]);

  return (
    <>
      <Emblem ref={emb} rank={rank} className={up ? '' : 'down'} />
      <div className="k">{up ? 'Nuovo rank' : 'Sei sceso di rank'}</div>
      <h1>{RANKS[rank]?.n}</h1>
      <p className="rules" style={{ margin: '10px 0 18px' }}>
        {up
          ? next
            ? `Prossimo: ${next.n} a ${next.min} XP`
            : 'Sei al massimo. Ora restaci.'
          : next
            ? `Ti servono ${next.min - xp} XP per tornare ${next.n}.`
            : ''}
      </p>
      <button type="button" className={`btn ${up ? '' : 'danger'}`} onClick={close}>
        {up ? 'Avanti' : 'Ricevuto'}
      </button>
    </>
  );
}

function RankPreview({ rank, close }: { rank: number; close: () => void }) {
  const xp = useGame((s) => s.xp);
  const mine = rankIndex(xp);
  const emb = useRef<HTMLSpanElement>(null);
  const r = RANKS[rank];

  useEffect(() => {
    emb.current?.animate(
      [
        { transform: 'scale(.6) rotate(-8deg)', opacity: 0 },
        { transform: 'scale(1.06)', opacity: 1, offset: 0.6 },
        { transform: 'none' },
      ],
      { duration: 500, easing: EASE },
    );
  }, []);

  if (!r) return null;
  const locked = rank > mine;
  return (
    <>
      <Emblem ref={emb} rank={rank} locked={locked} />
      <div className="k">
        {locked ? 'Stemma segreto' : rank === mine ? 'Il tuo stemma' : 'Già superato'}
      </div>
      <h1>{r.n}</h1>
      <p className="rules" style={{ margin: '10px 0 18px' }}>
        {locked
          ? `Si svela a ${r.min} XP · ti mancano ${r.min - xp} XP`
          : `Rank ${rank + 1} di ${RANKS.length} · da ${r.min} XP`}
      </p>
      <button type="button" className="btn ghost" onClick={close}>
        Chiudi
      </button>
    </>
  );
}
