import { usePrefs } from '../store/prefs.ts';

/*
 * Vibrazione. Android: navigator.vibrate. iOS non ha l'API: dal 18 un
 * <input type="checkbox" switch> cliccato via label produce un tic aptico.
 * Altrove non succede niente (fallback silenzioso).
 */

let iosLabel: HTMLLabelElement | null = null;

function iosSwitch(): HTMLLabelElement {
  if (iosLabel) return iosLabel;
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  label.style.display = 'none';
  label.setAttribute('aria-hidden', 'true');
  document.body.appendChild(label);
  iosLabel = label;
  return label;
}

/** iOS (trucco dello switch): la vibrazione funziona solo dentro un gesto dell'utente. */
export const hapticNeedsGesture = (): boolean => !('vibrate' in navigator);

export function haptic(pattern: number | number[] = 10): void {
  if (!usePrefs.getState().haptics) return;
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
    else iosSwitch().click();
  } catch {
    // nessuna vibrazione disponibile
  }
}
