import { createContext, useContext } from 'react';
import { nowIn, type Now } from '../domain/index.ts';

/** Adesso, a Roma. Le azioni lo leggono al momento del tocco. */
export const getNow = (): Now => nowIn(new Date());

/** Adesso per il rendering: aggiornato ogni 30 s e al ritorno sull'app. */
export const NowContext = createContext<Now | null>(null);

export function useNow(): Now {
  const now = useContext(NowContext);
  if (!now) throw new Error('useNow fuori da NowContext');
  return now;
}
