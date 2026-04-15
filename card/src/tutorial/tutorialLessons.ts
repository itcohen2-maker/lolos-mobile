// ============================================================
// tutorialLessons.ts — Lesson definitions for interactive tutorial
// Each lesson defines: enabled operators, special card types,
// step sequence, allowed actions per step, and i18n keys.
// ============================================================

import type { Fraction, Operation } from '../../shared/types';

export interface TutorialStep {
  /** Who is acting in this step */
  actor: 'bot' | 'user';
  /** Game phase this step operates in */
  gamePhase: 'turn-transition' | 'pre-roll' | 'building' | 'solved';
  /** Which GameAction types the user is allowed to dispatch (empty = bot step) */
  allowedActions: string[];
  /** i18n key for speech bubble (bot) or hint text (user) */
  textKey: string;
  /** Wait time in ms before bot acts (bot steps only) */
  botDelayMs?: number;
}

export interface LessonConfig {
  /** Lesson index (0-based) */
  index: number;
  /** i18n key for lesson title shown at start */
  titleKey: string;
  /** i18n key for lesson description */
  descKey: string;
  /** Operators enabled for this lesson's equation generation */
  enabledOperators: Operation[];
  /** Whether fraction cards are in the deck */
  showFractions: boolean;
  /** Max number range for card values */
  maxRange: 12 | 25;
  /** Special card types that MUST be in the user's hand */
  requiredSpecials: ('operation' | 'joker' | 'wild' | 'fraction' | 'identical')[];
  /** Whether this is free-play (no gating) */
  freePlay: boolean;
  /** Fraction kinds available (if showFractions) */
  fractionKinds?: Fraction[];
  /** Steps for the bot turn */
  botSteps: TutorialStep[];
  /** Steps for the user turn */
  userSteps: TutorialStep[];
}

// ── Step templates ──

const BOT_BEGIN: TutorialStep = {
  actor: 'bot',
  gamePhase: 'turn-transition',
  allowedActions: [],
  textKey: 'tutorial.bot.myTurn',
  botDelayMs: 1500,
};

const BOT_ROLL: TutorialStep = {
  actor: 'bot',
  gamePhase: 'pre-roll',
  allowedActions: [],
  textKey: 'tutorial.bot.rolling',
  botDelayMs: 1000,
};

const BOT_CONFIRM_EQ: TutorialStep = {
  actor: 'bot',
  gamePhase: 'building',
  allowedActions: [],
  textKey: 'tutorial.bot.confirmEq',
  botDelayMs: 2500,
};

const BOT_STAGE: TutorialStep = {
  actor: 'bot',
  gamePhase: 'solved',
  allowedActions: [],
  textKey: 'tutorial.bot.staging',
  botDelayMs: 1500,
};

const BOT_END: TutorialStep = {
  actor: 'bot',
  gamePhase: 'solved',
  allowedActions: [],
  textKey: 'tutorial.bot.endTurn',
  botDelayMs: 1000,
};

const USER_BEGIN: TutorialStep = {
  actor: 'user',
  gamePhase: 'turn-transition',
  allowedActions: ['BEGIN_TURN'],
  textKey: 'tutorial.hint.tapReady',
};

const USER_ROLL: TutorialStep = {
  actor: 'user',
  gamePhase: 'pre-roll',
  allowedActions: ['ROLL_DICE'],
  textKey: 'tutorial.hint.tapRoll',
};

const USER_CONFIRM_EQ: TutorialStep = {
  actor: 'user',
  gamePhase: 'building',
  allowedActions: ['CONFIRM_EQUATION'],
  textKey: 'tutorial.hint.confirmEq',
};

const USER_STAGE: TutorialStep = {
  actor: 'user',
  gamePhase: 'solved',
  allowedActions: ['STAGE_CARD'],
  textKey: 'tutorial.hint.tapCards',
};

const USER_CONFIRM_STAGED: TutorialStep = {
  actor: 'user',
  gamePhase: 'solved',
  allowedActions: ['CONFIRM_STAGED'],
  textKey: 'tutorial.hint.confirmStaged',
};

const USER_END: TutorialStep = {
  actor: 'user',
  gamePhase: 'solved',
  allowedActions: ['END_TURN'],
  textKey: 'tutorial.hint.endTurn',
};

// ── Lesson definitions ──

