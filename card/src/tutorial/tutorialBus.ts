// ============================================================
// tutorialBus.ts — Module-level pub/sub bridging the tutorial
// engine and the live game UI without prop-drilling.
//
// Outside tutorial mode, nothing subscribes, so emit is a no-op.
// ============================================================

export type FanDemoEasing = 'sweep' | 'settle';

export type FanDemoCmd =
  | { kind: 'scrollToIdx'; idx: number; durationMs?: number; easing?: FanDemoEasing }
  | { kind: 'pulseCardIdx'; idx: number; durationMs?: number }
  | { kind: 'pulseDiceBtn'; durationMs?: number }
  /** Tutorial-driven equation building. `eqPickDice` simulates a tap on
   *  die index N inside the EquationBuilder; `eqSetOp` sets op1/op2 to a
   *  specific operator (no cycling). Both no-op outside tutorial mode. */
  | { kind: 'eqPickDice'; idx: number }
  | { kind: 'eqSetOp'; which: 1 | 2; op: '+' | '-' | 'x' | '÷' }
  /** Tutorial-driven equation confirm (CONFIRM_EQUATION) and card staging
   *  (STAGE_CARD by hand-card value). The lesson host listens for both. */
  | { kind: 'eqConfirm' }
  | { kind: 'stageCardByValue'; value: number }
  /** Reset the EquationBuilder slots/ops without leaving 'building' phase.
   *  Used to re-arm a step when the lesson wants the learner to redo it. */
  | { kind: 'eqReset' }
  | { kind: 'clearCardFrame' };

export type UserEvent =
  | { kind: 'fanScrolled'; toIdx: number }
  | { kind: 'cardTapped'; cardId: string }
  | { kind: 'diceRolled' }
  /** Fired when the learner manually taps a die in the EquationBuilder
   *  (NOT via tutorialBus). Lessons can match on a specific die index. */
  | { kind: 'eqUserPickedDice'; idx: number }
  /** Lesson 5: learner chose an operation for the scratch equation slot
   *  (by tapping the slot to cycle, or by picking one in the joker modal). */
  | { kind: 'opSelected'; op: '+' | '-' | 'x' | '÷'; via: 'cycle' | 'joker' }
  /** Lesson 4 step 3 (guided full build) signals. `eqReadyToConfirm` fires
   *  continuously while the equation is valid but not yet confirmed — the
   *  tutorial uses it to switch into "press the confirm button" sub-phase.
   *  `eqConfirmedByUser` / `userPlayedCards` fire when the learner actually
   *  taps the two key buttons. */
  | { kind: 'eqReadyToConfirm' }
  | { kind: 'eqConfirmedByUser' }
  | { kind: 'userPlayedCards' }
  /** Lesson 5 (operation signs) progress signals. `l5AllSignsCycled` fires
   *  once the learner has cycled the `?` slot through all four operation
   *  symbols (+, -, ×, ÷). `l5JokerPlaced` fires after the learner picked a
   *  sign from the joker modal and then tapped the slot to place it. */
  | { kind: 'l5AllSignsCycled' }
  | { kind: 'l5JokerModalOpened' }
  | { kind: 'l5JokerPickedInModal'; op: '+' | '-' | 'x' | '÷' }
  | { kind: 'l5JokerPlaced'; op: '+' | '-' | 'x' | '÷' }
  | { kind: 'l5JokerFlowCompleted'; op: '+' | '-' | 'x' | '÷' }
  /** Lesson 5c (solve-for-op) signals. `l5OpSolveCorrect` fires each time
   *  the learner correctly confirms one of the two exercises; the final
   *  `l5OpExercisesDone` fires after both are done and drives the step
   *  outcome. `l5OpSolveWrong` fires on wrong-sign confirm for UI feedback. */
  | { kind: 'l5OpSolveCorrect'; exerciseIdx: 0 | 1 }
  | { kind: 'l5OpSolveWrong' }
  | { kind: 'l5OpExercisesDone' }
  /** Optional fractions tutorial: learner tapped Continue / Ack. */
  | { kind: 'fracLessonAck' }
  /** Fraction attack successfully played (tutorial validates before dispatch). */
  | { kind: 'fracAttackPlayed'; fraction: '1/2' | '1/3' | '1/4' | '1/5' }
  /** Fraction defense with a number (or wild) card that divides the penalty. */
  | { kind: 'fracDefenseSolved'; penaltyDenom: number };

