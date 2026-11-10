import { Drawer } from 'vaul';
import { useBackToClose } from '../lib/overlay.ts';
import { useUi } from '../store/ui.ts';
import { ItemSheet } from './ItemSheet.tsx';
import { SettingsSheet } from './SettingsSheet.tsx';

const TITLES = {
  add: 'Aggiungi',
  edit: 'Modifica',
  editIdea: 'Modifica idea',
  settings: 'Impostazioni',
} as const;

/** Bottom sheet unico (vaul): swipe in basso o gesto indietro per chiudere. */
export function AppSheet() {
  const sheet = useUi((s) => s.sheet);
  const open = useUi((s) => s.sheetOpen);
  const sheetKey = useUi((s) => s.sheetKey);
  const close = useUi((s) => s.closeSheet);
  useBackToClose(open, close);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="scrim" />
        <Drawer.Content className="sheet" aria-describedby={undefined}>
          <div className="sheet-in">
            <div className="grab" />
            <Drawer.Title className="sr-only">{sheet ? TITLES[sheet.type] : ''}</Drawer.Title>
            {sheet &&
              (sheet.type === 'settings' ? (
                <SettingsSheet key={sheetKey} />
              ) : (
                <ItemSheet key={sheetKey} sheet={sheet} />
              ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
