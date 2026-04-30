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
  | { kind: 'clearCardFrame' }
  /** Lesson 6 (possible-results): toggle the golden "תוצאות אפשריות" chip
   *  open, and tap a specific mini-card in the strip by its index. Both
   *  are wired in index.tsx via useEffect listeners that dispatch the
   *  matching click handler — mirrors the real user tap so the game's
   *  own state updates naturally. */
  | { kind: 'openResultsChip' }
  /** Force-close the "possible results" chip so the mini-strip slides
   *  shut. Used by the tutorial to reset chip state when the learner
   *  skip/back-navigates into L6 step 0 (chip should start closed and
   *  pulsing). */
  | { kind: 'closeResultsChip' }
  /** Clear the selected equation for display — hides the red
   *  SolveExerciseChip. Used when transitioning out of L6 so the red
   *  chip doesn't linger into the fractions lesson. */
  | { kind: 'clearSolveExerciseChip' }
  | { kind: 'tapMiniResult'; idx: number }
  /** Lesson 7 (parens-move): pre-open the red SolveExerciseChip with a
   *  specific equation string so the rigging can show the target before
   *  the learner builds anything. */
  | { kind: 'setSolveChip'; equation: string; result: number }
  /** Bot demo (or rigging) sets the parens toggle position directly. */
  | { kind: 'setParensRight'; value: boolean }
  /** Lesson 9 (identical card): tell GameScreen to stop the boosted pulse on
   *  the ResultsChip — chip is already open so pulsing it is misleading. */
  | { kind: 'disarmResultsChipPulse' };

export type UserEvent =
  | { kind: 'fanScrolled'; toIdx: number }
  | { kind: 'cardTapped'; cardId: string }
  | { kind: 'diceRolled' }
  | { kind: 'l3TipAck' }
  | { kind: 'l3SolvedAck' }
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
  | { kind: 'userPlayedCards'; count?: number; hasZero?: boolean; hasWild?: boolean }
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
  /** Lesson 5 "pick & place operator card" (the new step 5.2, inserted
   *  between cycle-signs and joker-place). The learner picks an operator
   *  card from their fan (like the real game) and drops it in the op1
   *  slot; `l5OpPickPlaceDone` fires after both exercises (first minus,
   *  then plus) are completed and drives the step outcome. Correct/wrong
   *  are intermediate signals the host uses for sfx + resetting the op. */
  | { kind: 'l5OpPickPlaceCorrect'; exerciseIdx: 0 | 1 }
  | { kind: 'l5OpPickPlaceWrong' }
  | { kind: 'l5OpPickPlaceDone' }
  /** Fired every time the learner successfully places a non-joker
   *  operator card (PLACE_EQ_OP) from their hand onto an op slot.
   *  The host uses it during L5 pick-place to detect correct vs wrong
   *  picks (and can be used by future lessons). */
  | { kind: 'l5OperatorPlaced'; op: '+' | '-' | 'x' | '÷'; position: 0 | 1 }
  /** Optional fractions tutorial: learner tapped Continue / Ack. */
  | { kind: 'fracLessonAck' }
  /** Fraction attack successfully played (tutorial validates before dispatch). */
  | { kind: 'fracAttackPlayed'; fraction: '1/2' | '1/3' | '1/4' | '1/5' }
  /** Fraction defense with a number (or wild) card that divides the penalty. */
  | { kind: 'fracDefenseSolved'; penaltyDenom: number }
  /** Fraction defense with a fraction card (passes the attack on). */
  | { kind: 'fracDefenseWithFraction' }
  /** Lesson 6 (possible-results) — user interactions on the feature:
   *  - `resultsChipTapped` fires when the learner taps the golden chip.
   *  - `miniCardTapped` fires when the learner taps any mini result card;
   *    `result` is the numeric value and `equation` is the full display
   *    string (e.g. "2 + 3 = 5").
   *  - `l6CopyConfirmed` fires from InteractiveTutorialScreen itself once
   *    the learner has confirmed an equation whose result matches the
   *    selected mini-card's target.
   *  - `l6CopyMismatch` fires when the learner confirms an equation with
   *    a DIFFERENT result than the current selection — used to surface a
   *    brief "try again" nudge without failing the step. */
  | { kind: 'resultsChipTapped' }
  | { kind: 'miniCardTapped'; result: number; equation: string }
  | { kind: 'l6CopyConfirmed' }
  | { kind: 'l6CopyMismatch'; expected: number; got: number }
  /** Lesson 7 (parens-move): fires when the learner taps the parens toggle. */
  | { kind: 'parensToggled'; parensRight: boolean }
  /** Fires when the learner confirms an equation with the correct parens
   *  position and result in the parens lesson. */
  | { kind: 'l7ParensCopyConfirmed' }
  /** Fires when the learner confirms an equation whose result or parens
   *  position doesn't match the target — used for the error bubble. */
  | { kind: 'l7ParensCopyMismatch'; expected: number; got: number }
  /** Lesson 8 (identical card): fires when the learner taps a matching card
   *  in pre-roll, triggering PLAY_IDENTICAL. */
  | { kind: 'identicalPlayed' }
  /** Lesson 9 (identical-single intro): fires when the learner taps "בוא ננסה"
   *  on the קלף זהה intro overlay, advancing to the actual play step. */
  | { kind: 'identicalSingleAck' }
  /** Lesson 10 (multi-play intro): fires when the learner taps "בוא ננסה"
   *  on the הידעת? overlay, advancing to the actual play step. */
  | { kind: 'identicalMultiAck' }
  /** Lesson 4 (full-build intro): fires when the learner taps "בוא ננסה"
   *  on the הידעת? overlay before the full-build step. */
  | { kind: 'l4DidYouKnowAck' };

