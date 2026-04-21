// ============================================================
// InteractiveTutorialScreen.tsx — Watch-and-mimic tutorial host.
// Boots a vs-bot game underneath (using the existing tutorial
// hand rigging), then floats cheerful speech bubbles narrating
// the bot demo and the user's turn. No mockup overlays — the
// real game UI does all the heavy lifting; we just talk.
// ============================================================

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Animated, Easing, Platform, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Audio } from 'expo-av';
import { useLocale } from '../i18n/LocaleContext';
import { HappyBubble } from '../components/HappyBubble';
import { GoldDieFace } from '../../AnimatedDice';
import { GoldDiceButton } from '../../components/GoldDiceButton';
import { initializeSfx, isSfxMuted, setSfxMuted } from '../audio/sfx';
import { generateTutorialHand } from './generateTutorialHand';


const diceRollSound = require('../../assets/dice_roll.m4a');

async function playDiceRollSound() {
  if (isSfxMuted()) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentMode: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    } as Parameters<typeof Audio.setAudioModeAsync>[0]);
    const { sound } = await Audio.Sound.createAsync(diceRollSound);
    // Re-check mute AFTER the async load — the learner might have hit the
    // mute button while createAsync was in flight. Without this second
    // check the dice sound would leak through despite a muted app.
    if (isSfxMuted()) {
      sound.unloadAsync().catch(() => {});
      return;
    }
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((s) => {
      const status = s as { didJustFinish?: boolean };
      if (status.didJustFinish) sound.unloadAsync().catch(() => {});
    });
  } catch {
    // No dice sound available — fail silently.
  }
}
import {
  type MimicAction,
  type MimicState,
  INITIAL_MIMIC_STATE,
  mimicReducer,
  MIMIC_FIRST_FRACTION_LESSON_INDEX,
} from './MimicEngine';
import type { Card, Fraction } from '../../shared/types';
import { createBotDemonstrator } from './BotDemonstrator';
import { tutorialBus, type LayoutRect } from './tutorialBus';
import { LESSONS } from './lessons';

const LESSON_SHAPES = LESSONS.map((l) => ({ id: l.id, stepCount: l.steps.length }));

const CELEBRATE_MS = 900;
const LESSON_DONE_MS = 1400;

const FRAC_KINDS: Fraction[] = ['1/2', '1/3'];

/** Scripted board for each optional-fractions tutorial step (see lesson-06). */
function buildFractionTutorialSetup(stepIndex: number, ts: number) {
  const dice = { die1: 2, die2: 3, die3: 5 };
  const discard12: Card = { id: `tut-frac-disc12-${ts}`, type: 'number', value: 12 };
  const half: Card = { id: `tut-frac-half-${ts}`, type: 'fraction', fraction: '1/2' };
  const third: Card = { id: `tut-frac-third-${ts}`, type: 'fraction', fraction: '1/3' };
  const botMirror = (hand: Card[]) => hand.map((c, i) => ({ ...c, id: `bot-${c.id}-${i}` }));

  if (stepIndex <= 1) {
    const ph: Card[] = [half, third, { id: `tut-n5-${ts}`, type: 'number', value: 5 }, { id: `tut-n7-${ts}`, type: 'number', value: 7 }, { id: `tut-n8-${ts}`, type: 'number', value: 8 }];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'building' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard12],
        dice,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  if (stepIndex === 2 || stepIndex === 3) {
    const ph: Card[] = [half, third, { id: `tut-n4-${ts}`, type: 'number', value: 4 }, { id: `tut-n6-${ts}`, type: 'number', value: 6 }, { id: `tut-n9-${ts}`, type: 'number', value: 9 }];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'building' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard12],
        dice,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  if (stepIndex === 4) {
    const fracOnPile: Card = { id: `tut-frac-pile-half-${ts}`, type: 'fraction', fraction: '1/2' };
    const ph: Card[] = [
      { id: `tut-d6-${ts}`, type: 'number', value: 6 },
      { id: `tut-d4-${ts}`, type: 'number', value: 4 },
      { id: `tut-d8-${ts}`, type: 'number', value: 8 },
      { id: `tut-d5-${ts}`, type: 'number', value: 5 },
      { id: `tut-d7-${ts}`, type: 'number', value: 7 },
    ];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'pre-roll' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard12, fracOnPile],
        dice,
        pendingFractionTarget: 2,
        fractionPenalty: 2,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  if (stepIndex === 5) {
    const fracOnPile: Card = { id: `tut-frac-pile-third-${ts}`, type: 'fraction', fraction: '1/3' };
    const ph: Card[] = [
      { id: `tut-d9-${ts}`, type: 'number', value: 9 },
      { id: `tut-d12-${ts}`, type: 'number', value: 12 },
      { id: `tut-d6b-${ts}`, type: 'number', value: 6 },
      { id: `tut-d5b-${ts}`, type: 'number', value: 5 },
      { id: `tut-d7b-${ts}`, type: 'number', value: 7 },
    ];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'pre-roll' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard12, fracOnPile],
        dice,
        pendingFractionTarget: 3,
        fractionPenalty: 3,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  return {
    type: 'TUTORIAL_FRACTION_SETUP' as const,
    slice: {
      currentPlayerIndex: 1,
      phase: 'building' as const,
      hands: [[], []],
      discardPile: [discard12],
      dice,
      pendingFractionTarget: null,
      fractionPenalty: 0,
      fractionAttackResolved: false,
      showFractions: true,
      fractionKinds: [...FRAC_KINDS],
    },
  };
}

interface Props {
  onExit: () => void;
  // The host (index.tsx) passes the live game store. We dispatch
  // START_GAME + TUTORIAL_SET_HANDS to boot the underlying game.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameDispatch: (action: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameState: any;
}

function rollThree(): { d1: number; d2: number; d3: number } {
  return {
    d1: Math.floor(Math.random() * 6) + 1,
    d2: Math.floor(Math.random() * 6) + 1,
    d3: Math.floor(Math.random() * 6) + 1,
  };
}

// Generate 3 random dice (any 1–6). The hand includes ALL 3 possible
// 2-die sums so the learner can pick ANY pair and always find a matching
// card. Two random filler cards complete the hand to 5.
function rollL4Dice(): {
  d1: number; d2: number; d3: number;
  pickA: number; pickB: number; target: number;
  hand: number[]; validSums: number[];
} {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const d3 = Math.floor(Math.random() * 6) + 1;
  const dice = [d1, d2, d3];
  // All 2-die + sums.
  const sums: [number, number, number][] = [
    [0, 1, d1 + d2],
    [0, 2, d1 + d3],
    [1, 2, d2 + d3],
  ];
  // Pick the sum closest to the middle of [2..12] for the bot demo.
  const sorted = [...sums].sort((a, b) => Math.abs(a[2] - 7) - Math.abs(b[2] - 7));
  const [pickA, pickB, target] = sorted[0];
  // Hand must contain ALL valid equation results — 2-die AND 3-die sums —
  // so the learner always finds a matching card no matter how they build.
  const threeSum = d1 + d2 + d3;
  const validSums = [...new Set([...sums.map((s) => s[2]), threeSum])];
  const hand = new Set<number>(validSums);
  // Advanced option for step 4.3: add a pair of cards that SUMS to the target
  // so the learner can play two cards (e.g. target 9 → 6 + 3) instead of just
  // the single matching card. Pair values are kept distinct so the fan shows
  // them as separate cards.
  if (target >= 3) {
    const maxPairA = Math.max(1, Math.floor((target - 1) / 2));
    const pairA = 1 + Math.floor(Math.random() * maxPairA);
    const pairB = target - pairA;
    if (pairA >= 1 && pairB >= 1 && pairA !== pairB && pairA <= 12 && pairB <= 12) {
      hand.add(pairA);
      hand.add(pairB);
    }
  }
  while (hand.size < 6) {
    const v = Math.floor(Math.random() * 12) + 1;
    hand.add(v);
  }
  const sortedHand = [...hand].sort((a, b) => a - b);
  return { d1, d2, d3, pickA, pickB, target, hand: sortedHand, validSums };
}