export const LESSONS: LessonConfig[] = [
  // Round 1: Basic numbers + addition
  {
    index: 0,
    titleKey: 'tutorial.lesson1.title',
    descKey: 'tutorial.lesson1.desc',
    enabledOperators: ['+'],
    showFractions: false,
    maxRange: 12,
    requiredSpecials: [],
    freePlay: false,
    botSteps: [BOT_BEGIN, BOT_ROLL, BOT_CONFIRM_EQ, BOT_STAGE, BOT_END],
    userSteps: [USER_BEGIN, USER_ROLL, USER_CONFIRM_EQ, USER_STAGE, USER_CONFIRM_STAGED, USER_END],
  },

  // Round 2: Operation cards
  {
    index: 1,
    titleKey: 'tutorial.lesson2.title',
    descKey: 'tutorial.lesson2.desc',
    enabledOperators: ['+', '-', 'x'],
    showFractions: false,
    maxRange: 12,
    requiredSpecials: ['operation'],
    freePlay: false,
    botSteps: [BOT_BEGIN, BOT_ROLL,
      { actor: 'bot', gamePhase: 'building', allowedActions: [], textKey: 'tutorial.bot.useOperation', botDelayMs: 2500 },
      BOT_STAGE, BOT_END],
    userSteps: [USER_BEGIN, USER_ROLL,
      { actor: 'user', gamePhase: 'building', allowedActions: ['SELECT_EQ_OP', 'PLACE_EQ_OP'], textKey: 'tutorial.hint.placeOperation' },
      USER_CONFIRM_EQ, USER_STAGE, USER_CONFIRM_STAGED, USER_END],
  },

  // Round 3: Joker card
  {
    index: 2,
    titleKey: 'tutorial.lesson3.title',
    descKey: 'tutorial.lesson3.desc',
    enabledOperators: ['+', '-', 'x'],
    showFractions: false,
    maxRange: 12,
    requiredSpecials: ['joker'],
    freePlay: false,
    botSteps: [BOT_BEGIN, BOT_ROLL,
      { actor: 'bot', gamePhase: 'building', allowedActions: [], textKey: 'tutorial.bot.useJoker', botDelayMs: 2500 },
      BOT_STAGE, BOT_END],
    userSteps: [USER_BEGIN, USER_ROLL,
      { actor: 'user', gamePhase: 'building', allowedActions: ['SELECT_EQ_JOKER', 'OPEN_JOKER_MODAL'], textKey: 'tutorial.hint.useJoker' },
      USER_CONFIRM_EQ, USER_STAGE, USER_CONFIRM_STAGED, USER_END],
  },

  // Round 4: Wild card
  {
    index: 3,
    titleKey: 'tutorial.lesson4.title',
    descKey: 'tutorial.lesson4.desc',
    enabledOperators: ['+', '-', 'x'],
    showFractions: false,
    maxRange: 12,
    requiredSpecials: ['wild'],
    freePlay: false,
    botSteps: [BOT_BEGIN, BOT_ROLL,
      { actor: 'bot', gamePhase: 'building', allowedActions: [], textKey: 'tutorial.bot.useWild', botDelayMs: 2500 },
      BOT_STAGE, BOT_END],
    userSteps: [USER_BEGIN, USER_ROLL, USER_CONFIRM_EQ,
      { actor: 'user', gamePhase: 'solved', allowedActions: ['STAGE_CARD'], textKey: 'tutorial.hint.useWild' },
      USER_CONFIRM_STAGED, USER_END],
  },

  // Round 5: Identical + Fraction attack/defense
  {
    index: 4,
    titleKey: 'tutorial.lesson5.title',
    descKey: 'tutorial.lesson5.desc',
    enabledOperators: ['+', '-', 'x', '÷'],
    showFractions: true,
    maxRange: 12,
    requiredSpecials: ['identical', 'fraction'],
    freePlay: false,
    fractionKinds: ['1/2', '1/3'],
    botSteps: [BOT_BEGIN, BOT_ROLL, BOT_CONFIRM_EQ, BOT_STAGE, BOT_END],
    userSteps: [
      USER_BEGIN,
      { actor: 'user', gamePhase: 'pre-roll', allowedActions: ['PLAY_IDENTICAL'], textKey: 'tutorial.hint.playIdentical' },
      USER_ROLL, USER_CONFIRM_EQ, USER_STAGE, USER_CONFIRM_STAGED, USER_END,
    ],
  },

  // Round 6: Free play
  {
    index: 5,
    titleKey: 'tutorial.lesson6.title',
    descKey: 'tutorial.lesson6.desc',
    enabledOperators: ['+', '-', 'x', '÷'],
    showFractions: true,
    maxRange: 12,
    requiredSpecials: [],
    freePlay: true,
    fractionKinds: ['1/2', '1/3'],
    botSteps: [BOT_BEGIN, BOT_ROLL, BOT_CONFIRM_EQ, BOT_STAGE, BOT_END],
    userSteps: [USER_BEGIN, USER_ROLL, USER_CONFIRM_EQ, USER_STAGE, USER_CONFIRM_STAGED, USER_END],
  },
];

export function getLesson(index: number): LessonConfig {
  return LESSONS[Math.min(index, LESSONS.length - 1)];
}

export const TOTAL_LESSONS = LESSONS.length;

/**
 * Dedicated onboarding ribbon targets for the interactive math onboarding overlay.
 * Kept in tutorial lessons module so onboarding and lessons share one source of truth.
 */
export const ONBOARDING_TARGET_TILE_IDS = ['target-9', 'target-4', 'target-8', 'target-11'] as const;
