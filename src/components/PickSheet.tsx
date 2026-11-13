import { SFX } from '../audio/engine.ts';
import {
  PROMISE_PENALTY,
  dueLabel,
  isPromisedTomorrow,
  listItems,
  penaltyOf,
  xpOf,
  type Item,
} from '../domain/index.ts';
import { haptic } from '../fx/haptics.ts';
import { getNow, useNow } from '../lib/now.ts';
import { useGame } from '../store/game.ts';
import { useUi } from '../store/ui.ts';

const GROUPS = [
  ['todo', 'Task'],
  ['buy', 'Da comprare'],
] as const;

/** "Scegli le task di oggi": un tocco promette per oggi (o toglie la promessa). */
export function PickSheet() {
  const now = useNow();
  const items = useGame((s) => s.items);
  const today = now.day;
  const groups = GROUPS.map(([kind, label]) => ({
    kind,
    label,
    list: listItems(items, kind, today).filter((i) => !i.done),
  }));
  const chosen = items.filter(
    (i) => i.kind !== 'daily' && !i.done && i.promiseDate === today,
  ).length;
  const empty = groups.every((g) => g.list.length === 0);

  const toggle = (it: Item) => {
    const r = useGame.getState().togglePromise(it.id, 0, getNow());
    if (!r) return;
    if (r.promised) {
      SFX.commit();
      haptic(12);
    } else {
      SFX.undo();
    }
  };

  return (
    <>
      <h3>Scegli le task di oggi</h3>
      <p className="rules">
        Tocca quelle che farai oggi. Se una salta, a mezzanotte perdi {PROMISE_PENALTY}× i suoi XP.
      </p>
      <p className="pick-count num">Scelte per oggi: {chosen}</p>

      {empty ? (
        <div className="empty">Niente in lista. Aggiungi una task con +.</div>
      ) : (
        groups.map(
          (g) =>
            g.list.length > 0 && (
              <div key={g.kind} className="pick-group">
                <h3>{g.label}</h3>
                {g.list.map((it) => {
                  const on = it.promiseDate === today;
                  const due = dueLabel(it, now);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      className={`pick-row ${on ? 'on' : ''}`}
                      aria-pressed={on}
                      onClick={() => {
                        toggle(it);
                      }}
                    >
                      <span className="chk">
                        <svg className="tick" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                      <span className="pick-t">
                        <span className="t">{it.title}</span>
                        <span className="meta">
                          <span className="mi">
                            +{xpOf(it)} XP · se salta −{penaltyOf(it, PROMISE_PENALTY)}
                          </span>
                          {due && (
                            <>
                              <span className="sep">·</span>
                              <span className={`mi ${due.urgent ? 'urg' : ''}`}>{due.text}</span>
                            </>
                          )}
                          {!on && isPromisedTomorrow(it, today) && (
                            <>
                              <span className="sep">·</span>
                              <span className="mi">
                                <span className="tag tomorrow">DOMANI</span>
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ),
        )
      )}

      <div className="acts">
        <button
          type="button"
          className="btn"
          onClick={() => {
            useUi.getState().closeSheet();
          }}
        >
          Fatto
        </button>
      </div>
    </>
  );
}
