/*
 * Ordine manuale: `position` è un float. Si inserisce a metà tra i due vicini;
 * se lo spazio diventa troppo piccolo si rinumera la sezione.
 */

const MIN_GAP = 1e-6;

export interface Positioned {
  id: string;
  position: number;
}

export function positionBetween(before?: number, after?: number): number {
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (before !== undefined) return before + 1;
  if (after !== undefined) return after - 1;
  return 0;
}

/** In fondo a una lista. */
export const positionAtEnd = (list: readonly Positioned[]): number =>
  list.length ? Math.max(...list.map((x) => x.position)) + 1 : 0;

/** In cima a una lista. */
export const positionAtStart = (list: readonly Positioned[]): number =>
  list.length ? Math.min(...list.map((x) => x.position)) - 1 : 0;

/**
 * Sposta l'elemento da `from` a `to` nella sezione (nell'ordine in cui è mostrata).
 * Restituisce solo le posizioni da salvare: di solito una, tutta la sezione se va rinumerata.
 */
export function reorder(section: readonly Positioned[], from: number, to: number): Positioned[] {
  const moved = section[from];
  if (!moved || from === to) return [];
  const rest = section.filter((_, i) => i !== from);
  const before = rest[to - 1]?.position;
  const after = rest[to]?.position;
  const tight = before !== undefined && after !== undefined && after - before < MIN_GAP;
  if (!tight) return [{ id: moved.id, position: positionBetween(before, after) }];
  const order = [...rest.slice(0, to), moved, ...rest.slice(to)];
  return order.map((x, i) => ({ id: x.id, position: i }));
}
