// ============================================================
// tutorialReducer.ts — State machine for interactive tutorial
// Tracks current lesson, step, speech bubbles, and action gating
// ============================================================

import { getLesson, TOTAL_LESSONS } from './tutorialLessons';
import type { TutorialStep } from './tutorialLessons';

export interface TutorialState {
  active: boolean;
  lessonIndex: number;
  /** 'bot' steps index or 'user' steps index */
  turn: 'bot' | 'user';
  stepIndex: number;
  /** Speech bubble for bot explanations */
  speechBubble: { textKey: string; params?: Record<string, string | number> } | null;
  /** Hint text key for user guidance */
  hintTextKey: string | null;
  /** Which GameAction types the user may dispatch right now */
  allowedActions: string[];
  /** Is this the free-play round? */
  freePlay: boolean;
  /** Show "wrong action" feedback */
  wrongActionFeedback: boolean;
  /** Tutorial completed */
  completed: boolean;
  /** Lesson intro overlay visible */
  showLessonIntro: boolean;
  /** New math onboarding overlay visibility */
  showMathOnboarding: boolean;
}

export type TutorialAction =
  | { type: 'START_TUTORIAL' }
  | { type: 'DISMISS_LESSON_INTRO' }
  | { type: 'DISMISS_MATH_ONBOARDING' }
  | { type: 'BOT_STEP_DONE' }
  | { type: 'USER_STEP_COMPLETED' }
  | { type: 'WRONG_ACTION' }
  | { type: 'DISMISS_WRONG_ACTION' }
  | { type: 'ADVANCE_TO_USER_TURN' }
  | { type: 'NEXT_LESSON' }
  | { type: 'EXIT_TUTORIAL' }
  | { type: 'SET_SPEECH'; textKey: string; params?: Record<string, string | number> }
  | { type: 'CLEAR_SPEECH' };

export const INITIAL_TUTORIAL_STATE: TutorialState = {
  active: false,
  lessonIndex: 0,
  turn: 'bot',
  stepIndex: 0,
  speechBubble: null,
  hintTextKey: null,
  allowedActions: [],
  freePlay: false,
  wrongActionFeedback: false,
  completed: false,
  showLessonIntro: true,
  showMathOnboarding: true,
};

function getCurrentStep(state: TutorialState): TutorialStep | null {
  const lesson = getLesson(state.lessonIndex);
  const steps = state.turn === 'bot' ? lesson.botSteps : lesson.userSteps;
  return steps[state.stepIndex] ?? null;
}

function applyStepState(state: TutorialState): TutorialState {
  const step = getCurrentStep(state);
  if (!step) return state;

  if (step.actor === 'bot') {
    return {
      ...state,
      speechBubble: { textKey: step.textKey },
      hintTextKey: null,
      allowedActions: [],
    };
  }
  return {
    ...state,
    speechBubble: null,
    hintTextKey: step.textKey,
    allowedActions: step.allowedActions,
  };
}

export function tutorialReducer(state: TutorialState, action: TutorialAction): TutorialState {
  switch (action.type) {
    case 'START_TUTORIAL': {
      const lesson = getLesson(0);
      return applyStepState({
        ...INITIAL_TUTORIAL_STATE,
        active: true,
        freePlay: lesson.freePlay,
        showLessonIntro: true,
      });
    }

    case 'DISMISS_LESSON_INTRO':
      return applyStepState({ ...state, showLessonIntro: false });

    case 'DISMISS_MATH_ONBOARDING':
      return { ...state, showMathOnboarding: false };

    case 'BOT_STEP_DONE': {
      const lesson = getLesson(state.lessonIndex);
      const nextIdx = state.stepIndex + 1;
      if (nextIdx < lesson.botSteps.length) {
        return applyStepState({ ...state, stepIndex: nextIdx });
      }
      // Bot turn done → switch to user turn
      return applyStepState({
        ...state,
        turn: 'user',
        stepIndex: 0,
        speechBubble: null,
      });
    }

    case 'ADVANCE_TO_USER_TURN':
      return applyStepState({
        ...state,
        turn: 'user',
        stepIndex: 0,
        speechBubble: null,
      });

    case 'USER_STEP_COMPLETED': {
      const lesson = getLesson(state.lessonIndex);
      const nextIdx = state.stepIndex + 1;
      if (nextIdx < lesson.userSteps.length) {
        return applyStepState({
          ...state,
          stepIndex: nextIdx,
          wrongActionFeedback: false,
        });
      }
      // User turn done → lesson complete
      return {
        ...state,
        hintTextKey: null,
        allowedActions: [],
        speechBubble: { textKey: 'tutorial.lessonComplete' },
        wrongActionFeedback: false,
      };
    }

    case 'WRONG_ACTION':
      return { ...state, wrongActionFeedback: true };

    case 'DISMISS_WRONG_ACTION':
      return { ...state, wrongActionFeedback: false };

    case 'NEXT_LESSON': {
      const nextLesson = state.lessonIndex + 1;
      if (nextLesson >= TOTAL_LESSONS) {
        return { ...state, active: false, completed: true };
      }
      const lesson = getLesson(nextLesson);
      return applyStepState({
        ...state,
        lessonIndex: nextLesson,
        turn: 'bot',
        stepIndex: 0,
        freePlay: lesson.freePlay,
        showLessonIntro: true,
        wrongActionFeedback: false,
        speechBubble: null,
        hintTextKey: null,
      });
    }

    case 'EXIT_TUTORIAL':
      return { ...INITIAL_TUTORIAL_STATE, completed: state.completed };

    case 'SET_SPEECH':
      return { ...state, speechBubble: { textKey: action.textKey, params: action.params } };

    case 'CLEAR_SPEECH':
      return { ...state, speechBubble: null };

    default:
      return state;
  }
}