/** Named on-screen targets the tutorial can draw an arrow at. The real game
 *  UI reports the rect of each button via `setLayout`; the tutorial reads it
 *  via `getLayout` when rendering its `HighlightOverlay`. */
export type LayoutKey = 'confirmEqBtn' | 'playCardsBtn' | 'resultsChip' | 'miniStrip';
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
/** When true (L5.1 only): equation starts empty and the learner places
 *  dice manually from the top, like at the start of a real exercise. */
let l5aDiceUnlocked = false;

/** Lesson 5.1 target-result: the expected equation result the learner is
 *  aiming for (e.g. `7` for `4 + 3 = 7`). When non-null, the EquationBuilder
 *  result box shows this target instead of the live-computed finalResult so
 *  the learner sees what they need to produce BEFORE picking an op. */
let l5aTargetResult: number | null = null;

/** While true (L5 "pick & place operator"), tapping an empty op slot in
 *  the equation is a no-op instead of cycling — the learner must pick an
 *  operator card from the fan and drop it on the slot, exactly like the
 *  real game. */
let l5BlockOpCycle = false;

/** While true, the player hand renders in the EXACT order that the
 *  tutorial rigged it — `sortHandCards` becomes a no-op. Used in L5.2
 *  (joker-place) so Slinda stays in the visual centre of the fan
 *  (rigged as index 2 of 5) instead of being pushed to the end by the
 *  default "operations before jokers" sort rule. */
let tutorialPreserveHandOrder = false;

/** While true, fraction PLAY/DEFEND taps emit tutorial user events for outcomes. */
let fracGuidedMode = false;

/** Lesson 6 step 6.2 (tap-mini): while true, mini-card taps are blocked until
 *  the hint bubble has appeared (~1.5s after await-mimic starts). */
let l6MiniLocked = false;

/** Lesson 6 (possible-results) guided mode. While true:
 *  - `ResultsStripBelowTable` + `SolveExerciseChip` render during tutorial
 *    (bypassing the normal `!state.isTutorial` gate).
 *  - `toggleResultsBadges` / `handleMiniResultSelect` in index.tsx emit the
 *    matching `resultsChipTapped` / `miniCardTapped` user events.
 *  - Mid-game onboarding nudges for the feature (bubbles, pulsing arrows,
 *    "first free uses" counter, wild-results guidance) are suppressed so
 *    they don't collide with the lesson.
 *  - The red SolveExerciseChip stays open on tap (acts as a live hint).
 *  - `ResultsSlot` + mini-strip report their layout rects so the tutorial
 *    can point an arrow at the current target. */
let l6GuidedMode = false;
/** Lesson 6 step 6.3 ("copy the exercise") — exposes the real confirm
 *  button in the EquationBuilder so the learner presses it themselves.
 *  Reuses the same layout channel as L4 step 3 (`confirmEqBtn`). */
