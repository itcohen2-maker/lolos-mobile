import {
  type MimicState,
  type LessonShape,
  INITIAL_MIMIC_STATE,
  mimicReducer,
} from './MimicEngine';

const LESSONS: LessonShape[] = [
  { id: 'fan-basics', stepCount: 2 },
  { id: 'dice', stepCount: 1 },
];

const after = (state: MimicState, ...actions: Parameters<typeof mimicReducer>[1][]): MimicState =>
  actions.reduce((s, a) => mimicReducer(s, a, LESSONS), state);

describe('MimicEngine — initial state', () => {
  it('starts idle at lesson 0 step 0', () => {
    expect(INITIAL_MIMIC_STATE).toEqual({
      phase: 'idle',
      lessonIndex: 0,
      stepIndex: 0,
    });
  });
});

describe('MimicEngine — happy path single lesson, single step', () => {
  it('START moves idle → intro on lesson 0', () => {
    const s = after(INITIAL_MIMIC_STATE, { type: 'START' });
    expect(s.phase).toBe('intro');
    expect(s.lessonIndex).toBe(0);
    expect(s.stepIndex).toBe(0);
  });

  it('DISMISS_INTRO moves intro → bot-demo on step 0', () => {
    const s = after(INITIAL_MIMIC_STATE, { type: 'START' }, { type: 'DISMISS_INTRO' });
    expect(s.phase).toBe('bot-demo');
    expect(s.stepIndex).toBe(0);
  });

  it('BOT_DEMO_DONE moves bot-demo → await-mimic', () => {
    const s = after(
      INITIAL_MIMIC_STATE,
      { type: 'START' },
      { type: 'DISMISS_INTRO' },
      { type: 'BOT_DEMO_DONE' },
    );
    expect(s.phase).toBe('await-mimic');
  });

  it('OUTCOME_MATCHED moves await-mimic → celebrate', () => {
    const s = after(
      INITIAL_MIMIC_STATE,
      { type: 'START' },
      { type: 'DISMISS_INTRO' },
      { type: 'BOT_DEMO_DONE' },
      { type: 'OUTCOME_MATCHED' },
    );
    expect(s.phase).toBe('celebrate');
  });
});

describe('MimicEngine — step advance within a lesson', () => {
  it('CELEBRATE_DONE on step 0 of 2-step lesson moves to bot-demo on step 1', () => {
    const s = after(
      INITIAL_MIMIC_STATE,
      { type: 'START' },
      { type: 'DISMISS_INTRO' },
      { type: 'BOT_DEMO_DONE' },
      { type: 'OUTCOME_MATCHED' },
      { type: 'CELEBRATE_DONE' },
    );
    expect(s.phase).toBe('bot-demo');
    expect(s.stepIndex).toBe(1);
    expect(s.lessonIndex).toBe(0);
  });

  it('CELEBRATE_DONE on last step of lesson moves to lesson-done', () => {
    const walkOneStep = (s: MimicState): MimicState =>
      after(s, { type: 'BOT_DEMO_DONE' }, { type: 'OUTCOME_MATCHED' }, { type: 'CELEBRATE_DONE' });

    let s = after(INITIAL_MIMIC_STATE, { type: 'START' }, { type: 'DISMISS_INTRO' });
    s = walkOneStep(s); // finishes step 0 → bot-demo step 1
    s = walkOneStep(s); // finishes step 1 → lesson-done

    expect(s.phase).toBe('lesson-done');
    expect(s.lessonIndex).toBe(0);
  });
});

describe('MimicEngine — lesson advance', () => {
  const finishLessonZero = (): MimicState => {
    const walkOneStep = (s: MimicState): MimicState =>
      after(s, { type: 'BOT_DEMO_DONE' }, { type: 'OUTCOME_MATCHED' }, { type: 'CELEBRATE_DONE' });
    let s = after(INITIAL_MIMIC_STATE, { type: 'START' }, { type: 'DISMISS_INTRO' });
    s = walkOneStep(s);
    s = walkOneStep(s);
    return s;
  };

  it('DISMISS_LESSON_DONE with more lessons → intro on next lesson, step 0', () => {
    const s = after(finishLessonZero(), { type: 'DISMISS_LESSON_DONE' });
    expect(s.phase).toBe('intro');
    expect(s.lessonIndex).toBe(1);
    expect(s.stepIndex).toBe(0);
  });

  it('DISMISS_LESSON_DONE on last lesson → all-done', () => {
    const finishLessonOne = (): MimicState => {
      let s = after(finishLessonZero(), { type: 'DISMISS_LESSON_DONE' });
      s = after(s, { type: 'DISMISS_INTRO' });
      s = after(s, { type: 'BOT_DEMO_DONE' }, { type: 'OUTCOME_MATCHED' }, { type: 'CELEBRATE_DONE' });
      return s;
    };
    const s = after(finishLessonOne(), { type: 'DISMISS_LESSON_DONE' });
    expect(s.phase).toBe('all-done');
  });
});

describe('MimicEngine — exit & defensive transitions', () => {
  it('EXIT from any phase returns to idle and resets indices', () => {
    const s = after(
      INITIAL_MIMIC_STATE,
      { type: 'START' },
      { type: 'DISMISS_INTRO' },
      { type: 'BOT_DEMO_DONE' },
      { type: 'EXIT' },
    );
    expect(s).toEqual(INITIAL_MIMIC_STATE);
  });

  it('OUTCOME_MATCHED in wrong phase is a no-op', () => {
    const s = after(INITIAL_MIMIC_STATE, { type: 'START' }, { type: 'OUTCOME_MATCHED' });
    expect(s.phase).toBe('intro');
  });

  it('BOT_DEMO_DONE in wrong phase is a no-op', () => {
    const s = after(INITIAL_MIMIC_STATE, { type: 'START' }, { type: 'BOT_DEMO_DONE' });
    expect(s.phase).toBe('intro');
  });

  it('DISMISS_INTRO from idle is a no-op', () => {
    const s = after(INITIAL_MIMIC_STATE, { type: 'DISMISS_INTRO' });
    expect(s.phase).toBe('idle');
  });
});

describe('MimicEngine — empty lessons edge case', () => {
  it('START with empty lessons array → all-done immediately', () => {
    const s = mimicReducer(INITIAL_MIMIC_STATE, { type: 'START' }, []);
    expect(s.phase).toBe('all-done');
  });
});
