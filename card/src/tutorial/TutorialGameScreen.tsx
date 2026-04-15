// ============================================================
// TutorialGameScreen.tsx — Interactive tutorial game screen
// Renders as an overlay on top of the real game screens.
// Observes game state changes to advance tutorial steps.
// Controls bot turns via delayed dispatches.
// ============================================================

import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { TutorialProvider, useTutorial } from './TutorialContext';
import { TutorialSpeechBubble } from './TutorialSpeechBubble';
import { TutorialHintBar } from './TutorialHintBar';
import { getLesson, TOTAL_LESSONS } from './tutorialLessons';
import { generateTutorialHand } from './generateTutorialHand';
import { useLocale } from '../i18n/LocaleContext';
import ValueRibbon from '../components/onboarding/ValueRibbon';
import SourceGeneratorButton from '../components/onboarding/SourceGeneratorButton';
import EquationSlots from '../components/onboarding/EquationSlots';
import FlexibleVariableInput from '../components/onboarding/FlexibleVariableInput';
import MasteryHeader from '../components/onboarding/MasteryHeader';
import type { RibbonTile } from '../components/onboarding/types';
import { createInitialOnboardingState, onboardingReducer } from './onboardingReducer';

const TUTORIAL_SEEN_KEY = 'salinda_tutorial_seen_v1';

interface TutorialGameScreenProps {
  onExit: () => void;
  gameDispatch: (action: any) => void;
  gameState: any;
}

