import { RowGroup } from '../components/RowGroup.tsx';
import {
  fmtDay,
  isDone,
  offToday,
  pauseOn,
  todayDailies,
  todayList,
  tomorrowList,
} from '../domain/index.ts';
import { getNow, useNow } from '../lib/now.ts';
import { useGame } from '../store/game.ts';
import { useUi } from '../store/ui.ts';

export function Today() {
  const now = useNow();
  const items = useGame((s) => s.items);
  const pauses = useGame((s) => s.pauses);
  const showOff = useUi((s) => s.showOff);
  const showTom = useUi((s) => s.showTom);
  const { toggleOff, toggleTom } = useUi.getState();

  const t = now.day;
  const dailies = todayDailies(items, now);
  const off = offToday(items, now);
  const prom = todayList(items, t);
  const tom = tomorrowList(items, t);
  const pz = pauseOn(pauses, t);
  const dd = dailies.filter((i) => isDone(i, t)).length;
  const pd = prom.filter((i) => isDone(i, t)).length;

  return (
    <>
      {pz && (
        <div className="pz-card">
          <b>⏸ In pausa · {pz.reason}</b>
          <span>
            Niente penalità{' '}
            {pz.untilDay ? `fino a ${fmtDay(t, pz.untilDay)} compreso` : 'finché non la togli'}. Se
            completi qualcosa prendi comunque gli XP.
          </span>
          <button
            type="button"
            className="mini"
            onClick={() => {
              useGame.getState().resume(getNow());
            }}
          >
            RIPRENDI ORA
          </button>
        </div>
      )}

      <section className="sec">
        <div className="sec-h">
          <h2>Ricorrenti di oggi</h2>
          <span className="num">
            {dd}/{dailies.length}
          </span>
        </div>
        {dailies.length ? (
          <RowGroup items={dailies} k="d" now={now} />
        ) : (
          <div className="empty">Niente di ricorrente oggi.</div>
        )}
        {off.length > 0 && (
          <>
            <button type="button" className="off-tgl" onClick={toggleOff} aria-expanded={showOff}>
              {showOff ? '▾' : '▸'} Non previste oggi · {off.length}
            </button>
            {showOff && <RowGroup items={off} k="o" now={now} noGrip />}
          </>
        )}
      </section>

      <section className="sec">
        <div className="sec-h">
          <h2>Promesse e scadenze</h2>
          <span className="num">
            {pd}/{prom.length}
          </span>
        </div>
        {prom.length ? (
          <RowGroup items={prom} k="p" now={now} showPromise showKind />
        ) : (
          <div className="empty">
            Niente promesse. Dalle Liste premi OGGI (o DOM la sera prima). Le cose in scadenza oggi
            compaiono qui da sole.
          </div>
        )}
        <button type="button" className="off-tgl" onClick={toggleTom} aria-expanded={showTom}>
          {showTom ? '▾' : '▸'} Promesse per domani · {tom.length}
        </button>
        {showTom &&
          (tom.length ? (
            <RowGroup items={tom} k="t" now={now} commitBtn />
          ) : (
            <div className="empty">Stasera scegli cosa farai domani: premi DOM nelle Liste.</div>
          ))}
      </section>
    </>
  );
}
