// ============================================================
// MimicEngine.ts — Watch-and-mimic tutorial state machine
// Pure reducer. UI side effects (bot demo, outcome detection,
// celebrate timer) are dispatched as actions from the outside.
// ============================================================

export type MimicPhase =
  | 'idle'
  | 'intro'
  | 'bot-demo'
  | 'await-mimic'
  | 'celebrate'
  | 'lesson-done'
  | 'core-complete'
  | 'post-signs-choice'
  | 'all-done';

export type MimicState = {
  phase: MimicPhase;
  lessonIndex: number;
  stepIndex: number;
};

export type MimicAction =
  | { type: 'START' }
  | { type: 'DISMISS_INTRO' }
  | { type: 'BOT_DEMO_DONE' }
  | { type: 'OUTCOME_MATCHED' }
  | { type: 'CELEBRATE_DONE' }
  | { type: 'DISMISS_LESSON_DONE' }
  | { type: 'DISMISS_CORE_COMPLETE' }
  | { type: 'CHOOSE_FINISH_TUTORIAL' }
  | { type: 'CHOOSE_ADVANCED_FRACTIONS' }
  | { type: 'GO_BACK' }
  | { type: 'EXIT' };

/** Last core lesson index (0-based) before optional fractions branch.
 *  Core lessons: 0 fan, 1 tap, 2 dice, 3 equation, 4 op-cycle+joker,
 *  5 possible-results (chip + mini-cards + solve-chip copy). */
export const MIMIC_LAST_CORE_LESSON_INDEX = 5;

/** First optional fractions module lesson index (append after core lessons). */
export const MIMIC_FIRST_FRACTION_LESSON_INDEX = MIMIC_LAST_CORE_LESSON_INDEX + 1;

export type LessonShape = { id: string; stepCount: number };

export const INITIAL_MIMIC_STATE: MimicState = {
  phase: 'idle',
  lessonIndex: 0,
  stepIndex: 0,
};

export function mimicReducer(
  state: MimicState,
  action: MimicAction,
  lessons: LessonShape[],
): MimicState {
  if (action.type === 'EXIT') return INITIAL_MIMIC_STATE;

  if (action.type === 'GO_BACK') {
    if (state.phase === 'post-signs-choice' || state.phase === 'core-complete') {
      // Return to the LAST step of the last core lesson (so the learner can
      // re-review whatever they just finished). The core end moved from
      // lesson 4 (2 steps) to lesson 5 (3 steps) when the possible-results
      // lesson was inserted, so read the step count from the registry
      // instead of hardcoding the index.
      const last = lessons[MIMIC_LAST_CORE_LESSON_INDEX];
      const lastStep = last ? Math.max(0, last.stepCount - 1) : 0;
      return { phase: 'intro', lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX, stepIndex: lastStep };
    }
    if (state.lessonIndex > MIMIC_LAST_CORE_LESSON_INDEX && state.stepIndex === 0) {
      return { phase: 'post-signs-choice', lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX, stepIndex: 0 };
    }
    if (state.stepIndex > 0) {
      return { ...state, phase: 'intro', stepIndex: state.stepIndex - 1 };
    }
    if (state.lessonIndex > 0) {
      return { phase: 'intro', lessonIndex: state.lessonIndex - 1, stepIndex: 0 };
    }
    return { phase: 'intro', lessonIndex: 0, stepIndex: 0 };
  }

  if (action.type === 'CHOOSE_FINISH_TUTORIAL' && state.phase === 'post-signs-choice') {
    return { ...state, phase: 'all-done' };
  }

  if (action.type === 'CHOOSE_ADVANCED_FRACTIONS' && state.phase === 'post-signs-choice') {
    return { phase: 'intro', lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX + 1, stepIndex: 0 };
  }

  if (action.type === 'START') {
    if (lessons.length === 0) return { ...state, phase: 'all-done' };
    return { phase: 'intro', lessonIndex: 0, stepIndex: 0 };
  }

  if (action.type === 'DISMISS_INTRO' && state.phase === 'intro') {
    return { ...state, phase: 'bot-demo' };
  }

  if (action.type === 'BOT_DEMO_DONE' && state.phase === 'bot-demo') {
    return { ...state, phase: 'await-mimic' };
  }

  if (action.type === 'OUTCOME_MATCHED' && state.phase === 'await-mimic') {
    return { ...state, phase: 'celebrate' };
  }

  if (action.type === 'CELEBRATE_DONE' && state.phase === 'celebrate') {
    const lesson = lessons[state.lessonIndex];
    const isLastStep = state.stepIndex >= lesson.stepCount - 1;
    if (isLastStep) {
      return { ...state, phase: 'lesson-done' };
    }
    return { ...state, phase: 'bot-demo', stepIndex: state.stepIndex + 1 };
  }

  if (action.type === 'DISMISS_LESSON_DONE' && state.phase === 'lesson-done') {
    const atCoreEnd =
      state.lessonIndex === MIMIC_LAST_CORE_LESSON_INDEX &&
      lessons[MIMIC_LAST_CORE_LESSON_INDEX]?.id === 'possible-results-basics';
    if (atCoreEnd) {
      // Core tutorial finished. Show a festive "you earned 10 coins" popup
      // first; the fractions branch prompt follows only after the learner
      // acks it.
      return { ...state, phase: 'core-complete' };
    }
    const isLastLesson = state.lessonIndex >= lessons.length - 1;
    if (isLastLesson) {
      return { ...state, phase: 'all-done' };
    }
    return { phase: 'intro', lessonIndex: state.lessonIndex + 1, stepIndex: 0 };
  }

  if (action.type === 'DISMISS_CORE_COMPLETE' && state.phase === 'core-complete') {
    return { ...state, phase: 'post-signs-choice' };
  }

  return state;
}
