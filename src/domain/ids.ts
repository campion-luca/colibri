import type { Day, PenaltyReason } from './types.ts';

/** Hash a 128 bit non crittografico (cyrb128), sincrono e uguale su browser e Deno. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** UUID v8 (formato "custom" di RFC 9562) ricavato in modo deterministico dalle parti. */
export function deterministicUuid(...parts: string[]): string {
  const hex = cyrb128(parts.join('|'))
    .map((n) => n.toString(16).padStart(8, '0'))
    .join('');
  const variant = ((parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  const h = `${hex.slice(0, 12)}8${hex.slice(13, 16)}${variant}${hex.slice(17)}`;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Id dell'evento penalità: stesso utente, giorno, elemento e motivo → stesso id.
 * Due dispositivi che calcolano la stessa penalità producono lo stesso evento,
 * e il server lo applica una volta sola.
 */
export const penaltyId = (userId: string, on: Day, itemId: string, why: PenaltyReason): string =>
  deterministicUuid('penalty', userId, on, itemId, why);
