// ============================================================
// InteractiveTutorialScreen.tsx — Watch-and-mimic tutorial host.
// Boots a vs-bot game underneath (using the existing tutorial
// hand rigging), then floats cheerful speech bubbles narrating
// the bot demo and the user's turn. No mockup overlays — the
// real game UI does all the heavy lifting; we just talk.
// ============================================================

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Animated, Easing, Platform, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useLocale } from '../i18n/LocaleContext';
import { HappyBubble } from '../components/HappyBubble';
import { GoldDieFace } from '../../AnimatedDice';
import { GoldDiceButton } from '../../components/GoldDiceButton';
import { initializeSfx, isSfxMuted, setSfxMuted } from '../audio/sfx';
import { SlindaCoin } from '../../components/SlindaCoin';
import { generateTutorialHand } from './generateTutorialHand';
import { supabase } from '../lib/supabase';


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
  MIMIC_LAST_CORE_LESSON_INDEX,
  MIMIC_PARENS_LESSON_INDEX,
  MIMIC_IDENTICAL_LESSON_INDEX,
  MIMIC_SINGLE_IDENTICAL_LESSON_INDEX,
  MIMIC_MULTI_PLAY_LESSON_INDEX,
} from './MimicEngine';
import type { Card, Fraction } from '../../shared/types';
import { createBotDemonstrator } from './BotDemonstrator';
import { tutorialBus, type LayoutRect } from './tutorialBus';
import { LESSONS } from './lessons';

const LESSON_SHAPES = LESSONS.map((l) => ({ id: l.id, stepCount: l.steps.length }));

const CELEBRATE_MS = 900;
const LESSON_DONE_MS = 1400;

// Pool of parens exercises: all use op1=minus, op2=minus.
// parensLeft = (d1-d2)-d3, parensRight = d1-(d2-d3) = target.
const L7_EXERCISE_POOL: { d1: number; d2: number; d3: number; target: number }[] = [
  { d1: 6, d2: 2, d3: 1, target: 5 },
  { d1: 5, d2: 2, d3: 1, target: 4 },
  { d1: 6, d2: 3, d3: 2, target: 5 },
  { d1: 5, d2: 3, d3: 1, target: 3 },
  { d1: 6, d2: 3, d3: 1, target: 4 },
  { d1: 4, d2: 2, d3: 1, target: 3 },
];

const FRAC_KINDS: Fraction[] = ['1/2', '1/3'];

