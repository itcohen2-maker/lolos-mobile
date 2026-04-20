import { LESSONS } from './index';
import { tutorialBus } from '../tutorialBus';

describe('lesson registry smoke', () => {
  it('has at least one lesson with at least one step', () => {
    expect(LESSONS.length).toBeGreaterThan(0);
    expect(LESSONS[0].steps.length).toBeGreaterThan(0);
  });
  it('lessons in order: core five + optional fractions-advanced', () => {
    expect(LESSONS.map((l) => l.id)).toEqual([
      'fan-basics',
      'tap-card',
      'dice-basics',
      'equation-basics',
      'op-cycle-basics',
      'fractions-advanced',
    ]);
  });
  it('lesson 4 (equation-basics) has 3 steps: play-card, fill-missing-die, full-build', () => {
    expect(LESSONS[3].steps.map(s => s.id)).toEqual(['play-card', 'fill-missing-die', 'full-build']);
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
  it('lesson 4 step 3 (full-build) outcome: userPlayedCards', () => {
    const step = LESSONS[3].steps[2];
    expect(step.outcome({ kind: 'userPlayedCards' })).toBe(true);
    expect(step.outcome({ kind: 'cardTapped', cardId: 'tut-l4-card-5-123' })).toBe(false);
    expect(step.outcome({ kind: 'eqUserPickedDice', idx: 1 })).toBe(false);
  });
  it('lesson 5 step 1 (cycle-signs) outcome: l5AllSignsCycled only', () => {
    const step = LESSONS[4].steps[0];
    expect(step.outcome({ kind: 'l5AllSignsCycled' })).toBe(true);
    expect(step.outcome({ kind: 'opSelected', op: '+', via: 'cycle' })).toBe(false);
    expect(step.outcome({ kind: 'l5JokerModalOpened' })).toBe(false);
  });
  it('lesson 5 step 2 (joker-place) requires completed full joker flow', () => {
    const step = LESSONS[4].steps[1];
    expect(step.outcome({ kind: 'l5JokerFlowCompleted', op: '÷' })).toBe(true);
    expect(step.outcome({ kind: 'l5JokerPlaced', op: '÷' })).toBe(false);
    expect(step.outcome({ kind: 'l5JokerPickedInModal', op: '÷' })).toBe(false);
  });
  it('lesson 6 (fractions-advanced) outcomes: ack, attacks, defenses', () => {
    const L6 = LESSONS[5];
    expect(L6.steps.map((s) => s.id)).toEqual([
      'frac-intro',
      'frac-theory',
      'frac-attack-half',
      'frac-attack-third',
      'frac-defend-half',
      'frac-defend-third',
    ]);
    expect(L6.steps[0].outcome({ kind: 'fracLessonAck' })).toBe(true);
    expect(L6.steps[2].outcome({ kind: 'fracAttackPlayed', fraction: '1/2' })).toBe(true);
    expect(L6.steps[2].outcome({ kind: 'fracAttackPlayed', fraction: '1/3' })).toBe(false);
    expect(L6.steps[3].outcome({ kind: 'fracAttackPlayed', fraction: '1/3' })).toBe(true);
    expect(L6.steps[4].outcome({ kind: 'fracDefenseSolved', penaltyDenom: 2 })).toBe(true);
    expect(L6.steps[5].outcome({ kind: 'fracDefenseSolved', penaltyDenom: 3 })).toBe(true);
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
  it('lesson 3 (dice-basics) has the roll step only and accepts diceRolled', () => {
    expect(LESSONS[2].steps.map(s => s.id)).toEqual(['roll-dice']);
    const [rollStep] = LESSONS[2].steps;
    expect(rollStep.outcome({ kind: 'diceRolled' })).toBe(true);
    expect(rollStep.outcome({ kind: 'cardTapped', cardId: 'x' })).toBe(false);
  });
  it('scroll-fan outcome accepts fanScrolled, rejects cardTapped', () => {
    const [scrollStep] = LESSONS[0].steps;
    expect(scrollStep.outcome({ kind: 'fanScrolled', toIdx: 1 })).toBe(true);
    expect(scrollStep.outcome({ kind: 'cardTapped', cardId: 'x' })).toBe(false);
  });
});
