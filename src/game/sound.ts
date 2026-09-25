import { useApp } from '../store';

/**
 * Tiny synthesised sound effects (Web Audio, no files). Silent unless the player has switched sound on;
 * the audio context is only created after that click, so browsers never block it.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

function audio() {
  if (!useApp.getState().fx.sound) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, { type = 'sine' as OscillatorType, gain = 0.4, at = 0, slide = 0 } = {}) {
  const a = audio(); if (!a || !master) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function hiss(dur: number, { from = 400, to = 2400, gain = 0.25, q = 0.8, at = 0 } = {}) {
  const a = audio(); if (!a || !master || !noise) return;
  const t = a.currentTime + at;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noise; src.loop = true;
  f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t); src.stop(t + dur + 0.05);
}

export const sfx = {
  /** a stop is reached; higher notes further along the journey */
  stop(step: number) { const f = 440 * Math.pow(2, (step % 12) / 12); tone(f, 0.18, { type: 'triangle', gain: 0.3 }); tone(f * 2, 0.12, { gain: 0.08, at: 0.02 }); },
  /** a number lands in the ledger */
  tick(pitch = 1) { tone(1200 * pitch, 0.05, { type: 'square', gain: 0.05 }); },
  coin() { tone(988, 0.07, { type: 'square', gain: 0.07 }); tone(1319, 0.16, { type: 'square', gain: 0.07, at: 0.07 }); },
  truck() { hiss(0.7, { from: 120, to: 90, gain: 0.3, q: 2 }); tone(55, 0.5, { type: 'sawtooth', gain: 0.06 }); },
  horn() { tone(98, 0.9, { type: 'sawtooth', gain: 0.12 }); tone(147, 0.9, { type: 'sawtooth', gain: 0.07 }); },
  whoosh() { hiss(1.1, { from: 300, to: 3200, gain: 0.3 }); },
  train() { for (let i = 0; i < 4; i++) hiss(0.12, { from: 900, to: 500, gain: 0.25, q: 3, at: i * 0.16 }); },
  select() { tone(660, 0.07, { type: 'triangle', gain: 0.25 }); tone(990, 0.12, { type: 'triangle', gain: 0.2, at: 0.06 }); },
  hover() { tone(1500, 0.03, { gain: 0.04 }); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.14, { type: 'triangle', gain: 0.25, at: i * 0.11 })); },
  stamp() { tone(90, 0.25, { type: 'sine', gain: 0.5, slide: 0.5 }); hiss(0.15, { from: 2000, to: 600, gain: 0.2 }); },
  badge(i: number) { tone(880 * Math.pow(2, i / 6), 0.12, { type: 'triangle', gain: 0.15 }); },
};