/** Scripted board for each optional-fractions tutorial step (see lesson-06). */
function buildFractionTutorialSetup(stepIndex: number, ts: number) {
  const dice = { die1: 2, die2: 3, die3: 5 };
  const discard12: Card = { id: `tut-frac-disc12-${ts}`, type: 'number', value: 12 };
  const half: Card = { id: `tut-frac-half-${ts}`, type: 'fraction', fraction: '1/2' };
  const third: Card = { id: `tut-frac-third-${ts}`, type: 'fraction', fraction: '1/3' };
  const botMirror = (hand: Card[]) => hand.map((c, i) => ({ ...c, id: `bot-${c.id}-${i}` }));

  if (stepIndex === 0) {
    // Step 0 (frac-intro): spotlight intro screen — fractions last in hand so
    // they appear prominent/front in the fan. Sign card adds visual variety.
    // Pile = 5 (prime) so accidental fraction taps are blocked by the intercept.
    const discard5: Card = { id: `tut-frac-disc5-${ts}`, type: 'number', value: 5 };
    const signPlus: Card = { id: `tut-sign-plus-${ts}`, type: 'operation', operation: '+' };
    const ph: Card[] = [{ id: `tut-n4-${ts}`, type: 'number', value: 4 }, { id: `tut-n8-${ts}`, type: 'number', value: 8 }, signPlus, third, half];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'building' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard5],
        dice,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  if (stepIndex === 1) {
    // Step 1 (attack-half): random even number NOT divisible by 3.
    const halfOpts = [4, 8, 10, 14, 16, 20, 22];
    const halfVal = halfOpts[Math.floor(Math.random() * halfOpts.length)];
    const discard8: Card = { id: `tut-frac-disc8-${ts}`, type: 'number', value: halfVal };
    // half last → appears at the front (prominent) of the fan
    const ph: Card[] = [third, { id: `tut-n5-${ts}`, type: 'number', value: 5 }, { id: `tut-n7-${ts}`, type: 'number', value: 7 }, { id: `tut-n8-${ts}`, type: 'number', value: 8 }, half];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'building' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard8],
        dice,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  if (stepIndex === 2) {
    // Step 2 (attack-third): random odd multiple of 3 (not divisible by 2).
    const thirdOpts = [9, 15, 21];
    const thirdVal = thirdOpts[Math.floor(Math.random() * thirdOpts.length)];
    const discard9: Card = { id: `tut-frac-disc9-${ts}`, type: 'number', value: thirdVal };
    const ph: Card[] = [half, third, { id: `tut-n4-${ts}`, type: 'number', value: 4 }, { id: `tut-n6-${ts}`, type: 'number', value: 6 }, { id: `tut-n9-${ts}`, type: 'number', value: 9 }];
    return {
      type: 'TUTORIAL_FRACTION_SETUP' as const,
      slice: {
        currentPlayerIndex: 1,
        phase: 'building' as const,
        hands: [botMirror(ph), ph],
        discardPile: [discard9],
        dice,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: true,
        fractionKinds: [...FRAC_KINDS],
      },
    };
  }
  if (stepIndex === 3) {
    const fracOnPile: Card = { id: `tut-frac-pile-half-${ts}`, type: 'fraction', fraction: '1/2' };
    // Mix: 4 and 8 are valid (÷2), 5 and 7 are invalid distractors.
    const ph: Card[] = [
      { id: `tut-d5-${ts}`, type: 'number', value: 5 },
      half,
      { id: `tut-d4-${ts}`, type: 'number', value: 4 },
      { id: `tut-d7-${ts}`, type: 'number', value: 7 },
      third,
      { id: `tut-d8-${ts}`, type: 'number', value: 8 },
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
  if (stepIndex === 4) {
    const fracOnPile: Card = { id: `tut-frac-pile-third-${ts}`, type: 'fraction', fraction: '1/3' };
    // Mix: 9 and 6 are valid (÷3), 5 and 8 are invalid distractors.
    const ph: Card[] = [
      { id: `tut-d8b-${ts}`, type: 'number', value: 8 },
      third,
      { id: `tut-d9-${ts}`, type: 'number', value: 9 },
      { id: `tut-d5b-${ts}`, type: 'number', value: 5 },
      half,
      { id: `tut-d6b-${ts}`, type: 'number', value: 6 },
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
  if (stepIndex === 5) {
    // Bonus step: fraction cards + number distractors. Only fraction tap completes the step.
    const fracOnPile: Card = { id: `tut-frac-pile-half-b-${ts}`, type: 'fraction', fraction: '1/2' };
    const ph: Card[] = [
      { id: `tut-b3-${ts}`, type: 'number', value: 3 },
      half,
      { id: `tut-b7-${ts}`, type: 'number', value: 7 },
      third,
      { id: `tut-b5-${ts}`, type: 'number', value: 5 },
      { id: `tut-b9-${ts}`, type: 'number', value: 9 },
      { id: `tut-b11-${ts}`, type: 'number', value: 11 },
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

/** Board rig for lesson 9 (mini copy).
 *  Building state with all operators, mini-strip available, red chip hidden
 *  until the learner taps a mini card. */
function buildMiniCopyTutorialSetup(ts: number) {
  // Pile: value 5 — matches the most common parens-right result (6−(2−1)=5).
  const pileTop: Card = { id: `tut-l9-top-${ts}`, type: 'number', value: 5 };
  // Hand: each likely equation result has BOTH a single card AND a 2-card combo.
  //   result 5: card 5 alone  OR  2+3=5
  //   result 7: card 7 alone  OR  3+4=7
  //   result 9: card 9 alone  OR  4+5=9 / 2+7=9
  //   result 3: card 3 alone  OR  2+1 (covered by 2 and 3)
  const hand: Card[] = [
    { id: `tut-l9-num-5-${ts}`, type: 'number', value: 5 },
    { id: `tut-l9-num-2-${ts}`, type: 'number', value: 2 },
    { id: `tut-l9-num-3-${ts}`, type: 'number', value: 3 },
    { id: `tut-l9-num-7-${ts}`, type: 'number', value: 7 },
    { id: `tut-l9-num-4-${ts}`, type: 'number', value: 4 },
    { id: `tut-l9-num-9-${ts}`, type: 'number', value: 9 },
  ];
  const botMirror = (h: Card[]) => h.map((c, i) => ({ ...c, id: `bot-${c.id}-${i}` }));
  return {
    type: 'TUTORIAL_FRACTION_SETUP' as const,
    slice: {
      currentPlayerIndex: 1,
      phase: 'building' as const,
      hands: [botMirror(hand), hand],
      discardPile: [pileTop],
      dice: { die1: 6, die2: 2, die3: 1 },
      pendingFractionTarget: null,
      fractionPenalty: 0,
      fractionAttackResolved: false,
      showFractions: false,
      fractionKinds: [] as const,
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
// card. For L4.3 the hint reads "pick one card OR several whose sum
// matches the result" — so the hand MUST contain BOTH the single target
// card AND a distinct pair of cards summing to target. If the dice roll
// makes a distinct pair impossible (target=2 requires 1+1, same value),
// we re-roll until both options are guaranteed.
function rollL4Dice(): {
  d1: number; d2: number; d3: number;
  pickA: number; pickB: number; target: number;
  hand: number[]; validSums: number[];
} {
  // Re-roll until the chosen target supports a DISTINCT pair (two cards
  // with different values that sum to target). Only failure case is
  // target < 3, which happens when the two picked dice are both 1.
  let d1 = 0, d2 = 0, d3 = 0;
  let pickA = 0, pickB = 0, target = 0;
  let attempts = 0;
  while (attempts < 20) {
    attempts += 1;
    d1 = Math.floor(Math.random() * 6) + 1;
    d2 = Math.floor(Math.random() * 6) + 1;
    d3 = Math.floor(Math.random() * 6) + 1;
    const sums: [number, number, number][] = [
      [0, 1, d1 + d2],
      [0, 2, d1 + d3],
      [1, 2, d2 + d3],
    ];
    const sorted = [...sums].sort((a, b) => Math.abs(a[2] - 7) - Math.abs(b[2] - 7));
    [pickA, pickB, target] = sorted[0];
    if (target >= 3) break;
  }
  const sums: [number, number, number][] = [
    [0, 1, d1 + d2],
    [0, 2, d1 + d3],
    [1, 2, d2 + d3],
  ];
  // Hand must contain ALL valid equation results — 2-die AND 3-die sums —
  // so the learner always finds a matching card no matter how they build.
  const threeSum = d1 + d2 + d3;
  const validSums = [...new Set([...sums.map((s) => s[2]), threeSum])];
  const hand = new Set<number>(validSums);
  // Guaranteed distinct pair (pairA, pairB) where pairA + pairB = target.
  // For target ≥ 3 we can always pick pairA in [1..floor((target-1)/2)] so
  // pairB = target - pairA is different from pairA. Both values stay
  // within [1..12] because target ≤ 12 (two dice each ≤ 6).
  const maxPairA = Math.floor((target - 1) / 2);
  const pairA = 1 + Math.floor(Math.random() * maxPairA);
  const pairB = target - pairA;
  hand.add(pairA);
  hand.add(pairB);
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
  // Measured rects of the "אשר את התרגיל" / "בחרתי" buttons — updated by the
  // real game UI via tutorialBus.setLayout.
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
  // Random dice for L5.1+L5.2 — generated once per lesson entry.
  const l5DiceRef = useRef<{ d1: number; d2: number; d3: number }>({ d1: 4, d2: 3, d3: 9 });
  // L5.1 wrong-card feedback: shown 2s then auto-cleared.
  const [l5PlaceWrong, setL5PlaceWrong] = useState(false);
  const l5PlaceWrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // L5.2 wrong-sign feedback: shown 2s when Slinda is placed with wrong op.
  const [l5JokerWrong, setL5JokerWrong] = useState(false);
  const l5JokerWrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const l5SlotPulse = useRef(new Animated.Value(0)).current;
  // Fractions lesson — pulse halo around the discard pile so the learner's
  // eye lands on the pile card (8 → 9 → fraction attack → fraction attack)
  // before reading the bubble.
  const fracPilePulse = useRef(new Animated.Value(0)).current;
  const fracArrowPulse = useRef(new Animated.Value(0)).current;
  // Frac-intro two-stage flow: 0 = pile label, 1 = lesson bubble.
  const [fracIntroStage, setFracIntroStage] = useState<0 | 1>(0);
  // Frac-defense intro: 0 = defense concept bubble, 1 = practice.
  const [fracDefenseIntroStage, setFracDefenseIntroStage] = useState<0 | 1>(0);
  // Bonus defense step: 0 = "הידעת?" info, 1 = practice (only fraction).
  const [fracBonusStage, setFracBonusStage] = useState<0 | 1>(0);
  // Tracks whether user chose a fraction card in each defense step.
  const fracDefenseUsedFractionRef = useRef<{ step3: boolean; step4: boolean }>({ step3: false, step4: false });
const [l5FlowHintPhase, setL5FlowHintPhase] = useState<'tapJoker' | 'pickModal' | 'placeSign'>('tapJoker');
  // L6.2 (tap-mini) await-mimic: "הבנתי" button appears ~1.5s after the hint
  // bubble so the learner has time to read "לחצו על מיני קלף" before the button shows.
  const [showL6TapMiniAck, setShowL6TapMiniAck] = useState(false);
  // L6.3 mismatch feedback: shown 2s when confirmed equation doesn't match the red chip.
  const [l6Mismatch, setL6Mismatch] = useState(false);
  // L7 (parens-move) mismatch feedback: shown 2.5s when confirmed equation
  // doesn't match the target (wrong parens position or wrong result).
  const [l7Mismatch, setL7Mismatch] = useState(false);
  const l7MismatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Frac-lesson bot-demo rig: tracks which stepIndex was last rigged so we
  // don't double-rig on re-renders. -1 means nothing rigged yet.
  const fracBotDemoRiggedRef = useRef(-1);
  // L7 rigged flag: prevents double-rigging on re-render during bot-demo.
  const l7RiggedRef = useRef(false);
  const l7ExerciseRef = useRef(L7_EXERCISE_POOL[0]);
  const l7LastExerciseIdxRef = useRef(-1);
  const l7CompletedExercisesRef = useRef(0);
  const [l7CompletedExercises, setL7CompletedExercises] = useState(0);
  // True from the moment exercise 1 confirms until the game phase reaches 'building'.
  // Blocks exercise-2 confirm from firing on the same 'solved' render cycle.
  const l7WaitingForBuildingRef = useRef(false);
  const l9LastExerciseIdxRef = useRef(-1);
  // L9 (mini-copy) mismatch feedback.
  const [l9Mismatch, setL9Mismatch] = useState(false);
  const [l9Stage, setL9Stage] = useState<0 | 1 | 2>(0);
  const l9MismatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const l9RiggedRef = useRef(false);
  const l10RiggedRef = useRef(false);
  const l10LastDiscardRef = useRef(-1);
  const l11RiggedRef = useRef(false);
  const l11LastResultRef = useRef(-1);
  const l11AwaitRiggedRef = useRef(false);
  const [l7FanHintHidden, setL7FanHintHidden] = useState(false);
  // L7 two-stage intro: 0=info bubble, 1=happy bubble+arrow, 2=gameplay.
  const [parensIntroStage, setParensIntroStage] = useState<0 | 1 | 2>(0);
  const [parensMockupApproved, setParensMockupApproved] = useState(false);
  const [parensMockupPendingAdvance, setParensMockupPendingAdvance] = useState(false);
  const [l9IntroApproved, setL9IntroApproved] = useState(false);
  const [l9IntroPendingAdvance, setL9IntroPendingAdvance] = useState(false);
  // Skip counter: counts presses of "דלג" during bot-demo or await-mimic phases
  // (the two phases where the learner is expected to watch or act). If > 2,
  // the core-complete popup shows "no coins" instead of the 10-coin reward.
  const [skipCount, setSkipCount] = useState(0);
  const [showWelcomeBubble, setShowWelcomeBubble] = useState(true);
  // Persistent count of tutorial runs where coins were actually earned.
  // Caps at 2 — registered-user infrastructure: once a user has earned
  // tutorial coins twice, subsequent completions show "no coins".
  const TUTORIAL_COINS_KEY = 'lulos_tutorial_coins_earned_count';
  const [tutorialCoinsEarnedCount, setTutorialCoinsEarnedCount] = useState(0);
  const coreCompleteProcessedRef = useRef(false);
  useEffect(() => {
    void AsyncStorage.getItem(TUTORIAL_COINS_KEY).then((val) => {
      const n = parseInt(val ?? '0', 10);
      setTutorialCoinsEarnedCount(isNaN(n) ? 0 : n);
    });
  }, []);
  useEffect(() => {
    if (engine.phase === 'idle') coreCompleteProcessedRef.current = false;
  }, [engine.phase]);
  useEffect(() => {
    if (engine.phase !== 'core-complete') return;
    if (coreCompleteProcessedRef.current) return;
    coreCompleteProcessedRef.current = true;
    if (skipCount > 2) return;
    setTutorialCoinsEarnedCount((prev) => {
      if (prev >= 2) return prev;
      const next = prev + 1;
      void AsyncStorage.setItem(TUTORIAL_COINS_KEY, String(next));
      void supabase.rpc('award_coins', { p_amount: 10, p_source: 'tutorial_core' });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.phase]);

  // ── Advanced-tutorial completion: award 20 coins when all advanced lessons done ──
  const advancedCompleteProcessedRef = useRef(false);
  useEffect(() => {
    if (engine.phase === 'idle') advancedCompleteProcessedRef.current = false;
  }, [engine.phase]);
  useEffect(() => {
    if (engine.phase !== 'advanced-complete') return;
    if (advancedCompleteProcessedRef.current) return;
    advancedCompleteProcessedRef.current = true;
    if (skipCount > 2) return;
    setTutorialCoinsEarnedCount((prev) => {
      const next = prev + 1;
      void AsyncStorage.setItem(TUTORIAL_COINS_KEY, String(next));
      void supabase.rpc('award_coins', { p_amount: 20, p_source: 'tutorial_advanced' });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.phase]);

  const l6MismatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Learner's hand at index 0 (currentPlayerIndex during L5) so the fan
    // always shows the learner's own cards.
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [playerHand, botHand] });
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

  // ── Auto-dismiss the intro phase — but only after the welcome screen is confirmed. ──
  useEffect(() => {
    if (engine.phase !== 'intro') return;
    if (showWelcomeBubble) return;
    dispatchEngine({ type: 'DISMISS_INTRO' });
  }, [engine.phase, showWelcomeBubble]);

  // ── External exit request (game's own red "יציאה" header button) ──
  useEffect(() => {
    return tutorialBus.subscribeRequestExit(() => {
      dispatchEngine({ type: 'EXIT' });
      onExit();
    });
  }, [onExit]);

  // ── lesson-done is invisible — celebrate already announced success.
  //    Progress to the next lesson immediately. ──
  useEffect(() => {
    if (engine.phase !== 'lesson-done') return;
    dispatchEngine({ type: 'DISMISS_LESSON_DONE' });
  }, [engine.phase, engine.lessonIndex]);

  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) {
      l7CompletedExercisesRef.current = 0;
      setL7CompletedExercises(0);
    }
  }, [engine.lessonIndex]);

  // ── Clear card frames + reset all tutorial state whenever a new step
  //    begins (phase=intro). This handles lesson transitions, GO_BACK,
  //    and ensures refs are re-armed so the lesson can boot fresh. ──
  useEffect(() => {
    if (engine.phase !== 'intro') return;
    const isFracLesson =
      engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    tutorialBus.emitFanDemo({ kind: 'clearCardFrame' });
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    if (isFracLesson) {
      tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
      gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: false });
    }
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
    // If GO_BACK left the game in turn-transition, push it forward so the
    // equation builder becomes visible again. Calling BEGIN_TURN from
    // 'building' would wrongly advance the turn and hide the equation —
    // so we only trigger this when already in turn-transition.
    if (!isFracLesson && gameState?.phase === 'turn-transition') {
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
    if (engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX) {
      // Clear stale copy-config on back navigation.
      // Full game state setup is handled by the bot-demo rigging effect.
      tutorialBus.setL6CopyConfig(null);
    } else if (isFracLesson) {
      gameDispatch(buildFractionTutorialSetup(engine.stepIndex, Date.now()));
    }
  }, [engine.phase, engine.lessonIndex, engine.stepIndex, gameState?.phase, gameDispatch]);

  // ── Frac-lesson steps 1+: rig game state at bot-demo entry.
  //    The MimicEngine goes celebrate → bot-demo (stepIndex+1) directly,
  //    skipping intro, so the intro effect above never fires for steps 1+.
  //    Step 0 is already handled by the intro effect above — skip it here. ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_FIRST_FRACTION_LESSON_INDEX) {
      fracBotDemoRiggedRef.current = -1;
      return;
    }
    if (engine.phase !== 'bot-demo') {
      fracBotDemoRiggedRef.current = -1;
      return;
    }
    if (engine.stepIndex === 0) return;
    if (fracBotDemoRiggedRef.current === engine.stepIndex) return;
    fracBotDemoRiggedRef.current = engine.stepIndex;
    gameDispatch(buildFractionTutorialSetup(engine.stepIndex, Date.now()));
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

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
    // Don't auto-advance during any post-core lesson celebrate — the rig
    // restores game state when the engine leaves celebrate. Firing BEGIN_TURN
    // here would move to pre-roll while the celebrate bubble is still showing.
    if (
      engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.phase === 'celebrate'
    ) return;
    gameDispatch({ type: 'BEGIN_TURN' });
  }, [gameState?.isTutorial, gameState?.phase, engine.lessonIndex, engine.phase, gameDispatch]);

  // ── Identical-card lesson: auto-dismiss the identicalAlert modal so the
  //    tutorial never shows the "player X placed card Y" overlay. ──
  useEffect(() => {
    if (!gameState?.identicalAlert) return;
    if (
      engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX &&
      engine.lessonIndex !== MIMIC_SINGLE_IDENTICAL_LESSON_INDEX
    ) return;
    gameDispatch({ type: 'DISMISS_IDENTICAL_ALERT' });
  }, [gameState?.identicalAlert, engine.lessonIndex, gameDispatch]);

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
      if (
        engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
        engine.stepIndex === 0 &&
        !parensMockupApproved
      ) {
        setParensMockupPendingAdvance(true);
        return;
      }
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
  }, [engine.phase, engine.lessonIndex, engine.stepIndex, parensMockupApproved]);

  // ── Listen for user mimic when phase=await-mimic ──
  useEffect(() => {
    if (engine.phase !== 'await-mimic') return;
    const lesson = LESSONS[engine.lessonIndex];
    const step = lesson?.steps[engine.stepIndex];
    if (!step) return;
    const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 3;
    // Lesson 5 is a two-step placement lesson — fan taps are always the
    // intended first action (pick an operator card in 5.1, tap the joker
    // in 5.2), so they should NEVER trigger the "wrong answer" shake.
    const isL5 = engine.lessonIndex === 4;
    // Lesson 7 (fractions): card taps flow through a separate validator
    // that emits `fracAttackPlayed`/`fracDefenseSolved` on success — the
    // raw `cardTapped` event fires either way, so suppressing the shake
    // prevents a "try again" flash on what turned out to be a legal play.
    const isL7 = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (step.outcome(evt)) {
        dispatchEngine({ type: 'OUTCOME_MATCHED' });
        return;
      }
      // Lesson-4 step-3 taps are staging actions, not "wrong answers" — the
      // step advances when the learner hits "בחרתי", so suppress the shake.
      if (isL4Step3) return;
      if (isL5) return;
      if (isL7) return;
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
    const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 3 && engine.phase === 'await-mimic';
    if (isL4Step3) {
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      tutorialBus.setL4Step3Mode(true);
      setL4Step3Phase('build');
      return () => tutorialBus.setL4Step3Mode(false);
    }
    tutorialBus.setL4Step3Mode(false);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // Keep botDemoActive in sync so index.tsx can block number-card taps mid-demo.
  useEffect(() => {
    tutorialBus.setBotDemoActive(engine.phase === 'bot-demo');
    return () => tutorialBus.setBotDemoActive(false);
  }, [engine.phase]);

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
  // `setL5aTargetResult` pushes the target (d1+d2) into the result box so
  // both steps show the same goal: sign slot empty, target `= d1+d2`.
  // Note: this effect fires before the L5 rigging effect (declaration order),
  // so it reads the PREVIOUS run's l5DiceRef values. The L5 rigging corrects
  // this immediately after by calling setL5aTargetResult with the fresh dice.
  useEffect(() => {
    const on =
      engine.lessonIndex === 4 &&
      engine.stepIndex <= 1 &&
      (engine.phase === 'bot-demo' || engine.phase === 'await-mimic' || engine.phase === 'celebrate');
    // Step 0 is now pre-filled via explicit eqPickDice+eqSetOp emits in the
    // rigging block — diceUnlocked stays false so the self-prefill effect
    // in index.tsx does not interfere (it would clear the slots on re-run).
    const diceUnlocked = false;
    tutorialBus.setL5aBlockFanTaps(on);
    tutorialBus.setL5aDiceUnlocked(diceUnlocked);
    tutorialBus.setL5aTargetResult(on ? (l5DiceRef.current.d1 + l5DiceRef.current.d2) : null);
    return () => {
      tutorialBus.setL5aBlockFanTaps(false);
      tutorialBus.setL5aDiceUnlocked(false);
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
    const isFrac =
      engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    const on =
      isFrac &&
      engine.phase !== 'post-signs-choice' &&
      engine.phase !== 'core-complete' &&
      engine.phase !== 'all-done' &&
      engine.phase !== 'idle';
    tutorialBus.setFracGuidedMode(on);
    return () => tutorialBus.setFracGuidedMode(false);
  }, [engine.lessonIndex, engine.phase]);

  // Lesson 7 (parens-move) guided mode — suppress auto-confirm while
  // parensRight=false and pulse the parens toggle button.
  useEffect(() => {
    // L7GuidedMode covers the full parens lesson (all phases) so the green
    // results-chip never pulses while the parens exercise is shown.
    const on = engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX;
    tutorialBus.setL7GuidedMode(on);
    return () => tutorialBus.setL7GuidedMode(false);
  }, [engine.lessonIndex, engine.phase]);

  // Parens lesson: tutorial boot uses enabledOperators=['+'] only — keep all
  // four signs allowed in game state for validTargets + hasError, including
  // after bot-demo → await-mimic (not only inside the one-shot rig effect).
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) return;
    if (engine.phase !== 'bot-demo' && engine.phase !== 'await-mimic') return;
    gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+', '-', 'x', '÷'] });
  }, [engine.lessonIndex, engine.phase, gameDispatch]);

  // Fractions lesson: keep possible-results chip hidden and closed throughout.
  useEffect(() => {
    const inFractionsLesson =
      engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!inFractionsLesson) return;
    tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: false });
  }, [engine.lessonIndex, engine.phase, engine.stepIndex, gameDispatch]);

  // Pulse halo around the discard pile while in the fractions lesson — keeps
  // the learner's attention on the pile card (the teaching target) across
  // all attack/defense steps.
  useEffect(() => {
    if (engine.lessonIndex < MIMIC_FIRST_FRACTION_LESSON_INDEX ||
        engine.lessonIndex >= MIMIC_PARENS_LESSON_INDEX) {
      fracPilePulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fracPilePulse, { toValue: 1, duration: 480, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(120),
        Animated.timing(fracPilePulse, { toValue: 0, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [engine.lessonIndex, fracPilePulse]);

  // Fractions lesson: re-rig the pile + hand on EVERY step transition. The
  // generic `intro` useEffect above only fires once per lesson entry, but
  // our fractions steps expect different pile cards per step (step 2
  // wants 8, step 3 wants 9, steps 4-5 swap the pile for defense setups).
  // Without this, the learner stays on the step-0 pile (12) while the
  // bubble text references the step-specific value.
  const lastFracRigRef = useRef<string>('');
  useEffect(() => {
    if (engine.lessonIndex < MIMIC_FIRST_FRACTION_LESSON_INDEX ||
        engine.lessonIndex >= MIMIC_PARENS_LESSON_INDEX) {
      lastFracRigRef.current = '';
      return;
    }
    if (engine.phase !== 'bot-demo') return;
    const key = `${engine.lessonIndex}-${engine.stepIndex}`;
    if (lastFracRigRef.current === key) return;
    lastFracRigRef.current = key;
    gameDispatch(buildFractionTutorialSetup(engine.stepIndex, Date.now()));
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

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

  // ── L5.2 wrong-sign feedback: when Slinda is placed with a non-`+` op,
  //    clear the slot, reset the flow hint, and show an error bubble for 2s. ──
  useEffect(() => {
    setL5JokerWrong(false);
    if (l5JokerWrongTimerRef.current) clearTimeout(l5JokerWrongTimerRef.current);
    if (engine.lessonIndex !== 4 || engine.stepIndex !== 1 || engine.phase !== 'await-mimic') return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind !== 'l5JokerFlowCompleted' || evt.op === '+') return;
      setL5JokerWrong(true);
      setL5FlowHintPhase('tapJoker');
      gameDispatch({ type: 'CLEAR_EQ_HAND' });
      if (l5JokerWrongTimerRef.current) clearTimeout(l5JokerWrongTimerRef.current);
      l5JokerWrongTimerRef.current = setTimeout(() => setL5JokerWrong(false), 2000);
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

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
    const isL4Step3 = engine.lessonIndex === 3 && engine.stepIndex === 3 && engine.phase === 'await-mimic';
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
    // During intro the refs are reset by the global intro effect — don't rig yet.
    if (engine.phase === 'intro' || engine.phase === 'idle') return;
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
    // Re-entry after GO_BACK (same lesson or cross-lesson): game is already
    // in 'building' — just re-rig so dice/hand match the current l4DiceRef.
    if (gameState.phase === 'building' && !eqLessonHandRiggedRef.current) {
      eqLessonHandRiggedRef.current = true;
      rigL4();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex, engine.phase, gameState?.phase, gameState?.players, gameDispatch]);

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
      const d1 = 2 + Math.floor(Math.random() * 7); // 2..8
      const d2 = 1 + Math.floor(Math.random() * (d1 - 1)); // 1..d1-1, so d1>d2≥1
      const d3Cands = [1,2,3,4,5,6,7,8,9].filter(n => n !== d1 && n !== d2 && n !== d1 + d2);
      const d3 = d3Cands[Math.floor(Math.random() * d3Cands.length)] ?? 9;
      l5DiceRef.current = { d1, d2, d3 };
      // Correct the result-box target now that the ref has the fresh dice
      // (the setL5aBlockFanTaps effect above fired first with stale values).
      tutorialBus.setL5aTargetResult(d1 + d2);
      gameDispatch({ type: 'ROLL_DICE', values: { die1: d1, die2: d2, die3: d3 } });
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
      // Same swap rationale as L5b: put learner's hand at index 0 (= currentPlayerIndex
      // at L5 entry) so the fan shows the learner's own cards, not the bot's.
      gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [playerHand, botHand] });
      // Pre-fill d1 and d2 so the equation shows `d1 [?] d2 = target`.
      // The operator slot is intentionally left empty — the learner picks
      // the `+` card from the fan and drops it on the empty slot.
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 0 }), 140);
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 1 }), 280);
    }
  }, [engine.lessonIndex, engine.phase, gameState?.phase, gameState?.players, gameDispatch]);

  // ── Lesson 5.1 (place-op): dice slots + operator `+` are pre-filled in the
  //    rigging block above (eqPickDice × 2 + eqSetOp). The self-prefill effect
  //    in index.tsx is no longer needed for step 0 — it only ran for step 0
  //    previously, but now the explicit emits handle it. Previously the equation
  //    started empty; the user reported "המישוואה לא מלאה ושואלת שאלה".
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
      // Swap so the learner's hand (with Slinda at index 2) lands at
      // currentPlayerIndex (which is 0 at L5b entry — the previous turn
      // belonged to the learner/player-1, so endTurnLogic advanced to
      // player-0). The fan always shows hands[currentPlayerIndex]; putting
      // the learner's joker there prevents the bot's ghost joker from
      // appearing in the fan and triggering a broken card-tap path.
      gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [playerHand, botHand] });
      // Keep the rigged hand order as-is — the default sort would push
      // Slinda to the end (operations before jokers), but we rigged her at
      // the centre index 2 on purpose. Flag is cleared when the lesson/step
      // changes (see the cleanup effect right below this one).
      tutorialBus.setTutorialPreserveHandOrder(true);
      // Slinda is centred by the bot demo's immediate scrollFanTo(2, durationMs:0)
      // at the start of botDemo — no separate setTimeout needed here.
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 0 }), 140);
      setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 1 }), 280);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── Clear the "preserve hand order" flag when leaving L5.2. The flag is
  //    set inside the L5.2 rigging block above. Without this, Slinda would
  //    stay pinned to the middle of the fan even in later lessons. ──
  useEffect(() => {
    const inL5b = engine.lessonIndex === 4 && engine.stepIndex === 1;
    if (!inL5b) tutorialBus.setTutorialPreserveHandOrder(false);
    return () => tutorialBus.setTutorialPreserveHandOrder(false);
  }, [engine.lessonIndex, engine.stepIndex]);

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
    // Re-arm the rigging on every re-entry into step 0 (GO_BACK flows the
    // engine through `intro` before landing on `bot-demo`, and the shared
    // `intro` useEffect at the top of this file clears equationHandSlots +
    // runs eqReset). Without this, returning to step 0 after a back-nav
    // leaves the equation empty and validTargets stale.
    if (engine.phase === 'intro' && engine.stepIndex === 0) {
      l6RiggedRef.current = false;
      return;
    }
    if (engine.phase !== 'bot-demo' || engine.stepIndex !== 0) return;
    if (l6RiggedRef.current) return;
    l6RiggedRef.current = true;

    // Dice: two distinct values (die3 exists but is not used in the equation)
    // so the mini-card strip shows a mix of options while the builder shows
    // a clean two-number exercise. ROLL_DICE guarantees 'building' phase.
    gameDispatch({ type: 'ROLL_DICE', values: { die1: 2, die2: 3, die3: 5 } });

    // Hand: number cards 5, 7, 8 match the three 2-number results reachable
    // from dice {2,3,5}: 2+3=5, 2+5=7, 3+5=8. Even though the learner doesn't
    // play cards in L6, seeing familiar numbers in the fan makes the demo
    // feel realistic and connected to the possible-results strip.
    const ts = Date.now();
    const playerHand = [
      { id: `tut-l6-num-5-${ts}`, type: 'number' as const, value: 5 },
      { id: `tut-l6-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
      { id: `tut-l6-num-7-${ts}`, type: 'number' as const, value: 7 },
      { id: `tut-l6-num-8-${ts}`, type: 'number' as const, value: 8 },
      { id: `tut-l6-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
    ];
    const botHand = [
      { id: `tut-l6-bot-num-5-${ts}`, type: 'number' as const, value: 5 },
      { id: `tut-l6-bot-op-plus-${ts}`, type: 'operation' as const, operation: '+' as const },
      { id: `tut-l6-bot-num-7-${ts}`, type: 'number' as const, value: 7 },
      { id: `tut-l6-bot-num-8-${ts}`, type: 'number' as const, value: 8 },
      { id: `tut-l6-bot-op-times-${ts}`, type: 'operation' as const, operation: 'x' as const },
    ];
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botHand, playerHand] });

    // Enable the ResultsChip (boot defaults it to false so it stays hidden
    // in L1–L5). Must be dispatched after the dice so validTargets is ready.
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });

    // Equation stays EMPTY throughout step 0 — the teaching point is the
    // green chip, not the builder. Reset any leftover state from previous steps.
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    // Chip starts CLOSED — user taps it in step 6.1 to open the mini-strip.
    tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── Lesson 6 step transitions: ensure the chip is in the expected state
  //    when the learner arrives at each step. Without this, skipping step
  //    6.0 (without actually tapping the chip) leaves the mini-strip closed
  //    for step 6.1, and the bot's `tapMiniResult` demo has nothing to tap.
  //    Symmetrically, going BACK into step 6.0 with `resultsOpen=true` from
  //    the previous run would defeat the "tap the pulsing chip" teaching. ──
  useEffect(() => {
    if (engine.lessonIndex !== 5) return;
    if (engine.phase !== 'bot-demo') return;
    if (engine.stepIndex === 0) {
      // Step 6.0: chip MUST start closed so the learner sees it pulsing and
      // can tap to open. If the user navigated here with chip open, reset.
      tutorialBus.emitFanDemo({ kind: 'closeResultsChip' });
    } else if (engine.stepIndex === 1) {
      // Step 6.1 (tap-mini): chip MUST be open so the mini-strip is visible.
      // If the learner skipped step 6.0 without actually opening it, this
      // force-opens so the bot demo + await-mimic have something to tap.
      tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
      // Re-fill the dice AND both operators in the EquationBuilder so the
      // learner sees a complete reference equation (2 + 3 + 5 = 10) next to
      // the mini-cards strip. Without operators the slots show "?" which
      // invites taps that are intentionally blocked, causing confusion.
      setTimeout(() => {
        tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 0 });
        tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 1 });
        tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 2 });
        tutorialBus.emitFanDemo({ kind: 'eqSetOp', which: 1, op: '+' });
        tutorialBus.emitFanDemo({ kind: 'eqSetOp', which: 2, op: '+' });
      }, 0);
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── Copy-exercise validator (L6 legacy + L9): when the learner confirms
  //    an equation, compare against the selected mini-card config and emit
  //    success/mismatch feedback. L9 requires copying the FULL equation. ──
  useEffect(() => {
    const isL6CopyAwait = engine.lessonIndex === 5 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
    const isL9CopyAwait = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX && engine.stepIndex === 0 && engine.phase === 'await-mimic' && l9Stage === 1;
    if (!isL6CopyAwait && !isL9CopyAwait) return;
    if (gameState?.phase !== 'solved') return;
    const cfg = tutorialBus.getL6CopyConfig();
    if (!cfg) return;
    const got = gameState.equationResult as number | null;
    const normalizeEq = (s: string | null | undefined): string =>
      String(s ?? '')
        .replace(/\u00d7/g, 'x')
        .replace(/\u2212/g, '-')
        .replace(/\u00f7/g, '÷')
        .replace(/\s+/g, '');
    const copiedExactly =
      isL9CopyAwait && cfg.equation
        ? normalizeEq(gameState?.lastEquationDisplay) === normalizeEq(cfg.equation)
        : true;
    if (got === cfg.target && copiedExactly) {
      tutorialBus.emitUserEvent({ kind: 'l6CopyConfirmed' });
    } else if (got != null) {
      tutorialBus.emitUserEvent({ kind: 'l6CopyMismatch', expected: cfg.target, got });
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameState?.phase, gameState?.equationResult, gameState?.lastEquationDisplay, l9Stage]);

  // ── Copy mismatch bubble (L6/L9): show error when wrong copy is confirmed. ──
  useEffect(() => {
    setL6Mismatch(false);
    setL9Mismatch(false);
    if (l6MismatchTimerRef.current) clearTimeout(l6MismatchTimerRef.current);
    if (l9MismatchTimerRef.current) clearTimeout(l9MismatchTimerRef.current);
    const isL6CopyAwait = engine.lessonIndex === 5 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
    const isL9CopyAwait = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX && engine.stepIndex === 0 && engine.phase === 'await-mimic';
    if (!isL6CopyAwait && !isL9CopyAwait) return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind !== 'l6CopyMismatch') return;
      if (isL9CopyAwait) {
        setL9Mismatch(true);
        gameDispatch({ type: 'REVERT_TO_BUILDING' });
        tutorialBus.emitFanDemo({ kind: 'eqReset' });
        if (l9MismatchTimerRef.current) clearTimeout(l9MismatchTimerRef.current);
        l9MismatchTimerRef.current = setTimeout(() => setL9Mismatch(false), 2500);
      } else {
        setL6Mismatch(true);
        if (l6MismatchTimerRef.current) clearTimeout(l6MismatchTimerRef.current);
        l6MismatchTimerRef.current = setTimeout(() => setL6Mismatch(false), 2500);
      }
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ── Lesson 7 (parens-move) rigging: dice 6,2,1; both ops minus; chip shows
  //    target 6 − (2 − 1) = 5. Runs once per L7 entry (bot-demo step 0). ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) { l7RiggedRef.current = false; return; }
    // Reset the flag on any non-bot-demo phase so back-navigation re-rigs correctly.
    if (engine.phase !== 'bot-demo') { l7RiggedRef.current = false; return; }
    if (engine.stepIndex !== 0) return;
    if (l7RiggedRef.current) return;
    l7RiggedRef.current = true;
    // Pick a random exercise, avoiding repeating the last one.
    let idx: number;
    do { idx = Math.floor(Math.random() * L7_EXERCISE_POOL.length); }
    while (L7_EXERCISE_POOL.length > 1 && idx === l7LastExerciseIdxRef.current);
    l7LastExerciseIdxRef.current = idx;
    const ex = L7_EXERCISE_POOL[idx];
    l7ExerciseRef.current = ex;
    const ts = Date.now();
    // Full operator set + red solve chip + open mini strip so the board matches
    // a real "possible results" session.
    gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+', '-', 'x', '÷'] });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: true });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
    tutorialBus.emitFanDemo({ kind: 'disarmResultsChipPulse' });
    tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
    gameDispatch({ type: 'ROLL_DICE', values: { die1: ex.d1, die2: ex.d2, die3: ex.d3 } });
    // Keep at least one guaranteed matching card in hand (target), so the
    // learner can complete the exercise without being blocked by hand RNG.
    const extraNums = [3, 5, 7, 8, 9]
      .filter((v) => v !== ex.d1 && v !== ex.d2 && v !== ex.d3 && v !== ex.target)
      .slice(0, 4);
    const playerHand = [ex.target, ...extraNums].map((value, i) => ({
      id: `tut-l7-num-${value}-${ts}-${i}`,
      type: 'number' as const,
      value,
    }));
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [botHand, playerHand] });
    // Dice pre-filled; operators left empty for the learner to set.
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 0 }), 140);
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 1 }), 280);
    setTimeout(() => tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx: 2 }), 420);
    const chipEq = `${ex.d1} − (${ex.d2} − ${ex.d3}) = ${ex.target}`;
    setTimeout(() => {
      tutorialBus.emitFanDemo({ kind: 'setSolveChip', equation: chipEq, result: ex.target });
    }, 560);
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ── Lesson 9 (mini-copy): next turn with mini-strip ON and red chip OFF
  //    until the learner taps a mini card. Learner then copies that exact
  //    equation in the builder and confirms. ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX) { l9RiggedRef.current = false; return; }
    if (engine.phase !== 'bot-demo') { l9RiggedRef.current = false; return; }
    if (engine.stepIndex !== 0) return;
    if (l9RiggedRef.current) return;
    l9RiggedRef.current = true;
    // Pick a random exercise every run (avoid repeating previous L9 run).
    let idx: number;
    do { idx = Math.floor(Math.random() * L7_EXERCISE_POOL.length); }
    while (L7_EXERCISE_POOL.length > 1 && idx === l9LastExerciseIdxRef.current);
    l9LastExerciseIdxRef.current = idx;
    const ex = L7_EXERCISE_POOL[idx];
    setL9Stage(0);
    gameDispatch({ type: 'TUTORIAL_SET_ENABLED_OPERATORS', operators: ['+', '-', 'x', '÷'] });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE', value: false });
    tutorialBus.setL6CopyConfig(null);
    tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
    tutorialBus.emitFanDemo({ kind: 'disarmResultsChipPulse' });
    tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    // ROLL_DICE in a separate tick so React flushes TUTORIAL_SET_ENABLED_OPERATORS first.
    // Without this, React batches both dispatches and ROLL_DICE sees the old operators (['+'] only),
    // producing validTargets with no minus/multiply equations → empty mini-cards strip.
    setTimeout(() => {
      gameDispatch({ type: 'ROLL_DICE', values: { die1: ex.d1, die2: ex.d2, die3: ex.d3 } });
    }, 0);
    // Build hand: one card per unique parens-right result (a op (b op c)).
    // This ensures every mini card shown has a matching number card in the fan.
    const ts9 = Date.now();
    const _applyOp = (a: number, op: string, b: number): number | null => {
      if (op === '+') return a + b;
      if (op === '-') return a - b;
      if (op === 'x') return a * b;
      if (op === '÷') return b !== 0 && Number.isInteger(a / b) ? a / b : null;
      return null;
    };
    const _ops = ['+', '-', 'x', '÷'];
    const _vals = [ex.d1, ex.d2, ex.d3];
    const _resultSet = new Set<number>();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (j !== i) for (let k = 0; k < 3; k++) if (k !== i && k !== j) {
      const [a, b, c] = [_vals[i], _vals[j], _vals[k]];
      for (const op1 of _ops) for (const op2 of _ops) {
        const inner = _applyOp(b, op2, c);
        if (inner === null) continue;
        const result = _applyOp(a, op1, inner);
        if (result !== null && result > 0 && result <= 25 && Number.isInteger(result)) _resultSet.add(result);
      }
    }
    const l9PlayerHand = [..._resultSet].sort((a, b) => a - b).map((value, i) => ({
      id: `tut-l9-num-${value}-${ts9}-${i}`,
      type: 'number' as const,
      value,
    }));
    const l9BotHand = l9PlayerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    gameDispatch({ type: 'TUTORIAL_SET_HANDS', hands: [l9BotHand, l9PlayerHand] });
    // Ensure human player (index 1) is the active player so UI interactions work.
    // Discard pile: a number card matching ex.target so the player can play
    // their matching hand card in stage 2 of the exercise.
    const l9PileCard = { id: `tut-l9-pile-${ts9}`, type: 'number' as const, value: ex.target };
    gameDispatch({ type: 'TUTORIAL_FRACTION_SETUP', slice: {
      currentPlayerIndex: 1,
      phase: 'building' as const,
      hands: [l9BotHand, l9PlayerHand], // parens-right matching hand
      discardPile: [l9PileCard],
      dice: null,
      pendingFractionTarget: null,
      fractionPenalty: 0,
      fractionAttackResolved: false,
      showFractions: false,
      fractionKinds: [] as const,
    }});
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ── Lesson 10 (single identical): pre-roll with one matching card.
  //    Discard value is randomised every run (avoid repeating). ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_SINGLE_IDENTICAL_LESSON_INDEX) { l10RiggedRef.current = false; return; }
    if (engine.phase !== 'bot-demo') { l10RiggedRef.current = false; return; }
    if (engine.stepIndex !== 0) return;
    if (l10RiggedRef.current) return;
    l10RiggedRef.current = true;
    // Pick a random discard value in [3..9], avoid repeating the last run.
    const pool = [3, 4, 5, 6, 7, 8, 9];
    let discardValue: number;
    do { discardValue = pool[Math.floor(Math.random() * pool.length)]; }
    while (pool.length > 1 && discardValue === l10LastDiscardRef.current);
    l10LastDiscardRef.current = discardValue;
    const ts = Date.now();
    const matchCard = { id: `tut-l10-match-${ts}`, type: 'number' as const, value: discardValue };
    // Fill the rest of the hand with values different from discardValue.
    const extras = [2, 3, 4, 5, 6, 7, 8, 9]
      .filter((v) => v !== discardValue)
      .slice(0, 4)
      .map((v, i) => ({ id: `tut-l10-extra-${v}-${ts}-${i}`, type: 'number' as const, value: v }));
    const discardCard = { id: `tut-l10-discard-${ts}`, type: 'number' as const, value: discardValue };
    const playerHand = [matchCard, ...extras];
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    gameDispatch({
      type: 'TUTORIAL_FRACTION_SETUP',
      slice: {
        currentPlayerIndex: 1,
        phase: 'pre-roll',
        hands: [botHand, playerHand],
        discardPile: [discardCard],
        dice: null,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        showFractions: false,
        fractionKinds: [],
      },
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ── Lesson 11 (multi-play): solved phase, randomised target in [5..9].
  //    Hand contains two addends that sum to the target + wild + joker,
  //    but NO direct card whose value === target. ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_MULTI_PLAY_LESSON_INDEX) { l11RiggedRef.current = false; return; }
    if (engine.phase !== 'bot-demo') { l11RiggedRef.current = false; return; }
    if (engine.stepIndex !== 1) return;
    if (l11RiggedRef.current) return;
    l11RiggedRef.current = true;
    // Pick a random target in [5..9], avoid repeating the last run.
    const targets = [5, 6, 7, 8, 9];
    let EQ_RESULT: number;
    do { EQ_RESULT = targets[Math.floor(Math.random() * targets.length)]; }
    while (targets.length > 1 && EQ_RESULT === l11LastResultRef.current);
    l11LastResultRef.current = EQ_RESULT;
    // Derive two addends (split roughly in half).
    const addA_raw = Math.floor(EQ_RESULT / 2);
    const addB_raw = EQ_RESULT - addA_raw;
    // Ensure addA !== addB so the hand contains two distinct-valued cards.
    const addA = addA_raw === addB_raw ? addA_raw - 1 : addA_raw;
    const addB = EQ_RESULT - addA; // addA + addB === EQ_RESULT always
    // Publish config so the bot demo in lesson-10-multi-play.ts can read it.
    tutorialBus.setL11Config({ addA, addB, target: EQ_RESULT });
    const ts = Date.now();
    const usedVals = new Set([addA, addB, 0, EQ_RESULT]);
    const fillers = [1, 2, 3, 4, 6, 7, 8, 9].filter(v => !usedVals.has(v)).slice(0, 4);
    const playerCards = [addA, addB, 0, ...fillers].map((v, i) => ({
      id: `tut-l11-num-${v}-${ts}-${i}`, type: 'number' as const, value: v,
    }));
    const wildCard = { id: `tut-l11-wild-${ts}`, type: 'wild' as const };
    const jokerCard = { id: `tut-l11-joker-${ts}`, type: 'joker' as const };
    const playerHand = [...playerCards, wildCard, jokerCard];
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-${c.id}` }));
    gameDispatch({
      type: 'TUTORIAL_FORCE_SOLVED',
      equationResult: EQ_RESULT,
      playerHand,
      botHand,
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ── L11: clear l11Config when leaving the lesson ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_MULTI_PLAY_LESSON_INDEX) {
      tutorialBus.setL11Config(null);
      l11RiggedRef.current = false;
      l11AwaitRiggedRef.current = false;
    }
  }, [engine.lessonIndex]);

  // ── L11 step 1 await-mimic: re-rig solved state so the learner gets a fresh
  //    hand after the bot demo consumed the previous game state (CONFIRM_STAGED). ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_MULTI_PLAY_LESSON_INDEX) { l11AwaitRiggedRef.current = false; return; }
    if (engine.phase !== 'await-mimic') { l11AwaitRiggedRef.current = false; return; }
    if (engine.stepIndex !== 1) return;
    if (l11AwaitRiggedRef.current) return;
    const cfg = tutorialBus.getL11Config();
    if (!cfg) return;
    l11AwaitRiggedRef.current = true;
    const ts = Date.now();
    const usedVals = new Set([cfg.addA, cfg.addB, 0, cfg.target]);
    const fillers = [1, 2, 3, 4, 6, 7, 8, 9].filter(v => !usedVals.has(v)).slice(0, 4);
    const playerCards = [cfg.addA, cfg.addB, 0, ...fillers].map((v, i) => ({
      id: `tut-l11-await-${v}-${ts}-${i}`, type: 'number' as const, value: v,
    }));
    const wildCard = { id: `tut-l11-await-wild-${ts}`, type: 'wild' as const };
    const jokerCard = { id: `tut-l11-await-joker-${ts}`, type: 'joker' as const };
    const playerHand = [...playerCards, wildCard, jokerCard];
    const botHand = playerHand.map((c) => ({ ...c, id: `bot-await-${c.id}` }));
    gameDispatch({
      type: 'TUTORIAL_FORCE_SOLVED',
      equationResult: cfg.target,
      playerHand,
      botHand,
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase, gameDispatch]);

  // ── L11 step 1 await-mimic: enable l4Step3Mode so the "בחרתי" button shows. ──
  useEffect(() => {
    const on = engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
               engine.stepIndex === 1 &&
               engine.phase === 'await-mimic';
    if (on) tutorialBus.setL4Step3Mode(true);
    return () => { if (on) tutorialBus.setL4Step3Mode(false); };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── L9: parens filter controls equation builder visibility by stage:
  //    Stage 1 (build equation): l9ParensFilter=true → dice row visible + clickable ──
  useEffect(() => {
    const on = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX &&
               engine.phase === 'await-mimic' &&
               l9Stage === 1;
    tutorialBus.setL9ParensFilter(on);
    return () => { tutorialBus.setL9ParensFilter(false); };
  }, [engine.lessonIndex, engine.phase, l9Stage]);

  // ── L9: reset stage + target filter when leaving the lesson or re-entering bot-demo ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX) {
      setL9Stage(0);
      return;
    }
    if (engine.phase === 'bot-demo' || engine.phase === 'intro') setL9Stage(0);
  }, [engine.lessonIndex, engine.phase]);

  // ── L9: on entering await-mimic stage 0 — reset equation, open chip,
  //    then filter validTargets to parens-right only. Running the filter
  //    here (not in bot-demo) prevents a stale equation from auto-confirming
  //    against the filtered targets before the learner taps a mini card. ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX) return;
    if (engine.phase !== 'await-mimic' || l9Stage !== 0) return;
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
    tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
    gameDispatch({ type: 'TUTORIAL_SET_VALID_TARGETS', targets: null });
  }, [engine.lessonIndex, engine.phase, l9Stage, gameDispatch]);

  // ── L9 stage 0→1: mini card tapped → unlock equation builder ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX || engine.phase !== 'await-mimic' || l9Stage !== 0) return;
    return tutorialBus.subscribeUserEvent((e) => {
      if (e.kind === 'miniCardTapped') setL9Stage(1);
    });
  }, [engine.lessonIndex, engine.phase, l9Stage]);

  // ── L9 stage 1: equation confirmed correctly → lesson outcome fires directly ──
  // The lesson outcome is now `l6CopyConfirmed`, so emitting it from tutorialBus
  // triggers OUTCOME_MATCHED in the engine → celebrate phase with כל הכבוד bubble.
  useEffect(() => {
    const on = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX && engine.phase === 'await-mimic' && l9Stage === 1;
    tutorialBus.setManualEqConfirm(on);
    return () => tutorialBus.setManualEqConfirm(false);
  }, [engine.lessonIndex, engine.phase, l9Stage]);


  // ── L7 pulses choreography:
  // stage 0 -> pulse red solve chip (copy target); after learner cycles an op,
  // stage 1 -> stop red, pulse orange parens button + continuation bubble;
  // stage 2 -> stop both (free play to confirm).
  useEffect(() => {
    const isParensAwait =
      engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
      engine.phase === 'await-mimic';
    if (!isParensAwait) {
      tutorialBus.setL7SolveChipLoopPulse(false);
      tutorialBus.setParensButtonPulse(false);
      return;
    }
    if (parensIntroStage === 0) {
      tutorialBus.setL7SolveChipLoopPulse(true);
      tutorialBus.setParensButtonPulse(false);
      return;
    }
    if (parensIntroStage === 1) {
      tutorialBus.setL7SolveChipLoopPulse(false);
      tutorialBus.setParensButtonPulse(true);
      return;
    }
    tutorialBus.setL7SolveChipLoopPulse(false);
    tutorialBus.setParensButtonPulse(false);
  }, [engine.lessonIndex, engine.phase, parensIntroStage]);

  useEffect(() => {
    return () => {
      tutorialBus.setParensButtonPulse(false);
      tutorialBus.setL7SolveChipLoopPulse(false);
    };
  }, []);

  // ── L7: reset intro stage when leaving OR backing up within the parens lesson. ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) {
      setParensIntroStage(0);
      return;
    }
    // Back navigation returns to bot-demo or intro — reset so bubble re-appears.
    if (engine.phase === 'bot-demo' || engine.phase === 'intro') {
      setParensIntroStage(0);
    }
  }, [engine.lessonIndex, engine.phase]);

  useEffect(() => {
    const isL7Await =
      engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
      engine.phase === 'await-mimic';
    if (isL7Await) {
      setL7FanHintHidden(false);
    }
  }, [engine.lessonIndex, engine.phase, engine.stepIndex, l7CompletedExercises]);

  useEffect(() => {
    const isL7Await =
      engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
      engine.phase === 'await-mimic';
    if (!isL7Await || l7FanHintHidden) return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'eqUserPickedDice' || evt.kind === 'opSelected' || evt.kind === 'parensToggled') {
        setL7FanHintHidden(true);
      }
    });
  }, [engine.lessonIndex, engine.phase, l7FanHintHidden, l7CompletedExercises]);


  // ── L7 stage 0→1: operator set → stop red-chip pulse, start parens-button pulse ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX || engine.phase !== 'await-mimic' || parensIntroStage !== 0) return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'opSelected') setParensIntroStage(1);
    });
  }, [engine.lessonIndex, engine.phase, parensIntroStage]);

  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) {
      setParensMockupApproved(false);
      setParensMockupPendingAdvance(false);
    }
  }, [engine.lessonIndex]);

  useEffect(() => {
    if (!parensMockupPendingAdvance || !parensMockupApproved) return;
    setParensMockupPendingAdvance(false);
    dispatchEngine({ type: 'BOT_DEMO_DONE' });
  }, [parensMockupPendingAdvance, parensMockupApproved]);

  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_IDENTICAL_LESSON_INDEX || engine.stepIndex !== 0) return;
    if (engine.phase === 'intro' || engine.phase === 'bot-demo') {
      setL9IntroApproved(false);
      setL9IntroPendingAdvance(false);
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  useEffect(() => {
    if (!l9IntroPendingAdvance || !l9IntroApproved) return;
    setL9IntroPendingAdvance(false);
    dispatchEngine({ type: 'BOT_DEMO_DONE' });
  }, [l9IntroPendingAdvance, l9IntroApproved]);

  // ── L7: stage 1→2 when parens toggled. ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX || parensIntroStage !== 1) return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind === 'parensToggled') {
        setParensIntroStage(2);
      }
    });
  }, [engine.lessonIndex, parensIntroStage]);

  // ── L7 await-mimic: enable manual eq confirm so the confirm button is visible. ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX || engine.phase !== 'await-mimic') {
      tutorialBus.setManualEqConfirm(false);
      return;
    }
    tutorialBus.setManualEqConfirm(true);
    return () => tutorialBus.setManualEqConfirm(false);
  }, [engine.lessonIndex, engine.phase]);

  // ── L7 await-mimic: reset equation so dice wait above (learner places them). ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX || engine.phase !== 'await-mimic') return;
    // First parens exercise should start with numbers already placed.
    if (l7CompletedExercises === 0) return;
    tutorialBus.emitFanDemo({ kind: 'eqReset' });
  }, [engine.lessonIndex, engine.phase, l7CompletedExercises]);

  // Parens exercise #2: auto-press "possible results" so mini cards open.
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) return;
    if (engine.phase !== 'await-mimic' && engine.phase !== 'bot-demo') return;
    if (l7CompletedExercises !== 1) return;
    gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
    tutorialBus.emitFanDemo({ kind: 'disarmResultsChipPulse' });
    tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
    tutorialBus.emitUserEvent({ kind: 'resultsChipTapped' });
  }, [engine.lessonIndex, engine.phase, gameDispatch, l7CompletedExercises]);

  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) return;
    if (engine.phase !== 'await-mimic' && engine.phase !== 'bot-demo') return;
    if (l7CompletedExercises !== 1) return;
    const id = setInterval(() => {
      gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
      tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
      tutorialBus.emitUserEvent({ kind: 'resultsChipTapped' });
    }, 450);
    return () => clearInterval(id);
  }, [engine.lessonIndex, engine.phase, gameDispatch, l7CompletedExercises]);

  // ── Lesson 7: outcome check — two-exercise flow.
  //    Exercise 1 (l7CompletedExercises === 0): parens-only — learner moves parens.
  //      On correct confirm → increment counter + revert to building for exercise 2.
  //    Exercise 2 (l7CompletedExercises === 1): full equation — learner fills all.
  //      On correct confirm → emit l7ParensCopyConfirmed → lesson advances. ──
  useEffect(() => {
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) return;
    if (engine.phase !== 'await-mimic') return;
    // When phase returns to 'building' after exercise 1, clear the transition guard.
    if (gameState?.phase === 'building') {
      l7WaitingForBuildingRef.current = false;
      return;
    }
    if (gameState?.phase !== 'solved') return;
    // Guard: if we just finished exercise 1 and REVERT_TO_BUILDING hasn't
    // propagated yet, skip this render to avoid double-firing.
    if (l7WaitingForBuildingRef.current) return;
    const parensRight = tutorialBus.getParensRightValue();
    const got = gameState.equationResult as number | null;
    const liveRight = tutorialBus.getL7ParensResults()?.right ?? null;
    const expected = liveRight ?? l7ExerciseRef.current.target;
    if (parensRight && got === expected) {
      if (l7CompletedExercisesRef.current === 0) {
        // Exercise 1 done — set guard + transition to exercise 2.
        l7WaitingForBuildingRef.current = true;
        l7CompletedExercisesRef.current = 1;
        setL7CompletedExercises(1);
        setParensIntroStage(2);
        tutorialBus.emitFanDemo({ kind: 'clearSolveExerciseChip' });
        gameDispatch({ type: 'REVERT_TO_BUILDING' });
      } else if (l7CompletedExercisesRef.current === 1) {
        // Exercise 2 done — advance lesson.
        tutorialBus.emitUserEvent({ kind: 'l7ParensCopyConfirmed' });
      }
    } else if (got != null) {
      tutorialBus.emitUserEvent({ kind: 'l7ParensCopyMismatch', expected, got });
    }
  }, [engine.lessonIndex, engine.phase, gameState?.phase, gameState?.equationResult, gameDispatch, l7CompletedExercises]);

  // ── L7→L9 boundary cleanup: once we actually leave parens, reset solved
  //    staging so the next lesson starts from a clean "building" board. ──
  const prevLessonIndexRef = useRef(engine.lessonIndex);
  useEffect(() => {
    const prev = prevLessonIndexRef.current;
    if (prev === MIMIC_PARENS_LESSON_INDEX && engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX) {
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
      tutorialBus.setL7SolveChipLoopPulse(false);
      tutorialBus.setParensButtonPulse(false);
    }
    prevLessonIndexRef.current = engine.lessonIndex;
  }, [engine.lessonIndex, gameDispatch]);

  // ── L7 mismatch bubble: show error 2.5s when wrong parens or result. ──
  useEffect(() => {
    setL7Mismatch(false);
    if (l7MismatchTimerRef.current) clearTimeout(l7MismatchTimerRef.current);
    if (engine.lessonIndex !== MIMIC_PARENS_LESSON_INDEX || engine.phase !== 'await-mimic') return;
    return tutorialBus.subscribeUserEvent((evt) => {
      if (evt.kind !== 'l7ParensCopyMismatch') return;
      setL7Mismatch(true);
      gameDispatch({ type: 'REVERT_TO_BUILDING' });
      setParensIntroStage(0);
      // Reset to empty equation — learner places dice again from the panel above.
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      if (l7MismatchTimerRef.current) clearTimeout(l7MismatchTimerRef.current);
      l7MismatchTimerRef.current = setTimeout(() => setL7Mismatch(false), 2500);
    });
  }, [engine.lessonIndex, engine.phase]);

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
  //    skips straight to the equation with zero delay. L6.2 (tap-mini)
  //    requires a MANUAL "הבנתי ›" confirmation so the learner can read
  //    the red SolveExerciseChip at their own pace before advancing. ──
  useEffect(() => {
    if (engine.phase !== 'celebrate') return;
    // L6 step 0 (open-chip): skip celebrate instantly — no fanfare.
    if (engine.lessonIndex === 5 && engine.stepIndex === 0) {
      dispatchEngine({ type: 'CELEBRATE_DONE' });
      return;
    }
    // Frac-intro (stepIndex 0 of any frac lesson): skip celebrate instantly
    // so the learner jumps straight into the attack step without a "בוא ננסה" pause.
    if (engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
        engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX &&
        engine.stepIndex === 0) {
      dispatchEngine({ type: 'CELEBRATE_DONE' });
      return;
    }
    // L10 (single identical) step 0 (intro overlay): skip celebrate instantly.
    if (engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX && engine.stepIndex === 0) {
      dispatchEngine({ type: 'CELEBRATE_DONE' });
      return;
    }
    // L11 (multi-play) step 0 (הידעת? intro): skip celebrate instantly.
    if (engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX && engine.stepIndex === 0) {
      dispatchEngine({ type: 'CELEBRATE_DONE' });
      return;
    }
    // Parens lesson: auto-advance so flow continues into the next exercise.
    if (engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX) {
      const id = setTimeout(() => dispatchEngine({ type: 'CELEBRATE_DONE' }), 1200);
      return () => clearTimeout(id);
    }
    // L6.2 (tap-mini, stepIndex 1): manual "הבנתי" required — do not auto-advance.
    if (engine.lessonIndex === 5 && engine.stepIndex === 1) return;
    const lesson = LESSONS[engine.lessonIndex];
    const step = lesson?.steps[engine.stepIndex];
    // Dice lesson → equation: instant transition, no celebration pause.
    const ms = step?.celebrateKey ? 2600 : CELEBRATE_MS;
    const id = setTimeout(() => dispatchEngine({ type: 'CELEBRATE_DONE' }), ms);
    return () => clearTimeout(id);
  }, [engine.phase, engine.lessonIndex, engine.stepIndex]);

  // ── L6.2 (tap-mini): lock mini cards initially, unlock after bubble delay ──
  useEffect(() => {
    const isL6TapMiniAwait =
      engine.lessonIndex === 5 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
    if (!isL6TapMiniAwait) {
      tutorialBus.setL6MiniLocked(false);
      setShowL6TapMiniAck(false);
      return;
    }
    tutorialBus.setL6MiniLocked(true);
    setShowL6TapMiniAck(false);
    const id = setTimeout(() => tutorialBus.setL6MiniLocked(false), 1500);
    return () => { clearTimeout(id); tutorialBus.setL6MiniLocked(false); };
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── L6.2 (tap-mini): show "הבנתי" only after user taps a mini card ──
  useEffect(() => {
    const isL6TapMiniAwait =
      engine.lessonIndex === 5 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
    if (!isL6TapMiniAwait) return;
    return tutorialBus.subscribeUserEvent((e) => {
      if (e.kind === 'miniCardTapped') setShowL6TapMiniAck(true);
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── Frac-intro: reset stage whenever we leave the intro step ──
  useEffect(() => {
    const isFracIntro =
      engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
      engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX &&
      engine.stepIndex === 0;
    if (!isFracIntro) setFracIntroStage(0);
  }, [engine.lessonIndex, engine.stepIndex]);

  // ── Frac intro: reset stage to 0 whenever leaving step 0 (back/skip/navigate) ──
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac || engine.stepIndex !== 0) setFracIntroStage(0);
  }, [engine.lessonIndex, engine.stepIndex]);

  // ── Frac-defense intro: reset whenever leaving step 3 ──
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac || engine.stepIndex !== 3) setFracDefenseIntroStage(0);
  }, [engine.lessonIndex, engine.stepIndex]);

  // ── Frac bonus step: reset stage + tracking ref when entering/leaving frac lesson ──
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac || engine.stepIndex !== 5) setFracBonusStage(0);
    if (!isFrac) fracDefenseUsedFractionRef.current = { step3: false, step4: false };
  }, [engine.lessonIndex, engine.stepIndex]);

  // ── Track fraction usage in defense steps 3 and 4 ──
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac) return;
    if ((engine.stepIndex !== 3 && engine.stepIndex !== 4) || engine.phase !== 'await-mimic') return;
    return tutorialBus.subscribeUserEvent((e) => {
      if (e.kind === 'fracDefenseWithFraction') {
        if (engine.stepIndex === 3) fracDefenseUsedFractionRef.current.step3 = true;
        if (engine.stepIndex === 4) fracDefenseUsedFractionRef.current.step4 = true;
      }
    });
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── Bonus step 5: auto-skip if user already used a fraction in step 3 or 4 ──
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac || engine.stepIndex !== 5 || engine.phase !== 'await-mimic') return;
    const usedFrac = fracDefenseUsedFractionRef.current.step3 || fracDefenseUsedFractionRef.current.step4;
    if (usedFrac) {
      dispatchEngine({ type: 'OUTCOME_MATCHED' });
    }
  }, [engine.lessonIndex, engine.stepIndex, engine.phase]);

  // ── Frac intro stage 0: flashing arrow toward the pile ──
  useEffect(() => {
    const isFrac = engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
                   engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
    if (!isFrac || engine.stepIndex !== 0 || fracIntroStage !== 0) {
      fracArrowPulse.stopAnimation();
      fracArrowPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fracArrowPulse, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(fracArrowPulse, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [engine.lessonIndex, engine.stepIndex, fracIntroStage, fracArrowPulse]);

  // ── Pick the bubble copy for the current phase. ──
  const currentLesson = LESSONS[engine.lessonIndex];
  const currentStep = currentLesson?.steps[engine.stepIndex];
  const isL4Step3Await = engine.lessonIndex === 3 && engine.stepIndex === 3 && engine.phase === 'await-mimic';
  // Lesson 4 step 3 uses a dynamic bubble: build → confirm → pick → play.
  const l4Step3HintKey: string | null = isL4Step3Await
    ? (l4Step3Phase === 'build' ? 'tutorial.l4c.hintFull'
       : l4Step3Phase === 'confirm' ? 'tutorial.l4c.hintPressConfirm'
       : l4Step3Phase === 'pick' ? 'tutorial.l4c.hintPickCards'
       : null)
    : null;
  // Lesson 5 step 5b (joker-place, now stepIndex 1) dynamic bubble:
  // tap joker → pick → place.
  const isL5bAwait = engine.lessonIndex === 4 && engine.stepIndex === 1 && engine.phase === 'await-mimic';
  const l5bHintKey: string | null = isL5bAwait
    ? (l5JokerWrong ? 'tutorial.l5b.wrongSign'
       : l5FlowHintPhase === 'pickModal' ? 'tutorial.l5b.hintPickInModal'
       : l5FlowHintPhase === 'placeSign' ? 'tutorial.l5b.hintPlaceSign'
       : 'tutorial.l5b.hintTapJoker')
    : null;
  // Three-phase hint for L5.1 (place-op):
  //   1. no card selected yet → "choose an op card that solves {{result}}"
  //   2. card selected (equationHandPick set) → "now press in the exercise to place it"
  //   3. wrong card placed → error message (auto-clears after 2s)
  const isL5PlaceAwait = engine.lessonIndex === 4 && engine.stepIndex === 0 && engine.phase === 'await-mimic';
  const L5A_TARGET_RESULT = l5DiceRef.current.d1 + l5DiceRef.current.d2;
  const l5PlaceHintKey: string | null = isL5PlaceAwait
    ? (l5PlaceWrong
        ? 'tutorial.l5op.wrong'
        : (gameState?.equationHandPick != null
            ? 'tutorial.l5a.hintPressEquation'
            : 'tutorial.l5a.hintChooseCard'))
    : null;
  const l5PlaceHintParams: Record<string, string> | undefined =
    l5PlaceHintKey === 'tutorial.l5a.hintChooseCard' ? { result: String(L5A_TARGET_RESULT) } : undefined;
  const isL6CopyAwait = engine.lessonIndex === 5 && engine.stepIndex === 2 && engine.phase === 'await-mimic';
  const l6MismatchHintKey: string | null = isL6CopyAwait && l6Mismatch ? 'tutorial.l6c.mismatch' : null;
  const isL9CopyAwait = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX && engine.stepIndex === 0 && engine.phase === 'await-mimic';
  const l9MismatchHintKey: string | null = isL9CopyAwait && l9Mismatch ? 'tutorial.l9.copy.mismatch' : null;
  const isL9Lesson = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX;
  const l9SelectMiniKey: string | null =
    isL9Lesson && engine.phase === 'await-mimic' && l9Stage === 0
      ? 'tutorial.l9.selectMini'
      : null;
  const l9BuildEqKey: string | null = null;
  const l9ChooseCardKey: string | null = null; // stage 2 removed — lesson ends on l6CopyConfirmed
  const isL7ParensAwait = engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX && engine.phase === 'await-mimic';
  const l7MismatchHintKey: string | null = isL7ParensAwait && l7Mismatch ? 'tutorial.l8.mismatch' : null;
  // Fractions intro step uses custom dedicated bubbles — suppress default bubble.
  // Parens lesson does NOT suppress (it uses its own hintKey via currentStep).
  const isFracIntroActive =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX &&
    engine.stepIndex === 0 &&
    (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
  const isFracAttackActive =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX &&
    (engine.stepIndex === 1 || engine.stepIndex === 2);
  // Defense steps (3-5) have their own HappyBubble — suppress the default bubble.
  const isFracDefenseActive =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX &&
    engine.stepIndex >= 3 &&
    (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
  const bubbleText: string | null =
    isFracIntroActive ? null
    : isFracDefenseActive ? null
    : (isFracAttackActive && engine.phase === 'bot-demo') ? null
    : engine.phase === 'post-signs-choice' || engine.phase === 'core-complete' ? null
    : engine.phase === 'bot-demo' ? (isL9Lesson ? null : (currentStep?.botHintKey ? t(currentStep.botHintKey) : null))
    : engine.phase === 'await-mimic'
      ? (l9SelectMiniKey ? t(l9SelectMiniKey) : l9BuildEqKey ? t(l9BuildEqKey) : l9MismatchHintKey ? t(l9MismatchHintKey) : l9ChooseCardKey ? t(l9ChooseCardKey) : l4Step3HintKey ? t(l4Step3HintKey) : l5PlaceHintKey ? t(l5PlaceHintKey, l5PlaceHintParams) : l5bHintKey ? t(l5bHintKey) : l6MismatchHintKey ? t(l6MismatchHintKey) : l7MismatchHintKey ? t(l7MismatchHintKey) : (engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX ? null : (currentStep?.hintKey ? t(currentStep.hintKey) : null)))
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
  // Uniform bottom offset for every "הבנתי" intro-overlay button across all lessons.
  const GOT_IT_BOTTOM = 28;
  // Advanced lessons (fractions, parens) need a bit more breathing room above the hand.
  const GOT_IT_BOTTOM_ADV = 52;
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
  const isFracLesson =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex < MIMIC_PARENS_LESSON_INDEX;
  const isParensLesson = engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX;
  const isIdenticalLesson = engine.lessonIndex === MIMIC_IDENTICAL_LESSON_INDEX;
  const isL10Intro = engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX &&
    engine.stepIndex === 0 &&
    (engine.phase === 'await-mimic' || engine.phase === 'bot-demo');
  const isL11Intro = engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX &&
    engine.stepIndex === 0 &&
    (engine.phase === 'await-mimic' || engine.phase === 'bot-demo');
  // Lesson 4 step 3 (did-you-know): overlay before the full-build step.
  const isL4DidYouKnow = engine.lessonIndex === 3 &&
    engine.stepIndex === 2 &&
    (engine.phase === 'await-mimic' || engine.phase === 'bot-demo');
  // Top discard card value — used by the L10 intro overlay mockup.
  const l10TopDiscard = gameState?.discardPile?.[gameState.discardPile.length - 1];
  const l10TopDiscardValue = l10TopDiscard?.value ?? '?';

  // Step progress indicator:
  // first step in a lesson shows "N"; additional steps show "N.1", "N.2"...
  // (e.g. 1, 1.1, 1.2, then next lesson starts at 2).
  const coreLessons = LESSONS.slice(0, MIMIC_LAST_CORE_LESSON_INDEX + 1);
  const totalCoreLessons = coreLessons.length;
  const isAdvancedLesson =
    engine.lessonIndex >= MIMIC_FIRST_FRACTION_LESSON_INDEX &&
    engine.lessonIndex <= MIMIC_MULTI_PLAY_LESSON_INDEX;
  const advancedLessons = LESSONS.slice(MIMIC_FIRST_FRACTION_LESSON_INDEX);
  const totalAdvancedLessons = advancedLessons.length;
  const lessonOrdinal = isAdvancedLesson
    ? (engine.lessonIndex - MIMIC_FIRST_FRACTION_LESSON_INDEX + 1)
    : (engine.lessonIndex + 1);
  const stepLabel = engine.stepIndex === 0
    ? String(lessonOrdinal)
    : `${lessonOrdinal}.${engine.stepIndex}`;
  const totalLessonCount = isAdvancedLesson ? totalAdvancedLessons : totalCoreLessons;
  const showStepProgress =
    engine.phase !== 'idle' &&
    engine.phase !== 'core-complete' &&
    engine.phase !== 'post-signs-choice' &&
    engine.phase !== 'all-done';
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
  // Counts presses during bot-demo/await-mimic — the phases where learning
  // is expected. > 2 such skips blocks the coin reward at core-complete.
  const skipForward = () => {
    if (showWelcomeBubble) return;
    if (engine.phase === 'bot-demo' || engine.phase === 'await-mimic') {
      setSkipCount((n) => n + 1);
    }
    switch (engine.phase) {
      case 'intro': dispatchEngine({ type: 'DISMISS_INTRO' }); break;
      case 'bot-demo':
        if (
          engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
          engine.stepIndex === 0 &&
          !parensMockupApproved
        ) {
          setParensMockupPendingAdvance(true);
          break;
        }
        dispatchEngine({ type: 'BOT_DEMO_DONE' });
        break;
      case 'await-mimic': dispatchEngine({ type: 'OUTCOME_MATCHED' }); break;
      case 'celebrate': dispatchEngine({ type: 'CELEBRATE_DONE' }); break;
      case 'lesson-done': dispatchEngine({ type: 'DISMISS_LESSON_DONE' }); break;
      case 'core-complete': dispatchEngine({ type: 'DISMISS_CORE_COMPLETE' }); break;
      case 'post-signs-choice': dispatchEngine({ type: 'CHOOSE_FINISH_TUTORIAL' }); break;
      case 'advanced-complete': dispatchEngine({ type: 'DISMISS_ADVANCED_COMPLETE' }); onExit(); break;
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
      ) : (isEquationLesson || isOpCycleLesson || isPossibleResultsLesson || isFracLesson || isParensLesson || isIdenticalLesson
          || engine.lessonIndex === MIMIC_SINGLE_IDENTICAL_LESSON_INDEX
          || engine.lessonIndex === MIMIC_MULTI_PLAY_LESSON_INDEX) ? (
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

      {/* Skip + Back buttons + step progress pill — top-right row. */}
      <View style={{ position: 'absolute', top: 12, right: 12, zIndex: 9600, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {showStepProgress ? (
          <View pointerEvents="none" style={{
            backgroundColor: 'rgba(15,23,42,0.82)',
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderWidth: 1.5,
            borderColor: 'rgba(148,163,184,0.55)',
          }}>
            <Text style={{ color: '#CBD5E1', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
              {`${stepLabel} / ${totalLessonCount}`}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity
          onPress={() => {
            if (showWelcomeBubble) return;
            // L9: go back ONE sub-step at a time (stage 2→1→0→GO_BACK).
            if (isL9Lesson && engine.phase === 'await-mimic' && l9Stage > 0) {
              if (l9Stage === 2) {
                // Solved phase → back to equation-building (stage 1), keep solve chip
                setL9Stage(1);
                gameDispatch({ type: 'REVERT_TO_BUILDING' });
                tutorialBus.emitFanDemo({ kind: 'eqReset' });
              } else {
                // Stage 1 → back to mini-card selection (stage 0)
                setL9Stage(0);
                tutorialBus.setL6CopyConfig(null);
                tutorialBus.emitFanDemo({ kind: 'eqReset' });
                gameDispatch({ type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS', value: true });
                tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
              }
              return;
            }
            dispatchEngine({ type: 'GO_BACK' });
          }}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            minWidth: 82,
            alignItems: 'center',
            justifyContent: 'center',
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
            minWidth: 82,
            alignItems: 'center',
            justifyContent: 'center',
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

      {/* Parens lesson: "Did you know?" style mockup + explicit confirm. */}
      {isParensLesson && engine.stepIndex === 0 && engine.phase === 'bot-demo' && l7CompletedExercises === 0 && !parensMockupApproved ? (
        <>
          <View
            pointerEvents="auto"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(5,10,22,0.88)',
              zIndex: 9250,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              zIndex: 9260,
            }}
          >
            <View
              style={{
                maxWidth: 360,
                width: '100%',
                borderRadius: 24,
                backgroundColor: 'rgba(15,23,42,0.96)',
                borderWidth: 2.5,
                borderColor: '#60A5FA',
                paddingVertical: 22,
                paddingHorizontal: 18,
                gap: 12,
                ...Platform.select({
                  ios: { shadowColor: '#60A5FA', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 16 },
                  android: { elevation: 14 },
                }),
              }}
            >
              <Text style={{ color: '#FCD34D', fontSize: 25, fontWeight: '900', textAlign: 'center', lineHeight: 31 }}>
                {t('tutorial.l8.mockupTitle')}
              </Text>
              <Text style={{ color: '#86EFAC', fontSize: 16, fontWeight: '800', textAlign: 'center', lineHeight: 24 }}>
                {t('tutorial.l8.mockupBody')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setParensMockupApproved(true)}
            style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
          >
            <View style={{
              backgroundColor: '#2563EB',
              borderRadius: 20,
              paddingVertical: 15,
              paddingHorizontal: 42,
              borderWidth: 2,
              borderColor: '#93C5FD',
              ...Platform.select({
                ios: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                android: { elevation: 12 },
              }),
            }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>
                {t('tutorial.l8.mockupContinue')}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {/* L10 (single identical) step 0: "קלף זהה" intro overlay with discard mockup */}
      {isL10Intro && (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(5,10,22,0.93)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            paddingHorizontal: 32,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fde68a', marginBottom: 8, textAlign: 'center' }}>
            {t('tutorial.l9.intro.title')}
          </Text>
          <Text style={{ fontSize: 14, color: '#d1d5db', textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
            {t('tutorial.l9.intro.desc')}
          </Text>
          {/* Mockup: discard pile top card → matching hand card */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 16 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{t('tutorial.identicalPracticeMockupDiscard')}</Text>
              <View style={{ width: 52, height: 72, backgroundColor: '#374151', borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#f59e0b' }}>
                <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#fde68a' }}>{l10TopDiscardValue}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 24, color: '#9ca3af' }}>→</Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{t('tutorial.identicalPracticeMockupHand')}</Text>
              <View style={{ width: 52, height: 72, backgroundColor: '#1e3a5f', borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#3b82f6' }}>
                <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#93c5fd' }}>{l10TopDiscardValue}</Text>
              </View>
            </View>
          </View>
          {engine.phase === 'await-mimic' && (
            <TouchableOpacity
              style={{ backgroundColor: '#f59e0b', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 }}
              onPress={() => tutorialBus.emitUserEvent({ kind: 'identicalSingleAck' })}
            >
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>
                {t('tutorial.l9.introContinue')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* L4 step 3 (did-you-know): "הידעת?" overlay before full-build */}
      {isL4DidYouKnow && (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(5,10,22,0.93)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            paddingHorizontal: 32,
          }}
        >
          <Text style={{ fontSize: 40, marginBottom: 8 }}>💡</Text>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#fde68a', marginBottom: 4, textAlign: 'center' }}>
            {t('tutorial.l4.didYouKnow')}
          </Text>
          <Text style={{ fontSize: 14, color: '#9ca3af', marginBottom: 12, textAlign: 'center' }}>
            {t('tutorial.l4.didYouKnowBestTip')}
          </Text>
          <Text style={{ fontSize: 16, color: '#e5e7eb', textAlign: 'center', marginBottom: 24, lineHeight: 24 }}>
            {t('tutorial.l4.didYouKnowBody')}
          </Text>
          {engine.phase === 'await-mimic' && (
            <TouchableOpacity
              style={{ backgroundColor: '#f59e0b', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 }}
              onPress={() => tutorialBus.emitUserEvent({ kind: 'l4DidYouKnowAck' })}
            >
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>
                {t('tutorial.l4.didYouKnowCta')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* L11 (multi-play) step 0: "הידעת?" intro overlay */}
      {isL11Intro && (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(5,10,22,0.93)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            paddingHorizontal: 32,
          }}
        >
          <Text style={{ fontSize: 40, marginBottom: 8 }}>💡</Text>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#fde68a', marginBottom: 4, textAlign: 'center' }}>
            {t('tutorial.identicalMulti.didYouKnow')}
          </Text>
          <Text style={{ fontSize: 14, color: '#9ca3af', marginBottom: 12, textAlign: 'center' }}>
            {t('tutorial.identicalMulti.bestTip')}
          </Text>
          <Text style={{ fontSize: 16, color: '#e5e7eb', textAlign: 'center', marginBottom: 24, lineHeight: 24 }}>
            {t('tutorial.identicalMulti.body')}
          </Text>
          {engine.phase === 'await-mimic' && (
            <TouchableOpacity
              style={{
                backgroundColor: '#f59e0b',
                borderRadius: 10,
                paddingVertical: 12,
                paddingHorizontal: 32,
              }}
              onPress={() => tutorialBus.emitUserEvent({ kind: 'identicalMultiAck' })}
            >
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>
                {t('tutorial.identicalMulti.cta')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
          (isDiceLesson && engine.phase !== 'bot-demo');
        // Compact bubble for L6 (possible results) + L7 (fractions) — both
        // lessons teach UI that lives at the TOP of the real game board
        // (green chip at top:84 / discard pile at top:50). A full-width
        // bubble at top:55 would cover exactly what the learner is supposed
        // to look at. Placing the compact bubble at top:400 keeps it in the
        // middle of the screen where no teaching target lives.
        // Exception: frac-intro (stepIndex 0) renders its own two-bubble
        // layout — suppress the default compact bubble there.
        const isL6 = isPossibleResultsLesson;
        const isFracIntroStep = isFracLesson && engine.stepIndex === 0 &&
          (engine.phase === 'bot-demo' || engine.phase === 'await-mimic');
        const compactMid =
          (((isL6 || isFracLesson) && !isFracIntroStep) ||
            (isParensLesson && engine.phase === 'celebrate'));
        const isL9Stage0Bubble = isL9Lesson && engine.phase === 'await-mimic' && l9Stage === 0;
        const isL9Stage1Bubble = isL9Lesson && engine.phase === 'await-mimic' && l9Stage === 1;
        return (
          <View
            pointerEvents={isParensLesson && engine.phase === 'celebrate' ? 'box-none' : 'none'}
            style={
              isL9Stage0Bubble
                ? { position: 'absolute', top: 130, left: 16, right: 16, alignItems: 'center', zIndex: 9200 }
                : isL9Stage1Bubble
                  ? { position: 'absolute', top: 55, left: 16, right: 16, alignItems: 'center', zIndex: 9200 }
                  : compactMid
                    ? { position: 'absolute', top: 400, left: 16, right: 16, alignItems: 'center', zIndex: 9200 }
                    : bubbleAtTop
                      ? { position: 'absolute', top: 55, left: 16, right: 16, alignItems: 'center', zIndex: 9200 }
                      : { position: 'absolute', bottom: BUBBLE_BOTTOM, left: 0, right: 0, alignItems: 'center', zIndex: 9200 }
            }
          >
            <HappyBubble
              text={bubbleText}
              tone={bubbleTone}
              arrowSize={compactMid || bubbleAtTop || isL9Stage0Bubble || isL9Stage1Bubble ? 'small' : 'big'}
              size={compactMid || isL9Stage0Bubble || isL9Stage1Bubble ? 'compact' : 'normal'}
              maxWidth={compactMid || isL9Stage0Bubble || isL9Stage1Bubble ? 320 : undefined}
              tailTop={false}
            />
          </View>
        );
      })() : null}

      {engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
       engine.phase === 'await-mimic' &&
       l7CompletedExercises === 0 &&
       !l7FanHintHidden &&
       !l7Mismatch ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: FAN_BOTTOM + 14,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 9210,
          }}
        >
          <HappyBubble
            text={t('tutorial.l8.continueParens')}
            tone="celebrate"
            size="compact"
            arrowSize="small"
            maxWidth={300}
            tailTop={false}
          />
        </View>
      ) : null}

      {engine.lessonIndex === MIMIC_PARENS_LESSON_INDEX &&
       engine.phase === 'await-mimic' &&
       l7CompletedExercises === 1 &&
       !l7FanHintHidden &&
       !l7Mismatch ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: FAN_BOTTOM + 14,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 9210,
          }}
        >
          <HappyBubble
            text={t('tutorial.l8.secondExerciseHint')}
            tone="celebrate"
            size="compact"
            arrowSize="small"
            maxWidth={320}
            tailTop={false}
          />
        </View>
      ) : null}

      {/* Fractions lesson — pulsing halo around the discard pile.
          The pile is positioned in the game at `top: 50, right: 12` with
          roughly 96px width and ~120px height (card + count badge). We
          draw a gold ring just outside its bounds that pulses in sync
          with `fracPilePulse`. */}
      {/* Fractions attack/defend steps (stepIndex > 0) — multi-layer pulsing
          glow around the pile card, like a glowing button. Three rings:
          outer fill-glow, mid halo ring, inner sharp border. */}
      {isFracLesson && engine.stepIndex > 0 && engine.stepIndex !== 3 ? (
        <>
          {/* Outer fill-glow — large, very soft */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: 28, right: -10, width: 140, height: 158,
            borderRadius: 28, backgroundColor: 'rgba(252,211,77,0.18)',
            opacity: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.7] }),
            transform: [{ scale: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.18] }) }],
            zIndex: 9140,
          }} />
          {/* Mid halo ring */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: 36, right: -2, width: 124, height: 142,
            borderRadius: 22, borderWidth: 3, borderColor: '#FCD34D',
            opacity: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.85] }),
            transform: [{ scale: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.12] }) }],
            zIndex: 9148,
            ...Platform.select({
              ios: { shadowColor: '#FCD34D', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 18 },
              android: { elevation: 12 },
            }),
          }} />
          {/* Inner sharp border — tightest ring, brightest pulse */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: 42, right: 4, width: 112, height: 130,
            borderRadius: 16, borderWidth: 3.5, borderColor: '#FEF08A',
            opacity: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            transform: [{ scale: fracPilePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
            zIndex: 9155,
            ...Platform.select({
              ios: { shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 14 },
              android: { elevation: 18 },
            }),
          }} />
        </>
      ) : null}

      {/* Frac attack steps (stepIndex 1–2) — HappyBubble near pile with pile value. */}
      {isFracLesson && (engine.stepIndex === 1 || engine.stepIndex === 2) &&
       (engine.phase === 'bot-demo' || engine.phase === 'await-mimic') ? (() => {
        const pileTop = gameState?.discardPile?.[gameState.discardPile.length - 1];
        const pileVal: number | null = pileTop?.type === 'number' ? (pileTop as { type: 'number'; value: number }).value : null;
        const pileText = locale === 'he'
          ? `בערימה יש ${pileVal ?? '…'} והוא מתחלק ב${engine.stepIndex === 1 ? '½' : '⅓'}`
          : `Pile is ${pileVal ?? '…'} — divides by ${engine.stepIndex === 1 ? '½' : '⅓'}`;
        return (
          <View pointerEvents="none" style={{ position: 'absolute', top: 340, left: 16, right: 16, alignItems: 'center', zIndex: 9310 }}>
            <HappyBubble text={pileText} tone="turn" withTail={false} size="compact" maxWidth={320} />
          </View>
        );
      })() : null}

      {/* Fractions intro (frac-intro, stepIndex 0) — full-screen dark spotlight,
          only the pile card visible. Two-stage button flow:
          Stage 0: pile label + "הבנתי" → advances to stage 1 locally.
          Stage 1: styled lesson bubble + "הבנתי" → fires fracLessonAck → practice. */}
      {isFracLesson && engine.stepIndex === 0 && (engine.phase === 'bot-demo' || engine.phase === 'await-mimic') ? (
        <>
          {/* Full-screen dark overlay — 3 rects exposing only the pile */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, backgroundColor: 'rgba(5, 10, 22, 0.92)', zIndex: 9200 }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: 40, left: 0, right: 116, height: 162, backgroundColor: 'rgba(5, 10, 22, 0.92)', zIndex: 9200 }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: 202, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 10, 22, 0.92)', zIndex: 9200 }} />

          {/* ── Stage 0: pile label bubble + first "הבנתי" ── */}
          {fracIntroStage === 0 ? (
            <>
              {/* Flashing card-arrow pointing at the pile from the left */}
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 88,
                  right: 126,
                  zIndex: 9400,
                  opacity: fracArrowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
                  transform: [
                    { scale: fracArrowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.06] }) },
                    { translateX: fracArrowPulse.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                  ],
                }}
              >
                {/* Depth shadow — offset for 3D card feel */}
                <View pointerEvents="none" style={{ position: 'absolute', top: 5, left: 5, right: -5, bottom: -5, backgroundColor: '#92400E', borderRadius: 14 }} />
                {/* Front face */}
                <View pointerEvents="none" style={{
                  backgroundColor: '#FCD34D', borderRadius: 14,
                  paddingHorizontal: 14, paddingVertical: 12,
                  borderWidth: 2.5, borderColor: '#F59E0B',
                  alignItems: 'center', justifyContent: 'center',
                  ...Platform.select({
                    ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 12 },
                    android: { elevation: 10 },
                  }),
                }}>
                  <Text style={{ fontSize: 28, color: '#78350F', fontWeight: '900' }}>{'→'}</Text>
                </View>
              </Animated.View>

              {/* Label bubble below pile, arrow up — bigger and centered */}
              <View pointerEvents="none" style={{ position: 'absolute', top: 202, left: 8, right: 8, alignItems: 'flex-end', zIndex: 9310 }}>
                <View style={{ marginRight: 90, width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 13, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#F59E0B' }} />
                <View style={{ width: '100%', backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 2.5, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 16, ...Platform.select({ ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 10 }, android: { elevation: 8 } }) }}>
                  <Text style={{ color: '#78350F', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
                    {locale === 'he' ? 'זאת ערימת הקלפים' : 'This is the card pile'}
                  </Text>
                </View>
              </View>

              {engine.phase === 'await-mimic' ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setFracIntroStage(1)}
                  style={{ position: 'absolute', bottom: GOT_IT_BOTTOM_ADV, left: 0, right: 0, alignItems: 'center', zIndex: 9410 }}
                >
                  <View style={{ backgroundColor: '#2563EB', borderRadius: 20, paddingVertical: 15, paddingHorizontal: 48, borderWidth: 2, borderColor: '#93C5FD', ...Platform.select({ ios: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 }, android: { elevation: 12 } }) }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>
                      {locale === 'he' ? 'הבנתי ✓' : 'Got it ✓'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}

          {/* ── Stage 1: styled lesson bubble + second "הבנתי" → fracLessonAck ── */}
          {fracIntroStage === 1 ? (
            <>
              <View pointerEvents="none" style={{ position: 'absolute', top: 200, left: 18, right: 18, zIndex: 9210 }}>
                <View style={{
                  backgroundColor: '#0F1E3A',
                  borderColor: '#3B82F6',
                  borderWidth: 2,
                  borderRadius: 24,
                  paddingHorizontal: 24,
                  paddingVertical: 26,
                  alignItems: 'center',
                  gap: 10,
                  ...Platform.select({ ios: { shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 22 }, android: { elevation: 18 } }),
                }}>
                  <Text style={{ color: '#93C5FD', fontSize: 15, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 }}>
                    {locale === 'he' ? 'איך מאתגרים את השחקן הבא?' : 'How to challenge the next player?'}
                  </Text>
                  <Text style={{ color: '#FCD34D', fontSize: 30, fontWeight: '900', textAlign: 'center' }}>
                    {locale === 'he' ? 'עם קלף שבר!' : 'With a Fraction card!'}
                  </Text>
                  <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(59,130,246,0.3)' }} />
                  <Text style={{ color: '#CBD5E1', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 21 }}>
                    {locale === 'he'
                      ? 'שחקן יכול לאתגר כשהמספר\nבערימה מתחלק בשבר שלו'
                      : 'A player can challenge when the\npile number is divisible by their fraction'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => tutorialBus.emitUserEvent({ kind: 'fracLessonAck' })}
                style={{ position: 'absolute', bottom: GOT_IT_BOTTOM_ADV, left: 0, right: 0, alignItems: 'center', zIndex: 9300 }}
              >
                <View style={{ backgroundColor: '#2563EB', borderRadius: 20, paddingVertical: 15, paddingHorizontal: 42, borderWidth: 2, borderColor: '#93C5FD', ...Platform.select({ ios: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 }, android: { elevation: 12 } }) }}>
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>
                    {locale === 'he' ? 'הבנתי — בוא ננסה ›' : 'Got it — let\'s try! ›'}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          ) : null}
        </>
      ) : null}


      {/* ── Defense intro (stepIndex 3, stage 0): concept bubble ── */}
      {isFracLesson && engine.stepIndex === 3 && fracDefenseIntroStage === 0 &&
       (engine.phase === 'bot-demo' || engine.phase === 'await-mimic') ? (
        <>
          {/* Dark overlay over entire screen */}
          <View pointerEvents="auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,22,0.88)', zIndex: 9250 }} />
          {/* Defense concept bubble — same style as the attack intro bubble */}
          <View pointerEvents="none" style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 24, zIndex: 9260,
          }}>
            <View style={{
              backgroundColor: '#1e1b4b',
              borderWidth: 2,
              borderColor: '#6366F1',
              borderRadius: 24,
              paddingHorizontal: 24,
              paddingVertical: 26,
              alignItems: 'center',
              gap: 10,
              ...Platform.select({
                ios: { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 22 },
                android: { elevation: 18 },
              }),
            }}>
              <Text style={{ color: '#FCD34D', fontSize: 26, fontWeight: '900', textAlign: 'center' }}>
                {locale === 'he' ? 'הגנה' : 'Defense'}
              </Text>
              <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(99,102,241,0.3)' }} />
              <Text style={{ color: '#E2E8F0', fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 23 }}>
                {locale === 'he'
                  ? 'הנח קלף שבר כדי להעביר את האתגר\nאו הנח קלף שמתחלק בשבר'
                  : 'Play a fraction card to pass the challenge\nor play a card divisible by the fraction'}
              </Text>
            </View>
          </View>
          {/* "הבנתי" button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFracDefenseIntroStage(1)}
            style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
          >
            <View style={{
              backgroundColor: '#4F46E5',
              borderRadius: 20,
              paddingVertical: 15,
              paddingHorizontal: 42,
              borderWidth: 2,
              borderColor: '#A5B4FC',
              ...Platform.select({
                ios: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                android: { elevation: 12 },
              }),
            }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>
                {locale === 'he' ? 'הבנתי — בוא ננסה ›' : 'Got it — let\'s try! ›'}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {/* ── Defend steps (stepIndex 3-4): HappyBubble hint ── */}
      {/* stepIndex 5 (bonus) has its own more specific bubble — suppress this one there */}
      {isFracLesson && engine.stepIndex >= 3 && engine.stepIndex < 5 && (engine.stepIndex > 3 || fracDefenseIntroStage === 1) && (engine.phase === 'bot-demo' || engine.phase === 'await-mimic') ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 340, left: 16, right: 16, alignItems: 'center', zIndex: 9210 }}>
          <HappyBubble
            text={locale === 'he' ? 'לחצו על קלף מתאים להגנה' : 'Tap a matching card to defend'}
            tone="turn"
            withTail={false}
            size="compact"
            maxWidth={320}
          />
        </View>
      ) : null}

      {/* ── Bonus defense step (stepIndex 5): "הידעת?" intro + fraction-only practice ── */}
      {isFracLesson && engine.stepIndex === 5 && engine.phase === 'await-mimic' &&
       !(fracDefenseUsedFractionRef.current.step3 || fracDefenseUsedFractionRef.current.step4) ? (
        <>
          {fracBonusStage === 0 ? (
            <>
              {/* Dark overlay */}
              <View pointerEvents="auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,22,0.88)', zIndex: 9250 }} />
              {/* "הידעת?" bubble */}
              <View pointerEvents="none" style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                alignItems: 'center', justifyContent: 'center',
                paddingHorizontal: 24, zIndex: 9260,
              }}>
                <View style={{
                  backgroundColor: '#14532d',
                  borderWidth: 2,
                  borderColor: '#22C55E',
                  borderRadius: 24,
                  paddingHorizontal: 24,
                  paddingVertical: 26,
                  alignItems: 'center',
                  gap: 10,
                  ...Platform.select({
                    ios: { shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 22 },
                    android: { elevation: 18 },
                  }),
                }}>
                  <Text style={{ color: '#86EFAC', fontSize: 15, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 }}>
                    {locale === 'he' ? 'הידעת?' : 'Did you know?'}
                  </Text>
                  <Text style={{ color: '#FCD34D', fontSize: 24, fontWeight: '900', textAlign: 'center', lineHeight: 30 }}>
                    {locale === 'he'
                      ? 'אפשר גם להניח קלף שבר כהגנה!'
                      : 'You can also play a fraction card to defend!'}
                  </Text>
                  <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(34,197,94,0.3)' }} />
                  <Text style={{ color: '#D1FAE5', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 21 }}>
                    {locale === 'he'
                      ? 'קלף שבר מעביר את האתגר לשחקן הבא'
                      : 'A fraction card passes the challenge to the next player'}
                  </Text>
                </View>
              </View>
              {/* "בוא ננסה" button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFracBonusStage(1)}
                style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', zIndex: 9270 }}
              >
                <View style={{
                  backgroundColor: '#16A34A',
                  borderRadius: 20,
                  paddingVertical: 15,
                  paddingHorizontal: 42,
                  borderWidth: 2,
                  borderColor: '#86EFAC',
                  ...Platform.select({
                    ios: { shadowColor: '#16A34A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
                    android: { elevation: 12 },
                  }),
                }}>
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>
                    {locale === 'he' ? 'בוא ננסה ›' : 'Let\'s try! ›'}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            /* Stage 1: hint to tap a fraction card only */
            <View pointerEvents="none" style={{ position: 'absolute', top: 340, left: 16, right: 16, alignItems: 'center', zIndex: 9260 }}>
              <HappyBubble
                text={locale === 'he' ? 'לחצו על קלף שבר להגנה' : 'Tap a fraction card to defend'}
                tone="turn"
                withTail={false}
                size="compact"
                maxWidth={320}
              />
            </View>
          )}
        </>
      ) : null}

      {/* Parens lesson: bubble UI temporarily removed — re-add one by one. */}

      {/* Lesson 4 (build equation) body is intentionally EMPTY here:
          the lesson is performed on the real game's EquationBuilder + fan.
          The tutorial only contributes the speech bubble + (later) highlights. */}

      {/* Removed by request: no "try again" happy/error bubble overlay. */}

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




      {/* Welcome bubble — shown at the very start before any lesson begins */}
      {showWelcomeBubble && engine.phase !== 'idle' && (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.60)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9400,
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#78350F',
              borderRadius: 26,
              paddingVertical: 38,
              paddingHorizontal: 28,
              borderWidth: 3,
              borderColor: '#FACC15',
              maxWidth: 460,
              width: '100%',
              alignItems: 'center',
              gap: 16,
              ...Platform.select({
                ios: { shadowColor: '#FACC15', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 20 },
                android: { elevation: 12 },
              }),
            }}
          >
            <Text style={{ color: '#FEF3C7', fontSize: 30, fontWeight: '900', textAlign: 'center' }}>
              {t('tutorial.welcome.title')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Text style={{ color: '#FDE68A', fontSize: 20, fontWeight: '800', textAlign: 'center', flexShrink: 1 }}>
                {t('tutorial.welcome.coreReward')}
              </Text>
              <SlindaCoin size={24} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Text style={{ color: '#FDE68A', fontSize: 17, fontWeight: '600', textAlign: 'center', opacity: 0.9, flexShrink: 1 }}>
                {t('tutorial.welcome.advancedReward')}
              </Text>
              <SlindaCoin size={20} />
            </View>
            <TouchableOpacity
              onPress={() => setShowWelcomeBubble(false)}
              style={{
                paddingVertical: 15,
                paddingHorizontal: 28,
                borderRadius: 18,
                backgroundColor: '#F59E0B',
                borderWidth: 2,
                borderColor: '#FCD34D',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#431407', fontWeight: '900', fontSize: 17 }}>
                {t('tutorial.welcome.start')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowWelcomeBubble(false);
                dispatchEngine({ type: 'JUMP_TO_ADVANCED' });
              }}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: 18,
                backgroundColor: '#6D28D9',
                borderWidth: 2,
                borderColor: '#C4B5FD',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 16 }}>
                {locale === 'he' ? 'הדרכת מיתקדמים' : 'Advanced Tutorial'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Core tutorial finished — choice screen: continue to fractions or start real game. */}
      {engine.phase === 'core-complete' ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.60)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9400,
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#78350F',
              borderRadius: 24,
              paddingVertical: 32,
              paddingHorizontal: 24,
              borderWidth: 3,
              borderColor: '#FACC15',
              maxWidth: 380,
              width: '100%',
              alignItems: 'center',
              gap: 14,
              ...Platform.select({
                ios: { shadowColor: '#FACC15', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 20 },
                android: { elevation: 12 },
              }),
            }}
          >
            <Text style={{ color: '#FEF3C7', fontSize: 26, fontWeight: '900', textAlign: 'center' }}>
              {t('tutorial.coreComplete.title')}
            </Text>
            {(skipCount > 2 || tutorialCoinsEarnedCount >= 2) ? (
              <>
                <Text style={{ color: '#FCA5A5', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
                  {t('tutorial.coreComplete.bodySkipped')}
                </Text>
                <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '600', textAlign: 'center', opacity: 0.75, marginTop: -6 }}>
                  {tutorialCoinsEarnedCount >= 2
                    ? t('tutorial.coreComplete.bodyLimitSub')
                    : t('tutorial.coreComplete.bodySkippedSub')}
                </Text>
              </>
            ) : (
              <Text style={{ color: '#FDE68A', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
                {t('tutorial.coreComplete.body')}
              </Text>
            )}
            <Text style={{ color: '#FDE68A', fontSize: 15, fontWeight: '600', textAlign: 'center', opacity: 0.9 }}>
              {t('tutorial.coreComplete.advancedOffer')}
            </Text>
            {/* Advanced fractions option */}
            <TouchableOpacity
              onPress={() => dispatchEngine({ type: 'CHOOSE_ADVANCED_FRACTIONS' })}
              style={{
                paddingVertical: 15,
                paddingHorizontal: 28,
                borderRadius: 18,
                backgroundColor: '#F59E0B',
                borderWidth: 2,
                borderColor: '#FCD34D',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#431407', fontWeight: '900', fontSize: 17 }}>
                {t('tutorial.coreComplete.advancedBtn')}
              </Text>
            </TouchableOpacity>
            {/* Real game — exits tutorial */}
            <TouchableOpacity
              onPress={onExit}
              style={{
                paddingVertical: 15,
                paddingHorizontal: 28,
                borderRadius: 18,
                backgroundColor: '#10B981',
                borderWidth: 2,
                borderColor: '#34D399',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, textAlign: 'center' }}>
                {t('tutorial.coreComplete.realGameBtn')}
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

      {/* Legacy standalone intro/theory "Continue" button was removed when
          the fractions lesson merged into direct attack steps — each step's
          outcome is now a real card tap, not a Continue click. */}

      {/* ── Advanced-complete: celebratory "סיימתם את ההדרכה!" modal ── */}
      {engine.phase === 'advanced-complete' ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9400,
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#78350F',
              borderRadius: 24,
              paddingVertical: 32,
              paddingHorizontal: 24,
              borderWidth: 3,
              borderColor: '#FACC15',
              maxWidth: 380,
              width: '100%',
              alignItems: 'center',
              gap: 14,
              ...Platform.select({
                ios: { shadowColor: '#FACC15', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 20 },
                android: { elevation: 12 },
              }),
            }}
          >
            <Text style={{ color: '#FEF3C7', fontSize: 26, fontWeight: '900', textAlign: 'center' }}>
              {t('tutorial.advancedComplete.title')}
            </Text>
            {skipCount > 2 ? (
              <>
                <Text style={{ color: '#FCA5A5', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
                  {t('tutorial.advancedComplete.bodySkipped')}
                </Text>
                <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '600', textAlign: 'center', opacity: 0.75, marginTop: -6 }}>
                  {t('tutorial.coreComplete.bodySkippedSub')}
                </Text>
              </>
            ) : (
              <Text style={{ color: '#FDE68A', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
                {t('tutorial.advancedComplete.body')}
              </Text>
            )}
            <TouchableOpacity
              onPress={() => {
                dispatchEngine({ type: 'DISMISS_ADVANCED_COMPLETE' });
                onExit();
              }}
              style={{
                paddingVertical: 15,
                paddingHorizontal: 28,
                borderRadius: 18,
                backgroundColor: '#10B981',
                borderWidth: 2,
                borderColor: '#34D399',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, textAlign: 'center' }}>
                {t('tutorial.advancedComplete.realGameBtn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* All-done: "יאללה נשחק!" CTA — returns to the mode picker */}
      {engine.phase === 'all-done' ? (
        <View style={{ position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center', zIndex: 9300 }}>
          <TouchableOpacity
            onPress={onExit}
            activeOpacity={0.8}
            style={{
              paddingVertical: 18,
              paddingHorizontal: 48,
              backgroundColor: '#10B981',
              borderRadius: 28,
              borderWidth: 3,
              borderColor: '#34D399',
              ...Platform.select({
                ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 18 },
                android: { elevation: 14 },
              }),
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: 0.5 }}>{t('tutorial.engine.exitAndReturn')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}


