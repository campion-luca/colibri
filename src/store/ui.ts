import { create } from 'zustand';
import type { Draft } from '../domain/index.ts';

export type Tab = 'oggi' | 'cal' | 'liste';
export type ListSeg = 'todo' | 'idea' | 'buy' | 'hold';

export type Sheet =
  | { type: 'add'; draft: Draft }
  | { type: 'edit'; id: string }
  | { type: 'editIdea'; id: string }
  | { type: 'settings' };

export type Overlay =
  | { id: number; type: 'rank'; rank: number; up: boolean }
  | { id: number; type: 'preview'; rank: number };

type OverlayInput = Overlay extends infer O ? (O extends Overlay ? Omit<O, 'id'> : never) : never;

interface ActionToast {
  id: number;
  msg: string;
  label: string;
  ms: number;
  onAction: () => void;
}

interface UiState {
  tab: Tab;
  listSeg: ListSeg;
  showOff: boolean;
  showTom: boolean;
  sheet: Sheet | null;
  /** cambia a ogni apertura: rimonta il contenuto del pannello */
  sheetKey: number;
  /** il pannello resta montato durante l'animazione di chiusura */
  sheetOpen: boolean;
  /** `on: false` = in uscita (il testo resta durante l'animazione) */
  toast: { id: number; msg: string; on: boolean } | null;
  actionToast: (ActionToast & { on: boolean }) | null;
  /** ordine delle sezioni congelato durante la pausa dopo un tocco (vedi fx/order) */
  frozen: Record<string, string[]> | null;
  overlay: Overlay | null;
  overlayOpen: boolean;

  setTab: (tab: Tab) => void;
  setListSeg: (seg: ListSeg) => void;
  goToKind: (kind: 'daily' | ListSeg) => void;
  toggleOff: () => void;
  toggleTom: () => void;
  openSheet: (sheet: Sheet) => void;
  closeSheet: () => void;
  showToast: (msg: string) => void;
  hideToast: (id: number) => void;
  showActionToast: (t: Omit<ActionToast, 'id'>) => void;
  hideActionToast: (id: number) => void;
  openOverlay: (o: OverlayInput) => void;
  closeOverlay: () => void;
}

let seq = 0;

export const useUi = create<UiState>()((set) => ({
  tab: 'oggi',
  listSeg: 'todo',
  showOff: false,
  showTom: false,
  sheet: null,
  sheetKey: 0,
  sheetOpen: false,
  toast: null,
  actionToast: null,
  frozen: null,
  overlay: null,
  overlayOpen: false,

  setTab: (tab) => {
    set({ tab });
  },
  setListSeg: (listSeg) => {
    set({ listSeg });
  },
  goToKind: (kind) => {
    set(kind === 'daily' ? { tab: 'oggi' } : { tab: 'liste', listSeg: kind });
  },
  toggleOff: () => {
    set((s) => ({ showOff: !s.showOff }));
  },
  toggleTom: () => {
    set((s) => ({ showTom: !s.showTom }));
  },
  openSheet: (sheet) => {
    set((s) => ({ sheet, sheetOpen: true, sheetKey: s.sheetKey + 1 }));
  },
  closeSheet: () => {
    set({ sheetOpen: false });
  },
  showToast: (msg) => {
    set({ toast: { id: ++seq, msg, on: true } });
  },
  hideToast: (id) => {
    set((s) => (s.toast?.id === id ? { toast: { ...s.toast, on: false } } : s));
  },
  showActionToast: (t) => {
    set({ actionToast: { ...t, id: ++seq, on: true } });
  },
  openOverlay: (o) => {
    set({ overlay: { ...o, id: ++seq }, overlayOpen: true });
  },
  closeOverlay: () => {
    set({ overlayOpen: false });
    // resta montato il tempo della dissolvenza
    window.setTimeout(() => {
      if (!useUi.getState().overlayOpen) set({ overlay: null });
    }, 300);
  },
  hideActionToast: (id) => {
    set((s) => (s.actionToast?.id === id ? { actionToast: { ...s.actionToast, on: false } } : s));
  },
}));

export const toast = (msg: string): void => {
  useUi.getState().showToast(msg);
};
