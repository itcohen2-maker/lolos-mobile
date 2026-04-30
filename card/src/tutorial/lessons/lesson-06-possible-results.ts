// ============================================================
// lesson-06-possible-results.ts — Sixth lesson (core): possible
// outcomes button + mini cards + red solve-exercise chip.
//
// Runs on the real game UI (ResultsChip + ResultsStripBelowTable +
// SolveExerciseChip). Two short steps — the old "copy exercise"
// step was dropped; the learner only needs to understand that
// tapping a mini-card reveals the exercise behind it, not rebuild
// it in the EquationBuilder.
//
// 6.1 (open-chip) — the learner taps the green "possible results"
//     chip next to the pile. The strip of mini-cards slides open.
//     Outcome: `resultsChipTapped` user event.
//
// 6.2 (tap-mini)  — one of the mini-cards pulses; the learner taps
//     it to reveal the red SolveExerciseChip with the full
//     equation behind the chosen result. Celebrate requires a
//     manual "הבנתי" acknowledgement before the lesson advances.
//     Outcome: `miniCardTapped` user event.
// ============================================================

import type { Lesson } from './types';

export const lesson06PossibleResults: Lesson = {
  id: 'possible-results-basics',
  titleKey: 'tutorial.l6.title',
  descKey: 'tutorial.l6.desc',
  steps: [
    {
      id: 'open-chip',
      // Bot-demo is instant — the bubble text (botHintKey) and the hint (hintKey)
      // are identical, so the learner sees ONE continuous bubble throughout.
      // Skipping the 3.2s wait means the green chip's boostedPulse is visible
      // immediately once await-mimic starts.
      botDemo: async (_api) => {},
      outcome: (e) => e.kind === 'resultsChipTapped',
      hintKey: 'tutorial.l6a.hintTapChip',
      botHintKey: 'tutorial.l6a.hintTapChip',
      celebrateKey: 'tutorial.l6a.celebrate',
    },
    {
      id: 'tap-mini',
      botDemo: async (api) => {
        await api.wait(7000);
        // Bot taps the first mini-card in the strip (sorted by result ascending).
        // The host rigs dice + hand so at least one mini-card is always present.
        await api.tapMiniResult(0);
      },
      outcome: (e) => e.kind === 'miniCardTapped',
      hintKey: 'tutorial.l6b.hintTapMini',
      botHintKey: 'tutorial.l6b.botIntro',
      celebrateKey: 'tutorial.l6b.celebrate',
    },
    {
      id: 'wild-finish',
      botDemo: async (api) => {
        await api.wait(900);
      },
      outcome: (e) => e.kind === 'userPlayedCards',
    },
  ],
};
