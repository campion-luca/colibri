import { useEffect, useRef, useState } from 'react';
import {
  DOW_LBL,
  EFFORT,
  KIND_LBL,
  PROMISE_PENALTY,
  addDays,
  cntOn,
  draftFromIdea,
  draftFromItem,
  isScheduled,
  stepEvery,
  stepMonthDay,
  type Day,
  type Dow,
  type Draft,
  type Effort,
  type Kind,
  type RecurType,
  type Times,
} from '../domain/index.ts';
import { SFX, tone } from '../audio/engine.ts';
import { nudge } from '../fx/effects.ts';
import { haptic } from '../fx/haptics.ts';
import { softDelete } from '../lib/actions.ts';
import { getNow, useNow } from '../lib/now.ts';
import { useGame } from '../store/game.ts';
import { toast, useUi, type Sheet } from '../store/ui.ts';

type FormSheet = Extract<Sheet, { type: 'add' | 'edit' | 'editIdea' }>;

const KINDS: (Kind | 'idea')[] = ['daily', 'todo', 'buy', 'idea', 'hold'];
const EFFORTS: Effort[] = [1, 2, 3, 4];
const RECURS: [RecurType, string][] = [
  ['daily', 'Ogni giorno'],
  ['weekly', 'Giorni'],
  ['interval', 'Ogni N gg'],
  ['monthly', 'Mensile'],
];
const DUE_CHIPS: [string, number | null][] = [
  ['Nessuna', null],
  ['Oggi', 0],
  ['Domani', 1],
  ['Tra 7 gg', 7],
];
const hasEffort = (k: Draft['kind']) => k === 'daily' || k === 'todo' || k === 'hold';

function initialDraft(sheet: FormSheet, today: Day): Draft | null {
  const { items, ideas } = useGame.getState();
  if (sheet.type === 'add') return sheet.draft;
  if (sheet.type === 'edit') {
    const it = items.find((i) => i.id === sheet.id);
    return it ? draftFromItem(it, today) : null;
  }
  const idea = ideas.find((x) => x.id === sheet.id);
  return idea ? draftFromIdea(idea) : null;
}

