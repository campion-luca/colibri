import { useState } from 'react';
import { Header } from './components/Header.tsx';
import { Nav, type Tab } from './components/Nav.tsx';

/* F0: solo layout. Valori del header segnaposto, collegati allo store in F2. */
export function App() {
  const [tab, setTab] = useState<Tab>('oggi');

  return (
    <>
      <div className="mx-auto min-h-full max-w-[480px] px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-[calc(env(safe-area-inset-bottom)+110px)]">
        <Header
          rankIndex={0}
          rankCount={6}
          rank={{ name: 'Uovo', min: 0 }}
          next={{ name: 'Pulcino', min: 100 }}
          xp={0}
          midnightIn="—"
          risk={0}
          onOpenSettings={() => undefined}
        />
        <main data-tab={tab} />
      </div>
      <Nav active={tab} onSelect={setTab} onAdd={() => undefined} onSettings={() => undefined} />
    </>
  );
}
