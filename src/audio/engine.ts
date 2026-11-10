import { usePrefs } from '../store/prefs.ts';

/*
 * Motore audio sintetizzato, nessun file. Portato identico dalla bozza:
 * onde square/sawtooth → filtro passa-basso → compressore. Note di base sopra ~200 Hz
 * così si sentono anche dallo speaker del telefono.
 */

type AudioCtor = typeof AudioContext;
let AC: AudioContext | null = null;
let MASTER: DynamicsCompressorNode | null = null;

function ac(): AudioContext | null {
  if (!AC) {
    try {
      const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
      const C = w.AudioContext ?? w.webkitAudioContext;
      if (C) AC = new C();
    } catch {
      AC = null;
    }
  }
  if (AC?.state === 'suspended') void AC.resume();
  return AC;
}

/** Da chiamare al primo tocco: crea/riprende l'AudioContext dentro un gesto dell'utente. */
export function unlockAudio(): void {
  if (usePrefs.getState().sound) ac();
}

function output(): { a: AudioContext; out: AudioNode } | null {
  if (!usePrefs.getState().sound) return null;
  const a = ac();
  if (!a) return null;
  if (!MASTER) {
    const c = a.createDynamicsCompressor();
    c.threshold.value = -14;
    c.ratio.value = 4;
    const g = a.createGain();
    g.gain.value = 1.4;
    c.connect(g).connect(a.destination);
    MASTER = c;
  }
  return { a, out: MASTER };
}

/** Suono "caldo": onda ricca di armoniche passata in un passa-basso. */
export function tone(
  f: number,
  dur = 0.1,
  type: OscillatorType = 'square',
  vol = 0.16,
  when = 0,
  lp = f * 5,
): void {
  const o0 = output();
  if (!o0) return;
  const { a, out } = o0;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const fl = a.createBiquadFilter();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  fl.type = 'lowpass';
  fl.frequency.setValueAtTime(Math.min(lp, 9000), t);
  fl.Q.value = 0.7;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.03);
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

export const SFX = {
  tick() {
    tone(700, 0.025, 'square', 0.05, 0, 2500);
  },
  /** la combo alza la nota sulla scala pentatonica */
  done(combo: number) {
    const s = PENTA[Math.min(combo, PENTA.length - 1)] ?? 0;
    const f = 330 * Math.pow(2, s / 12);
    tone(f, 0.18, 'square', 0.13, 0, f * 4);
    tone(f * 2, 0.1, 'triangle', 0.08, 0.01);
  },
  undo() {
    tone(294, 0.09, 'square', 0.1, 0, 1200);
    tone(220, 0.14, 'square', 0.09, 0.07, 900);
  },
  commit() {
    tone(392, 0.07, 'square', 0.09, 0, 1800);
    tone(587, 0.09, 'square', 0.08, 0.05, 2200);
  },
  day() {
    [330, 392, 494, 659, 784].forEach((f, i) => {
      tone(f, 0.26, 'square', 0.1, i * 0.07, f * 4);
    });
  },
  up() {
    [262, 330, 392, 494, 659, 784, 988].forEach((f, i) => {
      tone(f, 0.3, 'square', 0.1, i * 0.06, f * 4);
    });
    tone(1319, 0.6, 'triangle', 0.08, 0.45);
  },
  down() {
    [392, 330, 262, 196].forEach((f, i) => {
      tone(f, 0.3, 'sawtooth', 0.09, i * 0.12, 1400);
    });
  },
  loss() {
    tone(262, 0.2, 'sawtooth', 0.1, 0, 1200);
    tone(196, 0.3, 'sawtooth', 0.09, 0.12, 1000);
  },
  trash() {
    tone(330, 0.06, 'square', 0.08, 0, 1500);
    tone(220, 0.1, 'square', 0.08, 0.05, 1000);
  },
};

/** Colpo sordo: timbri e rilascio del riordino. */
export function thud(): void {
  const o0 = output();
  if (!o0) return;
  const { a, out } = o0;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  const fl = a.createBiquadFilter();
  o.type = 'square';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.25);
  fl.type = 'lowpass';
  fl.frequency.value = 700;
  g.gain.setValueAtTime(0.45, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(fl).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.4);
}

export function fanfare(big: boolean): void {
  const seq = big ? [262, 330, 392, 523, 392, 523, 659, 784] : [330, 392, 494, 659];
  seq.forEach((f, i) => {
    tone(f, 0.22, 'square', 0.1, 0.08 + i * 0.075, f * 4);
  });
  const end = 0.08 + seq.length * 0.075;
  (big ? [523, 659, 784, 1047] : [392, 494, 659]).forEach((f) => {
    tone(f, big ? 1.1 : 0.7, 'square', 0.06, end, f * 3);
  });
}

/** Vampata dello strike: rumore filtrato che sale + nota bassa. */
export function whoosh(n: number): void {
  const o0 = output();
  if (!o0) return;
  const { a, out } = o0;
  const len = Math.floor(a.sampleRate * 0.5);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  const bp = a.createBiquadFilter();
  const g = a.createGain();
  const t = a.currentTime;
  src.buffer = buf;
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(1400 + n * 120, t + 0.35);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  tone(165, 0.25, 'sawtooth', 0.08, 0.02, 600);
}

/** Frullo d'ali del colibrì. */
export function flutter(dur = 1.3): void {
  for (let i = 0; i < dur * 22; i++)
    tone(900 + Math.random() * 500, 0.015, 'square', 0.025, i / 22, 3000);
}
