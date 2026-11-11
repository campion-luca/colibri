import { useEffect, useState } from 'react';
import { SFX, unlockAudio } from './audio/engine.ts';
import { AppSheet } from './components/AppSheet.tsx';
import { FxDefs } from './components/Fire.tsx';
import { Header } from './components/Header.tsx';
import { Nav } from './components/Nav.tsx';
import { Overlay } from './components/Overlay.tsx';
import { Toasts } from './components/Toasts.tsx';
import {
  fmtDay,
  formatLeft,
  msToMidnight,
  newDraft,
  pauseOn,
  rankIndex,
  rankProgress,
  riskAt,
  strikeCount,
  windowToast,
  type XpEvent,
} from './domain/index.ts';
import { SYNC_ENABLED } from './data/client.ts';
import { flush, syncNow, useSync } from './data/sync.ts';
import { haptic } from './fx/haptics.ts';
import { flip } from './fx/order.ts';
import { NowContext, getNow, useNow } from './lib/now.ts';
import { CalendarScreen } from './screens/CalendarScreen.tsx';
import { Lists } from './screens/Lists.tsx';
import { Today } from './screens/Today.tsx';
import { isQuietUpdate, useGame } from './store/game.ts';
import { toast, useUi } from './store/ui.ts';

const TICK_MS = 30_000;
const PRESSABLE = 'button, [role="button"], .ttl, .tgl';

export function App() {
  const [now, setNow] = useState(getNow);

  // l'orologio dell'interfaccia: ogni 30 s e quando si torna sull'app
  useEffect(() => {
    const tick = () => {
      setNow(getNow());
    };
    // tornando sull'app: orologio aggiornato e dati ricaricati dal server
    const back = () => {
      tick();
      if (SYNC_ENABLED) void syncNow();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') back();
    };
    const id = window.setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', back);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', back);
    };
  }, []);

  // mezzanotte e chiusura delle fasce (fuori dal render: le righe scorrono con il FLIP)
  useEffect(() => {
    const id = window.setTimeout(() => {
      let closed: XpEvent[] = [];
      const g = useGame.getState();
      flip(() => {
        // con Supabase la mezzanotte passa da commit_rollover (data/sync)
        if (!SYNC_ENABLED) g.localRollover(now);
        closed = g.closeWindows(now);
      });
      if (SYNC_ENABLED) {
        const s = useGame.getState();
        if (s.lastDate === null || s.lastDate < now.day) void syncNow();
        else if (useSync.getState().queue.length) void flush();
      }
      if (closed.length) {
        SFX.loss();
        haptic(60);
        toast(windowToast(closed));
      }
    }, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, [now]);

  // primo tocco: sblocca l'audio; ogni pressione: tic corto e vibrazione leggera
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      unlockAudio();
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('.grip')) return;
      if (t?.closest(PRESSABLE)) {
        SFX.tick();
        haptic(5);
      }
    };
    // Safari iOS a volte accetta lo sblocco solo su touchend/click
    const UNLOCK = ['touchend', 'click', 'keydown'] as const;
    document.addEventListener('pointerdown', onDown, { capture: true });
    for (const ev of UNLOCK) document.addEventListener(ev, unlockAudio, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onDown, { capture: true });
      for (const ev of UNLOCK) document.removeEventListener(ev, unlockAudio, { capture: true });
    };
  }, []);

  // salita o discesa di rank, 650 ms dopo il cambio di XP (come nella bozza)
  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        if (s.xp === prev.xp || isQuietUpdate()) return;
        const before = rankIndex(prev.xp);
        const after = rankIndex(s.xp);
        if (before === after) return;
        window.setTimeout(() => {
          useUi.getState().openOverlay({ type: 'rank', rank: after, up: after > before });
        }, 650);
      }),
    [],
  );

  return (
    <NowContext value={now}>
      <FxDefs />
      <div
        id="app"
        className="mx-auto min-h-full max-w-[480px] px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-[calc(env(safe-area-inset-bottom)+110px)]"
      >
        <HeaderContainer />
        <Screen />
      </div>
      <NavContainer />
      <AppSheet />
      <Overlay />
      <Toasts />
    </NowContext>
  );
}

function HeaderContainer() {
  const now = useNow();
  const xp = useGame((s) => s.xp);
  const items = useGame((s) => s.items);
  const pauses = useGame((s) => s.pauses);
  const unsynced = useSync((s) => s.queue.length > 0);
  const pz = pauseOn(pauses, now.day);
  return (
    <Header
      unsynced={SYNC_ENABLED && unsynced}
      progress={rankProgress(xp)}
      xp={xp}
      strike={strikeCount(items, now.day)}
      midnightIn={formatLeft(msToMidnight(new Date(now.ts)))}
      risk={riskAt(items, pauses, now)}
      paused={
        pz
          ? {
              reason: pz.reason,
              until: pz.untilDay ? `fino a ${fmtDay(now.day, pz.untilDay)}` : 'senza fine',
            }
          : null
      }
      onOpenSettings={() => {
        useUi.getState().openSheet({ type: 'settings' });
      }}
    />
  );
}

function Screen() {
  const tab = useUi((s) => s.tab);
  return (
    <main key={tab} className="view">
      {tab === 'oggi' ? <Today /> : tab === 'cal' ? <CalendarScreen /> : <Lists />}
    </main>
  );
}

function NavContainer() {
  const tab = useUi((s) => s.tab);
  return (
    <Nav
      active={tab}
      onSelect={(t) => {
        useUi.getState().setTab(t);
      }}
      onAdd={() => {
        const ui = useUi.getState();
        const kind = ui.tab === 'liste' ? ui.listSeg : 'todo';
        ui.openSheet({ type: 'add', draft: newDraft(kind, ui.tab === 'oggi' ? 0 : null) });
      }}
      onSettings={() => {
        useUi.getState().openSheet({ type: 'settings' });
      }}
    />
  );
}