/** Named on-screen targets the tutorial can draw an arrow at. The real game
 *  UI reports the rect of each button via `setLayout`; the tutorial reads it
 *  via `getLayout` when rendering its `HighlightOverlay`. */
export type LayoutKey = 'confirmEqBtn' | 'playCardsBtn';
export type LayoutRect = { top: number; left: number; width: number; height: number };

type Listener<T> = (event: T) => void;
type VoidListener = () => void;

const fanDemoListeners = new Set<Listener<FanDemoCmd>>();
const userEventListeners = new Set<Listener<UserEvent>>();
const exitListeners = new Set<VoidListener>();
const layoutListeners = new Set<(key: LayoutKey, rect: LayoutRect | null) => void>();

let currentFanLength = 0;

let emphasizedCardId: string | null = null;
const emphasizedListeners = new Set<(id: string | null) => void>();

let opButtonPulse = 0;
const opButtonPulseListeners = new Set<(v: number) => void>();

/** Lesson 4 dynamic dice config, set by InteractiveTutorialScreen before
 *  the bot demo runs, read by lesson-04-equation via DemoApi. */
let l4Config: { pickA: number; pickB: number; target: number; hand?: number[]; validSums?: number[] } | null = null;

/** Lesson 5 (op-cycle) random equation config — two random numbers the
 *  scratch screen renders on either side of the cycling operation slot. */
let l5Config: { a: number; b: number } | null = null;

/** Lesson 4 step 3 "guided full build" mode. While true: the EquationBuilder
 *  skips auto-confirm + shows its real "אשר את התרגיל" button, so the learner
 *  taps it themselves; both that button and "בחרתי" report their layout so
 *  the tutorial can draw an arrow at them. */
let l4Step3Mode = false;
let l5GuidedMode = false;
/** While true + L5 guided: hide the hand strip (step 5a — signs only; step 5b shows hand for joker). */
let l5HideFan = false;

/** While true, fan card taps during L5a are swallowed before reaching SELECT_EQ_OP. */
let l5aBlockFanTaps = false;

/** While true, fraction PLAY/DEFEND taps emit tutorial user events for outcomes. */
let fracGuidedMode = false;

/** Subscribers notified when L5 UI flags change (hide fan / guided mode) so GameScreen can re-render. */
const l5UiListeners = new Set<VoidListener>();
function notifyL5Ui(): void {
  l5UiListeners.forEach((l) => l());
}

/** The actual equation result the learner last confirmed — set by the
 *  EquationBuilder's auto-confirm or by the real confirm button. Outcomes
 *  check this to validate the card the learner picks. */
let lastEquationResult: number | null = null;

const layouts: Partial<Record<LayoutKey, LayoutRect | null>> = {};

