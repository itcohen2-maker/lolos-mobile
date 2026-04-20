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
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const DEFAULT_SCROLL_MS = 700;
const DEFAULT_PULSE_MS = 600;

export function createBotDemonstrator(): DemoApi {
  return {
    async scrollFanTo(idx: number, opts: ScrollOpts = {}): Promise<void> {
      const durationMs = opts.durationMs ?? DEFAULT_SCROLL_MS;
      tutorialBus.emitFanDemo({ kind: 'scrollToIdx', idx, durationMs, easing: opts.easing });
      await sleep(durationMs);
    },
    async pulseCard(idx: number, durationMs: number = DEFAULT_PULSE_MS): Promise<void> {
      tutorialBus.emitFanDemo({ kind: 'pulseCardIdx', idx, durationMs });
      await sleep(durationMs);
    },
    async pulseDiceBtn(durationMs: number = 1800): Promise<void> {
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
      tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx });
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.26 });
      await sleep(450);
    },
    async eqSetOp(which: 1 | 2, op: '+' | '-' | 'x' | '÷'): Promise<void> {
      tutorialBus.emitFanDemo({ kind: 'eqSetOp', which, op });
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.22 });
      await sleep(450);
    },
    async eqConfirm(): Promise<void> {
      tutorialBus.emitFanDemo({ kind: 'eqConfirm' });
      void playSfx('success', { cooldownMs: 80, volumeOverride: 0.4 });
      await sleep(700);
    },
    async eqReset(): Promise<void> {
      tutorialBus.emitFanDemo({ kind: 'clearCardFrame' });
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      await sleep(250);
    },
    async stageCardByValue(value: number): Promise<void> {
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
  };
}
