import type { Item, Now } from '../domain/index.ts';
import { useGame } from '../store/game.ts';
import { Row, type RowOptions } from './Row.tsx';

interface RowGroupProps extends RowOptions {
  items: Item[];
  k: string;
  now: Now;
}

/** Una sezione di righe: il riordino resta dentro la sezione. */
export function RowGroup({ items, k, now, ...opts }: RowGroupProps) {
  const ids = items.map((i) => i.id);
  const onReorder = (from: number, to: number) => {
    useGame.getState().reorder(ids, from, to);
  };
  return (
    <div>
      {items.map((it) => (
        <Row
          key={it.id}
          item={it}
          k={k}
          now={now}
          onReorder={opts.noGrip ? undefined : onReorder}
          {...opts}
        />
      ))}
    </div>
  );
}
