import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Preferenze del dispositivo (non sincronizzate): suoni e vibrazione. */
interface Prefs {
  sound: boolean;
  haptics: boolean;
  setSound: (on: boolean) => void;
  setHaptics: (on: boolean) => void;
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      sound: true,
      haptics: true,
      setSound: (sound) => {
        set({ sound });
      },
      setHaptics: (haptics) => {
        set({ haptics });
      },
    }),
    {
      name: 'colibri-prefs',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sound: s.sound, haptics: s.haptics }),
    },
  ),
);