export function ItemSheet({ sheet }: { sheet: FormSheet }) {
  const now = useNow();
  const today = now.day;
  const [draft, setDraft] = useState<Draft | null>(() => initialDraft(sheet, today));
  const title = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const edit = sheet.type !== 'add';
  const liveItem = useGame((s) =>
    sheet.type === 'edit' ? s.items.find((i) => i.id === sheet.id) : undefined,
  );

  useEffect(() => {
    if (edit) return;
    const id = window.setTimeout(() => title.current?.focus(), 350);
    return () => {
      window.clearTimeout(id);
    };
  }, [edit]);

  if (!draft) return <p className="rules">Elemento non trovato.</p>;
  const k = draft.kind;
  const set = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch });
  };
  const setRecur = (patch: Partial<Draft['recur']>) => {
    set({ recur: { ...draft.recur, ...patch } });
  };
  const doneToday = liveItem ? cntOn(liveItem, today) : 0;

  const save = () => {
    const at = getNow();
    const g = useGame.getState();
    const ui = useUi.getState();
    if (!draft.title.trim()) {
      nudge(title.current);
      SFX.loss();
      return;
    }
    SFX.commit();
    haptic(12);
    if (sheet.type === 'edit') {
      if (g.edit(sheet.id, draft, at)) toast('Salvato');
      ui.closeSheet();
      return;
    }
    if (sheet.type === 'editIdea') {
      if (g.editIdea(sheet.id, draft, at)) toast('Salvato');
      ui.closeSheet();
      return;
    }
    const r = g.create(draft, at);
    ui.closeSheet();
    if (r?.idea) {
      ui.goToKind('idea');
    } else if (r?.item) {
      const it = r.item;
      const t = at.day;
      if (it.promiseDate === t || (it.kind === 'daily' && isScheduled(it, t)) || it.due === t) {
        ui.setTab('oggi');
      } else {
        ui.goToKind(it.kind);
      }
    }
  };

  const remove = () => {
    useUi.getState().closeSheet();
    if (sheet.type !== 'add') softDelete(sheet.id);
  };

  return (
    <>
      <h3>{edit ? 'Modifica' : 'Cosa'}</h3>
      {k === 'idea' ? (
        <textarea
          ref={title}
          className="field"
          rows={3}
          placeholder="Idea…"
          style={{ resize: 'none' }}
          value={draft.title}
          onChange={(e) => {
            set({ title: e.target.value });
          }}
        />
      ) : (
        <input
          ref={title}
          className="field"
          placeholder={k === 'buy' ? 'Cosa comprare…' : 'Nome della task…'}
          autoComplete="off"
          enterKeyHint="done"
          value={draft.title}
          onChange={(e) => {
            set({ title: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
        />
      )}

      <h3>Tipo</h3>
      <div className="chips k3">
        {KINDS.map((v) => (
          <Chip
            key={v}
            on={k === v}
            onClick={() => {
              set({ kind: v });
            }}
          >
            {KIND_LBL[v]}
          </Chip>
        ))}
      </div>

      {hasEffort(k) && (
        <>
          <h3>Impegno</h3>
          <div className="chips">
            {EFFORTS.map((e) => (
              <Chip
                key={e}
                on={draft.effort === e}
                onClick={() => {
                  set({ effort: e });
                  tone(262 + e * 65, 0.08, 'square', 0.09, 0, 1800);
                }}
              >
                {EFFORT[e].n}
                <small>
                  {EFFORT[e].t} · {EFFORT[e].xp}xp
                </small>
              </Chip>
            ))}
          </div>
        </>
      )}

      {k === 'daily' && (
        <>
          <h3>Ripeti</h3>
          <div className="chips">
            {RECURS.map(([v, l]) => (
              <Chip
                key={v}
                on={draft.recur.type === v}
                onClick={() => {
                  setRecur({ type: v });
                  SFX.commit();
                }}
              >
                {l}
              </Chip>
            ))}
          </div>
          {draft.recur.type === 'weekly' && (
            <div className="dows">
              {([1, 2, 3, 4, 5, 6, 7] as Dow[]).map((d) => {
                const on = draft.recur.days.includes(d);
                return (
                  <Chip
                    key={d}
                    on={on}
                    label={DOW_LBL[d]}
                    onClick={() => {
                      setRecur({
                        days: on
                          ? draft.recur.days.filter((x) => x !== d)
                          : [...draft.recur.days, d],
                      });
                      tone(300 + d * 40, 0.06, 'square', 0.08, 0, 1800);
                    }}
                  >
                    {DOW_LBL[d].slice(0, 1)}
                  </Chip>
                );
              })}
            </div>
          )}
          {draft.recur.type === 'interval' && (
            <div className="stepper">
              <Chip
                label="Meno"
                onClick={() => {
                  const every = stepEvery(draft.recur.every, -1);
                  setRecur({ every });
                  tone(260 + every * 6, 0.05, 'square', 0.08, 0, 1800);
                }}
              >
                −
              </Chip>
              <span>
                <b className="num">{draft.recur.every}</b> giorni
              </span>
              <Chip
                label="Più"
                onClick={() => {
                  const every = stepEvery(draft.recur.every, 1);
                  setRecur({ every });
                  tone(260 + every * 6, 0.05, 'square', 0.08, 0, 1800);
                }}
              >
                +
              </Chip>
            </div>
          )}
          {draft.recur.type === 'monthly' && (
            <div className="stepper">
              <Chip
                label="Meno"
                onClick={() => {
                  const day = stepMonthDay(draft.recur.day, -1);
                  setRecur({ day });
                  tone(260 + day * 8, 0.05, 'square', 0.08, 0, 1800);
                }}
              >
                −
              </Chip>
              <span>
                il <b className="num">{draft.recur.day}</b> del mese
              </span>
              <Chip
                label="Più"
                onClick={() => {
                  const day = stepMonthDay(draft.recur.day, 1);
                  setRecur({ day });
                  tone(260 + day * 8, 0.05, 'square', 0.08, 0, 1800);
                }}
              >
                +
              </Chip>
            </div>
          )}

          <h3>Volte al giorno</h3>
          <div className="chips k3n">
            {([1, 2, 3] as Times[]).map((n) => (
              <Chip
                key={n}
                on={draft.times === n}
                onClick={() => {
                  set({ times: n });
                  tone(262 + n * 80, 0.08, 'square', 0.09, 0, 1800);
                }}
              >
                {n}×
              </Chip>
            ))}
          </div>
          <button
            type="button"
            className="tgl"
            role="switch"
            aria-checked={draft.allDay}
            onClick={() => {
              set({ allDay: !draft.allDay });
              if (draft.allDay) SFX.commit();
              else SFX.undo();
            }}
          >
            <span>
              Tutto il giorno<small>Spegni per darle una fascia oraria</small>
            </span>
            <span className={`sw ${draft.allDay ? 'on' : ''}`} />
          </button>
          {!draft.allDay && (
            <div className="times">
              <label>
                Dalle
                <input
                  type="time"
                  value={draft.from}
                  onChange={(e) => {
                    if (e.target.value) set({ from: e.target.value });
                  }}
                />
              </label>
              <label>
                Alle
                <input
                  type="time"
                  value={draft.to}
                  onChange={(e) => {
                    if (e.target.value) set({ to: e.target.value });
                  }}
                />
              </label>
            </div>
          )}
          {sheet.type === 'edit' && liveItem?.kind === 'daily' && doneToday > 0 && (
            <div className="cnt-row">
              <span>Fatte oggi: {doneToday}</span>
              <button
                type="button"
                className="mini"
                onClick={() => {
                  useGame.getState().removeOneRep(sheet.id, getNow());
                  SFX.undo();
                }}
              >
                − TOGLI UNA
              </button>
            </div>
          )}
        </>
      )}

      {(k === 'todo' || k === 'buy') && (
        <>
          <h3>
            Promessa{' '}
            <small style={{ textTransform: 'none', letterSpacing: 0 }}>
              · se salta −{PROMISE_PENALTY}× XP
            </small>
          </h3>
          <div className="chips k3n">
            {(
              [
                [null, 'Nessuna'],
                [0, 'Oggi'],
                [1, 'Domani'],
              ] as const
            ).map(([v, l]) => (
              <Chip
                key={l}
                on={draft.promise === v}
                onClick={() => {
                  set({ promise: v });
                  SFX.commit();
                }}
              >
                {l}
              </Chip>
            ))}
          </div>
        </>
      )}

      {k !== 'idea' && (
        <>
          <h3>Nota</h3>
          <textarea
            className="field note"
            rows={2}
            placeholder="Dettagli, link, cosa ricordarti…"
            value={draft.note}
            onChange={(e) => {
              set({ note: e.target.value });
            }}
          />
        </>
      )}

      {(k === 'todo' || k === 'buy' || k === 'hold') && (
        <>
          <h3>Scadenza</h3>
          <div className="chips">
            {DUE_CHIPS.map(([l, n]) => (
              <Chip
                key={l}
                on={n === null ? !draft.due : draft.due === addDays(today, n)}
                onClick={() => {
                  set({ due: n === null ? null : addDays(today, n) });
                  SFX.commit();
                }}
              >
                {l}
              </Chip>
            ))}
          </div>
          <div className="times">
            <label>
              Oppure una data
              <input
                type="date"
                value={draft.due ?? ''}
                min={today}
                onChange={(e) => {
                  set({ due: e.target.value || null });
                }}
              />
            </label>
          </div>
        </>
      )}

      {k === 'hold' && (
        <p className="rules" style={{ marginTop: 12 }}>
          In sospeso: resta parcheggiata, non si promette e non toglie XP. Se la completi prendi
          comunque gli XP.
        </p>
      )}

      <div className="acts">
        <button type="button" className="btn" onClick={save}>
          {edit ? 'Salva' : 'Aggiungi'}
        </button>
        {edit && (
          <button type="button" className="btn danger" onClick={remove}>
            Elimina
          </button>
        )}
      </div>
    </>
  );
}

function Chip({
  on = false,
  label,
  onClick,
  children,
}: {
  on?: boolean;
  label?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`chip ${on ? 'on' : ''}`}
      aria-pressed={label === 'Meno' || label === 'Più' ? undefined : on}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
