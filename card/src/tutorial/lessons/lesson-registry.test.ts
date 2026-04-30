import { LESSONS } from './index';
import { tutorialBus } from '../tutorialBus';

describe('lesson registry smoke', () => {
  it('has at least one lesson with at least one step', () => {
    expect(LESSONS.length).toBeGreaterThan(0);
    expect(LESSONS[0].steps.length).toBeGreaterThan(0);
  });
  it('lessons in order: core six + optional fractions + parens + identical + final multi-play', () => {
    expect(LESSONS.map((l) => l.id)).toEqual([
      'fan-basics',
      'tap-card',
      'dice-basics',
      'equation-basics',
      'op-cycle-basics',
      'possible-results-basics',
      'fractions-advanced',
      'parens-move',
      'identical-single',
      'multi-play-tip',
    ]);
  });
  it('lesson 10 (multi-play-tip) has the two multi-play exercises only', () => {
    expect(LESSONS[9].steps.map((s) => s.id)).toEqual([
      'multi-play-exercise',
      'multi-play-exercise-2',
    ]);
  });
  it('lesson 4 (equation-basics) has 4 steps: play-card, fill-missing-die, did-you-know, full-build', () => {
    expect(LESSONS[3].steps.map(s => s.id)).toEqual(['play-card', 'fill-missing-die', 'did-you-know', 'full-build']);
  });
  it('lesson 4 step 1 (play-card) outcome: card matching lastEquationResult', () => {
    tutorialBus.setLastEquationResult(7);
    const step = LESSONS[3].steps[0];
    expect(step.outcome({ kind: 'cardTapped', cardId: 'tut-l4-card-7-123' })).toBe(true);
    expect(step.outcome({ kind: 'cardTapped', cardId: 'tut-l4-bot-card-7-123' })).toBe(true);
    expect(step.outcome({ kind: 'cardTapped', cardId: 'tut-l4-card-5-123' })).toBe(false);
    expect(step.outcome({ kind: 'diceRolled' })).toBe(false);
    tutorialBus._reset();
  });
  it('lesson 4 step 2 (fill-missing-die) outcome: card matching lastEquationResult', () => {
    tutorialBus.setLastEquationResult(9);
    const step = LESSONS[3].steps[1];
    expect(step.outcome({ kind: 'cardTapped', cardId: 'tut-l4-card-9-123' })).toBe(true);
    expect(step.outcome({ kind: 'cardTapped', cardId: 'tut-l4-bot-card-9-123' })).toBe(true);
    expect(step.outcome({ kind: 'cardTapped', cardId: 'tut-l4-card-5-123' })).toBe(false);
    expect(step.outcome({ kind: 'eqUserPickedDice', idx: 1 })).toBe(false);
    tutorialBus._reset();
  });
  it('lesson 4 step 3 (did-you-know) outcome: l4DidYouKnowAck', () => {
    const step = LESSONS[3].steps[2];
    expect(step.outcome({ kind: 'l4DidYouKnowAck' })).toBe(true);
    expect(step.outcome({ kind: 'userPlayedCards' })).toBe(false);
    expect(step.outcome({ kind: 'cardTapped', cardId: 'tut-l4-card-5-123' })).toBe(false);
  });
  it('lesson 4 step 4 (full-build) outcome: userPlayedCards', () => {
    const step = LESSONS[3].steps[3];
    expect(step.outcome({ kind: 'userPlayedCards' })).toBe(true);
    expect(step.outcome({ kind: 'cardTapped', cardId: 'tut-l4-card-5-123' })).toBe(false);
    expect(step.outcome({ kind: 'eqUserPickedDice', idx: 1 })).toBe(false);
  });
  it('lesson 5 has place-op, joker-place, then the important tip', () => {
    expect(LESSONS[4].steps.map((s) => s.id)).toEqual([
      'place-op',
      'joker-place',
      'important-tip',
    ]);
  });
  it('lesson 5 step 1 (place-op) outcome: only the correct `+` op advances', () => {
    const step = LESSONS[4].steps[0];
    // The step is set up as `4 ? 3 = 7`, so only `+` completes it.
    expect(step.outcome({ kind: 'l5OperatorPlaced', op: '+', position: 0 })).toBe(true);
    expect(step.outcome({ kind: 'l5OperatorPlaced', op: '-', position: 0 })).toBe(false);
    expect(step.outcome({ kind: 'l5OperatorPlaced', op: 'x', position: 0 })).toBe(false);
    expect(step.outcome({ kind: 'l5OperatorPlaced', op: 'ֳ·', position: 0 })).toBe(false);
    expect(step.outcome({ kind: 'opSelected', op: '+', via: 'cycle' })).toBe(false);
    expect(step.outcome({ kind: 'l5JokerModalOpened' })).toBe(false);
  });
  it('lesson 5 step 2 (joker-place) requires completed full joker flow with correct sign (+)', () => {
    const step = LESSONS[4].steps[1];
    expect(step.outcome({ kind: 'l5JokerFlowCompleted', op: '+' })).toBe(true);
    expect(step.outcome({ kind: 'l5JokerFlowCompleted', op: '-' })).toBe(false);
    expect(step.outcome({ kind: 'l5JokerFlowCompleted', op: 'x' })).toBe(false);
    expect(step.outcome({ kind: 'l5JokerFlowCompleted', op: 'ֳ·' })).toBe(false);
    expect(step.outcome({ kind: 'l5JokerPlaced', op: '+' })).toBe(false);
    expect(step.outcome({ kind: 'l5JokerPickedInModal', op: '+' })).toBe(false);
  });
  it('lesson 5 step 3 (important-tip) waits for l3TipAck', () => {
    const step = LESSONS[4].steps[2];
    expect(step.outcome({ kind: 'l3TipAck' })).toBe(true);
    expect(step.outcome({ kind: 'l3SolvedAck' })).toBe(false);
  });
  it('lesson 7 (fractions-advanced) has intro + 2 attacks only', () => {
    const L7 = LESSONS[6];
    expect(L7.steps.map((s) => s.id)).toEqual([
      'frac-intro',
      'frac-attack-half',
      'frac-attack-third',
    ]);
    expect(L7.steps[0].outcome({ kind: 'fracLessonAck' })).toBe(true);
    expect(L7.steps[0].outcome({ kind: 'fracAttackPlayed', fraction: '1/2' })).toBe(false);
    expect(L7.steps[1].outcome({ kind: 'fracAttackPlayed', fraction: '1/2' })).toBe(true);
    expect(L7.steps[1].outcome({ kind: 'fracAttackPlayed', fraction: '1/3' })).toBe(false);
    expect(L7.steps[2].outcome({ kind: 'fracAttackPlayed', fraction: '1/3' })).toBe(true);
  });
  it('lesson 1 (fan-basics) has the scroll step only', () => {
    expect(LESSONS[0].steps.map(s => s.id)).toEqual(['scroll-fan']);
  });
  it('lesson 2 (tap-card) has the tap step only and accepts cardTapped', () => {
    expect(LESSONS[1].steps.map(s => s.id)).toEqual(['tap-card']);
    const [tapStep] = LESSONS[1].steps;
    expect(tapStep.outcome({ kind: 'cardTapped', cardId: 'x' })).toBe(true);
    expect(tapStep.outcome({ kind: 'fanScrolled', toIdx: 1 })).toBe(false);
  });
  it('lesson 3 (dice-basics) includes roll and solved preview steps', () => {
    expect(LESSONS[2].steps.map(s => s.id)).toEqual(['roll-dice', 'solved-preview']);
    const [rollStep, previewStep] = LESSONS[2].steps;
    expect(rollStep.outcome({ kind: 'diceRolled' })).toBe(true);
    expect(rollStep.outcome({ kind: 'cardTapped', cardId: 'x' })).toBe(false);
    expect(previewStep.outcome({ kind: 'l3SolvedAck' })).toBe(true);
  });
  it('scroll-fan outcome accepts fanScrolled, rejects cardTapped', () => {
    const [scrollStep] = LESSONS[0].steps;
    expect(scrollStep.outcome({ kind: 'fanScrolled', toIdx: 1 })).toBe(true);
    expect(scrollStep.outcome({ kind: 'cardTapped', cardId: 'x' })).toBe(false);
  });
});
