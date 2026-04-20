import { LESSONS } from '../lessons';
import {
  INITIAL_MIMIC_STATE,
  mimicReducer,
  MIMIC_FIRST_FRACTION_LESSON_INDEX,
  MIMIC_LAST_CORE_LESSON_INDEX,
} from '../MimicEngine';

const SHAPES_CORE = [
  { id: 'a', stepCount: 1 },
  { id: 'b', stepCount: 1 },
  { id: 'c', stepCount: 1 },
  { id: 'd', stepCount: 1 },
  { id: 'op-cycle-basics', stepCount: 2 },
];
const SHAPES_WITH_FRAC = [...SHAPES_CORE, { id: 'fractions-advanced', stepCount: 6 }];

describe('mimicReducer fractions branch', () => {
  it('after last core lesson goes to post-signs-choice instead of all-done', () => {
    let s = mimicReducer(INITIAL_MIMIC_STATE, { type: 'START' }, SHAPES_WITH_FRAC);
    s = { ...s, lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX, stepIndex: 1, phase: 'lesson-done' };
    s = mimicReducer(s, { type: 'DISMISS_LESSON_DONE' }, SHAPES_WITH_FRAC);
    expect(s.phase).toBe('post-signs-choice');
    expect(s.lessonIndex).toBe(MIMIC_LAST_CORE_LESSON_INDEX);
  });

  it('CHOOSE_FINISH_TUTORIAL from post-signs-choice reaches all-done', () => {
    const s0: typeof INITIAL_MIMIC_STATE = {
      ...INITIAL_MIMIC_STATE,
      phase: 'post-signs-choice',
      lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX,
      stepIndex: 1,
    };
    const s = mimicReducer(s0, { type: 'CHOOSE_FINISH_TUTORIAL' }, SHAPES_WITH_FRAC);
    expect(s.phase).toBe('all-done');
  });

  it('CHOOSE_ADVANCED_FRACTIONS starts optional lesson at index 5', () => {
    const s0: typeof INITIAL_MIMIC_STATE = {
      ...INITIAL_MIMIC_STATE,
      phase: 'post-signs-choice',
      lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX,
      stepIndex: 1,
    };
    const s = mimicReducer(s0, { type: 'CHOOSE_ADVANCED_FRACTIONS' }, SHAPES_WITH_FRAC);
    expect(s.phase).toBe('intro');
    expect(s.lessonIndex).toBe(MIMIC_FIRST_FRACTION_LESSON_INDEX);
    expect(s.stepIndex).toBe(0);
  });

  it('GO_BACK from first fraction step returns to post-signs-choice', () => {
    const s0: typeof INITIAL_MIMIC_STATE = {
      ...INITIAL_MIMIC_STATE,
      phase: 'intro',
      lessonIndex: MIMIC_FIRST_FRACTION_LESSON_INDEX,
      stepIndex: 0,
    };
    const s = mimicReducer(s0, { type: 'GO_BACK' }, SHAPES_WITH_FRAC);
    expect(s.phase).toBe('post-signs-choice');
    expect(s.lessonIndex).toBe(MIMIC_LAST_CORE_LESSON_INDEX);
  });

  it('GO_BACK from post-signs-choice returns to last core step', () => {
    const s0: typeof INITIAL_MIMIC_STATE = {
      ...INITIAL_MIMIC_STATE,
      phase: 'post-signs-choice',
      lessonIndex: MIMIC_LAST_CORE_LESSON_INDEX,
      stepIndex: 1,
    };
    const s = mimicReducer(s0, { type: 'GO_BACK' }, SHAPES_WITH_FRAC);
    expect(s.phase).toBe('intro');
    expect(s.lessonIndex).toBe(MIMIC_LAST_CORE_LESSON_INDEX);
    expect(s.stepIndex).toBe(1);
  });

  it('after optional lesson completes, DISMISS_LESSON_DONE goes to all-done', () => {
    let s: typeof INITIAL_MIMIC_STATE = {
      ...INITIAL_MIMIC_STATE,
      lessonIndex: MIMIC_FIRST_FRACTION_LESSON_INDEX,
      stepIndex: 5,
      phase: 'lesson-done',
    };
    s = mimicReducer(s, { type: 'DISMISS_LESSON_DONE' }, SHAPES_WITH_FRAC);
    expect(s.phase).toBe('all-done');
  });

  it('attack-half step rejects wrong fraction event (stay on step until correct)', () => {
    const step = LESSONS[MIMIC_FIRST_FRACTION_LESSON_INDEX].steps[2];
    expect(step.outcome({ kind: 'fracAttackPlayed', fraction: '1/3' })).toBe(false);
    expect(step.outcome({ kind: 'fracAttackPlayed', fraction: '1/2' })).toBe(true);
  });
});
