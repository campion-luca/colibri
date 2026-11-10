import { useCallback, useEffect, useRef } from 'react';
import type { Item, Now } from '../domain/index.ts';
import { frozenOrder } from '../fx/order.ts';
import { useGame } from '../store/game.ts';
import { useUi } from '../store/ui.ts';
import { Row, type RowOptions } from './Row.tsx';

interface RowGroupProps extends RowOptions {
  items: Item[];
  k: string;
  now: Now;
}

/**
 * Una sezione di righe. Il riordino resta dentro la sezione; durante la pausa dopo un
 * tocco l'ordine resta quello di prima (fx/order) e poi scorre al nuovo.
 */
export function RowGroup({ items, k, now, ...opts }: RowGroupProps) {
  const frozen = useUi((s) => s.frozen?.[k]);
  const shown = frozen ? frozenOrder(items, frozen) : items;

  // callback stabile: le righe memoizzate non si ridisegnano per colpa sua
  const ids = useRef<string[]>([]);
  useEffect(() => {
    ids.current = shown.map((i) => i.id);
  });
  const onReorder = useCallback((from: number, to: number) => {
    useGame.getState().reorder(ids.current, from, to);
  }, []);

  return (
    <div>
      {shown.map((it) => (
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
