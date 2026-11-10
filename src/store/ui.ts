import { create } from 'zustand';
import type { Draft } from '../domain/index.ts';

export type Tab = 'oggi' | 'cal' | 'liste';
export type ListSeg = 'todo' | 'idea' | 'buy' | 'hold';

export type Sheet =
  | { type: 'add'; draft: Draft }
  | { type: 'edit'; id: string }
  | { type: 'editIdea'; id: string }
  | { type: 'settings' };

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
  hideActionToast: (id) => {
    set((s) => (s.actionToast?.id === id ? { actionToast: { ...s.actionToast, on: false } } : s));
  },
}));

export const toast = (msg: string): void => {
  useUi.getState().showToast(msg);
};