export function InteractiveTutorialScreen({ onExit, gameDispatch, gameState }: Props): React.ReactElement {
  const { t, locale } = useLocale();
  const dims = useWindowDimensions();
  const [engine, dispatchEngine] = useReducer(
    (s: MimicState, a: MimicAction) => mimicReducer(s, a, LESSON_SHAPES),
    INITIAL_MIMIC_STATE,
  );
  // Tutorial-owned dice state — used only for lesson 3 so the lesson is
  // self-contained and doesn't depend on the underlying game phase.
  const [tutorialDice, setTutorialDice] = useState<{ d1: number; d2: number; d3: number } | null>(null);
  // Pulse halo around the tutorial-owned dice button during the bot demo.
  const dicePulse = useRef(new Animated.Value(0)).current;
  // Lesson 4: random dice generated once when lesson 4 starts. The values
  // drive ROLL_DICE, and the bot demo reads pickA/pickB/target to know
  // which dice to pick and what the correct card value is.
  const l4DiceRef = useRef<ReturnType<typeof rollL4Dice> | null>(null);
  // Brief green-V overlay when the bot taps the equation confirm button.
  const [showConfirmCheck, setShowConfirmCheck] = useState(false);
  const confirmCheckScale = useRef(new Animated.Value(0)).current;
  // Brief "תוצאת התרגיל היא X" announcement after the bot confirms the equation.
  const [resultAnnouncement, setResultAnnouncement] = useState<string | null>(null);
  // Brief "try again" feedback when the learner makes a WRONG pick during
  // await-mimic (e.g. taps a non-target card, picks the wrong die). The tick
  // retriggers the animation every wrong attempt.
  const [wrongAttemptTick, setWrongAttemptTick] = useState(0);
  const wrongShakeAnim = useRef(new Animated.Value(0)).current;

  // (L5a wrong-tap feedback was removed when the lesson was rebuilt
  // around card placement — fan taps are now the correct first action.)

  // ── Lesson 4 step 3 (guided full build) sub-phase ──
  // Drives the dynamic speech bubble + arrow position during the learner's
  // solo run of a full equation. Transitions:
  //   build  →  confirm   — user has added 2 dice + op (eqReadyToConfirm)
  //   confirm →  pick      — user tapped "אשר את התרגיל" (eqConfirmedByUser)
  //   pick   →  play      — user tapped any card (first cardTapped in solved)
  //   play   →  (step ends)— user tapped "בחרתי" (userPlayedCards → outcome)
  type L4Step3Phase = 'build' | 'confirm' | 'pick' | 'play';
  const [l4Step3Phase, setL4Step3Phase] = useState<L4Step3Phase>('build');
  // Pulsing ▼ arrow animation — matches the existing tutorial arrow style
  // used elsewhere in the game (fades + bobs up). Loops continuously while
  // the arrow is visible over the target button.
  const l4ArrowPulse = useRef(new Animated.Value(0)).current;
  // Measured rects of the "אשר את התרגיל" / "בחרתי" buttons — updated by the
  // real game UI via tutorialBus.setLayout. Used to position the arrow.
  const [confirmBtnRect, setConfirmBtnRect] = useState<LayoutRect | null>(null);
  const [playCardsBtnRect, setPlayCardsBtnRect] = useState<LayoutRect | null>(null);

  // Lesson 5 (op-cycle) state — scratch canvas. The equation is
  //   `[a] [op] [b] = [result]`  where result updates live as op changes.
  // Number pairs are curated so all 4 operations yield integers (e.g. 4/2).
  // Step 5a: learner cycles the `?` slot through +, -, ×, ÷ — advances once
  // all four signs have been visited. Step 5b: learner taps the joker card,
  // picks a sign in the modal, then taps the slot to place it.
  type L5Op = '+' | '-' | 'x' | '÷';
  const L5_CYCLE: readonly L5Op[] = ['+', '-', 'x', '÷'];
  const [l5Config, setL5Config] = useState<{ a: number; b: number } | null>(null);
  const [l5SelectedOp, setL5SelectedOp] = useState<L5Op | null>(null);
  const [l5JokerOpen, setL5JokerOpen] = useState(false);
  // Signs the learner has visited via the `?` cycle — for step 5a outcome.
  const [l5CycledSigns, setL5CycledSigns] = useState<Set<L5Op>>(() => new Set());
  // Sign picked in the joker modal but not yet placed in the slot.
  const [l5PendingJokerOp, setL5PendingJokerOp] = useState<L5Op | null>(null);
  // L5.1 wrong-card feedback: shown 2s then auto-cleared.
  const [l5PlaceWrong, setL5PlaceWrong] = useState(false);
  const l5PlaceWrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const l5SlotPulse = useRef(new Animated.Value(0)).current;
  const [l5FlowHintPhase, setL5FlowHintPhase] = useState<'tapJoker' | 'pickModal' | 'placeSign'>('tapJoker');

  // ── Lesson 5c (solve-for-op) state ──
  // Two pre-generated exercises; learner must pick the sign that makes each
  // equation true and press "Confirm". `l5ExIndex` is the 0-based pointer
  // (2 = both solved, outcome fires). Wrong-confirm feedback rides on the
  // shared `wrongAttemptTick` shake/bubble wiring used by earlier lessons.
  type L5Ex = { a: number; b: number; op: L5Op; result: number };
  const [l5Exercises, setL5Exercises] = useState<L5Ex[]>([]);
  const [l5ExIndex, setL5ExIndex] = useState<0 | 1 | 2>(0);

  // ── Lesson 5.2 (operator pick & place) state ──
  // Two exercises: first minus (e.g. 6−3), then plus (e.g. 4+5), with fresh
  // random numbers each run. The learner has to pick the matching operator
  // card from the fan and drop it on the op1 slot — same mechanic as in the
  // real game (PLACE_EQ_OP). `l5OpPickIndex` is the 0-based pointer
  // (2 = both solved → step outcome fires). The transient feedback banner
  // mirrors solve-for-op but is scoped to pick-place so the two steps don't
  // share state.
  type L5OpPickEx = { a: number; b: number; op: '+' | '-' };
  const [l5OpPickExercises, setL5OpPickExercises] = useState<L5OpPickEx[]>([]);
  const [l5OpPickIndex, setL5OpPickIndex] = useState<0 | 1 | 2>(0);
  const [l5OpPickFeedback, setL5OpPickFeedback] = useState<null | 'correct' | 'wrong'>(null);

  // Random exercise generator — minus first (a ≥ b + 1, result ≥ 1) then plus
  // (1..6 both). Operations are fixed per slot (the lesson teaches minus AND
  // plus card placement specifically — see spec in docs).
  const generateL5OpPickExercises = (): L5OpPickEx[] => {
    const aMinus = 3 + Math.floor(Math.random() * 7); // 3..9
    const bMinus = 1 + Math.floor(Math.random() * (aMinus - 1)); // 1..aMinus-1 → a-b ≥ 1
    const aPlus = 1 + Math.floor(Math.random() * 6); // 1..6
    const bPlus = 1 + Math.floor(Math.random() * 6); // 1..6
    return [
      { a: aMinus, b: bMinus, op: '-' },
      { a: aPlus, b: bPlus, op: '+' },
    ];
  };

  // Rig the underlying game for a single pick-place exercise: clear the
  // equation, roll dice to the exercise's (a, b) + a random d3, give the
  // learner a fresh 4-card hand with all four operator cards, then pre-
  // fill the two dice slots so the equation shows `[a] [?] [b] … = ?`.
  // The learner's job is to drop the matching operator on the `?` slot.
  const rigL5OpPickExercise = (ex: L5OpPickEx): void => {
    // Clear any leftover placement from a prior exercise (PLACE_EQ_OP still
    // holds the card reference in equationHandSlots even after eqReset).
    gameDispatch({ type: 'CLEAR_EQ_HAND' });
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    const d3 = 1 + Math.floor(Math.random() * 6);
    gameDispatch({
      type: 'TUTORIAL_SET_DICE',
      values: { die1: ex.a, die2: ex.b, die3: d3 },
    });
    const ts = Date.now();
    const playerHand = [
      { id: `tut-l5op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
      { id: `tut-l5op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
      { id: `tut-l5op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
      { id: `tut-l5op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
    ];
    const botHand = [
      { id: `tut-l5op-bot-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
      { id: `tut-l5op-bot-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
      { id: `tut-l5op-bot-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
      { id: `tut-l5op-bot-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
    ];
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botHand, playerHand] });
    // Pre-fill d1 and d2 after React commits TUTORIAL_SET_DICE — without the
    // gap, eqPickDice reads stale dice values and the picks clobber each
    // other (see L5a prefill logic).
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 0 }), 140);
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 1 }), 280);
  };

  // Curated (a, b) pairs where all 4 operations yield integers. Pick one at
  // random when lesson 5 starts so the learner sees different numbers each
  // run. `a >= b >= 2` and `a % b === 0` guarantees `a / b` is a whole number
  // and `a - b >= 0` so subtraction never produces a negative.
  const L5_PAIRS: ReadonlyArray<{ a: number; b: number }> = [
    { a: 4, b: 2 }, { a: 6, b: 2 }, { a: 6, b: 3 },
    { a: 8, b: 2 }, { a: 8, b: 4 }, { a: 9, b: 3 },
    { a: 10, b: 2 }, { a: 10, b: 5 }, { a: 12, b: 3 },
    { a: 12, b: 4 }, { a: 12, b: 6 },
  ];
  const pickL5Pair = (): { a: number; b: number } =>
    L5_PAIRS[Math.floor(Math.random() * L5_PAIRS.length)];
  const computeL5Result = (a: number, b: number, op: L5Op | null): number | null => {
    if (op === null) return null;
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === 'x') return a * b;
    if (op === '÷') return b === 0 ? null : a / b;
    return null;
  };
  // Generate two lesson-5c exercises with different ops so the learner
  // doesn't get the same sign twice. Pairs are sampled from L5_PAIRS; for
  // each pair the chosen op + a/b are used to pre-compute the target result
  // (always an integer because L5_PAIRS is curated).
  const generateL5Exercises = (): L5Ex[] => {
    const allOps: L5Op[] = ['+', '-', 'x', '÷'];
    const ops = [...allOps].sort(() => Math.random() - 0.5).slice(0, 2);
    return ops.map((op) => {
      const { a, b } = pickL5Pair();
      const result = computeL5Result(a, b, op)!;
      return { a, b, op, result };
    });
  };

  // ── Start the engine on mount + ensure SFX are loaded (StartScreen
  //    normally initializes them, but the tutorial skips StartScreen). ──
  useEffect(() => {
    dispatchEngine({ type: 'START' });
    void initializeSfx();
    // Pre-generate dice for lesson 4 so lesson 3's roll shows the SAME
    // values the equation lesson will use.
    if (!l4DiceRef.current) {
      l4DiceRef.current = rollL4Dice();
    }
  }, []);

  // ── Keep SFX mute state in sync with game's soundsEnabled. StartScreen
  //    and GameScreen each do this in their own useEffect, but neither is
  //    always mounted during the tutorial (lessons 1–3 skip GameScreen). ──
  useEffect(() => {
    setSfxMuted(gameState?.soundsEnabled === false);
  }, [gameState?.soundsEnabled]);

  // ── Auto-dismiss the intro phase whenever it's reached (mount AND
  //    between lessons) — the lesson title/description is delivered via
  //    the in-context speech bubble, not a welcome card. ──
  useEffect(() => {
    if (engine.phase !== 'intro') return;
    dispatchEngine({ type: 'DISMISS_INTRO' });
  }, [engine.phase]);

  // ── External exit request (game's own red "יציאה" header button) ──
  useEffect(() => {
    return tutorialBus.subscribeRequestExit(() => {
      dispatchEngine({ type: 'EXIT' });
      onExit();
    });
  }, [onExit]);

  // ── lesson-done is invisible — celebrate already announced success.
  //    We still pass through the phase so the engine bookkeeping advances. ──
  useEffect(() => {
    if (engine.phase !== 'lesson-done') return;
    dispatchEngine({ type: 'DISMISS_LESSON_DONE' });
  }, [engine.phase]);

  // ── Clear card frames + reset all tutorial state whenever a new step
  //    begins (phase=intro). This handles lesson transitions, GO_BACK,
  //    and ensures refs are re-armed so the lesson can boot fresh. ──
  useEffect(() => {
    if (engine.phase !== 'intro') return;
    const isFracLesson = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX;
    tutorialBus.emitFanDemo({ kind: 'clearCardFrame' });
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    // eqReset only clears the EquationBuilder's local dice/op state. Any
    // operator or joker card the learner placed into equationHandSlots in
    // the previous step (e.g. L5.2's joker on an op slot) is still held in
    // game state, and the L5.1 self-prefill bails out while any slot is
    // non-null — producing the "empty equation, `?` sign" on GO_BACK into
    // L5.1. CLEAR_EQ_HAND is idempotent for lessons that don't populate
    // these slots, so it's safe to always dispatch on lesson-intro.
    gameDispatch({ type: 'CLEAR_EQ_HAND' });
    if (!isFracLesson && gameState?.phase === 'solved') {
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
    }
    // Clear any lingering "which cards were played" messages from the
    // previous step — BEGIN_TURN normally clears these, but the tutorial
    // skips normal turn flow.
    if (!isFracLesson && (gameState?.lastMoveMessage || gameState?.lastDiscardCount)) {
      gameDispatch({ type: 'BEGIN_TURN' });
    }
    // Reset dice lesson state so the gold button re-appears on GO_BACK.
    setTutorialDice(null);
    // Only regenerate L4 dice when going BACKWARDS (engine.lessonIndex
    // went down). Going forward (lesson 3 → 4) must keep the same dice
    // the user already saw in lesson 3.
    if (engine.lessonIndex <= 2) {
      l4DiceRef.current = rollL4Dice();
    }
    // Re-arm lesson 4 refs so BEGIN_TURN + ROLL_DICE re-fire when needed.
    eqLessonAdvancedRef.current = false;
    eqLessonHandRiggedRef.current = false;
    // Clear result announcement if lingering.
    setResultAnnouncement(null);
    if (isFracLesson) {
      gameDispatch(buildFractionTutorialSetup(engine.stepIndex, Date.now()));
    }
  }, [engine.phase, engine.lessonIndex, engine.stepIndex, gameState?.phase, gameDispatch]);

  // ── Boot underlying game once on mount ──
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    if (gameState?.phase !== 'setup') return;
    bootedRef.current = true;
    gameDispatch({
      type: 'START_GAME',
      players: [
        { name: locale === 'he' ? 'בוט מורה' : 'Coach Bot' },
        { name: locale === 'he' ? 'אתה' : 'You' },
      ],
      difficulty: 'easy',
      mode: 'pass-and-play',
      isTutorial: true,
      fractions: false,
      showPossibleResults: false,
      showSolveExercise: false,
      enabledOperators: ['+'],
      mathRangeMax: 12,
      timerSetting: 'off' as const,
      timerCustomSeconds: 60,
      difficultyStage: 'A',
    });
  }, [gameState?.phase, gameDispatch, locale]);

  // ── Lesson 3 (dice) is handled entirely inside the tutorial overlay
  //    (its own button + dice display). We don't advance the underlying
  //    game phase — that kept leaking real-game UI through the curtain. ──

  // ── Rig the user's hand with sample cards once the game is in pre-roll ──
  const handsRiggedRef = useRef(false);
  useEffect(() => {
    if (handsRiggedRef.current) return;
    if (!gameState?.players || gameState.players.length < 2) return;
    if (gameState.phase !== 'turn-transition' && gameState.phase !== 'pre-roll') return;
    handsRiggedRef.current = true;
    const dice = gameState.dice ?? { die1: 3, die2: 4, die3: 2 };
    const handConfig: Parameters<typeof generateTutorialHand>[1] = {
      index: 0,
      titleKey: 'tutorial.l1.title',
      descKey: 'tutorial.l1.desc',
      enabledOperators: ['+'],
      showFractions: false,
      maxRange: 12,
      requiredSpecials: [],
      freePlay: false,
      botSteps: [],
      userSteps: [],
    };
    const result = generateTutorialHand(dice, handConfig, 0);
    gameDispatch({
      type: 'TUTORIAL_SET_HANDS',
      hands: [result.botHand, result.playerHand],
      ...(result.discardTop ? { discardPile: [result.discardTop] } : {}),
    });
  }, [gameState?.phase, gameState?.players, gameDispatch]);

  // ── TurnTransition deliberately hides the "I'm ready" button when
  //    `state.isTutorial` (see index.tsx TurnTransition). Without an auto
  //    BEGIN_TURN the game can stay in `turn-transition` forever — no fan on
  //    the transition screen path, or lesson 2 await-mimic never sees taps
  //    on the same stack as the full PlayerHand. Skip straight to pre-roll. ──
  useEffect(() => {
    if (!gameState?.isTutorial || gameState.phase !== 'turn-transition') return;
    gameDispatch({ type: 'BEGIN_TURN' });
  }, [gameState?.isTutorial, gameState?.phase, gameDispatch]);

  // ── Run bot demo when phase=bot-demo. The scripted async chain advances
  //    naturally; a 6s safety timer also fires BOT_DEMO_DONE in case the
  //    chain stalls (e.g. WebView/Audio init holding the JS thread). ──
  useEffect(() => {
    if (engine.phase !== 'bot-demo') return;
    const lesson = LESSONS[engine.lessonIndex];
    const step = lesson?.steps[engine.stepIndex];
    if (!step) return;
    // Pass the `cancelled` flag through so bus emits from a skipped-past
    // bot-demo (e.g. L4's eqPickDice chain still waiting out a 2800ms
    // pause) cannot leak forward into the next step's UI after the user
    // hits "דלג". Without this, L4's `eqPickDice(pickA)` / `eqPickDice(pickB)`
    // could fire while the learner is already on L5.1, clobbering its
    // pre-filled `4 ? 3 = 7` with stale indices (producing e.g. `4 + 9 = 13`).
    let cancelled = false;
    const demo = createBotDemonstrator(() => cancelled);
    let fired = false;
    const fireOnce = () => {
      if (cancelled || fired) return;
      fired = true;
      dispatchEngine({ type: 'BOT_DEMO_DONE' });
    };
    (async () => {
      try {
        await step.botDemo(demo);
      } catch (e) {
        if (__DEV__) console.warn('[tutorial] botDemo failed', e);
      }
      fireOnce();
    })();
    const fallback = setTimeout(fireOnce, 6000);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [engine.phase, engine.lessonIndex, engine.stepIndex]);

  // ── Listen for user mimic when phase=await-mimic ──
  useEffect(() => {
    if (engine.phase !== 'await-mimic') return;
    const lesson = LESSONS[engine.lessonIndex];
    const step = lesson?.steps[engine.stepIndex];
    if (!step) return;
    const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 2;
    // Lesson 5 is a two-step placement lesson — fan taps are always the
    // intended first action (pick an operator card in 5.1, tap the joker
    // in 5.2), so they should NEVER trigger the "wrong answer" shake.
    const isL5 = engine.lessonIndex === 4;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (step.outcome(evt)) {
        dispatchEngine({ type: 'OUTCOME_MATCHED' });
        return;
      }
      // Lesson-4 step-3 taps are staging actions, not "wrong answers" — the
      // step advances when the learner hits "בחרתי", so suppress the shake.
      if (isL4Step3) return;
      if (isL5) return;
      // A WRONG card pick — only flash "try again" for cardTapped events
      // that didn't match. Die picks (eqUserPickedDice) are valid
      // intermediate actions and should NEVER trigger "wrong".
      if (evt.kind === 'cardTapped') {
        setWrongAttemptTick((n) => n + 1);
      }
    });
  }, [engine.phase, engine.lessonIndex, engine.stepIndex]);

  // ── Lesson 4 step 3 (guided full build): enable l4Step3Mode while active
  //    so the EquationBuilder shows its confirm button + skips auto-confirm,
  //    and both buttons report their layout via bus. Also reset the sub-phase
  //    every time the step re-enters (e.g. after GO_BACK). ──
  useEffect(() => {
    const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
    if (isL4Step3) {
      tutorialBus.setL4Step3Mode(true);
      setL4Step3Phase('build');
      return () => tutorialBus.setL4Step3Mode(false);
    }
    tutorialBus.setL4Step3Mode(false);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // Lesson 5 runs on the real game UI (EquationBuilder + joker modal).
  useEffect(() => {
    const on = engine.lessonIndex === 4 && (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
    tutorialBus.setL5GuidedMode(on);
    return () => tutorialBus.setL5GuidedMode(false);
  }, [engine.lessonIndex, engine.phase]);

  // L5 is now a pure "place an operator card" lesson — no cycle-on-tap. The
  // fan is the PRIMARY interaction target (learner picks a card from it), so
  // we explicitly DO NOT block fan taps. Cycling the `?` slot is blocked in
  // BOTH L5 steps so tapping the operator slot either places a held card or
  // does nothing — it never flips the sign.
  useEffect(() => {
    const on =
      engine.lessonIndex === 4 &&
      (engine.phase === 'bot-demo' || engine.phase === 'await-mimic' || engine.phase === 'celebrate');
    tutorialBus.setL5BlockOpCycle(on);
    return () => tutorialBus.setL5BlockOpCycle(false);
  }, [engine.lessonIndex, engine.phase]);

  // L5.1 (place-op) AND L5.2 (joker-place): lock the pre-filled dice slots
  // so the learner can't accidentally empty the equation while searching
  // for the operator slot. `setL5aBlockFanTaps` drives that lock in
  // renderDiceSlot / unplaced-dice-button onPress. Leaves fan card taps
  // untouched — the learner still needs to pick an operation card (or
  // Slinda) from the fan.
  // `setL5aTargetResult` pushes the target (7 for `4 + 3`) into the result
  // box so both steps show the same goal: sign slot empty, target `= 7`.
  useEffect(() => {
    const on =
      engine.lessonIndex === 4 &&
      engine.stepIndex <= 1 &&
      (engine.phase === 'bot-demo' || engine.phase === 'await-mimic' || engine.phase === 'celebrate');
    tutorialBus.setL5aBlockFanTaps(on);
    tutorialBus.setL5aTargetResult(on ? 7 : null);
    return () => {
      tutorialBus.setL5aBlockFanTaps(false);
      tutorialBus.setL5aTargetResult(null);
    };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // L5.1 (place-op) outcome wiring lives in the lesson definition
  // (lesson-05-op-cycle.ts) — `outcome: event.kind === 'l5OperatorPlaced'`.
  // The engine subscribes to user events globally; index.tsx emits the
  // event from renderOpBtn.onPress → PLACE_EQ_OP, so nothing else is
  // needed here.

  // (L5a wrong-tap wiring was removed — the new L5.1 flow MAKES fan taps
  // the correct first action, so there's nothing "wrong" about tapping a
  // card during this step.)

  // Optional fractions module: emit bus events for scripted outcomes.
  useEffect(() => {
    const on =
      engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.phase !== 'post-signs-choice' &&
      engine.phase !== 'core-complete' &&
      engine.phase !== 'all-done' &&
      engine.phase !== 'idle';
    tutorialBus.setFracGuidedMode(on);
    return () => tutorialBus.setFracGuidedMode(false);
  }, [engine.lessonIndex, engine.phase]);

  useEffect(() => {
    // Joker-place is now stepIndex 1 (the new place-op step took over
    // stepIndex 0 and the old cycle-signs / pick-place / solve-for-op
    // steps were retired). Sub-hint flow: tap joker → pick sign in modal
    // → place on slot.
    const isL5bAwait = engine.lessonIndex === 4 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
    if (!isL5bAwait) return;
    setL5FlowHintPhase('tapJoker');
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'l5JokerModalOpened') setL5FlowHintPhase('pickModal');
      else if (evt.kind === 'l5JokerPickedInModal') setL5FlowHintPhase('placeSign');
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── Layout subscription: keep local rects in sync with the bus so the
  //    arrow re-renders whenever a button's position changes (first mount,
  //    orientation change, etc). ──
  useEffect(() => {
    setConfirmBtnRect(tutorialBus.getLayout('confirmEqBtn'));
    setPlayCardsBtnRect(tutorialBus.getLayout('playCardsBtn'));
    return tutorialBus.subscribeLayout((key, rect) => {
      if (key === 'confirmEqBtn') setConfirmBtnRect(rect);
      else if (key === 'playCardsBtn') setPlayCardsBtnRect(rect);
    });
  }, []);

  // ── Pulse the ➜ arrow while it's visible (confirm/play sub-phases).
  //    Timing matches the game's existing roll-dice timer arrow: 280ms each
  //    way with inOut(quad) — a quick, urgent bob that draws the eye. ──
  const isL4Step3AwaitForArrow = engine.lessonIndex === 3 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
  const showArrow = isL4Step3AwaitForArrow && (l4Step3Phase === 'confirm' || l4Step3Phase === 'play');
  useEffect(() => {
    if (!showArrow) {
      l4ArrowPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(l4ArrowPulse, { toValue: 1, duration: 280, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.timing(l4ArrowPulse, { toValue: 0, duration: 280, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showArrow, l4ArrowPulse]);

  // ── Lesson 4 bounce-back: if CONFIRM_STAGED advances the turn during
  //    any lesson-4 step, the game enters 'turn-transition' and the
  //    EquationBuilder + fan disappear. Immediately bounce back to
  //    'building' so the tutorial screen stays intact. ──
  useEffect(() => {
    if (engine.lessonIndex !== 3) return;
    if (gameState?.phase !== 'turn-transition') return;
    // Chain: turn-transition → pre-roll → building (with current dice).
    gameDispatch({ type: 'BEGIN_TURN' });
  }, [engine.lessonIndex, gameState?.phase, gameDispatch]);
  useEffect(() => {
    if (engine.lessonIndex !== 3) return;
    if (gameState?.phase !== 'pre-roll') return;
    // Re-rig with existing l4 dice to get back to building.
    const l4 = l4DiceRef.current;
    if (l4) {
      gameDispatch({ type: 'ROLL_DICE', values: { die1: l4.d1, die2: l4.d2, die3: l4.d3 } });
    }
  }, [engine.lessonIndex, gameState?.phase, gameDispatch]);

  // ── Lesson 4 step 3 sub-phase transitions driven by user events. ──
  useEffect(() => {
    const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
    if (!isL4Step3) return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'eqReadyToConfirm') {
        setL4Step3Phase((p) => (p === 'build' ? 'confirm' : p));
      } else if (evt.kind === 'eqConfirmedByUser') {
        setL4Step3Phase('pick');
      } else if (evt.kind === 'cardTapped') {
        // First tap after confirming enters the 'play' sub-phase: arrow moves
        // from fan to the "בחרתי" button. Subsequent stage/unstage taps keep
        // the arrow on "בחרתי".
        setL4Step3Phase((p) => (p === 'pick' ? 'play' : p));
      }
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // Run the shake + auto-clear whenever wrongAttemptTick increments.
  useEffect(() => {
    if (wrongAttemptTick === 0) return;
    wrongShakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(wrongShakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(wrongShakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(wrongShakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(wrongShakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setWrongAttemptTick(0), 1600);
    return () => clearTimeout(t);
  }, [wrongAttemptTick, wrongShakeAnim]);

  // ── Bus subscriptions for lesson-4 actions that need access to game
  //    state (stageCardByValue, eqReset → REVERT_TO_BUILDING) and for
  //    the green-V confirm flash. ──
  useEffect(() => {
    return tutorialBus.subscribeFanDemo((cmd) => {
      if (cmd.kind === 'stageCardByValue') {
        const cp = gameState?.players?.[gameState.currentPlayerIndex];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const card = cp?.hand?.find((c: any) => c.type === 'number' && c.value === cmd.value);
        if (card) gameDispatch({ type: 'STAGE_CARD', card });
      } else if (cmd.kind === 'eqReset') {
        // Revert back to 'building' from 'solved' so the EquationBuilder
        // accepts new dice picks. Also unstage any staged card.
        if (gameState?.phase === 'solved') {
          gameDispatch({ type: 'REVERT_TO_BUILDING' });
        }
      } else if (cmd.kind === 'eqConfirm') {
        // Flash a green V on top of the equation-confirm button.
        setShowConfirmCheck(true);
        confirmCheckScale.setValue(0);
        Animated.spring(confirmCheckScale, { toValue: 1, friction: 5, tension: 130, useNativeDriver: true }).start();
        setTimeout(() => setShowConfirmCheck(false), 900);
        // Result announcement removed — it was reading stale/incorrect
        // data and confusing the learner. The green result box + golden
        // halo on the equation builder already communicate the answer.
      }
    });
  }, [gameState?.players, gameState?.currentPlayerIndex, gameState?.phase, gameDispatch, confirmCheckScale, locale]);

  // ── Lesson 4 (build equation) auto-progression: drive the underlying
  //    game into 'building' with rigged dice + hand. Handles first entry
  //    AND re-entry after GO_BACK (refs are re-armed in the intro cleanup). ──
  const eqLessonAdvancedRef = useRef(false);
  const eqLessonHandRiggedRef = useRef(false);
  const l5LessonAdvancedRef = useRef(false);
  const l5LessonHandRiggedRef = useRef(false);
  const rigL4 = () => {
    // Use rollL4Dice values as-is — NO re-derivation. This guarantees
    // perfect consistency: the dice, pickA/pickB, target, hand, and
    // validSums are all computed ONCE in the same function call.
    const l4 = l4DiceRef.current ?? rollL4Dice();
    l4DiceRef.current = l4;
    const { d1, d2, d3, pickA, pickB, target, hand, validSums } = l4;
    tutorialBus.setL4Config({ pickA, pickB, target, hand, validSums });

    const ts = Date.now();
    const handCards = hand.map((v) => ({
      id: `tut-l4-card-${v}-${ts}`,
      type: 'number' as const,
      value: v,
    }));
    const botCards = hand.map((v) => ({
      id: `tut-l4-bot-card-${v}-${ts}`,
      type: 'number' as const,
      value: v,
    }));
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botCards, handCards] });
    if (gameState?.phase === 'pre-roll') {
      gameDispatch({ type: 'ROLL_DICE', values: { die1: d1, die2: d2, die3: d3 } });
    } else {
      // Re-entry or any other non-pre-roll phase: force-set the dice so
      // the displayed values match the bus config above.
      gameDispatch({ type: 'TUTORIAL_SET_DICE', values: { die1: d1, die2: d2, die3: d3 } });
    }
  };
  useEffect(() => {
    if (engine.lessonIndex !== 3) return;
    if (!gameState?.players || gameState.players.length < 2) return;

    // First entry: turn-transition → pre-roll → building
    if (gameState.phase === 'turn-transition' && !eqLessonAdvancedRef.current) {
      eqLessonAdvancedRef.current = true;
      gameDispatch({ type: 'BEGIN_TURN' });
      return;
    }
    if (gameState.phase === 'pre-roll' && !eqLessonHandRiggedRef.current) {
      eqLessonHandRiggedRef.current = true;
      rigL4();
      return;
    }
    // Re-entry after GO_BACK: game is already in 'building' — just re-rig.
    if (gameState.phase === 'building' && !eqLessonHandRiggedRef.current) {
      eqLessonHandRiggedRef.current = true;
      rigL4();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex, gameState?.phase, gameState?.players, gameDispatch]);

  // ── Lesson 5 (op/joker) must run on the real EquationBuilder. Ensure the
  //    game is in `building` with visible dice and a hand that includes a joker. ──
  useEffect(() => {
    if (engine.lessonIndex !== 4) return;
    if (engine.phase === 'intro') {
      l5LessonAdvancedRef.current = false;
      l5LessonHandRiggedRef.current = false;
      return;
    }
    if (!gameState?.players || gameState.players.length < 2) return;
    if (gameState.phase === 'turn-transition' && !l5LessonAdvancedRef.current) {
      l5LessonAdvancedRef.current = true;
      gameDispatch({ type: 'BEGIN_TURN' });
      return;
    }
    // Rig regardless of current gameState.phase — entering lesson 5 from any
    // prior lesson/state (including `solved` after L4, or mid-`building` from
    // a GO_BACK) should rebuild the L5 hand + dice. ROLL_DICE in tutorial
    // mode bypasses its own phase gate (see index.tsx reducer). TUTORIAL_SET_HANDS
    // has no phase restriction. Run the rigging once per lesson entry.
    if (!l5LessonHandRiggedRef.current) {
      l5LessonHandRiggedRef.current = true;
      // L5.1 pedagogy: the learner sees `4 ? 3 = 7` and must pick the `+`
      // card to complete it. Dice are fixed (not rolled) so the exercise
      // stays deterministic; d1 and d2 are intentionally distinct and the
      // target (7 = 4+3) maps to exactly one correct operator.
      // No joker in this hand — the joker is introduced in step 5.2, and
      // exposing it here would let the learner bypass the "pick the right
      // operation card" decision that step 5.1 is teaching.
      const FIXED_L5_DICE = { d1: 4, d2: 3, d3: 9 };
      gameDispatch({ type: 'ROLL_DICE', values: { die1: FIXED_L5_DICE.d1, die2: FIXED_L5_DICE.d2, die3: FIXED_L5_DICE.d3 } });
      const ts = Date.now();
      const playerHand = [
        { id: `tut-l5-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      const botHand = [
        { id: `tut-l5-bot-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5-bot-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5-bot-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5-bot-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botHand, playerHand] });
    }
  }, [engine.lessonIndex, engine.phase, gameState?.phase, gameState?.players, gameDispatch]);

  // ── Lesson 5.1 (place-op): only the first two number slots (d1, d2) are
  //    prefilled BY the EquationBuilder itself — the operator slot stays
  //    empty so the learner drops a card there. See the self-prefill
  //    useEffect in index.tsx that triggers off of
  //    `tutorialBus.getL5aBlockFanTaps()`. Doing the prefill inside the
  //    owner of the slot state removes the emit-vs-subscribe race that
  //    previously left the equation empty ("המישוואה תקועה ואין שני
  //    מיספרים"). Nothing to do here.

  // ── If the user skipped the dice lesson without rolling, fabricate
  //    dice values when celebrate begins so the "these are the numbers"
  //    bubble has something to point at. ──
  useEffect(() => {
    if (engine.lessonIndex !== 2) return;
    if (engine.phase !== 'celebrate') return;
    if (tutorialDice) return;
    const l4 = l4DiceRef.current ?? rollL4Dice();
    setTutorialDice({ d1: l4.d1, d2: l4.d2, d3: l4.d3 });
  }, [engine.phase, engine.lessonIndex, tutorialDice]);

  // ── Pulse the tutorial-owned dice button during dice-lesson bot-demo. ──
  useEffect(() => {
    const isPulsing = engine.phase === 'bot-demo' && engine.lessonIndex === 2;
    if (!isPulsing) {
      dicePulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dicePulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(dicePulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [engine.phase, engine.lessonIndex, dicePulse]);

  // ── Lesson 5: pick a fresh (a, b) pair on entry + reset per-lesson state
  //    (cycled signs, pending joker op, modal) so each run starts clean. ──
  useEffect(() => {
    if (engine.lessonIndex !== 4) {
      setL5JokerOpen(false);
      return;
    }
    const cfg = pickL5Pair();
    setL5Config(cfg);
    setL5SelectedOp(null);
    setL5JokerOpen(false);
    setL5CycledSigns(new Set());
    setL5PendingJokerOp(null);
    setL5Exercises(generateL5Exercises());
    setL5ExIndex(0);
    tutorialBus.setL5Config(cfg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex]);

  // ── Between lesson-5 steps (place-op → joker), reset per-step state so
  //    each step starts on a clean slate (modal closed, no pending joker
  //    pick). Step 0 (place-op) rigging — full 3-dice layout with `+` on
  //    both operator slots — lives in the lesson-entry rigging block (see
  //    the L5 dice/hand useEffect above). ──
  useEffect(() => {
    if (engine.lessonIndex !== 4) return;
    if (engine.phase !== 'bot-demo') return;
    if (engine.stepIndex > 0) {
      setL5JokerOpen(false);
      setL5PendingJokerOp(null);
    }
    if (engine.stepIndex === 1) {
      // Step 5.2 (joker-place — "meet Slinda"): mirror 5.1. Keep the 5.1
      // dice (4, 3, 9) on the table; clear the placed `+` card and the
      // op/result state; swap in a 5-card hand with Slinda centred at
      // index 2; then re-pre-fill d1 and d2 so the equation reads
      // `4 ? 3 = 7` with the sign slot empty. The staged delays mirror
      // `rigL5OpPickExercise`'s pattern — without them, eqPickDice races
      // the eqReset commit.
      gameDispatch({ type: 'CLEAR_EQ_HAND' });
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      const ts = Date.now();
      const playerHand = [
        { id: `tut-l5b-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5b-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5b-joker-${ts}`, type: 'joker' as const },
        { id: `tut-l5b-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5b-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      const botHand = [
        { id: `tut-l5b-bot-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
        { id: `tut-l5b-bot-op-minus-${ts}`, type: 'operation' as const, operation: '-' as const },
        { id: `tut-l5b-bot-joker-${ts}`, type: 'joker' as const },
        { id: `tut-l5b-bot-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
        { id: `tut-l5b-bot-op-divide-${ts}`, type: 'operation' as const, operation: '÷' as const },
      ];
      gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botHand, playerHand] });
      // Scroll the fan so Slinda (index 2 of 5) is centred immediately when
      // the step loads — before the bot demo does its own scroll.
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'scrollToIdx', idx: 2, durationMs: 350, easing: 'settle' }), 60);
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 0 }), 140);
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 1 }), 280);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── Lesson 6 (possible-results) rigging: on entry, the learner sees a
  //    fully-filled equation and a full hand — the green ResultsChip pulses
  //    strongly to draw attention. We rig a deterministic setup (dice 2,3,4
  //    + both op slots = `+`) so the chip has possible targets to show, and
  //    enable showPossibleResults on the game state (the boot defaults it
  //    to false so the chip stays hidden during earlier lessons). Runs once
  //    per L6 entry (reset on lesson exit via the ref below). ──
  const l6RiggedRef = useRef(false);
  useEffect(() => {
    if (engine.lessonIndex !== 5) {
      l6RiggedRef.current = false;
      return;
    }
    if (engine.phase !== 'bot-demo' || engine.stepIndex !== 0) return;
    if (l6RiggedRef.current) return;
    l6RiggedRef.current = true;

    // Fresh dice — pick values that generate plenty of valid targets so the
    // mini-card strip isn't empty when the chip opens.
    gameDispatch({ type: 'TUTORIAL_SET_DICE', values: { die1: 2, die2: 3, die3: 4 } });

    // Full hand — mix of numbers + operators so the hand visually looks
    // "loaded" (per the user's spec: "הכפתור הירוק פועם... היד מלאה").
    const ts = Date.now();
    const playerHand = [
      { id: `tut-l6-num-5-${ts}`, type: 'number' as const, value: 5 },
      { id: `tut-l6-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
      { id: `tut-l6-num-6-${ts}`, type: 'number' as const, value: 6 },
      { id: `tut-l6-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
      { id: `tut-l6-num-9-${ts}`, type: 'number' as const, value: 9 },
    ];
    const botHand = [
      { id: `tut-l6-bot-num-5-${ts}`, type: 'number' as const, value: 5 },
      { id: `tut-l6-bot-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
      { id: `tut-l6-bot-num-6-${ts}`, type: 'number' as const, value: 6 },
      { id: `tut-l6-bot-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
      { id: `tut-l6-bot-num-9-${ts}`, type: 'number' as const, value: 9 },
    ];
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botHand, playerHand] });

    // Enable the ResultsChip (boot defaults it to false so it stays hidden
    // in L1–L5). Must be dispatched after the dice so validTargets is ready.
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });

    // Fill the EquationBuilder completely via the fan-demo channel. Stagger
    // the emissions slightly so the EquationBuilder's subscribe effect has
    // time to process each one (same pattern as L5b above). Both op slots
    // are set to `+` giving "2 + 3 + 4 = 9".
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 0 }), 120);
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqSetOp', which: 1, op: '+' }), 200);
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 1 }), 280);
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqSetOp', which: 2, op: '+' }), 360);
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 2 }), 440);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── Lesson 5a: when the learner cycles the `?` slot, publish the matching
  //    op card id prefix to tutorialBus so the fan can emphasize it. ──
  useEffect(() => {
    if (engine.lessonIndex !== 4 || engine.stepIndex !== 0) return;
    const unsubscribe = tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind !== 'opSelected' || evt.via !== 'cycle') return;
      const cardIdByOp: Record<'+' | '-' | 'x' | '÷', string> = {
        '+': 'tut-l5-op-plus',
        '-': 'tut-l5-op-minus',
        'x': 'tut-l5-op-times',
        '÷': 'tut-l5-op-divide',
      };
      tutorialBus.setEmphasizedCardId(cardIdByOp[evt.op]);
      setL5SelectedOp(evt.op);
    });
    return () => {
      unsubscribe();
      tutorialBus.setEmphasizedCardId(null);
    };
  }, [engine.lessonIndex, engine.stepIndex]);

  // ── L5.1 wrong-card feedback: when a non-`+` op card is placed in the slot,
  //    show an error bubble for 2s then revert to the normal hint. ──
  useEffect(() => {
    setL5PlaceWrong(false);
    if (l5PlaceWrongTimerRef.current) clearTimeout(l5PlaceWrongTimerRef.current);
    if (engine.lessonIndex !== 4 || engine.stepIndex !== 0 || engine.phase !== 'await-mimic') return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind !== 'l5OperatorPlaced' || evt.op === '+') return;
      setL5PlaceWrong(true);
      if (l5PlaceWrongTimerRef.current) clearTimeout(l5PlaceWrongTimerRef.current);
      l5PlaceWrongTimerRef.current = setTimeout(() => setL5PlaceWrong(false), 2000);
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── Lesson 5: pulse the `?` slot whenever nothing is selected yet so the
  //    learner's eye is drawn to the interactive spot. Stops the instant an
  //    op is chosen. useNativeDriver is intentionally FALSE: the pulse feeds
  //    interpolations that re-create per render (different outputRanges when
  //    the slot becomes filled). Native driver can't handle that churn safely
  //    — keeping the animation on the JS side avoids a native-graph crash. ──
  useEffect(() => {
    if (engine.lessonIndex !== 4) {
      l5SlotPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(l5SlotPulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(l5SlotPulse, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    loop.start();
    const sub = l5SlotPulse.addListener(({ value }) => {
      tutorialBus.setOpButtonPulse(value);
    });
    return () => {
      loop.stop();
      l5SlotPulse.removeListener(sub);
      tutorialBus.setOpButtonPulse(0);
    };
  }, [engine.lessonIndex, l5SlotPulse]);

  // ── Celebrate timer (longer if the step provides a custom message
  //    that the learner actually needs time to read). Dice lesson (idx 2)
  //    skips straight to the equation with zero delay. ──
  useEffect(() => {
    if (engine.phase !== 'celebrate') return;
    const lesson = LESSONS[engine.lessonIndex];
    const step = lesson?.steps[engine.stepIndex];
    // Dice lesson → equation: instant transition, no celebration pause.
    const ms = step?.celebrateKey ? 2600 : CELEBRATE_MS;
    const id = setTimeout(() => dispatchEngine({ type: 'CELEBRATE_DONE' }), ms);
    return () => clearTimeout(id);
  }, [engine.phase, engine.lessonIndex, engine.stepIndex]);

  // ── Pick the bubble copy for the current phase. ──
  const currentLesson = LESSONS[engine.lessonIndex];
  const currentStep = currentLesson?.steps[engine.stepIndex];
  const isL4Step3Await = engine.lessonIndex === 3 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
  // Lesson 4 step 3 uses a dynamic bubble: build → confirm → pick → play.
  const l4Step3HintKey: string | null = isL4Step3Await
    ? (l4Step3Phase === 'build' ? 'tutorial.l4c.hintFull'
       : l4Step3Phase === 'confirm' ? 'tutorial.l4c.hintPressConfirm'
       : l4Step3Phase === 'pick' ? 'tutorial.l4c.hintPickCards'
       : 'tutorial.l4c.hintPressPlay')
    : null;
  // Lesson 5 step 5b (joker-place, now stepIndex 1) dynamic bubble:
  // tap joker → pick → place.
  const isL5bAwait = engine.lessonIndex === 4 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
  const l5bHintKey: string | null = isL5bAwait
    ? (l5FlowHintPhase === 'pickModal' ? 'tutorial.l5b.hintPickInModal'
       : l5FlowHintPhase === 'placeSign' ? 'tutorial.l5b.hintPlaceSign'
       : 'tutorial.l5b.hintTapJoker')
    : null;
  // Three-phase hint for L5.1 (place-op):
  //   1. no card selected yet → "choose an op card that solves {{result}}"
  //   2. card selected (equationHandPick set) → "now press in the exercise to place it"
  //   3. wrong card placed → error message (auto-clears after 2s)
  const isL5PlaceAwait = engine.lessonIndex === 4 && engine.stepIndex === 0 && engine.phase === 'await-mimic';
  const L5A_TARGET_RESULT = 7;
  const l5PlaceHintKey: string | null = isL5PlaceAwait
    ? (l5PlaceWrong
        ? 'tutorial.l5op.wrong'
        : (gameState?.equationHandPick != null
            ? 'tutorial.l5a.hintPressEquation'
            : 'tutorial.l5a.hintChooseCard'))
    : null;
  const l5PlaceHintParams: Record<string, string> | undefined =
    l5PlaceHintKey === 'tutorial.l5a.hintChooseCard' ? { result: String(L5A_TARGET_RESULT) } : undefined;
  const bubbleText: string | null =
    engine.phase === 'post-signs-choice' || engine.phase === 'core-complete' ? null
    : engine.phase === 'bot-demo' ? (currentStep?.botHintKey ? t(currentStep.botHintKey) : t('tutorial.engine.botDemoLabel'))
    : engine.phase === 'await-mimic' ? (l4Step3HintKey ? t(l4Step3HintKey) : l5PlaceHintKey ? t(l5PlaceHintKey, l5PlaceHintParams) : l5bHintKey ? t(l5bHintKey) : (currentStep?.hintKey ? t(currentStep.hintKey) : t('tutorial.engine.yourTurnLabel')))
    : engine.phase === 'celebrate' ? (currentStep?.celebrateKey ? t(currentStep.celebrateKey) : t('tutorial.engine.celebrate'))
    // lesson-done has no bubble — celebrate already said its piece, and a
    // generic "you finished the lesson" right after every action is noise.
    : engine.phase === 'all-done' ? t('tutorial.engine.allDone')
    : null;
  const bubbleTone: 'demo' | 'turn' | 'celebrate' =
    engine.phase === 'celebrate' || engine.phase === 'lesson-done' || engine.phase === 'all-done' ? 'celebrate'
    : engine.phase === 'await-mimic' ? 'turn'
    : 'demo';

  // Fan strip lives at the bottom of the screen, height ≈ 140 (HAND_INNER
  // _HEIGHT + HAND_STRIP_ABOVE_FAN), bottom edge at HAND_BOTTOM_OFFSET (195).
  // Cards render with overflow:visible so they extend slightly outside the
  // strip; we anchor the isolation curtain ABOVE that visible bleed.
  const FAN_BOTTOM = 195;
  const FAN_STRIP_H = 140;
  const FAN_VISUAL_TOP_FROM_BOTTOM = FAN_BOTTOM + FAN_STRIP_H + 30; // 365 — leaves a clear margin above bleeding cards
  // Header column (top-left): red "יציאה" + טורניר + sound buttons stack
  // here, ~72px wide each + paddingHorizontal:12 + small buffer = ~100. Three
  // 32px buttons stacked at marginTop:-65 leaves the column ending around 110.
  const HEADER_COL_W = 100;
  const HEADER_COL_H = 110;
  // Lesson 2 (dice) exposes a vertical window in the middle/bottom area
  // covering both the gold dice button (~82–140 px from bottom) and the
  // equation area where the rolled dice land (~200–360 px from bottom).
  const DICE_WINDOW_BOTTOM = 60;
  const DICE_WINDOW_TOP_FROM_BOTTOM = 400;

  const isDiceLesson = engine.lessonIndex === 2;
  const isEquationLesson = engine.lessonIndex === 3;
  const isOpCycleLesson = engine.lessonIndex === 4;
  const isPossibleResultsLesson = engine.lessonIndex === 5;
  const isFracLesson = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX;
  // Bubble sits just above whatever window is exposed for this lesson.
  // For the dice lesson's initial hint ("נסו להטיל קוביות") we keep the
  // bubble at the previous lesson's position so it doesn't jump; only the
  // subsequent messages (celebrate / lesson-done) rise above the dice window.
  const diceHintShouldStayLow =
    isDiceLesson && (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
  const BUBBLE_BOTTOM = isDiceLesson && !diceHintShouldStayLow
    ? DICE_WINDOW_TOP_FROM_BOTTOM + 12
    : FAN_VISUAL_TOP_FROM_BOTTOM + 18;

  // ── Skip button: pushes the engine forward one phase. Lets us walk
  //    through the tutorial without performing every action. ──
  const skipForward = () => {
    switch (engine.phase) {
      case 'intro': dispatchEngine({ type: 'DISMISS_INTRO' }); break;
      case 'bot-demo': dispatchEngine({ type: 'BOT_DEMO_DONE' }); break;
      case 'await-mimic': dispatchEngine({ type: 'OUTCOME_MATCHED' }); break;
      case 'celebrate': dispatchEngine({ type: 'CELEBRATE_DONE' }); break;
      case 'lesson-done': dispatchEngine({ type: 'DISMISS_LESSON_DONE' }); break;
      case 'core-complete': dispatchEngine({ type: 'DISMISS_CORE_COMPLETE' }); break;
      case 'post-signs-choice': dispatchEngine({ type: 'CHOOSE_FINISH_TUTORIAL' }); break;
      case 'all-done': onExit(); break;
      default: break;
    }
  };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' }}>
      {/* Single-tone tutorial coverage — one opaque color (#0a1628) painted
          as contiguous bands around the lesson's focal "window". All bands
          bleed past the screen edges (top:-60, sides:-10, bottom:-60) so
          the coverage extends into notched/overscan areas. No semi-
          transparent wash — that created visible seams between bands.

          Windows left uncovered per lesson:
            • All non-equation lessons: top-left corner (0..HEADER_COL_W,
              0..HEADER_COL_H) for the game's red "יציאה" button.
            • Fan/tap lessons: bottom strip from FAN_VISUAL_TOP_FROM_BOTTOM
              down, so the card fan shows through.
            • Dice lesson: no bottom window — tutorial renders its own dice
              button on top, so coverage extends all the way down.
            • Equation lesson: no body coverage at all — the real game's
              EquationBuilder + PlayerHand + discard pile must be visible. */}

      {/* Top band removed — player chips, tournament, and other header
          elements are already gated by !state.isTutorial in the game
          components. No need for a covering rectangle that creates a
          visible seam in the upper-right corner. */}

      {/* Body band — spans full width (with side bleed), from the bottom of
          the header row down to either the top of the fan window or the
          bottom of the screen, depending on the lesson. */}
      {isDiceLesson ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: HEADER_COL_H,
            left: -10,
            right: -10,
            bottom: -60,
            backgroundColor: '#0a1628',
            zIndex: 9000,
          }}
        />
      ) : (isEquationLesson || isOpCycleLesson || isPossibleResultsLesson || isFracLesson) ? (
        null
      ) : (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: HEADER_COL_H,
            left: -10,
            right: -10,
            bottom: FAN_VISUAL_TOP_FROM_BOTTOM,
            backgroundColor: '#0a1628',
            zIndex: 9000,
          }}
        />
      )}

      {/* Dice lesson body — tutorial-owned button + dice display, matching
          the real game: button anchored at GOLD_ACTION_BUTTON_TOP (low on
          screen) and dice rendered as a row of framed gold faces in the
          equation-builder zone. */}
      {isDiceLesson ? (
        <>
          {/* Dice display — equation-builder style row, sits in the upper-
              middle of the canvas where the real builder lives. */}
          {tutorialDice ? (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: HEADER_COL_H + 110, left: 0, right: 0, alignItems: 'center', zIndex: 9100 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  direction: 'ltr',
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                {[tutorialDice.d1, tutorialDice.d2, tutorialDice.d3].map((v, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 14,
                      borderWidth: 2,
                      borderColor: 'rgba(232,184,48,0.4)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GoldDieFace value={v} size={52} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Gold dice button — same screen position as in the real game. */}
          {!tutorialDice ? (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: Math.max(96, Math.min(680, dims.height - 140)),
                left: 0,
                right: 0,
                alignItems: 'center',
                zIndex: 9100,
              }}
            >
              <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: -14,
                    right: -14,
                    bottom: -14,
                    borderRadius: 70,
                    borderWidth: 4,
                    borderColor: '#FCD34D',
                    opacity: dicePulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.95] }),
                    transform: [{ scale: dicePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
                  }}
                />
                <GoldDiceButton
                  onPress={() => {
                    void playDiceRollSound();
                    // Use the pre-generated L4 dice so the values match
                    // the equation lesson that follows.
                    const l4 = l4DiceRef.current ?? rollL4Dice();
                    setTutorialDice({ d1: l4.d1, d2: l4.d2, d3: l4.d3 });
                    // Advance the lesson regardless of where in bot-demo /
                    // await-mimic we are — the bus subscriber is only active
                    // during await-mimic, so dispatch OUTCOME_MATCHED directly
                    // when the user clicks early.
                    if (engine.phase === 'bot-demo') {
                      dispatchEngine({ type: 'BOT_DEMO_DONE' });
                      dispatchEngine({ type: 'OUTCOME_MATCHED' });
                    } else if (engine.phase === 'await-mimic') {
                      tutorialBus.emitUserEvent({ kind: 'diceRolled' });
                    }
                  }}
                  width={160}
                  size={58}
                />
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {/* Lesson 5 runs on the real game UI (EquationBuilder + hand).
          Step 5.1 (place-op) pre-fills the full equation + sets `+` on both
          operator slots; the learner drops an operation card on op1.
          Step 5.2 (joker-place) introduces Slinda the joker. */}

      {/* (Legacy solve-for-op puzzle kept commented out — the step was
          retired when the lesson was reduced to two screens.) */}
      {false ? (() => {
        const current = l5Exercises[l5ExIndex];
        if (!current) return null;
        const displayOp: L5Op | null = l5PendingJokerOp ?? l5SelectedOp;
        const liveResult = computeL5Result(current.a, current.b, displayOp);
        const confirmEnabled = displayOp !== null;
        const isCorrect = displayOp !== null && computeL5Result(current.a, current.b, displayOp) === current.result;
        const onConfirm = () => {
          if (!confirmEnabled) return;
          if (isCorrect) {
            const idx = l5ExIndex as 0 | 1;
            tutorialBus.emitUserEvent({ kind: 'l5OpSolveCorrect', exerciseIdx: idx });
            if (idx === 0) {
              // Advance to exercise 2 with a clean slot.
              setL5ExIndex(1);
              setL5SelectedOp(null);
              setL5PendingJokerOp(null);
              setL5JokerOpen(false);
            } else {
              // Both done — fire the step outcome.
              setL5ExIndex(2);
              tutorialBus.emitUserEvent({ kind: 'l5OpExercisesDone' });
            }
          } else {
            tutorialBus.emitUserEvent({ kind: 'l5OpSolveWrong' });
            setWrongAttemptTick((n) => n + 1);
          }
        };
        const onSlotTap = () => {
          // If a joker sign is pending, placing it in the slot commits it.
          if (l5PendingJokerOp !== null) {
            setL5SelectedOp(l5PendingJokerOp);
            setL5PendingJokerOp(null);
            return;
          }
          // Otherwise cycle through the four signs.
          const cur = l5SelectedOp;
          const idx = cur === null ? -1 : L5_CYCLE.indexOf(cur);
          const next = L5_CYCLE[(idx + 1) % L5_CYCLE.length];
          setL5SelectedOp(next);
        };
        const onOpCardTap = (op: L5Op) => {
          setL5SelectedOp(op);
          setL5PendingJokerOp(null);
        };
        return (
          <>
            {/* Dark cover over the real game body. */}
            <View
              pointerEvents="auto"
              style={{
                position: 'absolute',
                top: HEADER_COL_H,
                left: -10,
                right: -10,
                bottom: -60,
                backgroundColor: '#0a1628',
                zIndex: 9000,
              }}
            />
            {/* Exercise counter (e.g. "תרגיל 1 מתוך 2"). */}
            <View pointerEvents="none" style={{ position: 'absolute', top: HEADER_COL_H + 28, left: 0, right: 0, alignItems: 'center', zIndex: 9100 }}>
              <Text style={{ color: '#CBD5E1', fontSize: 13, fontWeight: '700' }}>
                {locale === 'he' ? `תרגיל ${l5ExIndex + 1} מתוך 2` : `Exercise ${l5ExIndex + 1} of 2`}
              </Text>
            </View>
            {/* Equation row: a [?] b = result */}
            <View
              pointerEvents="box-none"
              style={{ position: 'absolute', top: HEADER_COL_H + 70, left: 0, right: 0, alignItems: 'center', zIndex: 9100 }}
            >
              <View
                style={{
                  flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: 14,
                  paddingVertical: 18, paddingHorizontal: 24, borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <View
                  style={{
                    width: 62, height: 78, borderRadius: 14, borderWidth: 2,
                    borderColor: '#60A5FA', backgroundColor: '#EFF6FF',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 32, fontWeight: '900', color: '#1D4ED8' }}>{String(current.a)}</Text>
                </View>
                <TouchableOpacity activeOpacity={0.85} onPress={onSlotTap}>
                  <View
                    style={{
                      width: 62, height: 78, borderRadius: 14, borderWidth: 3,
                      borderColor: displayOp ? '#F97316' : '#FDE68A',
                      backgroundColor: displayOp ? '#FFF7ED' : 'rgba(253,230,138,0.12)',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 34, fontWeight: '900', color: displayOp ? '#EA580C' : '#FDE68A' }}>
                      {displayOp ?? '?'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View
                  style={{
                    width: 62, height: 78, borderRadius: 14, borderWidth: 2,
                    borderColor: '#60A5FA', backgroundColor: '#EFF6FF',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 32, fontWeight: '900', color: '#1D4ED8' }}>{String(current.b)}</Text>
                </View>
                <Text style={{ fontSize: 32, fontWeight: '900', color: '#FDE68A' }}>=</Text>
                <View
                  style={{
                    minWidth: 62, height: 78, paddingHorizontal: 14, borderRadius: 14, borderWidth: 2,
                    borderColor: '#34D399', backgroundColor: 'rgba(16,185,129,0.12)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 32, fontWeight: '900', color: '#A7F3D0' }}>
                    {String(current.result)}
                  </Text>
                </View>
              </View>
              {/* Live-result preview — shows what the current sign produces vs target. */}
              {displayOp !== null && liveResult !== null && liveResult !== current.result ? (
                <Text style={{ marginTop: 10, color: '#FCA5A5', fontSize: 14, fontWeight: '700' }}>
                  {locale === 'he' ? `עם הסימן הזה: ${liveResult}` : `With this sign: ${liveResult}`}
                </Text>
              ) : null}
            </View>
            {/* Op cards row + joker (all tappable). */}
            <View
              pointerEvents="box-none"
              style={{ position: 'absolute', top: HEADER_COL_H + 260, left: 0, right: 0, alignItems: 'center', zIndex: 9100 }}
            >
              <View style={{ flexDirection: 'row', direction: 'ltr', gap: 12, alignItems: 'center' }}>
                {(['+', '-', 'x', '÷'] as L5Op[]).map((op) => (
                  <TouchableOpacity key={op} activeOpacity={0.85} onPress={() => onOpCardTap(op)}>
                    <View
                      style={{
                        width: 56, height: 72, borderRadius: 12, borderWidth: 2,
                        borderColor: displayOp === op ? '#F59E0B' : '#F97316',
                        backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center',
                        transform: displayOp === op ? [{ scale: 1.08 }] : undefined,
                      }}
                    >
                      <Text style={{ fontSize: 28, fontWeight: '800', color: '#EA580C' }}>{op}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity activeOpacity={0.85} onPress={() => setL5JokerOpen(true)}>
                  <View
                    style={{
                      width: 56, height: 72, borderRadius: 12, borderWidth: 2, borderColor: '#EAB308',
                      backgroundColor: '#FEFCE8', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 20, color: '#CA8A04', fontWeight: '900' }}>★</Text>
                    <Text style={{ fontSize: 10, color: '#CA8A04', fontWeight: '800', marginTop: 2 }}>
                      {t('tutorial.l5.jokerLabel')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            {/* Confirm button. */}
            <View pointerEvents="box-none" style={{ position: 'absolute', top: HEADER_COL_H + 370, left: 0, right: 0, alignItems: 'center', zIndex: 9100 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onConfirm}
                disabled={!confirmEnabled}
                style={{
                  paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16,
                  backgroundColor: confirmEnabled ? '#F97316' : '#475569',
                  borderWidth: 2, borderColor: confirmEnabled ? '#FDE68A' : '#64748B',
                  opacity: confirmEnabled ? 1 : 0.7,
                }}
              >
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>
                  {t('game.buildingEquationNext')}
                </Text>
              </TouchableOpacity>
            </View>
            {/* Joker modal — reuse the same modal body as lesson 5b. Picking
                a sign sets `l5PendingJokerOp`; the learner then taps the slot
                to place it (or taps an op card directly). */}
            {l5JokerOpen ? (
              <View
                pointerEvents="auto"
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
                  zIndex: 9500,
                }}
              >
                <View
                  style={{
                    backgroundColor: '#0F172A', borderRadius: 22, paddingVertical: 22, paddingHorizontal: 26,
                    borderWidth: 2, borderColor: '#EAB308', minWidth: 260,
                  }}
                >
                  <Text style={{ color: '#FEF9C3', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>
                    {t('tutorial.l5.jokerPickTitle')}
                  </Text>
                  <View style={{ flexDirection: 'row', direction: 'ltr', gap: 10, justifyContent: 'center' }}>
                    {(['+', '-', 'x', '÷'] as L5Op[]).map((op) => (
                      <TouchableOpacity
                        key={op}
                        activeOpacity={0.85}
                        onPress={() => {
                          setL5JokerOpen(false);
                          setL5PendingJokerOp(op);
                          tutorialBus.emitUserEvent({ kind: 'opSelected', op, via: 'joker' });
                        }}
                        style={{
                          width: 54, height: 54, borderRadius: 12, backgroundColor: '#FFF7ED',
                          borderWidth: 2, borderColor: '#F97316', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 26, color: '#EA580C', fontWeight: '900' }}>{op}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={() => setL5JokerOpen(false)}
                    style={{ marginTop: 18, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10, backgroundColor: 'rgba(71,85,105,0.92)' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </>
        );
      })() : null}

      {/* The game's red "יציאה" button at top-left is uncovered by design;
          its onPress emits tutorialBus.requestExit() to leave the tutorial. */}

      {/* Exit + Skip + Back buttons — top-right. Exit always available so
          learners (or QA) can leave the tutorial at any point regardless of
          whether the underlying game's header exit button is reachable. */}
      <View style={{ position: 'absolute', top: 12, right: 12, zIndex: 9600, flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={() => {
            dispatchEngine({ type: 'EXIT' });
            onExit();
          }}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: 'rgba(185,28,28,0.95)',
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: 'rgba(254,202,202,0.85)',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{t('tutorial.engine.exitBtn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => dispatchEngine({ type: 'GO_BACK' })}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: 'rgba(71,85,105,0.92)',
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: 'rgba(148,163,184,0.7)',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{'‹ חזור'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={skipForward}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: 'rgba(15,118,110,0.92)',
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: 'rgba(94,234,212,0.85)',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
            {engine.phase === 'celebrate' ? 'הבנתי ›' : 'דלג ›'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* DEBUG: step number badge — visible so we can reference specific
          steps by number during review. REMOVE BEFORE PRODUCTION. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 48, right: 16, zIndex: 9700 }}>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FCD34D' }}>
          <Text style={{ color: '#FCD34D', fontSize: 14, fontWeight: '900' }}>
            {`${engine.lessonIndex + 1}.${engine.stepIndex + 1} [${engine.phase}]`}
          </Text>
        </View>
      </View>

      {/* Cheerful speech bubble — position depends on lesson + phase:
          • Dice lesson (3) bot-demo: bottom (matches lesson 2 height, smooth
            transition into the lesson).
          • Dice lesson (3) await-mimic/celebrate: top — so the rolled dice
            results remain visible in the middle of the screen.
          • Equation (4) / op-cycle (5) lessons: always top — the builder / UI
            occupies the middle.
          • Fan (1) / tap (2) lessons: always bottom — just above the fan. */}
      {bubbleText ? (() => {
        const bubbleAtTop =
          isEquationLesson ||
          isOpCycleLesson ||
          isPossibleResultsLesson ||
          isFracLesson ||
          (isDiceLesson && engine.phase !== 'bot-demo');
        return (
          <View
            pointerEvents="none"
            style={
              bubbleAtTop
                ? { position: 'absolute', top: 55, left: 16, right: 16, alignItems: 'center', zIndex: 9200 }
                : { position: 'absolute', bottom: BUBBLE_BOTTOM, left: 0, right: 0, alignItems: 'center', zIndex: 9200 }
            }
          >
            <HappyBubble text={bubbleText} tone={bubbleTone} arrowSize={bubbleAtTop ? 'small' : 'big'} />
          </View>
        );
      })() : null}

      {/* Lesson 4 (build equation) body is intentionally EMPTY here:
          the lesson is performed on the real game's EquationBuilder + fan.
          The tutorial only contributes the speech bubble + (later) highlights. */}

      {/* "Try again" bubble — shown briefly when the learner makes a wrong
          pick during await-mimic. Red-outlined and shaken horizontally so
          it's impossible to miss; the lesson stays put until the right
          answer is chosen. */}
      {wrongAttemptTick > 0 ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 210, left: 0, right: 0, alignItems: 'center', zIndex: 9500 }}
        >
          <Animated.View
            style={{
              transform: [{ translateX: wrongShakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }],
              backgroundColor: '#B91C1C',
              borderColor: '#FEE2E2',
              borderWidth: 3,
              borderRadius: 18,
              paddingVertical: 10,
              paddingHorizontal: 18,
              ...Platform.select({
                ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 8 },
                android: { elevation: 10 },
              }),
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', textAlign: 'center' }}>
              {locale === 'he' ? '✗ לא נכון — נסה שוב' : '✗ Not quite — try again'}
            </Text>
          </Animated.View>
        </View>
      ) : null}

      {/* (L5a wrong-tap amber ring + "tap the sign" bubble were removed
          when cycle-signs was retired — in the new L5.1 (place-op) flow,
          fan taps are the CORRECT first action.) */}

      {/* Green V flash when the bot taps the equation confirm button —
          centered on the measured confirm button (same rect as the hint arrow). */}
      {showConfirmCheck && isEquationLesson ? (() => {
        const CHECK = 70;
        const half = CHECK / 2;
        const r = confirmBtnRect;
        const wrapStyle = r
          ? {
              position: 'absolute' as const,
              top: r.top + r.height / 2 - half,
              left: r.left + r.width / 2 - half,
              width: CHECK,
              height: CHECK,
              zIndex: 9400,
            }
          : {
              position: 'absolute' as const,
              top: 500,
              left: 0,
              right: 0,
              alignItems: 'center' as const,
              zIndex: 9400,
            };
        return (
          <View pointerEvents="none" style={wrapStyle}>
            <Animated.View
              style={{
                width: CHECK,
                height: CHECK,
                borderRadius: half,
                backgroundColor: '#16A34A',
                borderWidth: 4,
                borderColor: '#FFF',
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: confirmCheckScale }],
                shadowColor: '#16A34A',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.95,
                shadowRadius: 18,
                elevation: 16,
              }}
            >
              <Text style={{ color: '#FFF', fontSize: 42, fontWeight: '900', lineHeight: 46 }}>{'✓'}</Text>
            </Animated.View>
          </View>
        );
      })() : null}

      {/* Lesson 4 step 3 arrow — horizontal yellow ➜ placed to the RIGHT of
          the target button, rotated 180° so it points LEFT back at the
          button. Container height MATCHES the button height so vertical
          centring lands on the button itself (not below it). */}
      {showArrow && (l4Step3Phase === 'confirm' ? confirmBtnRect : playCardsBtnRect) ? (
        <Animated.View
          pointerEvents="none"
          style={(() => {
            const rect = l4Step3Phase === 'confirm' ? confirmBtnRect! : playCardsBtnRect!;
            // Real button heights from GameScreen LulosButton — measured rect
            // can be taller (shadow / elevation), which vertically centers the
            // arrow too low if we use rect.height blindly.
            const btnH = l4Step3Phase === 'confirm' ? 48 : 54;
            const top = rect.top + Math.max(0, (rect.height - btnH) / 2);
            return {
              position: 'absolute',
              left: rect.left + rect.width + 4,
              top,
              width: 72,
              height: btnH,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9500,
              opacity: l4ArrowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
              transform: [
                { translateX: l4ArrowPulse.interpolate({ inputRange: [0, 1], outputRange: [14, -10] }) },
                { scale: l4ArrowPulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.94, 1.22, 0.94] }) },
              ],
            };
          })()}
        >
          <Text style={{ fontSize: 36, lineHeight: 36, color: '#FDE047', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6, transform: [{ rotate: '180deg' }] }}>➜</Text>
        </Animated.View>
      ) : null}

      {/* Core tutorial finished — celebratory "10 coins" popup that precedes
          the fractions-branch choice. Warm palette + coin emoji + single
          "הבנתי" button. Tapping it dispatches DISMISS_CORE_COMPLETE, which
          transitions the engine to post-signs-choice. */}
      {engine.phase === 'core-complete' ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9400,
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#78350F',
              borderRadius: 22,
              paddingVertical: 28,
              paddingHorizontal: 24,
              borderWidth: 3,
              borderColor: '#FACC15',
              maxWidth: 380,
              width: '100%',
              alignItems: 'center',
              shadowColor: '#FACC15',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 18,
              elevation: 10,
            }}
          >
            <Text style={{ color: '#FEF3C7', fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 14 }}>
              {t('tutorial.coreComplete.title')}
            </Text>
            <Text style={{ color: '#FDE68A', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 22 }}>
              {t('tutorial.coreComplete.body')}
            </Text>
            <TouchableOpacity
              onPress={() => dispatchEngine({ type: 'DISMISS_CORE_COMPLETE' })}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 36,
                borderRadius: 16,
                backgroundColor: '#F59E0B',
                borderWidth: 2,
                borderColor: '#FCD34D',
              }}
            >
              <Text style={{ color: '#431407', fontWeight: '900', fontSize: 17 }}>
                {t('tutorial.coreComplete.ack')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Optional fractions: choice after core tutorial */}
      {engine.phase === 'post-signs-choice' ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9400,
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#0F172A',
              borderRadius: 22,
              paddingVertical: 22,
              paddingHorizontal: 20,
              borderWidth: 2,
              borderColor: '#EAB308',
              maxWidth: 380,
              width: '100%',
            }}
          >
            <Text style={{ color: '#FEF9C3', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>
              {t('tutorial.fracBranch.title')}
            </Text>
            <Text style={{ color: '#E2E8F0', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 20 }}>
              {t('tutorial.fracBranch.body')}
            </Text>
            <TouchableOpacity
              onPress={() => dispatchEngine({ type: 'CHOOSE_ADVANCED_FRACTIONS' })}
              style={{ paddingVertical: 14, borderRadius: 16, backgroundColor: '#2563EB', marginBottom: 10 }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 16 }}>
                {t('tutorial.fracBranch.advancedBtn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => dispatchEngine({ type: 'CHOOSE_FINISH_TUTORIAL' })}
              style={{ paddingVertical: 14, borderRadius: 16, backgroundColor: '#475569' }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 16 }}>
                {t('tutorial.fracBranch.finishBtn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Fractions intro/theory: explicit Continue (outcome fracLessonAck) */}
      {isFracLesson && engine.phase === 'await-mimic' && engine.stepIndex <= 1 ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center', zIndex: 9350 }}
        >
          <TouchableOpacity
            onPress={() => tutorialBus.emitUserEvent({ kind: 'fracLessonAck' })}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 28,
              backgroundColor: '#059669',
              borderRadius: 16,
              borderWidth: 2,
              borderColor: '#6EE7B7',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{t('tutorial.engine.continueBtn')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* All-done: explicit "Exit & return" CTA — never auto-continues into a game */}
      {engine.phase === 'all-done' ? (
        <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', zIndex: 9300 }}>
          <TouchableOpacity
            onPress={onExit}
            style={{ paddingVertical: 14, paddingHorizontal: 32, backgroundColor: '#10B981', borderRadius: 20 }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{t('tutorial.engine.exitAndReturn')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}


