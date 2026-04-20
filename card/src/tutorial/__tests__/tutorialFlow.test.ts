import { INITIAL_TUTORIAL_STATE, tutorialReducer } from '../tutorialReducer';

describe('tutorial dual-demo + fractions opt-in flow', () => {
  it('moves to second demo variant before next lesson', () => {
    const started = tutorialReducer(INITIAL_TUTORIAL_STATE, { type: 'START_TUTORIAL' });
    const nextVariant = tutorialReducer(started, { type: 'NEXT_VARIANT' });

    expect(nextVariant.turn).toBe('bot');
    expect(nextVariant.stepIndex).toBe(0);
    expect(nextVariant.demoVariantIndex).toBe(1);
    expect(nextVariant.showLessonIntro).toBe(false);
  });

  it('opens fractions opt-in gate before lesson 5', () => {
    const stateAtWildLesson = {
      ...INITIAL_TUTORIAL_STATE,
      active: true,
      lessonIndex: 3,
      turn: 'user' as const,
      fractionsOptIn: null,
    };
    const gated = tutorialReducer(stateAtWildLesson, { type: 'NEXT_LESSON' });
    expect(gated.awaitingFractionsOptIn).toBe(true);
    expect(gated.fractionsOptIn).toBeNull();
  });

  it('skips fraction lesson when user declines opt-in', () => {
    const stateAfterPrompt = {
      ...INITIAL_TUTORIAL_STATE,
      active: true,
      lessonIndex: 3,
      awaitingFractionsOptIn: true,
    };
    const noFractions = tutorialReducer(stateAfterPrompt, {
      type: 'TUTORIAL_CONFIRM_FRACTIONS_OPT_IN',
      choice: 'no',
    });
    const next = tutorialReducer(noFractions, { type: 'NEXT_LESSON' });
    expect(next.lessonIndex).toBe(5);
  });
});
