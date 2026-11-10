import { useEffect, useState } from 'react';
import { AppSheet } from './components/AppSheet.tsx';
import { Header } from './components/Header.tsx';
import { Nav } from './components/Nav.tsx';
import { Toasts } from './components/Toasts.tsx';
import {
  fmtDay,
  formatLeft,
  msToMidnight,
  newDraft,
  pauseOn,
  rankProgress,
  riskAt,
  windowToast,
} from './domain/index.ts';
import { NowContext, getNow, useNow } from './lib/now.ts';
import { CalendarScreen } from './screens/CalendarScreen.tsx';
import { Lists } from './screens/Lists.tsx';
import { Today } from './screens/Today.tsx';
import { useGame } from './store/game.ts';
import { toast, useUi } from './store/ui.ts';

const TICK_MS = 30_000;

export function App() {
  const [now, setNow] = useState(getNow);

  // l'orologio dell'interfaccia: ogni 30 s e quando si torna sull'app
  useEffect(() => {
    const refresh = () => {
      setNow(getNow());
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const id = window.setInterval(refresh, TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  // mezzanotte e chiusura delle fasce
  useEffect(() => {
    const r = useGame.getState().tick(now);
    if (r.windowEvents.length) toast(windowToast(r.windowEvents));
  }, [now]);

  return (
    <NowContext value={now}>
      <div className="mx-auto min-h-full max-w-[480px] px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-[calc(env(safe-area-inset-bottom)+110px)]">
        <HeaderContainer />
        <Screen />
      </div>
      <NavContainer />
      <AppSheet />
      <Toasts />
    </NowContext>
  );
}

function HeaderContainer() {
  const now = useNow();
  const xp = useGame((s) => s.xp);
  const items = useGame((s) => s.items);
  const pauses = useGame((s) => s.pauses);
  const pz = pauseOn(pauses, now.day);
  return (
    <Header
      progress={rankProgress(xp)}
      xp={xp}
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
