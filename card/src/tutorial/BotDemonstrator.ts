// ============================================================
// BotDemonstrator.ts — High-level API for choreographing bot
// demos in the watch-and-mimic tutorial. Lessons author code
// against this; underneath it talks to tutorialBus.
// ============================================================

import { Audio } from 'expo-av';
import { tutorialBus, type FanDemoEasing } from './tutorialBus';
import { playSfx, isSfxMuted } from '../audio/sfx';

const diceRollAsset = require('../../assets/dice_roll.m4a');

export type ScrollOpts = {
  durationMs?: number;
  easing?: FanDemoEasing;
};

export type DemoApi = {
  scrollFanTo(idx: number, opts?: ScrollOpts): Promise<void>;
  pulseCard(idx: number, durationMs?: number): Promise<void>;
  pulseDiceBtn(durationMs?: number): Promise<void>;
  /** Equation-builder helpers — drive the real EquationBuilder via the bus. */
  eqPickDice(idx: number): Promise<void>;
  eqSetOp(which: 1 | 2, op: '+' | '-' | 'x' | '÷'): Promise<void>;
  eqConfirm(): Promise<void>;
  eqReset(): Promise<void>;
  stageCardByValue(value: number): Promise<void>;
  wait(ms: number): Promise<void>;
  fanLength(): number;
  /** Lesson 4 dynamic dice config (set by the host before bot-demo starts). */
  l4Config(): { pickA: number; pickB: number; target: number; hand?: number[]; validSums?: number[] } | null;
  /** Lesson 6 (possible-results) helpers. */
  openResultsChip(): Promise<void>;
  tapMiniResult(idx: number): Promise<void>;
  /** Lesson 6 step 3 copy-exercise config (published by the host once the
   *  learner taps a mini-card). Returns null outside that step. */
  l6CopyConfig(): { pickA: number; pickB: number; op: '+' | '-' | 'x' | '÷'; target: number } | null;
  /** Lesson 11 (multi-play) addends — published by InteractiveTutorialScreen
   *  before the bot demo so the bot stages the correct cards. */
  l11Config(): { addA: number; addB: number } | null;
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const DEFAULT_SCROLL_MS = 700;
const DEFAULT_PULSE_MS = 600;

/** Create a bot-demo api that stops emitting bus events once `isCancelled()`
 *  returns true. The host sets a local flag in the useEffect cleanup when
 *  the lesson/step transitions; every emit-producing method checks that flag
 *  on entry so stale emits from a skipped-past bot demo cannot leak into
 *  the next step's UI. (Reproduction: user hits "דלג" mid-L4.1 while
 *  `await api.wait(2800)` is pending — 2800ms later the chain tries to
 *  `eqPickDice(pickA)` and corrupts L5.1's pre-filled equation.) The
 *  predicate is optional so existing call sites and tests that don't need
 *  cancellation still work unchanged. */
export function createBotDemonstrator(isCancelled?: () => boolean): DemoApi {
  const cancelled = (): boolean => isCancelled?.() ?? false;
  return {
    async scrollFanTo(idx: number, opts: ScrollOpts = {}): Promise<void> {
      if (cancelled()) return;
      const durationMs = opts.durationMs ?? DEFAULT_SCROLL_MS;
      tutorialBus.emitFanDemo({ kind: 'scrollToIdx', idx, durationMs, easing: opts.easing });
      await sleep(durationMs);
    },
    async pulseCard(idx: number, durationMs: number = DEFAULT_PULSE_MS): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'pulseCardIdx', idx, durationMs });
      await sleep(durationMs);
    },
    async pulseDiceBtn(durationMs: number = 1800): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'pulseDiceBtn', durationMs });
      // Play dice roll sound during the bot demo (respects mute). The second
      // isSfxMuted() check catches the race where the learner hits mute while
      // createAsync is still loading the sound file.
      if (!isSfxMuted()) {
        try {
          const { sound } = await Audio.Sound.createAsync(diceRollAsset);
          if (isSfxMuted()) {
            sound.unloadAsync().catch(() => {});
          } else {
            await sound.playAsync();
            sound.setOnPlaybackStatusUpdate((s) => {
              if ((s as { didJustFinish?: boolean }).didJustFinish) sound.unloadAsync().catch(() => {});
            });
          }
        } catch { /* no sound — fail silently */ }
      }
      await sleep(durationMs);
    },
    async eqPickDice(idx: number): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx });
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.26 });
      await sleep(450);
    },
    async eqSetOp(which: 1 | 2, op: '+' | '-' | 'x' | '÷'): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'eqSetOp', which, op });
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.22 });
      await sleep(450);
    },
    async eqConfirm(): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'eqConfirm' });
      void playSfx('success', { cooldownMs: 80, volumeOverride: 0.4 });
      await sleep(700);
    },
    async eqReset(): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'clearCardFrame' });
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      await sleep(250);
    },
    async stageCardByValue(value: number): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'stageCardByValue', value });
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.3 });
      await sleep(500);
    },
    async wait(ms: number): Promise<void> {
      await sleep(ms);
    },
    fanLength(): number {
      return tutorialBus.getFanLength();
    },
    l4Config(): { pickA: number; pickB: number; target: number } | null {
      return tutorialBus.getL4Config();
    },
    async openResultsChip(): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.26 });
      await sleep(650);
    },
    async tapMiniResult(idx: number): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'tapMiniResult', idx });
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.26 });
      await sleep(650);
    },
    l6CopyConfig(): { pickA: number; pickB: number; op: '+' | '-' | 'x' | '÷'; target: number } | null {
      return tutorialBus.getL6CopyConfig();
    },
    l11Config(): { addA: number; addB: number } | null {
      return tutorialBus.getL11Config();
    },
  };
}
