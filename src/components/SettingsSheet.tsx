import {
  BUY_XP,
  DAILY_PENALTY,
  DUE_PENALTY,
  EFFORT,
  MAX_MISSED_DAYS,
  PROMISE_PENALTY,
  RANKS,
  STRIKE_FROM,
  rankIndex,
  type Effort,
} from '../domain/index.ts';
import { seedData } from '../dev/seed.ts';
import { getNow } from '../lib/now.ts';
import { useGame } from '../store/game.ts';
import { toast, useUi } from '../store/ui.ts';
import { Emblem } from './Emblem.tsx';

const EFFORTS: Effort[] = [1, 2, 3, 4];

/*
 * Impostazioni. In F2: stemmi, tabella XP e regole.
 * Report di ieri e Pausa arrivano in F5, Notifiche in F6.
 */
export function SettingsSheet() {
  const r = rankIndex(useGame((s) => s.xp));

  return (
    <>
      <h3>Rank · gli stemmi si svelano salendo</h3>
      <div className="rk-list">
        {RANKS.map((k, i) => (
          <div key={k.n} className={`rk-cell ${i === r ? 'cur' : ''} ${i > r ? 'lock' : ''}`}>
            <Emblem rank={i} locked={i > r} />
            <b>{k.n}</b>
            <small className="num">{k.min} XP</small>
          </div>
        ))}
      </div>

      <h3>XP per impegno</h3>
      <table className="tbl">
        <tbody>
          {EFFORTS.map((e) => (
            <tr key={e}>
              <td>
                {EFFORT[e].n} <span style={{ color: 'var(--dim)' }}>{EFFORT[e].t}</span>
              </td>
              <td>+{EFFORT[e].xp}</td>
            </tr>
          ))}
          <tr>
            <td>Da comprare</td>
            <td>+{BUY_XP}</td>
          </tr>
        </tbody>
      </table>

      <h3>Regole</h3>
      <p className="rules">
        <b>Strike</b>: dalla {STRIKE_FROM}ª task non ricorrente fatta in giornata parte il fuoco.
        <br />
        <b>Ricorrenti</b>: ogni giorno, in certi giorni, ogni N giorni o una volta al mese; da 1 a 3
        volte al giorno, con fascia oraria opzionale. Quando la fascia si chiude le ripetizioni
        mancanti costano subito −{DAILY_PENALTY}×.
        <br />
        <b>Promesse</b> non mantenute: −{PROMISE_PENALTY}× a mezzanotte. <b>Scadenze</b> mancate: −
        {DUE_PENALTY}× (non si somma alla promessa).
        <br />
        Giorni di assenza: le ricorrenti contano per ogni giorno saltato (max {MAX_MISSED_DAYS}).
        Sotto soglia perdi il rank.
      </p>

      {import.meta.env.DEV && <DevTools />}
    </>
  );
}

/** Solo in sviluppo: dati di esempio della bozza e azzeramento. */
function DevTools() {
  return (
    <>
      <h3>Sviluppo</h3>
      <div className="acts">
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            const g = useGame.getState();
            g.replaceAll({ ...seedData(getNow(), g.userId), notif: g.notif });
            useUi.getState().closeSheet();
            toast('Dati di esempio caricati');
          }}
        >
          Carica dati di esempio
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            useGame.getState().replaceAll({ lastDate: getNow().day });
            useUi.getState().closeSheet();
            toast('Tutto azzerato');
          }}
        >
          Azzera tutto
        </button>
      </div>
    </>
  );
}