let l6Step3Mode = false;

/** Lesson 6 "copy exercise" config. Published by InteractiveTutorialScreen
 *  once the learner taps a mini-card; the bot demo reads it via DemoApi to
 *  pick the right dice + operator.
 *    - `pickA` / `pickB`: dice indices (0..2) for op1 side.
 *    - `op`: operator to place in op1.
 *    - `target`: expected result — the copy step's outcome only fires when
 *      the learner's confirmed equation lands on this number. */
let l6CopyConfig: { pickA: number; pickB: number; op: '+' | '-' | 'x' | '÷'; target: number; equation?: string } | null = null;

/** Lesson 7 (parens-move) guided mode. While true, the EquationBuilder
 *  suppresses auto-confirm when parensRight=false, the parens toggle
 *  button pulses, and the InteractiveTutorialScreen validates the outcome. */
let l7GuidedMode = false;

/** Current parensRight value — kept in sync from index.tsx so that
 *  InteractiveTutorialScreen can read it when game enters 'solved'. */
let parensRightValue = false;

/** True while the parens lesson intro stage 0 is active — pulses the
 *  orange parens-toggle button so the learner's eye lands on it. */
let parensButtonPulse = false;

/** True in stage 0 only — pulses the red SolveExerciseChip alongside the
 *  orange parens button so both targets are highlighted simultaneously. */
let l7SolveChipLoopPulse = false;

/** Both parens-position results for the current L7 equation state.
 *  Published by EquationBuilder whenever d1/d2/d3/op1/op2 are all filled.
 *  null when equation is incomplete or not in L7 mode. */
let l7ParensResults: { left: number | null; right: number | null } | null = null;

/** True while the tutorial engine is in the 'bot-demo' phase. Used by
 *  index.tsx to block user card interactions that would corrupt the
 *  game state mid-demonstration (e.g. staging number cards). */
let botDemoActive = false;

/** When true: show the "אשר את התרגיל" button and suppress auto-confirm,
 *  so the learner must explicitly press it. Used in L7 (parens) and L9 (copy). */
let manualEqConfirm = false;

/** When true: enables equation builder (dice visible + clickable) in L9 stage 1. */
let l9ParensFilter = false;

/** When true: L7 step 1 — show parens-right mini cards from validTargets directly,
 *  bypassing the l7ParensResults filter (which requires operators in equation). */
let l7Step1Mode = false;
let l6WildStepMode = false;

/** Lesson 11 (multi-play) addends — published by InteractiveTutorialScreen
 *  before the bot demo so the bot stages the correct cards. */
