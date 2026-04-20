// ============================================================
// lessons/types.ts — Shared types for the lesson system.
// ============================================================

import type { DemoApi } from '../BotDemonstrator';
import type { UserEvent } from '../tutorialBus';

export type OutcomePredicate = (event: UserEvent) => boolean;

export type HighlightSpec = {
  target: 'fan' | 'dice' | 'eq-area' | 'card-N';
  shape?: 'ring' | 'arrow';
};

export type LessonStep = {
  id: string;
  /** Bot's micro-demo for this step (real UI animations) */
  botDemo: (api: DemoApi) => Promise<void>;
  /** Did the user mimic an equivalent action? */
  outcome: OutcomePredicate;
  /** Where to draw the highlight ring during await-mimic */
  highlight?: HighlightSpec;
  /** Short i18n key for the hint text shown above the highlight (player turn) */
  hintKey?: string;
  /** Short i18n key for the speech bubble while the BOT is demonstrating
   *  this step. Falls back to the generic "watch the bot" copy. */
  botHintKey?: string;
  /** Short i18n key for the speech bubble shown during `celebrate` after
   *  the user completes this step. Falls back to `tutorial.engine.celebrate`. */
  celebrateKey?: string;
};

export type Lesson = {
  id: string;
  /** i18n key for lesson title shown in the intro overlay */
  titleKey: string;
  /** i18n key for short description on intro */
  descKey?: string;
  steps: LessonStep[];
};