function TutorialGameContent({ onExit, gameDispatch, gameState }: TutorialGameScreenProps) {
  const { state: tut, dispatch: tutDispatch } = useTutorial();
  const { t, locale } = useLocale();
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onboardingTiles = useMemo<RibbonTile[]>(
    () => [
      { id: 'target-9', kind: 'target', value: 9 },
      { id: 'target-4', kind: 'target', value: 4 },
      { id: 'target-8', kind: 'target', value: 8 },
      { id: 'target-11', kind: 'target', value: 11 },
      { id: 'op-plus', kind: 'operator', value: '+', label: '+' },
      { id: 'op-minus', kind: 'operator', value: '-', label: '-' },
      { id: 'flex-x', kind: 'flexible', label: 'x' },
    ],
    [],
  );
  const [onboardingState, onboardingDispatch] = useReducer(
    onboardingReducer,
    onboardingTiles,
    createInitialOnboardingState,
  );
  const [timerProgress, setTimerProgress] = useState(1);

  useEffect(() => {
    onboardingDispatch({ type: 'SET_EQUATION_TARGET', index: 0, targetTileId: 'target-9' });
    onboardingDispatch({ type: 'SET_EQUATION_TARGET', index: 1, targetTileId: 'target-4' });
  }, []);

  useEffect(() => {
    if (!onboardingState.timedMasteryEnabled) {
      setTimerProgress(1);
      return;
    }
    setTimerProgress(1);
    const start = Date.now();
    const durationMs = 45000;
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.max(0, 1 - elapsed / durationMs);
      setTimerProgress(next);
    }, 150);
    return () => clearInterval(timer);
  }, [onboardingState.timedMasteryEnabled]);

  // ── Start tutorial on mount ──
  useEffect(() => {
    tutDispatch({ type: 'START_TUTORIAL' });
  }, [tutDispatch]);

  // ── Auto-start game when in setup phase ──
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (!tut.active || hasStartedRef.current) return;
    if (gameState.phase === 'setup') {
      hasStartedRef.current = true;
      const lesson = getLesson(tut.lessonIndex);
      gameDispatch({
        type: 'START_GAME',
        players: [
          { name: locale === 'he' ? 'בוט מורה' : 'Coach Bot' },
          { name: locale === 'he' ? 'אתה' : 'You' },
        ],
        difficulty: 'easy',
        mode: 'pass-and-play',
        isTutorial: true,
        fractions: lesson.showFractions,
        fractionKinds: lesson.fractionKinds,
        showPossibleResults: true,
        showSolveExercise: true,
        enabledOperators: lesson.enabledOperators,
        mathRangeMax: lesson.maxRange,
        timerSetting: 'off' as const,
        timerCustomSeconds: 60,
        difficultyStage: 'A',
      });
    }
  }, [tut.active, gameState.phase, tut.lessonIndex, locale]);

  // ── Rig hands after game starts ──
  const handsRiggedForLessonRef = useRef(-1);
  useEffect(() => {
    if (!tut.active) return;
    if (gameState.phase !== 'turn-transition' && gameState.phase !== 'pre-roll') return;
    if (handsRiggedForLessonRef.current === tut.lessonIndex) return;
    if (!gameState.players || gameState.players.length < 2) return;

    const lesson = getLesson(tut.lessonIndex);
    const dice = gameState.dice ?? { die1: 3, die2: 4, die3: 2 };
    const result = generateTutorialHand(dice, lesson);

    handsRiggedForLessonRef.current = tut.lessonIndex;
    gameDispatch({
      type: 'TUTORIAL_SET_HANDS',
      hands: [result.botHand, result.playerHand],
      ...(result.discardTop ? { discardPile: [result.discardTop] } : {}),
    });
  }, [tut.active, tut.lessonIndex, gameState.phase, gameState.players]);

  // ── Re-rig user hand after dice roll ──
  const lastDiceSeqRef = useRef(-1);
  useEffect(() => {
    if (!tut.active || tut.turn !== 'user') return;
    if (gameState.phase !== 'building') return;
    if (!gameState.dice) return;

    const diceSeq = gameState.diceRollSeq ?? 0;
    if (lastDiceSeqRef.current === diceSeq) return;
    lastDiceSeqRef.current = diceSeq;

    const lesson = getLesson(tut.lessonIndex);
    const result = generateTutorialHand(gameState.dice, lesson);

    gameDispatch({
      type: 'TUTORIAL_SET_HANDS',
      hands: [gameState.players[0].hand, result.playerHand],
    });
  }, [tut.active, tut.turn, gameState.phase, gameState.dice, gameState.diceRollSeq]);

  // ── Bot turn automation ──
  // When it's bot's turn (player 0) and tutorial says 'bot', auto-play
  useEffect(() => {
    if (!tut.active || tut.turn !== 'bot' || tut.showLessonIntro) return;
    if (gameState.phase === 'game-over' || gameState.phase === 'setup') return;
    // Only act when game's current player is player 0 (bot)
    if (gameState.currentPlayerIndex !== 0) return;

    const lesson = getLesson(tut.lessonIndex);
    const step = lesson.botSteps[tut.stepIndex];
    if (!step) {
      // No more bot steps — advance to user
      tutDispatch({ type: 'ADVANCE_TO_USER_TURN' });
      return;
    }

    const delay = step.botDelayMs ?? 1500;
    botTimerRef.current = setTimeout(() => {
      executeBotStep(gameState.phase, gameDispatch, gameState);
      tutDispatch({ type: 'BOT_STEP_DONE' });
    }, delay);

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [tut.active, tut.turn, tut.stepIndex, tut.lessonIndex, tut.showLessonIntro,
      gameState.phase, gameState.currentPlayerIndex]);

  // ── Observe game state to advance user steps ──
  // Track phase transitions to know when user completed an action
  const prevPhaseRef = useRef(gameState.phase);
  const prevPlayerIdxRef = useRef(gameState.currentPlayerIndex);
  useEffect(() => {
    if (!tut.active || tut.turn !== 'user') return;

    const phaseChanged = prevPhaseRef.current !== gameState.phase;
    const playerChanged = prevPlayerIdxRef.current !== gameState.currentPlayerIndex;
    prevPhaseRef.current = gameState.phase;
    prevPlayerIdxRef.current = gameState.currentPlayerIndex;

    if (phaseChanged || playerChanged) {
      // User did something that changed the game state — advance tutorial step
      tutDispatch({ type: 'USER_STEP_COMPLETED' });
    }
  }, [tut.active, tut.turn, gameState.phase, gameState.currentPlayerIndex,
      gameState.hasPlayedCards, gameState.stagedCards?.length]);

  // ── Detect turn switches ──
  useEffect(() => {
    if (!tut.active || tut.showLessonIntro) return;
    // Bot is player 0, user is player 1
    if (gameState.currentPlayerIndex === 1 && tut.turn === 'bot') {
      tutDispatch({ type: 'ADVANCE_TO_USER_TURN' });
    }
  }, [tut.active, tut.turn, tut.showLessonIntro, gameState.currentPlayerIndex]);

  // When user finishes and it goes back to bot's turn → next lesson
  useEffect(() => {
    if (!tut.active || tut.showLessonIntro) return;
    if (gameState.currentPlayerIndex === 0 && tut.turn === 'user') {
      tutDispatch({ type: 'NEXT_LESSON' });
    }
  }, [tut.active, tut.turn, tut.showLessonIntro, gameState.currentPlayerIndex]);

  // ── Mark seen when completed ──
  useEffect(() => {
    if (tut.completed) {
      void AsyncStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
    }
  }, [tut.completed]);

  // ── Dismiss wrong-action feedback ──
  useEffect(() => {
    if (!tut.wrongActionFeedback) return;
    const timer = setTimeout(() => tutDispatch({ type: 'DISMISS_WRONG_ACTION' }), 2000);
    return () => clearTimeout(timer);
  }, [tut.wrongActionFeedback, tutDispatch]);

  // ── Render ──
  const speechText = tut.speechBubble ? t(tut.speechBubble.textKey, tut.speechBubble.params) : '';
  const hintText = tut.hintTextKey ? t(tut.hintTextKey) : '';

  // Lesson intro
  if (tut.showLessonIntro && tut.active) {
    const lesson = getLesson(tut.lessonIndex);
    return (
      <LessonIntroOverlay
        lessonNumber={tut.lessonIndex + 1}
        totalLessons={TOTAL_LESSONS}
        title={t(lesson.titleKey)}
        description={t(lesson.descKey)}
        onContinue={() => tutDispatch({ type: 'DISMISS_LESSON_INTRO' })}
      />
    );
  }

  // Tutorial completed
  if (tut.completed) {
    return <TutorialCompleteOverlay onExit={onExit} t={t} />;
  }

  if (!tut.active) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {tut.showMathOnboarding ? (
        <View style={styles.mathOnboardingWrap}>
          <MasteryHeader
            cumulativeSum={onboardingState.cumulativeSum}
            remainingTargets={onboardingState.remainingTargetIds.length}
            timedMasteryEnabled={onboardingState.timedMasteryEnabled}
            timerProgress={timerProgress}
          />
          <View style={styles.mathToggleRow}>
            <Text style={styles.mathHintText}>{t('tutorial.onboarding.timed')}</Text>
            <TouchableOpacity
              style={styles.mathToggleBtn}
              onPress={() => onboardingDispatch({ type: 'TOGGLE_TIMED_MASTERY', enabled: !onboardingState.timedMasteryEnabled })}
            >
              <Text style={styles.mathToggleText}>{onboardingState.timedMasteryEnabled ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.mathHintText}>{t('tutorial.onboarding.ribbonHint')}</Text>
          <ValueRibbon
            tiles={onboardingTiles}
            selectedTileIds={onboardingState.selectedTileIds}
            remainingTargetIds={onboardingState.remainingTargetIds}
            onSelectTile={(tileId) => onboardingDispatch({ type: 'SELECT_TILE', tileId })}
            onUserScrolled={() => onboardingDispatch({ type: 'USER_SCROLLED' })}
            onDemoScrolled={() => onboardingDispatch({ type: 'DEMO_SCROLL_DONE' })}
          />

          <View style={styles.mathCenterAction}>
            <SourceGeneratorButton
              disabled={onboardingState.generateClicked}
              label={t('tutorial.onboarding.generate')}
              onPress={() => onboardingDispatch({ type: 'GENERATE_SOURCES', values: [5, 4, 1, 6, 2] })}
            />
          </View>

          <EquationSlots
            equations={onboardingState.equations}
            activeEquationIndex={onboardingState.activeEquationIndex}
            sourceNumbers={onboardingState.sourceNumbers}
            onSelectEquation={(index) => onboardingDispatch({ type: 'SET_ACTIVE_EQUATION', index })}
            onTapSource={(number) => onboardingDispatch({ type: 'TAP_SOURCE_NUMBER', number })}
            onToggleOperator={(index) => onboardingDispatch({ type: 'TOGGLE_EQUATION_OPERATOR', index })}
            onConfirmEquation={(index) => onboardingDispatch({ type: 'CONFIRM_EQUATION', index })}
          />

          <View style={styles.mathBottomRow}>
            <TouchableOpacity
              style={[styles.mathDoneBtn, onboardingState.masteryAchieved && styles.mathDoneBtnOn]}
              onPress={() => tutDispatch({ type: 'DISMISS_MATH_ONBOARDING' })}
            >
              <Text style={styles.mathDoneText}>
                {onboardingState.masteryAchieved ? t('tutorial.onboarding.done') : t('tutorial.onboarding.skip')}
              </Text>
            </TouchableOpacity>
          </View>

          <FlexibleVariableInput
            visible={!!onboardingState.pendingFlexibleTileId}
            title={t('tutorial.onboarding.assignFlex')}
            cancelLabel={t('ui.cancel')}
            confirmLabel={t('ui.confirm')}
            onCancel={() => onboardingDispatch({ type: 'ASSIGN_FLEXIBLE_VALUE', tileId: onboardingState.pendingFlexibleTileId ?? 'flex-x', value: 0 })}
            onSubmit={(value) =>
              onboardingDispatch({
                type: 'ASSIGN_FLEXIBLE_VALUE',
                tileId: onboardingState.pendingFlexibleTileId ?? 'flex-x',
                value,
              })
            }
          />
        </View>
      ) : null}

      {/* Bot speech bubble */}
      <TutorialSpeechBubble
        text={speechText}
        visible={tut.turn === 'bot' && !!tut.speechBubble}
      />

      {/* User hint bar */}
      <TutorialHintBar
        text={hintText}
        visible={tut.turn === 'user' && !!hintText}
      />

      {/* Lesson progress + exit */}
      <View style={styles.progressBar}>
        <Text style={styles.progressText}>
          {t('tutorial.lessonProgress', { current: tut.lessonIndex + 1, total: TOTAL_LESSONS })}
        </Text>
        <TouchableOpacity onPress={onExit} style={styles.exitBtn} activeOpacity={0.7}>
          <Text style={styles.exitBtnText}>✕</Text>
          <Text style={styles.exitBtnLabel}>{t('tutorial.exit')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Execute a bot game action based on actual game phase */
function executeBotStep(
  currentPhase: string,
  dispatch: (action: any) => void,
  state: any,
): void {
  switch (currentPhase) {
    case 'turn-transition':
      dispatch({ type: 'BEGIN_TURN' });
      break;
    case 'pre-roll':
    case 'roll-dice':
      dispatch({ type: 'ROLL_DICE' });
      break;
    case 'building': {
      const targets = state.validTargets ?? [];
      if (targets.length > 0) {
        const target = targets[0];
        dispatch({
          type: 'CONFIRM_EQUATION',
          result: target.result,
          equationDisplay: target.equation,
          equationOps: [],
        });
      } else {
        dispatch({ type: 'DRAW_CARD' });
      }
      break;
    }
    case 'solved': {
      if (state.hasPlayedCards) {
        dispatch({ type: 'END_TURN' });
      } else if (state.stagedCards?.length > 0) {
        dispatch({ type: 'CONFIRM_STAGED' });
      } else {
        const hand = state.players?.[state.currentPlayerIndex]?.hand ?? [];
        const numCard = hand.find((c: any) => c.type === 'number');
        if (numCard) {
          dispatch({ type: 'STAGE_CARD', card: numCard });
        }
      }
      break;
    }
  }
}

// ── Lesson Intro Overlay ──

function LessonIntroOverlay({
  lessonNumber, totalLessons, title, description, onContinue,
}: {
  lessonNumber: number; totalLessons: number; title: string; description: string; onContinue: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, speed: 12, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.introOverlay}>
      <LinearGradient colors={['#070f1a', '#0f2840', '#153252']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.introContent, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.introBadge}>
          <Text style={styles.introBadgeText}>{lessonNumber}/{totalLessons}</Text>
        </View>
        <Text style={styles.introTitle}>{title}</Text>
        <Text style={styles.introDesc}>{description}</Text>
        <TouchableOpacity style={styles.introBtn} onPress={onContinue}>
          <Text style={styles.introBtnText}>▶</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Tutorial Complete Overlay ──

function TutorialCompleteOverlay({ onExit, t }: { onExit: () => void; t: (key: string) => string }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={styles.introOverlay}>
      <LinearGradient colors={['#070f1a', '#0f2840', '#153252']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.introContent, { opacity: fadeAnim }]}>
        <Text style={styles.completeEmoji}>🎉</Text>
        <Text style={styles.introTitle}>{t('tutorial.complete.title')}</Text>
        <Text style={styles.introDesc}>{t('tutorial.complete.desc')}</Text>
        <TouchableOpacity style={styles.introBtn} onPress={onExit}>
          <Text style={styles.introBtnText}>{t('tutorial.complete.play')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Main export ──

export function TutorialGameScreen(props: TutorialGameScreenProps) {
  return (
    <TutorialProvider>
      <TutorialGameContent {...props} />
    </TutorialProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
  },
  mathOnboardingWrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 12,
    zIndex: 10005,
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(2,6,23,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  mathCenterAction: {
    alignItems: 'center',
  },
  mathBottomRow: {
    alignItems: 'center',
  },
  mathDoneBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#374151',
  },
  mathDoneBtnOn: {
    backgroundColor: '#16A34A',
  },
  mathDoneText: {
    color: '#fff',
    fontWeight: '700',
  },
  mathHintText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  mathToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mathToggleBtn: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  mathToggleText: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  progressBar: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10001,
  },
  progressText: {
    fontSize: 11,
    color: 'rgba(255,215,0,0.7)',
    fontWeight: '600',
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(234,67,53,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(234,67,53,0.5)',
    gap: 6,
  },
  exitBtnText: {
    fontSize: 16,
    color: '#FCA5A5',
    fontWeight: '700',
  },
  exitBtnLabel: {
    fontSize: 12,
    color: '#FCA5A5',
    fontWeight: '600',
  },
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    maxWidth: 340,
  },
  introBadge: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  introBadgeText: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '700',
  },
  introTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  introDesc: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  introBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 24,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  introBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  completeEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
});