let l11Config: { addA: number; addB: number; target: number; includeZero: boolean; includeWild: boolean } | null = null;

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
    // Lesson 5a flips several renderer-level decisions (force full 3-dice
    // equation layout, force all 4 operator cycle choices). Notify the UI so
    // EquationBuilder re-renders immediately instead of waiting for an
    // unrelated game-state change to kick it.
    notifyL5Ui();
  },
  getL5aBlockFanTaps(): boolean {
    return l5aBlockFanTaps;
  },

  setL5aDiceUnlocked(on: boolean): void {
    l5aDiceUnlocked = on;
    notifyL5Ui();
  },
  getL5aDiceUnlocked(): boolean {
    return l5aDiceUnlocked;
  },

  setL5BlockOpCycle(on: boolean): void {
    l5BlockOpCycle = on;
    notifyL5Ui();
  },
  getL5BlockOpCycle(): boolean {
    return l5BlockOpCycle;
  },

  setTutorialPreserveHandOrder(on: boolean): void {
    tutorialPreserveHandOrder = on;
    notifyL5Ui();
  },
  getTutorialPreserveHandOrder(): boolean {
    return tutorialPreserveHandOrder;
  },

  setL5aTargetResult(v: number | null): void {
    l5aTargetResult = v;
    notifyL5Ui();
  },
  getL5aTargetResult(): number | null {
    return l5aTargetResult;
  },

  setFracGuidedMode(on: boolean): void {
    fracGuidedMode = on;
    notifyL5Ui();
  },
  getFracGuidedMode(): boolean {
    return fracGuidedMode;
  },

  setL6MiniLocked(on: boolean): void {
    l6MiniLocked = on;
  },
  getL6MiniLocked(): boolean {
    return l6MiniLocked;
  },

  setL6GuidedMode(on: boolean): void {
    l6GuidedMode = on;
    notifyL5Ui();
    if (!on) {
      layouts.resultsChip = null;
      layouts.miniStrip = null;
    }
  },
  getL6GuidedMode(): boolean {
    return l6GuidedMode;
  },

  setL6Step3Mode(on: boolean): void {
    l6Step3Mode = on;
    notifyL5Ui();
    if (!on) {
      layouts.confirmEqBtn = null;
    }
  },
  getL6Step3Mode(): boolean {
    return l6Step3Mode;
  },

  setL6CopyConfig(cfg: { pickA: number; pickB: number; op: '+' | '-' | 'x' | '÷'; target: number; equation?: string } | null): void {
    l6CopyConfig = cfg;
  },
  getL6CopyConfig(): { pickA: number; pickB: number; op: '+' | '-' | 'x' | '÷'; target: number; equation?: string } | null {
    return l6CopyConfig;
  },

  setL7GuidedMode(on: boolean): void {
    l7GuidedMode = on;
    notifyL5Ui();
  },
  getL7GuidedMode(): boolean {
    return l7GuidedMode;
  },

  setParensRightValue(v: boolean): void {
    parensRightValue = v;
    notifyL5Ui();
  },
  getParensRightValue(): boolean {
    return parensRightValue;
  },

  setParensButtonPulse(on: boolean): void {
    parensButtonPulse = on;
    notifyL5Ui();
  },
  getParensButtonPulse(): boolean {
    return parensButtonPulse;
  },

  setL7SolveChipLoopPulse(on: boolean): void {
    l7SolveChipLoopPulse = on;
    notifyL5Ui();
  },
  getL7SolveChipLoopPulse(): boolean {
    return l7SolveChipLoopPulse;
  },

  setL7ParensResults(results: { left: number | null; right: number | null } | null): void {
    l7ParensResults = results;
    notifyL5Ui();
  },
  getL7ParensResults(): { left: number | null; right: number | null } | null {
    return l7ParensResults;
  },

  setBotDemoActive(on: boolean): void {
    botDemoActive = on;
  },
  getBotDemoActive(): boolean {
    return botDemoActive;
  },

  setManualEqConfirm(on: boolean): void {
    manualEqConfirm = on;
  },
  getManualEqConfirm(): boolean {
    return manualEqConfirm;
  },

  setL9ParensFilter(on: boolean): void {
    l9ParensFilter = on;
    notifyL5Ui();
  },
  getL9ParensFilter(): boolean {
    return l9ParensFilter;
  },

  setL7Step1Mode(on: boolean): void {
    l7Step1Mode = on;
    notifyL5Ui();
  },
  getL7Step1Mode(): boolean {
    return l7Step1Mode;
  },

  setL6WildStepMode(on: boolean): void {
    l6WildStepMode = on;
    notifyL5Ui();
  },
  getL6WildStepMode(): boolean {
    return l6WildStepMode;
  },

  setL11Config(cfg: { addA: number; addB: number; target: number; includeZero: boolean; includeWild: boolean } | null): void {
    l11Config = cfg;
  },
  getL11Config(): { addA: number; addB: number; target: number; includeZero: boolean; includeWild: boolean } | null {
    return l11Config;
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
    l5aDiceUnlocked = false;
    l5aTargetResult = null;
    l5BlockOpCycle = false;
    tutorialPreserveHandOrder = false;
    fracGuidedMode = false;
    l6MiniLocked = false;
    l6GuidedMode = false;
    l6Step3Mode = false;
    l6CopyConfig = null;
    l7GuidedMode = false;
    parensButtonPulse = false;
    l7SolveChipLoopPulse = false;
    parensRightValue = false;
    botDemoActive = false;
    manualEqConfirm = false;
    l9ParensFilter = false;
    l7Step1Mode = false;
    l6WildStepMode = false;
    l11Config = null;
    l5UiListeners.clear();
    lastEquationResult = null;
    layouts.confirmEqBtn = null;
    layouts.playCardsBtn = null;
    layouts.resultsChip = null;
    layouts.miniStrip = null;
    opButtonPulse = 0;
    opButtonPulseListeners.clear();
  },
};