export const tutorialBus = {
  emitFanDemo(cmd: FanDemoCmd): void {
    fanDemoListeners.forEach((l) => l(cmd));
  },
  subscribeFanDemo(fn: Listener<FanDemoCmd>): () => void {
    fanDemoListeners.add(fn);
    return () => {
      fanDemoListeners.delete(fn);
    };
  },

  emitUserEvent(event: UserEvent): void {
    userEventListeners.forEach((l) => l(event));
  },
  subscribeUserEvent(fn: Listener<UserEvent>): () => void {
    userEventListeners.add(fn);
    return () => {
      userEventListeners.delete(fn);
    };
  },

  /** Anywhere in the running game can request the tutorial to exit
   *  (e.g. the game's own "Exit" header button when state.isTutorial). */
  emitRequestExit(): void {
    exitListeners.forEach((l) => l());
  },
  subscribeRequestExit(fn: VoidListener): () => void {
    exitListeners.add(fn);
    return () => {
      exitListeners.delete(fn);
    };
  },

  /** Fan component reports its current card count so lessons can author
   *  length-agnostic demos (e.g. "scroll to last card" without hardcoding 4). */
  setFanLength(n: number): void {
    currentFanLength = Math.max(0, n | 0);
  },
  getFanLength(): number {
    return currentFanLength;
  },

  setL4Config(cfg: { pickA: number; pickB: number; target: number; hand?: number[]; validSums?: number[] }): void {
    l4Config = cfg;
  },
  getL4Config(): { pickA: number; pickB: number; target: number; hand?: number[]; validSums?: number[] } | null {
    return l4Config;
  },

  setEmphasizedCardId(id: string | null): void {
    emphasizedCardId = id;
    emphasizedListeners.forEach((l) => l(id));
  },
  getEmphasizedCardId(): string | null {
    return emphasizedCardId;
  },
  subscribeEmphasizedCard(fn: (id: string | null) => void): () => void {
    emphasizedListeners.add(fn);
    return () => { emphasizedListeners.delete(fn); };
  },

  setOpButtonPulse(v: number): void {
    opButtonPulse = v;
    opButtonPulseListeners.forEach((l) => l(v));
  },
  getOpButtonPulse(): number {
    return opButtonPulse;
  },
  subscribeOpButtonPulse(fn: (v: number) => void): () => void {
    opButtonPulseListeners.add(fn);
    return () => { opButtonPulseListeners.delete(fn); };
  },

  setL5Config(cfg: { a: number; b: number }): void {
    l5Config = cfg;
  },
  getL5Config(): { a: number; b: number } | null {
    return l5Config;
  },

  setLastEquationResult(r: number | null): void {
    lastEquationResult = r;
  },
  getLastEquationResult(): number | null {
    return lastEquationResult;
  },

  setL4Step3Mode(on: boolean): void {
    l4Step3Mode = on;
    if (!on) {
      layouts.confirmEqBtn = null;
      layouts.playCardsBtn = null;
    }
  },
  getL4Step3Mode(): boolean {
    return l4Step3Mode;
  },

  setL5GuidedMode(on: boolean): void {
    l5GuidedMode = on;
    notifyL5Ui();
  },
  getL5GuidedMode(): boolean {
    return l5GuidedMode;
  },

  setL5HideFan(on: boolean): void {
    l5HideFan = on;
    notifyL5Ui();
  },
  getL5HideFan(): boolean {
    return l5HideFan;
  },

  setL5aBlockFanTaps(on: boolean): void {
    l5aBlockFanTaps = on;
  },
  getL5aBlockFanTaps(): boolean {
    return l5aBlockFanTaps;
  },

  setFracGuidedMode(on: boolean): void {
    fracGuidedMode = on;
  },
  getFracGuidedMode(): boolean {
    return fracGuidedMode;
  },

  subscribeL5Ui(fn: VoidListener): () => void {
    l5UiListeners.add(fn);
    return () => {
      l5UiListeners.delete(fn);
    };
  },

  setLayout(key: LayoutKey, rect: LayoutRect | null): void {
    layouts[key] = rect;
    layoutListeners.forEach((fn) => fn(key, rect));
  },
  getLayout(key: LayoutKey): LayoutRect | null {
    return layouts[key] ?? null;
  },
  subscribeLayout(fn: (key: LayoutKey, rect: LayoutRect | null) => void): () => void {
    layoutListeners.add(fn);
    return () => {
      layoutListeners.delete(fn);
    };
  },

  // For tests
  _reset(): void {
    fanDemoListeners.clear();
    userEventListeners.clear();
    exitListeners.clear();
    layoutListeners.clear();
    emphasizedListeners.clear();
    emphasizedCardId = null;
    currentFanLength = 0;
    l4Config = null;
    l5Config = null;
    l4Step3Mode = false;
    l5GuidedMode = false;
    l5HideFan = false;
    l5aBlockFanTaps = false;
    fracGuidedMode = false;
    l5UiListeners.clear();
    lastEquationResult = null;
    layouts.confirmEqBtn = null;
    layouts.playCardsBtn = null;
    opButtonPulse = 0;
    opButtonPulseListeners.clear();
  },
};
