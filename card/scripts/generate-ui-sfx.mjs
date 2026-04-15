/**
 * Generates short mono 44.1kHz 16-bit LE WAV files for UI SFX (no external deps).
 * Run from repo: node card/scripts/generate-ui-sfx.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

const SAMPLE_RATE = 44100;

function writeWav(filepath, samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  let o = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767 * 0.92), o);
    o += 2;
  }
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, buf);
}

function envLinear(phase, attack, sustainStart, sustainEnd, releaseEnd) {
  if (phase < attack) return phase / attack;
  if (phase < sustainStart) return 1;
  if (phase < sustainEnd) return 1;
  if (phase < releaseEnd) return 1 - (phase - sustainEnd) / (releaseEnd - sustainEnd);
  return 0;
}

function tone(freq, ms, amp, envFn) {
  const n = Math.floor((SAMPLE_RATE * ms) / 1000);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const phase = i / n;
    const e = envFn(phase);
    const t = i / SAMPLE_RATE;
    out[i] = amp * e * Math.sin(2 * Math.PI * freq * t);
  }
  return out;
}

function mix(...parts) {
  const len = Math.max(...parts.map((p) => p.length));
  const out = new Array(len).fill(0);
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) out[i] += p[i];
  }
  const peak = Math.max(...out.map((x) => Math.abs(x)), 1e-6);
  if (peak > 1) for (let i = 0; i < out.length; i++) out[i] /= peak;
  return out;
}

function padSilence(samples, extraMs) {
  const pad = Math.floor((SAMPLE_RATE * extraMs) / 1000);
  return samples.concat(new Array(pad).fill(0));
}

// Crisp UI tap — very short high blip
const tap = tone(
  1650,
  38,
  0.55,
  (p) => envLinear(p, 0.02, 0.08, 0.35, 1),
);

// Success — bright two-step
const success = padSilence(
  mix(
    tone(523, 70, 0.4, (p) => envLinear(p, 0.05, 0.2, 0.5, 1)),
    tone(784, 90, 0.35, (p) => envLinear(p, 0.08, 0.25, 0.55, 1)),
  ),
  20,
);

// Combo — quick major third
const combo = padSilence(
  mix(
    tone(440, 55, 0.38, (p) => envLinear(p, 0.04, 0.2, 0.45, 1)),
    tone(554, 55, 0.38, (p) => envLinear(p, 0.04, 0.2, 0.45, 1)),
  ),
  25,
);

// Soft error — short low fall
const errorSoft = tone(
  180,
  120,
  0.42,
  (p) => (1 - p) * (1 - p),
);

// Start — small upward chirp
const start = (() => {
  const n = Math.floor((SAMPLE_RATE * 160) / 1000);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const f = 320 + 480 * p * p;
    const t = i / SAMPLE_RATE;
    const e = envLinear(p, 0.05, 0.15, 0.6, 1);
    out[i] = 0.4 * e * Math.sin(2 * Math.PI * f * t);
  }
  return padSilence(out, 30);
})();

// Complete — three-note fanfare (short)
const complete = padSilence(
  mix(
    tone(392, 55, 0.32, (p) => envLinear(p, 0.06, 0.25, 0.55, 1)),
    tone(494, 55, 0.3, (p) => envLinear(p, 0.1, 0.3, 0.6, 1)),
    tone(587, 80, 0.28, (p) => envLinear(p, 0.12, 0.35, 0.65, 1)),
  ),
  40,
);

// Transition — filtered noise burst (sine stack = soft whoosh)
const transition = (() => {
  const n = Math.floor((SAMPLE_RATE * 140) / 1000);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const e = envLinear(p, 0.05, 0.2, 0.55, 1);
    const t = i / SAMPLE_RATE;
    const wobble =
      0.12 * Math.sin(2 * Math.PI * 6 * t) +
      0.1 * Math.sin(2 * Math.PI * 9 * t + 1) +
      0.08 * Math.sin(2 * Math.PI * 14 * t + 2);
    out[i] = 0.35 * e * wobble;
  }
  return out;
})();

const files = {
  'sfx_ui_tap.wav': tap,
  'sfx_ui_success.wav': success,
  'sfx_ui_combo.wav': combo,
  'sfx_ui_error_soft.wav': errorSoft,
  'sfx_ui_start.wav': start,
  'sfx_ui_complete.wav': complete,
  'sfx_ui_transition.wav': transition,
};

for (const [name, samples] of Object.entries(files)) {
  writeWav(path.join(OUT, name), samples);
  console.log('wrote', name, samples.length, 'samples');
}
