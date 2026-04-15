// ============================================================
// TutorialContext.tsx — Provider for interactive tutorial state
// Observes game state changes to advance tutorial steps.
// Does NOT gate dispatch — the user interacts with the real game.
// ============================================================

import React, { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import {
  tutorialReducer,
  INITIAL_TUTORIAL_STATE,
} from './tutorialReducer';
import type { TutorialState, TutorialAction } from './tutorialReducer';

interface TutorialContextValue {
  state: TutorialState;
  dispatch: (action: TutorialAction) => void;
}

const TutorialCtx = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialCtx);
  if (!ctx) throw new Error('useTutorial must be inside TutorialProvider');
  return ctx;
}

export function useTutorialOptional(): TutorialContextValue | null {
  return useContext(TutorialCtx);
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tutorialReducer, INITIAL_TUTORIAL_STATE);

  return (
    <TutorialCtx.Provider value={{ state, dispatch }}>
      {children}
    </TutorialCtx.Provider>
  );
}
