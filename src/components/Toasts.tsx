import { useEffect } from 'react';
import { useUi } from '../store/ui.ts';

/** Toast in alto e toast con azione (ANNULLA) in basso sopra la nav. */
export function Toasts() {
  const t = useUi((s) => s.toast);
  const a = useUi((s) => s.actionToast);

  useEffect(() => {
    if (!t?.on) return;
    const id = window.setTimeout(() => {
      useUi.getState().hideToast(t.id);
    }, 2200);
    return () => {
      window.clearTimeout(id);
    };
  }, [t]);

  useEffect(() => {
    if (!a?.on) return;
    const id = window.setTimeout(() => {
      useUi.getState().hideActionToast(a.id);
    }, a.ms);
    return () => {
      window.clearTimeout(id);
    };
  }, [a]);

  return (
    <>
      <div className={`toast ${t?.on ? 'on' : ''}`} role="status" aria-live="polite">
        {t?.msg}
      </div>
      <div className={`toast act ${a?.on ? 'on' : ''}`} role="status" aria-live="polite">
        <span>{a?.msg}</span>
        {a && (
          <button
            type="button"
            tabIndex={a.on ? 0 : -1}
            onClick={() => {
              useUi.getState().hideActionToast(a.id);
              a.onAction();
            }}
          >
            {a.label}
          </button>
        )}
        {a?.on && <i key={a.id} style={{ animationDuration: `${a.ms}ms` }} />}
      </div>
    </>
  );
}
