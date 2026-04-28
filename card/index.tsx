// ============================================================
// index.tsx — Lolos Card Game — FULL SINGLE FILE
// LinearGradient cards, 3D shadows, rotated deck, thick edges
// ============================================================

import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, useReducer, forwardRef, useImperativeHandle } from 'react';
import type { ReactNode } from 'react';
import type { BotDifficulty } from './src/bot/types';
import { botStepDelayRange } from './shared/botPlan';
import { decideBotAction } from './src/bot/botBrain';
import { translateBotAction } from './src/bot/executor';
import type { BotAction } from './src/bot/types';
import {
  I18nManager, View, Text, TextInput, ScrollView, TouchableOpacity, Image, ImageBackground,
  StyleSheet, Animated, Easing, Dimensions, Modal as RNModal, Platform, PanResponder, Alert,
  Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, NativeModules, AppState,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { LinearGradient } from 'expo-linear-gradient';
import { registerRootComponent } from 'expo';
import { useFonts, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle as SvgCircle, Rect as SvgRect, Path as SvgPath, Polygon as SvgPolygon } from 'react-native-svg';
import { GoldDieFace } from './AnimatedDice';
import { InteractiveTutorialScreen } from './src/tutorial/InteractiveTutorialScreen';
import { tutorialBus } from './src/tutorial/tutorialBus';
import { HappyBubble } from './src/components/HappyBubble';
// RoamingDice inlined below (was ./components/RoamingDice)
import { GoldDiceButton } from './components/GoldDiceButton';
import { LulosButton } from './components/LulosButton';
import { CasinoButton } from './components/CasinoButton';
import { WalkingDice } from './components/WalkingDice';
import FuseTimer from './components/FuseTimer';
import ExcellenceMeter from './components/ExcellenceMeter';
import { SlindaCoin } from './components/SlindaCoin';
import { HorizontalOptionWheel, type HorizontalWheelOption } from './components/HorizontalOptionWheel';
import * as Localization from 'expo-localization';
import { t, type MsgParams } from './shared/i18n';
import {
  DIFFICULTY_STAGE_CONFIG,
  STAGE_SEQUENCE,
  migrateDifficultyStage,
  type DifficultyStageId,
} from './shared/difficultyStages';
import { buildEqOpDisplayCycle, normalizeOperationToken } from './shared/equationOpCycle';

const WELCOME_NOTIFICATION_TITLES = new Set([t('he', 'welcome.title'), t('en', 'welcome.title')]);
const RESULTS_POSSIBLE_TITLES = new Set([t('he', 'results.possibleTitle'), t('en', 'results.possibleTitle')]);
import { LocaleProvider, useLocale } from './src/i18n/LocaleContext';
import { disposeSfx, initializeSfx, playSfx, setSfxMuted, setSfxVolume } from './src/audio/sfx';
// TEMP: capture full stack trace for TypeError
const _origConsoleError = console.error;
const sendDebugLog = (hypothesisId: string, location: string, message: string, data: Record<string, unknown> = {}) => {
};
console.error = (...args: any[]) => {
  const first = args[0];
  const err = first instanceof Error ? first : null;
  sendDebugLog('H1', 'index.tsx:console.error', 'console.error captured', {
    arg0Type: typeof first,
    isError: Boolean(err),
    message: err?.message ?? (typeof first === 'string' ? first : null),
    stack: err?.stack ?? null,
  });
  if (args[0] instanceof Error && args[0].message?.includes('length')) {
    _origConsoleError('[STACK TRACE]', args[0].stack);
  }
  _origConsoleError(...args);
};

const pokerTableImg = Platform.OS === 'web'
  ? require('./assets/table_ovale.png')
  : require('./assets/table.png');
const gameBgImg = require('./assets/bg.jpg');
/** רקע מסכי שחקן / מעבר תור — כחול־כהה, מובחן מתמונת הרקע של מסך המשחק (bg.jpg) */
const playerScreensGradientColors = ['#070f1a', '#0f2840', '#153252'] as const;
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MultiplayerProvider, useMultiplayerOptional } from './src/hooks/useMultiplayer';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { ShopScreen } from './src/screens/ShopScreen';
import { MyThemesScreen } from './src/screens/MyThemesScreen';
import { LobbyEntry, LobbyScreen, LanguageToggle, parseJoinParamsFromUrl } from './src/screens/LobbyScreens';
import { CARDS_PER_PLAYER, TURN_TIMER_HINT_UNTIL_ROUNDS_PLAYED, wildDeckCount } from './shared/gameConstants';
import { displayFontFamily } from './src/theme/fonts';
import { ThemeProvider, useActiveTheme } from './src/theme/ThemeContext';
import { resolveGameTableSurface } from './src/theme/gameTableSurface';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** אותו top לכפתור הקוביות המוזהב (GameScreen) ולכפתור «אני מוכן» (TurnTransition).
 *  clamp תחתון: כש־SCREEN_H קטן, ‎SCREEN_H - 140‎ שלילי — מסך המעבר עם overflow:hidden חותך את הכפתור ("נעלם"). */
const GOLD_ACTION_BUTTON_TOP = Math.max(96, Math.min(680, SCREEN_H - 140));

/** גובה אזור היד (מניפה) — זהה במסך השחקן (TurnTransition) ובמסך המשחק (GameScreen)
 *  HAND_STRIP_HEIGHT = גובה כל האזור (כולל טקסט מעל היד אם יש)
 *  HAND_INNER_HEIGHT = גובה viewport של SimpleHand — חייב לשקף את fanH בפועל (אחרת המניפה בולטת מעל השולחן)
 *  HAND_BOTTOM_OFFSET = מרחק תחתית המסך עד לתחתית אזור היד (מעל פס הכפתורים) — חייב זהה בשני המסכים.
 *  חשוב: בשני המסכים משתמשים תמיד בקבועים האלה בלבד, בלי מספרים קשיחים.
 */
const HAND_FAN_CARD_H = 140;
const HAND_FAN_CENTER_SCALE = 1.15;
const HAND_FAN_VIEWPORT_PAD = 55;
/** בקירוב: 140*1.15+55 — חייב להישאר מסונכרן ל-SimpleHand */
const HAND_INNER_HEIGHT = Math.ceil(HAND_FAN_CARD_H * HAND_FAN_CENTER_SCALE + HAND_FAN_VIEWPORT_PAD - 100);
/** רווח לטקסט רמז (מעבר תור) / אוורור מעל המניפה */
const HAND_STRIP_ABOVE_FAN = 24;
const HAND_STRIP_HEIGHT = HAND_INNER_HEIGHT + HAND_STRIP_ABOVE_FAN;
/** מרחק (px) מתחתית המסך לתחתית פס היד — זהה ב־TurnTransition וב־GameScreen (195px); תואם origin/main ללא הרמה בתור בוט */
const HAND_BOTTOM_OFFSET = 195;

/** קצה עליון של אזור היד (מספר מרחק מהתחתית) — ליישור FuseTimer / מיני־תוצאות */
const HAND_ZONE_TOP = HAND_BOTTOM_OFFSET + HAND_STRIP_HEIGHT;
/** שורת מיני־תוצאות — עדיין X פיקסלים מתחת לטיימר־פתיל */
const HAND_MINI_RESULTS_BOTTOM = HAND_ZONE_TOP - 10;

/**
 * מוקאפ שולחן + משוואה (SLOT 3) — כוונון במקום אחד:
 * - EQUATION_TABLE_TOP / SHIFT_X: מזיזים את כל בלוק השולחן הירוק על המסך.
 * - EQUATION_BUILDER_FINE_OFFSET_Y / _X: מזיזים רק את תוכן המשוואה בתוך השולחן (לא את תמונת השולחן).
 */
const EQUATION_TABLE_TOP = 205;
const EQUATION_TABLE_SHIFT_X = 10;
const EQUATION_BUILDER_FINE_OFFSET_Y = -2;
/** היסט אופקי של המשוואה בלבד; שלילי = שמאלה (LTR), חיובי = ימינה */
const EQUATION_BUILDER_FINE_OFFSET_X = -15;

const EXCELLENCE_METER_DEMO_VALUE = 65;

function devCheckHandLayout() {
  if (!__DEV__) return;
  if (HAND_INNER_HEIGHT >= HAND_STRIP_HEIGHT) {
    console.warn('[hand-layout] HAND_STRIP_ABOVE_FAN חייב להיות חיובי (HAND_STRIP_HEIGHT > HAND_INNER_HEIGHT).');
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHARED SAFE AREA
// ═══════════════════════════════════════════════════════════════
function useGameSafeArea() {
  const insets = useSafeAreaInsets();
  // כמו origin/main: מינימום 20 — באנדרואיד edge-to-edge לעיתים insets.bottom≈0; בלי זה המניפה/כפתורים יורדים מדי
  const safeBottom = Math.max(insets.bottom, 20);
  // Android edge-to-edge: insets.top מ-useSafeAreaInsets לעיתים מחזיר 0 כי ה-StatusBar translucent.
  // ניקח מקסימום בין insets.top, StatusBar.currentHeight ומינימום סביר, ואז תוספת בטיחות קטנה
  // כדי שכפתורים ואייקונים לא יעלו על פס הסוללה/ההתראות.
  const androidStatusBarH = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0;
  const androidMinTop = Platform.OS === 'android' ? 32 : 0;
  const safeTop = Math.max(insets.top, androidStatusBarH, androidMinTop);
  const extra = Platform.OS === 'android' ? 6 : 0;
  const safeInsets = { ...insets, top: safeTop + extra };
  return { safeBottom, SAFE_BOTTOM_PAD: safeBottom + 16, insets: safeInsets };
}

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

type CardType = 'number' | 'fraction' | 'operation' | 'joker' | 'wild';
type Operation = '+' | '-' | 'x' | '÷';
type Fraction = '1/2' | '1/3' | '1/4' | '1/5';

interface Card {
  id: string;
  type: CardType;
  value?: number;
  fraction?: Fraction;
  operation?: Operation;
  /** When type === 'wild' and card was placed on discard pile — the value it represents (active range). */
  resolvedValue?: number;
  /** When type === 'fraction' and card was placed on discard pile — attack: denominator (divide by X); block: new target after fraction. */
  resolvedTarget?: number;
}

/** קלף פעולה/סלינדה משובץ במשבצת 0 או 1 במבנה הקוביות; jokerAs רלוונטי רק לסלינדה */
interface EquationHandSlot {
  card: Card;
  jokerAs: Operation | null;
}

interface Player {
  id: number;
  name: string;
  hand: Card[];
  calledLolos: boolean;
  isBot: boolean;
  courageMeterStep: number;
  courageMeterPercent: number;
  courageRewardPulseId: number;
  courageCoins: number;
  lastCourageCoinsAwarded: boolean;
  courageDiscardSuccessStreak: number;
}

interface DiceResult { die1: number; die2: number; die3: number; }
interface EquationOption { equation: string; result: number; }

type GamePhase = 'setup' | 'turn-transition' | 'pre-roll' | 'building' | 'solved' | 'roll-dice' | 'game-over';

const EMPTY_ID_SET = new Set<string>();
type AbVariant = 'control_0_12_plus' | 'variant_0_15_plus';

const ALL_FRACTION_KINDS: readonly Fraction[] = ['1/2', '1/3', '1/4', '1/5'];

/** שברי ברירת מחדל למסך ההגדרות המתקדמות. */

interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  drawPile: Card[];
  discardPile: Card[];
  dice: DiceResult | null;
  /** מסונכן עם השרת במקוון; מקומי מתעדכן ב־ROLL_DICE — לאיפוס בונה משוואות */
  diceRollSeq: number;
  selectedCards: Card[];
  stagedCards: Card[];
  validTargets: EquationOption[];
  equationResult: number | null;
  activeOperation: Operation | null;
  challengeSource: string | null;
  equationOpsUsed: Operation[];
  activeFraction: Fraction | null;
  pendingFractionTarget: number | null;
  fractionPenalty: number;
  fractionAttackResolved: boolean;
  hasPlayedCards: boolean;
  hasDrawnCard: boolean;
  lastCardValue: number | null;
  consecutiveIdenticalPlays: number;
  courageMeterPercent: number;
  courageMeterStep: number;
  /** @deprecated נשמר לתאימות; חוק רצף השלכות בוטל */
  courageDiscardSuccessStreak: number;
  courageRewardPulseId: number;
  courageCoins: number;
  /** Why the excellence meter last advanced — surfaced as an explanation bubble
      on the next TurnTransition screen so the player understands the reward.
      Cleared when the next turn actually begins (BEGIN_TURN). */
  lastCourageRewardReason: string | null;
  /** True for exactly one turn after the excellence meter fills and grants 5 coins. */
  lastCourageCoinsAwarded: boolean;
  identicalAlert: { playerName: string; cardDisplay: string; consecutive: number } | null;
  jokerModalOpen: boolean;
  /** משבצות 0/1 — קלפים מהיד בתרגיל הקוביות */
  equationHandSlots: [EquationHandSlot | null, EquationHandSlot | null];
  /** נבחר מהיד וממתין ללחיצה על משבצת אופרטור */
  equationHandPick: EquationHandSlot | null;
  lastMoveMessage: string | null;
  lastDiscardCount: number;
  lastEquationDisplay: string | null;
  difficulty: 'easy' | 'full';
  diceMode: '3';
  showFractions: boolean;
  /** מכנים לכלול בחבילה כש־showFractions */
  fractionKinds: Fraction[];
  showPossibleResults: boolean;
  showSolveExercise: boolean;
  difficultyStage: DifficultyStageId;
  stageTransitions: number;
  mathRangeMax: 12 | 25;
  enabledOperators: Operation[];
  allowNegativeTargets: boolean;
  abVariant: AbVariant;
  equationAttempts: number;
  equationSuccesses: number;
  turnStartedAt: number | null;
  totalEquationResponseMs: number;
  timerSetting: '30' | '60' | 'off' | 'custom';
  timerCustomSeconds: number;
  winner: Player | null;
  message: string;
  roundsPlayed: number;
  notifications: Notification[];
  moveHistory: MoveHistoryEntry[];
  /** למשתמש חדש — הדרכה מופעלת; משמש לעדיפות להתראות onb/guidance ב־NotificationZone */
  guidanceEnabled: boolean | null;
  /** דגל חד־פעמי: האם המשתמש כבר ראה את הודעת ההדרכה מתחת לכפתור הקוביות בתור הראשון */
  hasSeenIntroHint: boolean;
  /** דגל חד־פעמי: האם המשתמש כבר ראה הסבר מה לעשות אחרי שהמשוואה נפתרה (בחירת קלפים לתוצאה) */
  hasSeenSolvedHint: boolean;
  /** משחק מקוון — מזהה הגרלת פותח (מהשרת) */
  openingDrawId?: string | null;
  /** משחק מקוון — מועד יעד (epoch ms) לפעולת תור; null כשלא במצב המתנה */
  turnDeadlineAt?: number | null;
  /** צלילי משחק — false = השתקה (נשמר ב־AsyncStorage) */
  soundsEnabled: boolean;
  /** טבלת טורניר — למשחק הנוכחי בלבד; מאופסת בתחילת כל START_GAME */
  tournamentTable: TournamentRow[];
  /** מונה שימושים בכפתור "תוצאות אפשריות" לצורך תשלום כל שימוש רביעי */
  possibleResultsInfoUses: number;
  /** ספירה רק פעם אחת בכל תור — גם אם הכפתור נלחץ כמה פעמים */
  possibleResultsInfoCountedThisTurn: boolean;
  /** מקוון: המשתמש סגר את בועת קלף זהה לפני ש-callback השני מהשרת הסיר את identicalCelebration */
  suppressIdenticalOverlayOnline: boolean;
  /** Bot configuration for offline vs-bot mode. null = pass-and-play (no bots). See spec §0.4. */
  botConfig: {
    difficulty: BotDifficulty;
    playerIds: ReadonlyArray<number>;
    /** Tests only — inject RNG for deterministic bot plans. */
    rng?: () => number;
  } | null;
  /** משחק מקוון מול בוט — רמת קושי מהשרת (hostGameSettings); null כשלא רלוונטי */
  hostBotDifficulty: BotDifficulty | null;
  /** תור מזהי קלפים ל־stage אחרי confirmEquation (בוט מקומי); null = אין תור */
  botPendingStagedIds: string[] | null;
  /** תור פעולות הדגמה לבוט כשאין לו פתרון ישיר (למשל stage/unstage לפני draw). */
  botPendingDemoActions: BotAction[] | null;
  /** מספר טיקים שנשארו להצגת "אין פתרון" לפני שהבוט שולף. */
  botNoSolutionTicks: number;
  /** דגל להצגת הודעת "אין פתרון, אני שולף קלף". */
  botNoSolutionDrawPending: boolean;
  /** עצירה לימודית אחרי הטלת קוביות לפני ניסיון בניית תרגיל. */
  botDicePausePending: boolean;
  /** השהיית "חשיבה" לבוט כשהוא מאותגר בשבר. */
  botFractionDefenseTicks: number;
  /** תור הצגה לבוט: פוקוס קלף/השהיה/הסבר לפני החלת פעולה. */
  botPresentation: BotPresentationState;
  /** דגל לפעם-אחת-בתור: הבוט כבר הראה את הדגמת «תוצאות אפשריות + מיני-קלפים». */
  botConfirmDemoShownThisTurn: boolean;
  /** השהיה אחרי אישור משוואה לפני התחלת בחירת קלפים מהיד. */
  botPostEquationPauseTicks: number;
  /** Monotonic counter incremented on every BOT_STEP dispatch. Used by bot clock useEffect dep array
   *  to guarantee re-scheduling on no-op ticks. Prevents "frozen bot" bugs. See spec §0.5.2. */
  botTickSeq: number;
  /** Tutorial mode — show all validTargets in results strip (no hand-based filtering). */
  isTutorial: boolean;
  /** Cards accumulated during the current turn (reset at turn start). */
  currentTurnPlayedCards: Card[];
  /** Cards played in the previous turn — displayed on TurnTransition screen. */
  lastTurnPlayedCards: Card[];
}

interface Notification {
  id: string;
  message: string;
  emoji?: string;
  title?: string;
  body?: string;
  style: 'success' | 'warning' | 'info' | 'celebration' | 'error';
  autoDismissMs?: number;
  /** אין סגירה אוטומטית — כפתור "הבנתי" ב־NotificationZone */
  requireAck?: boolean;
  /** מספר גדול מודגש — מוצג בנוטיפיקציית אתגר שבר */
  bigNumber?: number;
}

type BotPresentationState = {
  action: BotAction | null;
  candidateCardId: string | null;
  ticks: number;
  notification: Notification | null;
};

interface TournamentRow {
  playerId: number;
  playerName: string;
  wins: number;
  losses: number;
}

/** טבלת טורניר למצב מקוון/מקומי — אם חסרה ב-state עדיין מציגים שורות לפי שחקנים */
function getTournamentRowsForModal(state: {
  tournamentTable?: TournamentRow[];
  players: { id: number; name: string }[];
}): TournamentRow[] {
  const t = state.tournamentTable;
  if (Array.isArray(t) && t.length > 0) return t;
  return state.players.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    wins: 0,
    losses: 0,
  }));
}

function TournamentInfoModal({
  visible,
  onClose,
  rows,
  gameInfo,
  onOpenRules,
  settings,
}: {
  visible: boolean;
  onClose: () => void;
  rows: TournamentRow[];
  gameInfo: {
    modeLabel: string;
    difficultyLabel: string;
    playersCount: number;
    diceModeLabel?: string;
  };
  onOpenRules?: () => void;
  settings: {
    mathRangeMax: 12 | 25;
    showFractions: boolean;
    fractionKinds: Fraction[];
    enabledOperators: Operation[];
    allowNegativeTargets: boolean;
    showPossibleResults: boolean;
    showSolveExercise: boolean;
    timerSetting: '30' | '60' | 'off' | 'custom';
    timerCustomSeconds: number;
  };
}) {
  const { t } = useLocale();
  const safeFractionKinds = Array.isArray(settings.fractionKinds) ? settings.fractionKinds : [];
  const safeEnabledOperators = Array.isArray(settings.enabledOperators) ? settings.enabledOperators : [];
  const safeTimerSetting = settings.timerSetting ?? 'off';
  const safeTimerCustomSeconds = Number.isFinite(settings.timerCustomSeconds) ? settings.timerCustomSeconds : 60;
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => b.wins - a.wins || a.losses - b.losses || a.playerId - b.playerId,
      ),
    [rows],
  );
  if (!visible) return null;
  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        { zIndex: 160, backgroundColor: 'rgba(0,0,0,0.62)' },
        Platform.OS === 'android' ? { elevation: 160 } : null,
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        onPress={onClose}
        activeOpacity={1}
      />
      <View
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          top: 36,
          bottom: 36,
          backgroundColor: '#1F2937',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.14)',
          padding: 14,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800' }}>{t('ui.tournamentTitle')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {onOpenRules ? (
              <LulosButton
                text="חוקים"
                color="blue"
                width={68}
                height={30}
                fontSize={11}
                onPress={onOpenRules}
              />
            ) : null}
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: '#CBD5E1', fontSize: 22, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
        <View style={{ borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)', borderRadius: 10, backgroundColor: 'rgba(15,23,42,0.45)', padding: 8 }}>
          <Text style={{ color: '#FDE68A', fontSize: 12, fontWeight: '800', textAlign: 'right', marginBottom: 6 }}>
            מידע על המשחק
          </Text>
          <Text style={{ color: '#FEF3C7', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
            {`מצב: ${gameInfo.modeLabel}`}
          </Text>
          <Text style={{ color: '#FEF3C7', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
            {`קושי: ${gameInfo.difficultyLabel}`}
          </Text>
          <Text style={{ color: '#FEF3C7', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
            {`מספר שחקנים: ${gameInfo.playersCount}`}
          </Text>
          {gameInfo.diceModeLabel ? (
            <Text style={{ color: '#FEF3C7', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
              {`מצב קוביות: ${gameInfo.diceModeLabel}`}
            </Text>
          ) : null}
        </View>
        <View style={{ borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)', borderRadius: 10, backgroundColor: 'rgba(2,44,34,0.38)', padding: 8 }}>
          <Text style={{ color: '#86EFAC', fontSize: 12, fontWeight: '800', textAlign: 'right', marginBottom: 6 }}>
            הגדרות המשחק הנוכחי
          </Text>
          <Text style={{ color: '#DCFCE7', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
            {`טווח מספרים: 0–${settings.mathRangeMax}`}
          </Text>
          <Text style={{ color: '#DCFCE7', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
            {`שברים: ${settings.showFractions ? `עם (${safeFractionKinds.join(', ') || 'ברירת מחדל'})` : 'בלי'}`}
          </Text>
          <Text style={{ color: '#DCFCE7', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
            {`סימנים פעילים: ${safeEnabledOperators.join(' ') || 'אין'}`}
          </Text>
          <Text style={{ color: '#DCFCE7', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
            {`תוצאות אפשריות: ${settings.showPossibleResults ? 'מופעל' : 'כבוי'}`}
          </Text>
          <Text style={{ color: '#DCFCE7', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
            {`פתרון תרגיל: ${settings.showSolveExercise ? 'מופעל' : 'כבוי'}`}
          </Text>
          <Text style={{ color: '#DCFCE7', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
            {`טיימר: ${safeTimerSetting === 'off' ? 'ללא' : safeTimerSetting === 'custom' ? `${safeTimerCustomSeconds} שניות (מותאם)` : `${safeTimerSetting} שניות`}`}
          </Text>
        </View>
        <Text style={{ color: '#CBD5E1', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
          הטבלה מתאפסת בתחילת כל משחק חדש ומציגה ניצחונות/הפסדים למשחק הנוכחי.
        </Text>
        <View style={{ borderWidth: 1, borderColor: 'rgba(147,197,253,0.35)', borderRadius: 10, backgroundColor: 'rgba(15,23,42,0.35)', padding: 8 }}>
          {sorted.length === 0 ? (
            <Text style={{ color: '#93C5FD', fontSize: 12, textAlign: 'center' }}>אין נתונים עדיין</Text>
          ) : (
            sorted.map((row, idx) => (
              <View
                key={row.playerId}
                style={{
                  flexDirection: 'row-reverse',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 5,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: 'rgba(148,163,184,0.16)',
                }}
              >
                <Text style={{ color: '#E2E8F0', fontSize: 12, fontWeight: '700' }}>
                  {row.playerName || `שחקן ${row.playerId + 1}`}
                </Text>
                <Text style={{ color: '#93C5FD', fontSize: 12 }}>
                  ניצחונות: {row.wins} | הפסדים: {row.losses}
                </Text>
              </View>
            ))
          )}
        </View>
        </ScrollView>
      </View>
    </View>
  );
}

function sortHandCards(cards: Card[]): Card[] {
  // Tutorial opt-out: when L5.2 (joker-place) rigs Slinda at the middle
  // index of the fan, the default "operations before jokers" rule would
  // push her to the end. Skip the sort so the learner sees Slinda right
  // where the bot is about to pulse her.
  if (tutorialBus.getTutorialPreserveHandOrder()) return cards;
  const groupOrder: Record<CardType, number> = {
    number: 0,
    wild: 0,
    fraction: 1,
    operation: 2,
    joker: 2,
  };

  return [...cards].sort((a, b) => {
    const ga = groupOrder[a.type] ?? 99;
    const gb = groupOrder[b.type] ?? 99;
    if (ga !== gb) return ga - gb;

    if (a.type === 'number' && b.type === 'number') return (a.value ?? 0) - (b.value ?? 0);
    if (a.type === 'number' && b.type === 'wild') return -1;
    if (a.type === 'wild' && b.type === 'number') return 1;

    if (a.type === 'fraction' && b.type === 'fraction') {
      return (a.fraction ?? '').localeCompare(b.fraction ?? '', 'he');
    }
    if (a.type === 'operation' && b.type === 'operation') {
      return (a.operation ?? '').localeCompare(b.operation ?? '', 'en');
    }
    if (a.type === 'operation' && b.type === 'joker') return -1;
    if (a.type === 'joker' && b.type === 'operation') return 1;

    return 0;
  });
}

function normalizeRestoredNotifications(payload: unknown): Notification[] {
  const loc: 'he' | 'en' =
    Localization.getLocales()[0]?.languageCode?.toLowerCase() === 'en' ? 'en' : 'he';
  const welcomeTitleHe = t('he', 'welcome.title');
  const welcomeTitleEn = t('en', 'welcome.title');
  if (!Array.isArray(payload)) return [];
  return payload.map((item: unknown) => {
    const n = item as Partial<Notification> & { id?: string };
    if (!n || typeof n !== 'object') return n as Notification;
    const id = String(n.id ?? '');
    const titleOk = n.title === welcomeTitleHe || n.title === welcomeTitleEn;
    const isWelcome = id.startsWith('onb-welcome') || titleOk;
    const bodyStr = n.body != null ? String(n.body).trim() : '';
    const msgStr = n.message != null ? String(n.message).trim() : '';
    if (isWelcome && !bodyStr && !msgStr) {
      return {
        ...n,
        title: n.title ?? t(loc, 'welcome.title'),
        message: n.message ?? '',
        body: `${t(loc, 'welcome.body')}\n${t(loc, 'welcome.goodLuck')}`,
      } as Notification;
    }
    if (isWelcome && !bodyStr && msgStr) {
      return { ...n, body: msgStr } as Notification;
    }
    return n as Notification;
  });
}

/** רשומת היסטוריית מהלך — כל פעם ששחקן מניח קלפים / שולף / מסיים תור */
interface MoveHistoryEntry {
  playerIndex: number;
  cardsDiscarded: number;
  description: string;
}

export type EquationCommitPayload = { cardId: string; position: 0 | 1; jokerAs: Operation | null };

type GameAction =
  | { type: 'START_GAME'; players: { name: string; isBot?: boolean }[]; difficulty: 'easy' | 'full'; fractions: boolean; fractionKinds?: Fraction[]; showPossibleResults: boolean; showSolveExercise: boolean; timerSetting: '30' | '60' | 'off' | 'custom'; timerCustomSeconds?: number; difficultyStage?: DifficultyStageId | string; enabledOperators?: Operation[]; allowNegativeTargets?: boolean; mathRangeMax?: 12 | 25; abVariant?: AbVariant; mode: 'pass-and-play' | 'vs-bot'; botDifficulty?: BotDifficulty; isTutorial?: boolean }
  | { type: 'PLAY_AGAIN' }
  | { type: 'NEXT_TURN' }
  | { type: 'BEGIN_TURN' }
  | { type: 'ROLL_DICE'; values?: DiceResult }
  | { type: 'CONFIRM_EQUATION'; result: number; equationDisplay: string; equationOps: Operation[]; equationCommits?: EquationCommitPayload[] }
  | { type: 'RECORD_EQUATION_ATTEMPT' }
  | { type: 'RESET_ONLINE_EQ_UI' }
  | { type: 'REVERT_TO_BUILDING' }
  | { type: 'STAGE_CARD'; card: Card }
  | { type: 'UNSTAGE_CARD'; card: Card }
  | { type: 'CONFIRM_STAGED' }
  | { type: 'CONFIRM_TRAP_ONLY' }
  | { type: 'PLAY_IDENTICAL'; card: Card }
  | { type: 'SELECT_EQ_OP'; card: Card }
  | { type: 'PLACE_EQ_OP'; position: number }
  | { type: 'REMOVE_EQ_HAND_SLOT'; position: 0 | 1 }
  | { type: 'CLEAR_EQ_HAND' }
  | { type: 'CLEAR_EQ_HAND_PICK' }
  | { type: 'SELECT_EQ_JOKER'; card: Card; chosenOperation: Operation }
  | { type: 'PLAY_FRACTION'; card: Card }
  | { type: 'DEFEND_FRACTION_SOLVE'; card: Card; wildResolve?: number }
  | { type: 'DEFEND_FRACTION_PENALTY' }
  | { type: 'PLAY_JOKER'; card: Card; chosenOperation: Operation }
  | { type: 'DRAW_CARD' }
  | { type: 'CALL_LOLOS' }
  | { type: 'END_TURN' }
  | { type: 'SET_MESSAGE'; message: string }
  | { type: 'OPEN_JOKER_MODAL'; card: Card }
  | { type: 'CLOSE_JOKER_MODAL' }
  | { type: 'ADD_SLINDA_TO_HAND' }
  | { type: 'DISMISS_IDENTICAL_ALERT' }
  | { type: 'SUPPRESS_ONLINE_IDENTICAL_OVERLAY' }
  | { type: 'CLEAR_ONLINE_IDENTICAL_SUPPRESS' }

  | { type: 'PUSH_NOTIFICATION'; payload: Notification }
  | { type: 'DISMISS_NOTIFICATION'; id: string }
  | { type: 'RESTORE_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'SET_GUIDANCE_ENABLED'; enabled: boolean }
  | { type: 'SET_SOUNDS_ENABLED'; enabled: boolean }
  | { type: 'UPDATE_PLAYER_NAME'; playerIndex: number; name: string }
  | { type: 'DISMISS_INTRO_HINT' }
  | { type: 'USE_POSSIBLE_RESULTS_INFO' }
  | { type: 'BOT_STEP' }
  | { type: 'RESET_GAME' }
  | { type: 'TUTORIAL_SET_HANDS'; hands: Card[][]; drawPile?: Card[]; discardPile?: Card[] }
  | { type: 'TUTORIAL_SET_DICE'; values: DiceResult }
  | { type: 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS'; value: boolean }
  | { type: 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE'; value: boolean }
  | { type: 'TUTORIAL_SET_VALID_TARGETS'; targets: EquationOption[] | null }
  | { type: 'TUTORIAL_SET_ENABLED_OPERATORS'; operators: Operation[] }
  | {
      type: 'TUTORIAL_FRACTION_SETUP';
      slice: {
        currentPlayerIndex: number;
        phase: GamePhase;
        hands: Card[][];
        discardPile: Card[];
        dice: DiceResult | null;
        pendingFractionTarget: number | null;
        fractionPenalty: number;
        fractionAttackResolved: boolean;
        showFractions: boolean;
        fractionKinds: Fraction[];
      };
    }
  | {
      /** Skip dice/equation-build flow and jump directly to solved phase with
       *  a known result. Used by the multi-play tutorial lesson (L11). */
      type: 'TUTORIAL_FORCE_SOLVED';
      equationResult: number;
      playerHand: Card[];
      botHand: Card[];
      discardPile?: Card[];
    };

// Global mutable intercept for fraction card taps (tutorial + hint)
const fracTapIntercept = { fn: null as ((card: Card) => boolean) | null };

// ═══════════════════════════════════════════════════════════════
//  ARITHMETIC — שתי קוביות: L→R. שלוש קוביות: סדר פעולות רגיל (כמו server/equations)
// ═══════════════════════════════════════════════════════════════

function applyOperation(a: number, op: Operation | string, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case 'x': case '*': case '×': return a * b;
    case '÷': case '/': return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

function isHighPrecedence(op: string): boolean {
  return op === 'x' || op === '×' || op === '*' || op === '÷' || op === '/';
}

/** Evaluate a op1 b op2 c with standard order of operations (× ÷ before + −) */
function evalThreeTerms(a: number, op1: string, b: number, op2: string, c: number): number | null {
  if (isHighPrecedence(op2) && !isHighPrecedence(op1)) {
    // op2 has higher precedence: compute b op2 c first
    const right = applyOperation(b, op2, c);
    if (right === null) return null;
    return applyOperation(a, op1, right);
  }
  // op1 has equal or higher precedence: left-to-right
  const left = applyOperation(a, op1, b);
  if (left === null) return null;
  return applyOperation(left, op2, c);
}

function fractionDenominator(f: Fraction): number {
  switch (f) { case '1/2': return 2; case '1/3': return 3; case '1/4': return 4; case '1/5': return 5; }
}

function isDivisibleByFraction(value: number, f: Fraction): boolean {
  const d = fractionDenominator(f);
  return value % d === 0 && value > 0;
}

/** ערכי פרא חוקיים להגנת שבר — מספרים ב־1..maxWild המתחלקים במכנה */
function validWildValuesForFractionDefense(penalty: number, maxWild: number): number[] {
  if (penalty <= 0 || maxWild < 1) return [];
  const vals: number[] = [];
  for (let v = 1; v <= maxWild; v++) {
    if (v % penalty === 0) vals.push(v);
  }
  return vals;
}

function validateFractionPlay(card: Card, topDiscard: Card | undefined): boolean {
  if (!card.fraction || !topDiscard) return false;
  // Wild (פרא) על הערימה מקבל `resolvedValue` והוא אמור להתנהג כמו מספר לכל חוקי השבר.
  // בלי זה, למשל פרא=22 עם `1/2` ייחשב בטעות כ"לא מתחלק".
  if (topDiscard.type !== 'number' && topDiscard.type !== 'wild') return false;
  const effective = getEffectiveNumber(topDiscard);
  if (effective === null) return false;
  return isDivisibleByFraction(effective, card.fraction as Fraction);
}

function getHandSlotOperation(slot: EquationHandSlot | null): Operation | null {
  if (!slot) return null;
  return slot.card.type === 'joker' ? slot.jokerAs : slot.card.operation ?? null;
}

function countEquationHandPlaced(state: GameState): number {
  return (state.equationHandSlots[0] ? 1 : 0) + (state.equationHandSlots[1] ? 1 : 0);
}

function deriveEquationHandSlotsFromCommits(
  state: GameState,
  commits?: EquationCommitPayload[],
): [EquationHandSlot | null, EquationHandSlot | null] {
  const slots: [EquationHandSlot | null, EquationHandSlot | null] = [null, null];
  if (!commits || commits.length === 0) return slots;
  const hand = state.players[state.currentPlayerIndex]?.hand ?? [];
  for (const commit of commits) {
    if (commit.position !== 0 && commit.position !== 1) continue;
    const card = hand.find((c) => c.id === commit.cardId);
    if (!card) continue;
    slots[commit.position] = {
      card,
      jokerAs: card.type === 'joker' ? (commit.jokerAs ?? null) : null,
    };
  }
  return slots;
}

function isCardInEquationHand(state: GameState, cardId: string): boolean {
  if (state.equationHandPick?.card.id === cardId) return true;
  return state.equationHandSlots.some((s) => s?.card.id === cardId);
}

const EQ_OPS_STR = ['+', '-', '*', '/'];

function getCurrentResult(
  s1: number | null, op1: string, s2: number | null, op2: string, s3: number | null,
): number | null {
  try {
    if (s1 === null || s2 === null) return null;
    if (s3 !== null) {
      const r = evalThreeTerms(s1, op1, s2, op2, s3);
      if (r === null || !Number.isFinite(r)) return null;
      return r;
    }
    const intermediate = applyOperation(s1, op1, s2);
    if (intermediate === null || !Number.isFinite(intermediate)) return null;
    return intermediate;
  } catch {
    return null;
  }
}

function displayOrOperationToToken(s: string | Operation | null): Operation | null {
  if (s == null) return null;
  if (s === '×' || s === '*') return 'x';
  if (s === '+' || s === '-' || s === 'x' || s === '÷') return s;
  return null;
}

function parseEquationDisplayForUi(
  equationDisplay: string | null | undefined,
): { numbers: number[]; operators: Operation[]; parensRight: boolean } | null {
  if (!equationDisplay) return null;
  const lhs = equationDisplay.split('=')[0] ?? equationDisplay;
  const numbersRaw = lhs.match(/\d+/g);
  if (!numbersRaw || numbersRaw.length < 2) return null;
  const numbers = numbersRaw.map((n) => Number(n));
  const opRaw = lhs.match(/[+\-x÷*/×]/g) ?? [];
  const operators = opRaw
    .map((op) => displayOrOperationToToken(op))
    .filter((op): op is Operation => op != null)
    .slice(0, 2);
  const compact = lhs.replace(/\s+/g, '');
  const parensRight = /^\d+[+\-x÷*/×]\(.*\)$/.test(compact);
  return { numbers, operators, parensRight };
}

function isOperationAllowedForStage(s: string | Operation | null, allowed: readonly Operation[]): boolean {
  const t = displayOrOperationToToken(s);
  if (!t) return true;
  return allowed.includes(t);
}

// ═══════════════════════════════════════════════════════════════
//  DECK
// ═══════════════════════════════════════════════════════════════

let cardIdCounter = 0;
function makeId(): string { return `card-${++cardIdCounter}`; }

const DEFAULT_FRAC_DECK: { frac: Fraction; count: number }[] = [
  { frac: '1/2', count: 6 }, { frac: '1/3', count: 4 },
  { frac: '1/4', count: 3 }, { frac: '1/5', count: 2 },
];

function generateDeck(
  difficulty: 'easy' | 'full',
  includeFractions: boolean = true,
  enabledOperators?: Operation[],
  rangeMaxOverride?: 12 | 25,
  fractionKinds?: Fraction[] | null,
): Card[] {
  cardIdCounter = 0;
  const cards: Card[] = [];
  const maxNumber = rangeMaxOverride ?? (difficulty === 'easy' ? 12 : 25);
  for (let set = 0; set < 4; set++)
    for (let v = 0; v <= maxNumber; v++)
      cards.push({ id: makeId(), type: 'number', value: v });
  if (includeFractions) {
    const allow = fractionKinds && fractionKinds.length > 0 ? new Set(fractionKinds) : null;
    const fracs = allow ? DEFAULT_FRAC_DECK.filter((x) => allow.has(x.frac)) : DEFAULT_FRAC_DECK;
    for (const { frac, count } of fracs)
      for (let i = 0; i < count; i++)
        cards.push({ id: makeId(), type: 'fraction', fraction: frac });
  }
  const operations: Operation[] = enabledOperators && enabledOperators.length > 0 ? enabledOperators : ['+', '-', 'x', '÷'];
  for (const op of operations)
    for (let i = 0; i < (op === '÷' ? 3 : 4); i++)
      cards.push({ id: makeId(), type: 'operation', operation: op });
  for (let i = 0; i < 4; i++)
    cards.push({ id: makeId(), type: 'joker' });
  const wilds = wildDeckCount(maxNumber, includeFractions);
  for (let i = 0; i < wilds; i++)
    cards.push({ id: makeId(), type: 'wild' });
  return cards;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dealCards(deck: Card[], playerCount: number, cardsPerPlayer: number) {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  let idx = 0;
  for (let c = 0; c < cardsPerPlayer; c++)
    for (let p = 0; p < playerCount; p++)
      if (idx < deck.length) hands[p].push(deck[idx++]);
  return { hands, remaining: deck.slice(idx) };
}

// ═══════════════════════════════════════════════════════════════
//  DICE
// ═══════════════════════════════════════════════════════════════

function rollDiceUtil(): DiceResult {
  return {
    die1: Math.floor(Math.random() * 6) + 1,
    die2: Math.floor(Math.random() * 6) + 1,
    die3: Math.floor(Math.random() * 6) + 1,
  };
}

function isTriple(dice: DiceResult): boolean {
  return dice.die1 === dice.die2 && dice.die2 === dice.die3;
}

const ALL_OPS: Operation[] = ['+', '-', 'x', '÷'];

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

function generateValidTargets(
  dice: DiceResult,
  enabledOperators?: Operation[],
  allowNegativeTargets: boolean = false,
  maxTarget: number = 25,
): EquationOption[] {
  const allowedOps = enabledOperators && enabledOperators.length > 0 ? enabledOperators : ALL_OPS;
  const values = [dice.die1, dice.die2, dice.die3];
  const perms = permutations(values);
  const seen = new Set<string>();
  const results: EquationOption[] = [];

  for (const [a, b, c] of perms) {
    for (const op1 of allowedOps) {
      for (const op2 of allowedOps) {
        // Left-grouped: (a op1 b) op2 c
        const leftInner = applyOperation(a, op1, b);
        const leftRes = leftInner === null ? null : applyOperation(leftInner, op2, c);
        if (leftRes !== null && (allowNegativeTargets || leftRes >= 0) && Number.isInteger(leftRes)) {
          const eqL = `(${a} ${op1} ${b}) ${op2} ${c} = ${leftRes}`;
          if (!seen.has(`${leftRes}:${eqL}`)) { seen.add(`${leftRes}:${eqL}`); results.push({ equation: eqL, result: leftRes }); }
        }
        // Right-grouped: a op1 (b op2 c)
        const rightInner = applyOperation(b, op2, c);
        const rightRes = rightInner === null ? null : applyOperation(a, op1, rightInner);
        if (rightRes !== null && (allowNegativeTargets || rightRes >= 0) && Number.isInteger(rightRes)) {
          const eqR = `${a} ${op1} (${b} ${op2} ${c}) = ${rightRes}`;
          if (!seen.has(`${rightRes}:${eqR}`)) { seen.add(`${rightRes}:${eqR}`); results.push({ equation: eqR, result: rightRes }); }
        }
      }
    }
  }

  const pairs: [number, number][] = [
    [values[0], values[1]], [values[0], values[2]], [values[1], values[2]],
  ];
  for (const [a, b] of pairs) {
    for (const op of allowedOps) {
      const r1 = applyOperation(a, op, b);
      if (r1 !== null && (allowNegativeTargets || r1 >= 0) && Number.isInteger(r1)) {
        const eq1 = `${a} ${op} ${b} = ${r1}`;
        if (!seen.has(`${r1}:${eq1}`)) { seen.add(`${r1}:${eq1}`); results.push({ equation: eq1, result: r1 }); }
      }
      const r2 = applyOperation(b, op, a);
      if (r2 !== null && (allowNegativeTargets || r2 >= 0) && Number.isInteger(r2)) {
        const eq2 = `${b} ${op} ${a} = ${r2}`;
        if (!seen.has(`${r2}:${eq2}`)) { seen.add(`${r2}:${eq2}`); results.push({ equation: eq2, result: r2 }); }
      }
    }
  }

  const byResult = new Map<number, EquationOption>();
  for (const opt of results)
    if ((allowNegativeTargets || opt.result >= 0) && opt.result <= maxTarget && !byResult.has(opt.result)) {
      byResult.set(opt.result, opt);
    }
  return Array.from(byResult.values()).sort((a, b) => a.result - b.result);
}

// ═══════════════════════════════════════════════════════════════
//  VALIDATION
// ═══════════════════════════════════════════════════════════════

function validateIdenticalPlay(card: Card, topDiscard: Card | undefined): boolean {
  if (!topDiscard) return false;
  // קלף פרא נספר כאותו מספר — מותר להניח פרא כ"זהה" כשראש הערימה קלף מספר (או פרא)
  if (card.type === 'wild') return topDiscard.type === 'number' || topDiscard.type === 'wild';
  if (card.type !== topDiscard.type) return false;
  switch (card.type) {
    case 'number': return card.value === topDiscard.value;
    case 'fraction': return card.fraction === topDiscard.fraction;
    case 'operation': return card.operation === topDiscard.operation;
    case 'joker': return topDiscard.type === 'joker';
    default: return false;
  }
}

/** ערך מספרי אפקטיבי של קלף: מספר → value, פרא על הערימה → resolvedValue. */
function getEffectiveNumber(card: Card | undefined): number | null {
  if (!card) return null;
  if (card.type === 'number') return card.value ?? null;
  if (card.type === 'wild') return card.resolvedValue ?? null;
  return null;
}

function getStagedPermutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of getStagedPermutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

function validateStagedCards(
  numberCards: Card[],
  opCard: Card | null,
  target: number,
  maxWild: number = 25,
): boolean {
  const cap = Math.max(0, Math.min(25, maxWild));
  const wildCount = numberCards.filter(c => c.type === 'wild').length;
  const numCards = numberCards.filter(c => c.type === 'number');
  const values = numCards.map(c => c.value ?? 0);
  if (wildCount > 1) return false;
  if (numCards.length > 2) return false;
  if (wildCount === 1) {
    if (!opCard) {
      const sum = values.reduce((s, v) => s + v, 0);
      const wildVal = target - sum;
      return wildVal >= 0 && wildVal <= cap && Number.isInteger(wildVal);
    }
    const op = opCard.operation!;
    // חייבים 0..cap — לא עד target בלבד: למשל 4 − פרא = 0 דורש פרא=4 כש-target הוא 0
    for (let wildVal = 0; wildVal <= cap; wildVal++) {
      const allVals = [...values, wildVal];
      const perms = getStagedPermutations(allVals);
      for (const perm of perms) {
        for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
          let result: number | null = perm[0];
          for (let i = 1; i < perm.length; i++) {
            const useOp = i - 1 === gapPos ? op : '+';
            result = applyOperation(result!, useOp as Operation, perm[i]);
            if (result === null) break;
          }
          if (result !== null && result === target) return true;
        }
      }
    }
    return false;
  }
  if (values.length === 0) return false;
  if (!opCard) return values.reduce((s, v) => s + v, 0) === target;
  const op = opCard.operation!;
  const perms = getStagedPermutations(values);
  for (const perm of perms) {
    for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
      let result: number | null = perm[0];
      for (let i = 1; i < perm.length; i++) {
        const useOp = i - 1 === gapPos ? op : '+';
        result = applyOperation(result!, useOp as Operation, perm[i]);
        if (result === null) break;
      }
      if (result !== null && result === target) return true;
    }
  }
  return false;
}

function computeWildValueInStaged(
  numberCards: Card[],
  opCard: Card | null,
  target: number,
  maxWild: number = 25,
): number | null {
  const cap = Math.max(0, Math.min(25, maxWild));
  const wildCount = numberCards.filter(c => c.type === 'wild').length;
  const numCards = numberCards.filter(c => c.type === 'number');
  const values = numCards.map(c => c.value ?? 0);
  if (wildCount !== 1) return null;
  if (!opCard) {
    const wildVal = target - values.reduce((s, v) => s + v, 0);
    return wildVal >= 0 && wildVal <= cap && Number.isInteger(wildVal) ? wildVal : null;
  }
  const op = opCard.operation!;
  for (let wildVal = 0; wildVal <= cap; wildVal++) {
    const allVals = [...values, wildVal];
    const perms = getStagedPermutations(allVals);
    for (const perm of perms) {
      for (let gapPos = 0; gapPos < perm.length - 1; gapPos++) {
        let result: number | null = perm[0];
        for (let i = 1; i < perm.length; i++) {
          const useOp = i - 1 === gapPos ? op : '+';
          result = applyOperation(result!, useOp as Operation, perm[i]);
          if (result === null) break;
        }
        if (result !== null && result === target) return wildVal;
      }
    }
  }
  return null;
}

function computeStagedResult(staged: Card[]): number | null {
  // Evaluate staged cards left-to-right in tap order
  // Numbers separated by default +, unless an operator card appears between them
  const parsed: ({ type: 'num'; value: number } | { type: 'op'; op: Operation })[] = [];
  for (const c of staged) {
    if (c.type === 'number') parsed.push({ type: 'num', value: c.value ?? 0 });
    else if (c.type === 'operation') parsed.push({ type: 'op', op: c.operation! });
  }
  if (parsed.length === 0) return null;
  // Build evaluation: insert default + between consecutive numbers
  let result: number | null = null;
  let pendingOp: Operation = '+';
  for (const item of parsed) {
    if (item.type === 'num') {
      if (result === null) { result = item.value; }
      else { result = applyOperation(result, pendingOp, item.value); pendingOp = '+'; }
      if (result === null) return null;
    } else {
      pendingOp = item.op;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  GAME REDUCER
// ═══════════════════════════════════════════════════════════════
//
// ── TODO: UNIFIED NOTIFICATION SYSTEM — IRON RULES ──
//
// 1. ONE FIXED ZONE: A single <NotificationZone /> component in GameScreen,
//    always at the same screen position (absolute, below header). Never moves.
//
// 2. STATE-OWNED: Notifications live in reducer state as notifications: Notification[],
//    NOT derived from props or local useState. They survive re-renders.
//    Actions: PUSH_NOTIFICATION, DISMISS_NOTIFICATION.
//
// 3. QUEUE-BASED: Highest priority shown first. Dismissing reveals the next.
//    Priority order: frac-challenge > op-challenge > identical > op-celeb >
//    prev-action > frac-hint > eq-error > info.
//
// 4. TYPES: 'prev-action' | 'op-challenge' | 'frac-challenge' | 'identical' |
//    'frac-hint' | 'op-celeb' | 'eq-error' | 'info'.
//    Each has: id, type, title, body, autoDismissMs?, actions?, defense?, priority.
//
// 5. NEVER LOST: Notifications are only removed by explicit DISMISS_NOTIFICATION
//    dispatch. Phase changes, re-renders, or state updates do NOT clear them.
//
// 6. AUTO-DISMISS: Managed by the NotificationZone component via useEffect timer
//    that dispatches DISMISS_NOTIFICATION when autoDismissMs expires.
//
// 7. REPLACES: turnToast, opFeedback, opChallengeVisible, fracHintVisible,
//    fracToast, identicalAlert sheet, fraction challenge sheet — all consolidated.
//

const initialState: GameState = {
  phase: 'setup', players: [], currentPlayerIndex: 0, drawPile: [], discardPile: [],
  dice: null, diceRollSeq: 0, selectedCards: [], stagedCards: [], validTargets: [], equationResult: null,
  equationOpsUsed: [], activeOperation: null, challengeSource: null, activeFraction: null, pendingFractionTarget: null,
  fractionPenalty: 0, fractionAttackResolved: false, hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null,
  consecutiveIdenticalPlays: 0, identicalAlert: null, jokerModalOpen: false, equationHandSlots: [null, null], equationHandPick: null,
  courageMeterPercent: 0, courageMeterStep: 0, courageDiscardSuccessStreak: 0, courageRewardPulseId: 0, courageCoins: 0,
  lastCourageRewardReason: null, lastCourageCoinsAwarded: false,
  lastMoveMessage: null, lastDiscardCount: 0, lastEquationDisplay: null,
  difficulty: 'full', diceMode: '3', showFractions: true, fractionKinds: [...ALL_FRACTION_KINDS],
  showPossibleResults: true, showSolveExercise: true,
  difficultyStage: 'H', stageTransitions: 7, mathRangeMax: 25, enabledOperators: ['x', '÷'], allowNegativeTargets: true, abVariant: 'control_0_12_plus',
  equationAttempts: 0, equationSuccesses: 0, turnStartedAt: null, totalEquationResponseMs: 0,
  timerSetting: 'off', timerCustomSeconds: 60, winner: null, message: '',
  roundsPlayed: 0,
  notifications: [],
  moveHistory: [],
  guidanceEnabled: null,
  hasSeenIntroHint: false,
  hasSeenSolvedHint: false,
  soundsEnabled: true,
  tournamentTable: [],
  possibleResultsInfoUses: 0,
  possibleResultsInfoCountedThisTurn: false,
  suppressIdenticalOverlayOnline: false,
  botConfig: null,
  hostBotDifficulty: null,
  botPendingStagedIds: null,
  botPendingDemoActions: null,
  botNoSolutionTicks: 0,
  botNoSolutionDrawPending: false,
  botDicePausePending: false,
  botFractionDefenseTicks: 0,
  botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
  botConfirmDemoShownThisTurn: false,
  botPostEquationPauseTicks: 0,
  botTickSeq: 0,
  isTutorial: false,
  currentTurnPlayedCards: [],
  lastTurnPlayedCards: [],
};

function reshuffleDiscard(st: GameState): GameState {
  if (st.drawPile.length > 0 || st.discardPile.length <= 1) return st;
  const top = st.discardPile[st.discardPile.length - 1];
  return { ...st, drawPile: shuffle(st.discardPile.slice(0, -1)), discardPile: [top] };
}

function drawFromPile(st: GameState, count: number, pi: number): GameState {
  let s = { ...st, players: st.players.map(p => ({ ...p, hand: [...p.hand] })) };
  for (let i = 0; i < count; i++) {
    s = reshuffleDiscard(s);
    if (s.drawPile.length === 0) break;
    s.players[pi].hand.push(s.drawPile[0]);
    s.drawPile = s.drawPile.slice(1);
  }
  return s;
}

function resolveDiscardNumberCardFromStaged(
  stagedCards: Card[],
  equationResult: number,
  maxWild: number = 25,
): Card {
  const stagedNumbers = stagedCards.filter(c => c.type === 'number' || c.type === 'wild');
  const stagedOpCard = stagedCards.find(c => c.type === 'operation') ?? null;
  const wildVal = stagedNumbers.some(c => c.type === 'wild')
    ? computeWildValueInStaged(stagedNumbers, stagedOpCard, equationResult, maxWild)
    : null;

  for (let i = stagedCards.length - 1; i >= 0; i--) {
    const c = stagedCards[i];
    if (c.type === 'number') return c;
    if (c.type === 'wild') return wildVal !== null ? { ...c, resolvedValue: wildVal } : c;
  }

  const fallback = stagedNumbers[stagedNumbers.length - 1];
  if (fallback?.type === 'wild') {
    return wildVal !== null ? { ...fallback, resolvedValue: wildVal } : fallback;
  }
  return fallback;
}

function checkWin(st: GameState): GameState {
  const cp = st.players[st.currentPlayerIndex];
  // Win at 2-or-fewer cards so that a multi-card play (e.g. equation that
  // burns two numbers at once) that skips straight from 3 → 1 still triggers
  // the game-over instead of leaving the player stuck below the threshold.
  if (cp.hand.length <= 2) {
    const tournamentTable = st.tournamentTable.map((row) => {
      if (row.playerId === cp.id) return { ...row, wins: row.wins + 1 };
      return { ...row, losses: row.losses + 1 };
    });
    return { ...st, phase: 'game-over', winner: cp, tournamentTable };
  }
  return st;
}

function endTurnLogic(st: GameState, tf: (key: string, params?: MsgParams) => string): GameState {
  let s = { ...st };
  const up = s.players[s.currentPlayerIndex];
  if (up.hand.length === 2 && !up.calledLolos) {
    s.message = tf('local.callLolosForgiven', { name: up.name });
  }
  const next = (s.currentPlayerIndex + 1) % s.players.length;
  const nextNotifications = [...s.notifications];
  if (up.hand.length === 3 && !up.isBot) {
    nextNotifications.push({
      id: `three-cards-${up.id}-${Date.now()}`,
      message: tf('local.threeCardsWinPath', { name: up.name }),
      style: 'info',
      autoDismissMs: 4500,
    });
  }

  // Condition 2: reward when human player succeeds 2 turns in a row
  const justPlayedIsBot = up.isBot === true;
  const curStreak = s.courageDiscardSuccessStreak ?? 0;
  if (!justPlayedIsBot) {
    if (!s.hasPlayedCards) {
      s = { ...s, courageDiscardSuccessStreak: 0 };
    } else if (curStreak >= 2) {
      s = applyCourageStepReward(s, tf('courage.reason.consecutiveSuccess'));
      s = { ...s, courageDiscardSuccessStreak: 0 };
    }
  }

  return {
    ...s,
    notifications: nextNotifications,
    players: s.players.map(p => ({ ...p, calledLolos: false, lastCourageCoinsAwarded: false })),
    currentPlayerIndex: next, phase: 'turn-transition', dice: null,
    selectedCards: [], stagedCards: [], equationResult: null, validTargets: [],
    activeOperation: null,
    challengeSource: null,
    equationOpsUsed: [],
    activeFraction: null, identicalAlert: null, suppressIdenticalOverlayOnline: false, hasPlayedCards: false,
    hasDrawnCard: false, lastCardValue: null, pendingFractionTarget: null,
    fractionPenalty: 0, equationHandSlots: [null, null], equationHandPick: null,
    lastDiscardCount: s.lastDiscardCount,
    lastEquationDisplay: s.lastEquationDisplay,
    roundsPlayed: s.roundsPlayed + 1,
    possibleResultsInfoCountedThisTurn: false,
    botPendingStagedIds: null,
    botPendingDemoActions: null,
    botNoSolutionTicks: 0,
    botNoSolutionDrawPending: false,
    botDicePausePending: false,
    botFractionDefenseTicks: 0,
    botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
    botConfirmDemoShownThisTurn: false,
    botPostEquationPauseTicks: 0,
    lastTurnPlayedCards: s.currentTurnPlayedCards,
    currentTurnPlayedCards: [],
  };
}

const COURAGE_STEP_TO_PERCENT: Readonly<Record<number, number>> = {
  0: 0,
  1: 33,
  2: 66,
  3: 100,
};

function clampCourageStep(step: number): number {
  return Math.max(0, Math.min(3, step));
}

function applyCourageStepReward(st: GameState, reason: string): GameState {
  const pIdx = st.currentPlayerIndex;
  const cp = st.players[pIdx];
  if (!cp || cp.isBot) return st; // only reward human players
  const nextStep = clampCourageStep((cp.courageMeterStep ?? 0) + 1);
  if (nextStep === (cp.courageMeterStep ?? 0)) return st;
  const nextPercent = COURAGE_STEP_TO_PERCENT[nextStep];
  const isFull = nextPercent >= 100;
  const updatedPlayer: typeof cp = {
    ...cp,
    courageMeterStep: isFull ? 0 : nextStep,
    courageMeterPercent: isFull ? 0 : nextPercent,
    courageRewardPulseId: (cp.courageRewardPulseId ?? 0) + 1,
    courageCoins: (cp.courageCoins ?? 0) + (isFull ? 5 : 0),
    lastCourageCoinsAwarded: isFull,
  };
  return {
    ...st,
    players: st.players.map((p, i) => i === pIdx ? updatedPlayer : p),
    // Mirror human player fields to global state so existing rendering works
    courageMeterStep: isFull ? 0 : nextStep,
    courageMeterPercent: isFull ? 0 : nextPercent,
    courageRewardPulseId: (st.courageRewardPulseId ?? 0) + 1,
    courageCoins: (st.courageCoins ?? 0) + (isFull ? 5 : 0),
    lastCourageRewardReason: reason,
    lastCourageCoinsAwarded: isFull,
  };
}

function gameReducer(
  st: GameState,
  action: GameAction,
  tf: (key: string, params?: MsgParams) => string,
): GameState {
  switch (action.type) {
    case 'START_GAME':
    case 'PLAY_AGAIN': {
      AsyncStorage.removeItem('lulos_guidance_notifications');
      const playersSeed =
        action.type === 'PLAY_AGAIN'
          ? st.players.map((p) => ({ name: p.name, isBot: p.isBot }))
          : action.players;
      const difficulty = action.type === 'PLAY_AGAIN' ? st.difficulty : action.difficulty;
      const stage = migrateDifficultyStage(
        action.type === 'PLAY_AGAIN' ? st.difficultyStage : (action.difficultyStage ?? 'H'),
      );
      const stageCfg = DIFFICULTY_STAGE_CONFIG[stage];
      const enabledOperators = action.type === 'PLAY_AGAIN'
        ? st.enabledOperators
        : (action.enabledOperators && action.enabledOperators.length > 0 ? action.enabledOperators : stageCfg.enabledOperators);
      const allowNegativeTargets = action.type === 'PLAY_AGAIN'
        ? st.allowNegativeTargets
        : (action.allowNegativeTargets ?? stageCfg.allowNegativeTargets);
      const mathRangeMax = action.type === 'PLAY_AGAIN'
        ? st.mathRangeMax
        : (action.mathRangeMax ?? stageCfg.rangeMax);
      const abVariant = action.type === 'PLAY_AGAIN'
        ? st.abVariant
        : (action.abVariant ?? 'control_0_12_plus');
      const diceMode: GameState['diceMode'] = '3';
      const isLowNumberRange = mathRangeMax === 12;
      let fractions = action.type === 'PLAY_AGAIN' ? st.showFractions : action.fractions;
      let fractionKinds: Fraction[] =
        action.type === 'PLAY_AGAIN'
          ? [...st.fractionKinds]
          : action.fractionKinds && action.fractionKinds.length > 0
            ? [...action.fractionKinds]
            : [...ALL_FRACTION_KINDS];
      if (isLowNumberRange) {
        fractions = false;
        fractionKinds = [];
      }
      const showPossibleResults =
        action.type === 'PLAY_AGAIN' ? st.showPossibleResults : action.showPossibleResults;
      const showSolveExercise =
        action.type === 'PLAY_AGAIN' ? st.showSolveExercise : action.showSolveExercise;
      const timerSetting = action.type === 'PLAY_AGAIN' ? st.timerSetting : action.timerSetting;
      const timerCustomSeconds =
        action.type === 'PLAY_AGAIN' ? st.timerCustomSeconds : action.timerCustomSeconds ?? 60;
      const deck = shuffle(
        generateDeck(difficulty, fractions, enabledOperators, mathRangeMax, fractions ? fractionKinds : null),
      );
      const { hands, remaining } = dealCards(deck, playersSeed.length, CARDS_PER_PLAYER);
      let drawPile = remaining;
      let firstDiscard: Card | undefined;
      for (let i = 0; i < drawPile.length; i++) {
        if (drawPile[i].type === 'number') {
          firstDiscard = drawPile[i];
          drawPile = [...drawPile.slice(0, i), ...drawPile.slice(i + 1)];
          break;
        }
      }
      if (!firstDiscard) { firstDiscard = drawPile[0]; drawPile = drawPile.slice(1); }
      const botConfig: GameState['botConfig'] =
        action.type === 'PLAY_AGAIN'
          ? st.botConfig
          : action.mode === 'vs-bot'
            ? {
                difficulty: action.botDifficulty ?? 'medium',
                playerIds: playersSeed
                  .map((p, i) => ((p as { isBot?: boolean }).isBot ? i : -1))
                  .filter((id) => id >= 0),
              }
            : null;
      // Randomize the first player every local game (pass-and-play AND vs-bot).
      // openingDrawId drives the "who starts" celebration bubble in both modes.
      const firstPlayerIndex = Math.floor(Math.random() * playersSeed.length);
      const localOpeningDrawId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ...initialState,
        // אל תאפס דגלי הדרכה חד־פעמיים כאשר מתחילים משחק חדש
        hasSeenIntroHint: st.hasSeenIntroHint,
        hasSeenSolvedHint: st.hasSeenSolvedHint,
        soundsEnabled: st.soundsEnabled,
        guidanceEnabled: st.guidanceEnabled,
        phase: 'turn-transition', difficulty, diceMode,
        difficultyStage: stage,
        stageTransitions: action.type === 'PLAY_AGAIN' ? st.stageTransitions : STAGE_SEQUENCE.indexOf(stage),
        mathRangeMax,
        enabledOperators,
        allowNegativeTargets,
        abVariant,
        equationAttempts: 0,
        equationSuccesses: 0,
        turnStartedAt: Date.now(),
        totalEquationResponseMs: 0,
        showFractions: fractions,
        fractionKinds,
        showPossibleResults,
        showSolveExercise,
        timerSetting, timerCustomSeconds,
        players: playersSeed.map((p, i) => ({ id: i, name: p.name, hand: hands[i], calledLolos: false, isBot: (p as { isBot?: boolean }).isBot ?? false, courageMeterStep: 0, courageMeterPercent: 0, courageRewardPulseId: 0, courageCoins: 0, lastCourageCoinsAwarded: false, courageDiscardSuccessStreak: 0 })),
        currentPlayerIndex: firstPlayerIndex,
        openingDrawId: localOpeningDrawId,
        drawPile, discardPile: firstDiscard ? [firstDiscard] : [],
        tournamentTable:
          action.type === 'PLAY_AGAIN'
            ? st.tournamentTable.map((row) => ({ ...row }))
            : playersSeed.map((p, i) => ({
                playerId: i,
                playerName: p.name,
                wins: 0,
                losses: 0,
              })),
        botConfig,
        botPendingStagedIds: null,
        botPendingDemoActions: null,
        botNoSolutionTicks: 0,
        botNoSolutionDrawPending: false,
        botDicePausePending: false,
        botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
        botConfirmDemoShownThisTurn: false,
        botPostEquationPauseTicks: 0,
        botTickSeq: 0,
        isTutorial: action.type === 'START_GAME' && !!action.isTutorial,
      };
    }
    case 'NEXT_TURN': {
      console.log('NEXT_TURN, pendingFractionTarget was:', st.pendingFractionTarget);
      AsyncStorage.removeItem('lulos_guidance_notifications');
      const next = (st.currentPlayerIndex + 1) % st.players.length;
      return {
        ...st,
        notifications: [],
        players: st.players.map(p => ({ ...p, calledLolos: false })),
        currentPlayerIndex: next,
        phase: 'turn-transition',
        dice: null,
        selectedCards: [],
        stagedCards: [],
        equationResult: null,
        validTargets: [],
        message: '',
        activeOperation: null,
        challengeSource: null,
        equationOpsUsed: [],
        hasPlayedCards: false,
        hasDrawnCard: false,
        lastCardValue: null,
        lastDiscardCount: 0,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: false,
        equationHandSlots: [null, null],
        equationHandPick: null,
        possibleResultsInfoCountedThisTurn: false,
        botPendingStagedIds: null,
        botPendingDemoActions: null,
        botNoSolutionTicks: 0,
        botNoSolutionDrawPending: false,
        botDicePausePending: false,
        botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
        // Reset the per-turn demo gate so the next bot turn can fire the
        // possible-results demo again. endTurnLogic already resets this;
        // adding it here keeps NEXT_TURN (online) in lockstep.
        botConfirmDemoShownThisTurn: false,
        botPostEquationPauseTicks: 0,
      };
    }
    case 'BEGIN_TURN': {
      console.log('BEGIN_TURN: pendingFractionTarget=', st.pendingFractionTarget, 'fractionAttackResolved=', st.fractionAttackResolved, 'topCard=', st.discardPile[st.discardPile.length-1]?.type, st.discardPile[st.discardPile.length-1]?.fraction);
      // activeOperation is purely informational — challenge card stays on pile, player plays normally
      // Fraction attack: explicit pending attack (from PLAY_FRACTION)
      if (st.pendingFractionTarget !== null && !st.fractionAttackResolved) {
        const currentIsBot =
          !!st.botConfig && st.botConfig.playerIds.includes(st.players[st.currentPlayerIndex]?.id ?? -1);
        const showBotText = currentIsBot && st.guidanceEnabled !== false;
        return {
          ...st,
          phase: 'pre-roll',
          message: showBotText
            ? tf('botOffline.fractionDefenseThinkBody', { x: String(st.fractionPenalty) })
            : '',
          lastDiscardCount: 0,
          lastEquationDisplay: null,
          lastCourageRewardReason: null,
          lastCourageCoinsAwarded: false,
          turnStartedAt: Date.now(),
          botFractionDefenseTicks: currentIsBot ? 2 : 0,
          botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
          botPostEquationPauseTicks: 0,
        };
      }
      // Fraction attack: auto-detect fraction card on top of discard pile
      // Skip if the fraction was already resolved (penalty taken or defense played)
      const topDiscard = st.discardPile[st.discardPile.length - 1];
      // Stale fraction bubbles from the previous turn must not leak into this
      // turn. `frac-challenge-*` is requireAck (no auto-dismiss) so if the
      // defender acked and resolved the attack, the bubble would still be in
      // the queue and re-render on the next player's turn-transition.
      const clearedNotifs = (st.notifications ?? []).filter((n) => !n.id.startsWith('frac-'));
      if (topDiscard && topDiscard.type === 'fraction' && !st.fractionAttackResolved) {
        const denom = fractionDenominator(topDiscard.fraction!);

        return { ...st, phase: 'pre-roll', pendingFractionTarget: denom, fractionPenalty: denom, fractionAttackResolved: false, message: '', lastDiscardCount: 0, lastEquationDisplay: null, lastCourageRewardReason: null, lastCourageCoinsAwarded: false, turnStartedAt: Date.now(), botFractionDefenseTicks: 0, botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null }, botPostEquationPauseTicks: 0, notifications: clearedNotifs };
      }
      // Normal turn — reset; clear last-move display (הודעת עדכון רק במסך השחקן); notify if fraction chain just ended
      const fracChainEnded = st.fractionAttackResolved && topDiscard?.type === 'fraction';
      return { ...st, phase: 'pre-roll', fractionAttackResolved: false, pendingFractionTarget: null, fractionPenalty: 0, message: fracChainEnded ? tf('local.fractionRoundEndedRoll') : '', lastDiscardCount: 0, lastEquationDisplay: null, lastCourageRewardReason: null, lastCourageCoinsAwarded: false, turnStartedAt: Date.now(), botFractionDefenseTicks: 0, botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null }, botPostEquationPauseTicks: 0, notifications: clearedNotifs };
    }
    case 'ROLL_DICE': {
      // In tutorial mode, allow ROLL_DICE from any phase so the lesson can
      // re-rig dice between steps without going through turn transitions.
      if (st.phase !== 'pre-roll' && !st.isTutorial) return st;
      const dice: DiceResult = action.values || rollDiceUtil();
      let ns: GameState = { ...st, dice };
      if (isTriple(dice)) {
        ns = { ...ns, message: tf('toast.tripleDice', { n: String(dice.die1) }) };
      }
      const vt = generateValidTargets(dice, st.enabledOperators, st.allowNegativeTargets, st.mathRangeMax);
      const currentIsBot =
        !!st.botConfig && st.botConfig.playerIds.includes(st.players[st.currentPlayerIndex]?.id ?? -1);
      return {
        ...ns,
        validTargets: vt,
        phase: 'building',
        diceRollSeq: (st.diceRollSeq ?? 0) + 1,
        consecutiveIdenticalPlays: 0,
        message: ns.message || '',
        // Tutorial: when forcing ROLL_DICE from non-pre-roll, also clear
        // stale solved/played state so the EquationBuilder is fully fresh.
        ...(st.isTutorial && st.phase !== 'pre-roll' ? {
          equationResult: null,
          equationOpsUsed: [],
          lastEquationDisplay: null,
          stagedCards: [],
          hasPlayedCards: false,
          selectedCards: [],
          lastMoveMessage: null,
          lastDiscardCount: 0,
        } : {}),
        botPendingStagedIds: null,
        botPendingDemoActions: null,
        botNoSolutionTicks: 0,
        botNoSolutionDrawPending: false,
        botDicePausePending: currentIsBot,
        botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
        botPostEquationPauseTicks: 0,
      };
    }
    case 'CONFIRM_EQUATION': {
      if (st.phase !== 'building') return st;
      const isNewUser = st.guidanceEnabled !== false;
      const firstSolvedHint = isNewUser && !st.hasSeenSolvedHint;
      const equationHandSlots = deriveEquationHandSlotsFromCommits(st, action.equationCommits);
      return {
        ...st,
        phase: 'solved',
        equationResult: action.result,
        equationOpsUsed: action.equationOps,
        equationHandSlots,
        equationHandPick: null,
        lastEquationDisplay: action.equationDisplay,
        stagedCards: [],
        message: firstSolvedHint ? tf('local.solvedEquationPickCards') : '',
        hasSeenSolvedHint: st.hasSeenSolvedHint || firstSolvedHint,
        equationSuccesses: st.equationSuccesses + 1,
        totalEquationResponseMs: st.turnStartedAt ? st.totalEquationResponseMs + Math.max(0, Date.now() - st.turnStartedAt) : st.totalEquationResponseMs,
        botPendingStagedIds: null,
        botPendingDemoActions: null,
        botNoSolutionTicks: 0,
        botNoSolutionDrawPending: false,
        botDicePausePending: false,
        botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
        botPostEquationPauseTicks: 0,
      };
    }
    case 'RECORD_EQUATION_ATTEMPT': {
      return { ...st, equationAttempts: st.equationAttempts + 1 };
    }
    case 'REVERT_TO_BUILDING': {
      if (st.phase !== 'solved' || st.hasPlayedCards) return st;
      return {
        ...st,
        phase: 'building',
        equationResult: null,
        equationOpsUsed: [],
        lastEquationDisplay: null,
        stagedCards: [],
        message: '',
        botPendingStagedIds: null,
        botPendingDemoActions: null,
        botNoSolutionTicks: 0,
        botNoSolutionDrawPending: false,
        botDicePausePending: false,
        botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
        botPostEquationPauseTicks: 0,
      };
    }
    case 'STAGE_CARD': {
      if (st.phase !== 'solved' || st.hasPlayedCards) return st;
      if (st.stagedCards.some(c => c.id === action.card.id)) return st;
      if (action.card.type !== 'number' && action.card.type !== 'operation' && action.card.type !== 'wild') return st;
      if (action.card.type === 'wild' && st.stagedCards.some(c => c.type === 'wild')) return st;
      // Lift from dice-equation UI into staging (same physical card — clear slot/pick first)
      let base: typeof st = st;
      if (isCardInEquationHand(st, action.card.id)) {
        const slots: [EquationHandSlot | null, EquationHandSlot | null] = [...st.equationHandSlots];
        if (slots[0]?.card.id === action.card.id) slots[0] = null;
        if (slots[1]?.card.id === action.card.id) slots[1] = null;
        const equationHandPick =
          st.equationHandPick?.card.id === action.card.id ? null : st.equationHandPick;
        base = { ...st, equationHandSlots: slots, equationHandPick, message: '' };
      }
      if (action.card.type === 'operation' && base.stagedCards.some(c => c.type === 'operation')) {
        return { ...base, message: tf('stage.oneOpOnly') };
      }
      return { ...base, stagedCards: [...base.stagedCards, action.card], message: '' };
    }
    case 'UNSTAGE_CARD': {
      if (st.phase !== 'solved') return st;
      return { ...st, stagedCards: st.stagedCards.filter(c => c.id !== action.card.id), message: '' };
    }
    case 'CONFIRM_STAGED': {
      if (st.phase !== 'solved' || st.hasPlayedCards) return st;
      const stNumbers = st.stagedCards.filter(c => c.type === 'number' || c.type === 'wild');
      const stOpCards = st.stagedCards.filter(c => c.type === 'operation');
      const stOpCard = stOpCards.length === 1 ? stOpCards[0] : null;
      if (stNumbers.length === 0) return { ...st, message: tf('confirm.needNumberOrWild') };
      if (st.equationResult === null) return st;
      if (!validateStagedCards(stNumbers, stOpCard, st.equationResult, st.mathRangeMax ?? 25)) {
        return { ...st, message: tf('confirm.sumMismatch') };
      }
      // Valid — remove staged cards + equation operator card from hand
      const stIds = new Set(st.stagedCards.map(c => c.id));
      for (const slot of st.equationHandSlots) if (slot) stIds.add(slot.card.id);
      const stCp = st.players[st.currentPlayerIndex];
      const stNp = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: stCp.hand.filter(c => !stIds.has(c.id)) } : p);
      const discardDisplayCard = resolveDiscardNumberCardFromStaged(
        st.stagedCards,
        st.equationResult!,
        st.mathRangeMax ?? 25,
      );
      const lastCardVal = getEffectiveNumber(discardDisplayCard);
      const stDiscard = [...st.discardPile, discardDisplayCard];
      const stToast = tf('toast.equationPlayed', {
        name: stCp.name,
        equation: `\u2066${st.lastEquationDisplay || ''}\u2069`,
        value: String(lastCardVal ?? '?'),
      });
      // TODO: add dedicated sound effect per discard count
      const moveEntry: MoveHistoryEntry = { playerIndex: st.currentPlayerIndex, cardsDiscarded: stIds.size, description: stToast };
      const allDiscardedCards: Card[] = [...st.stagedCards, ...st.equationHandSlots.filter(Boolean).map(s => s!.card)];
      let stNs: GameState = { ...st, players: stNp, discardPile: stDiscard, stagedCards: [], selectedCards: [], consecutiveIdenticalPlays: 0, hasPlayedCards: true, lastCardValue: lastCardVal, activeOperation: null, challengeSource: null, equationOpsUsed: [], equationHandSlots: [null, null], equationHandPick: null, lastMoveMessage: stToast, lastDiscardCount: stIds.size, lastEquationDisplay: st.lastEquationDisplay, message: '', moveHistory: [...st.moveHistory, moveEntry], currentTurnPlayedCards: [...st.currentTurnPlayedCards, ...allDiscardedCards] };
      // Condition 1: used all 3 dice (equation display has 2+ operators before '=')
      const eqBefore = (st.lastEquationDisplay ?? '').split('=')[0] ?? '';
      const usedAllDice = (eqBefore.match(/[+×÷-]/g) ?? []).length >= 2;
      if (usedAllDice) {
        stNs = applyCourageStepReward(stNs, tf('courage.reason.fullEquation'));
      }
      // Track consecutive success streak for human (non-bot) players
      if (!stNs.botConfig?.playerIds.includes(stCp.id)) {
        stNs = { ...stNs, courageDiscardSuccessStreak: (st.courageDiscardSuccessStreak ?? 0) + 1 };
      }
      stNs = checkWin(stNs);
      if (stNs.phase === 'game-over') return stNs;
      // Discard celebration is shown on TurnTransition only (not NotificationZone in GameScreen).
      return { ...endTurnLogic(stNs, tf), lastDiscardCount: stIds.size };
    }
    case 'CONFIRM_TRAP_ONLY': {
      return { ...st, message: tf('operation.onlyInEquation') };
    }
    case 'PLAY_IDENTICAL': {
      if (st.phase !== 'pre-roll') return st;
      if (st.consecutiveIdenticalPlays >= 2) return st;
      if (action.card.type === 'operation' || action.card.type === 'joker') return st;
      const td = st.discardPile[st.discardPile.length - 1];
      if (!validateIdenticalPlay(action.card, td)) return st;
      const effectiveVal = getEffectiveNumber(td);
      const cardToDiscard = action.card.type === 'wild' && effectiveVal != null
        ? { ...action.card, resolvedValue: effectiveVal }
        : action.card;
      const cp = st.players[st.currentPlayerIndex];
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      const newConsecutive = st.consecutiveIdenticalPlays + 1;
      const cardDisplay = action.card.type === 'number' ? `${action.card.value}` :
                          action.card.type === 'fraction' ? action.card.fraction! :
                          action.card.type === 'wild' ? (effectiveVal != null ? tf('labels.wildWithValue', { value: String(effectiveVal) }) : tf('labels.wild')) : tf('labels.joker');
      let ns: GameState = {
        ...st, players: np, discardPile: [...st.discardPile, cardToDiscard],
        selectedCards: [], hasPlayedCards: true,
        consecutiveIdenticalPlays: newConsecutive,
        lastCardValue: action.card.type === 'number' ? action.card.value ?? null : action.card.type === 'wild' ? effectiveVal : null,
        identicalAlert: { playerName: cp.name, cardDisplay, consecutive: newConsecutive },
        currentTurnPlayedCards: [...st.currentTurnPlayedCards, cardToDiscard],
        message: '',
      };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return { ...ns, identicalAlert: null };
      return ns; // Stay — modal shown, DISMISS_IDENTICAL_ALERT will call endTurnLogic
    }
    case 'DISMISS_IDENTICAL_ALERT': {
      if (!st.identicalAlert) return st;
      const idToast = tf('toast.identicalPlay', {
        name: st.identicalAlert.playerName,
        card: st.identicalAlert.cardDisplay,
      });
      return endTurnLogic(
        {
          ...st,
          identicalAlert: null,
          suppressIdenticalOverlayOnline: false,
          lastMoveMessage: idToast,
          lastDiscardCount: 1,
          moveHistory: [...st.moveHistory, { playerIndex: st.currentPlayerIndex, cardsDiscarded: 1, description: idToast }],
        },
        tf,
      );
    }
    case 'SUPPRESS_ONLINE_IDENTICAL_OVERLAY':
      return { ...st, suppressIdenticalOverlayOnline: true };
    case 'CLEAR_ONLINE_IDENTICAL_SUPPRESS':
      return { ...st, suppressIdenticalOverlayOnline: false };
    // ── Equation operator placement (building phase only) ──
    case 'SELECT_EQ_OP': {
      console.log('[REDUCER] SELECT_EQ_OP', 'phase=', st.phase, 'card=', action.card.operation);
      // שלב המשוואה נשלט ע"י override במצב רשת — ב-localState הוא נשאר 'setup', לכן אין בדיקת phase כאן; הצרכנים מגנים ב-UI.
      if (action.card.type !== 'operation') return st;
      // Tutorial Lesson 5 teaches operator-card placement — all four signs
      // are valid picks regardless of stage config (stage 'A' only enables
      // `+`). The enabledOperators gate is bypassed here and in PLACE_EQ_OP
      // so any card from the learner's L5 hand can be picked up.
      const bypassOpGate = st.isTutorial;
      if (!bypassOpGate && action.card.operation != null && !st.enabledOperators.includes(action.card.operation)) {
        return { ...st, message: tf('equation.operatorNotInStage') };
      }
      const placed = countEquationHandPlaced(st);
      if (placed >= 2 && !st.equationHandPick) {
        return { ...st, message: tf('equation.handSlotsFull') };
      }
      if (st.equationHandSlots[0]?.card.id === action.card.id) {
        return { ...st, equationHandSlots: [null, st.equationHandSlots[1]], equationHandPick: null, message: '' };
      }
      if (st.equationHandSlots[1]?.card.id === action.card.id) {
        return { ...st, equationHandSlots: [st.equationHandSlots[0], null], equationHandPick: null, message: '' };
      }
      return { ...st, equationHandPick: { card: action.card, jokerAs: null }, message: '' };
    }
    case 'SELECT_EQ_JOKER': {
      // שלב המשוואה נשלט ע"י override במצב רשת — ב-localState הוא נשאר 'setup'; הצרכנים מגנים ב-UI.
      // Tutorial bypass: see comment in SELECT_EQ_OP above.
      const bypassJokerGate = st.isTutorial;
      if (!bypassJokerGate && action.chosenOperation != null && !st.enabledOperators.includes(action.chosenOperation)) {
        return { ...st, message: tf('equation.operatorNotInStage') };
      }
      const placed = countEquationHandPlaced(st);
      if (placed >= 2 && !st.equationHandPick) {
        return { ...st, message: tf('equation.handSlotsFull') };
      }
      if (st.equationHandSlots[0]?.card.id === action.card.id) {
        return { ...st, equationHandSlots: [null, st.equationHandSlots[1]], equationHandPick: null, message: '' };
      }
      if (st.equationHandSlots[1]?.card.id === action.card.id) {
        return { ...st, equationHandSlots: [st.equationHandSlots[0], null], equationHandPick: null, message: '' };
      }
      return {
        ...st,
        equationHandPick: { card: action.card, jokerAs: action.chosenOperation },
        jokerModalOpen: false,
        selectedCards: [],
        message: '',
      };
    }
    case 'PLACE_EQ_OP': {
      const pick = st.equationHandPick;
      console.log('[REDUCER] PLACE_EQ_OP', 'pos=', action.position, 'hasPick=', !!pick);
      if (!pick || action.position < 0 || action.position > 1) return st;
      if (pick.card.type === 'joker' && pick.jokerAs == null) return st;
      const opToPlace = pick.card.type === 'joker' ? pick.jokerAs : pick.card.operation;
      // Tutorial bypass: see comment in SELECT_EQ_OP above.
      const bypassPlaceGate = st.isTutorial;
      if (!bypassPlaceGate && opToPlace != null && !st.enabledOperators.includes(opToPlace)) {
        return { ...st, message: tf('equation.operatorNotInStage'), equationHandPick: null };
      }
      const slots: [EquationHandSlot | null, EquationHandSlot | null] = [...st.equationHandSlots];
      if (slots[0]?.card.id === pick.card.id) slots[0] = null;
      if (slots[1]?.card.id === pick.card.id) slots[1] = null;
      slots[action.position as 0 | 1] = { card: pick.card, jokerAs: pick.jokerAs };
      return { ...st, equationHandSlots: slots, equationHandPick: null, message: '' };
    }
    case 'REMOVE_EQ_HAND_SLOT': {
      const slots: [EquationHandSlot | null, EquationHandSlot | null] = [...st.equationHandSlots];
      slots[action.position] = null;
      return { ...st, equationHandSlots: slots, message: '' };
    }
    case 'CLEAR_EQ_HAND': {
      console.log('[REDUCER] CLEAR_EQ_HAND');
      return { ...st, equationHandSlots: [null, null], equationHandPick: null, message: '' };
    }
    case 'CLEAR_EQ_HAND_PICK':
      return { ...st, equationHandPick: null, message: '' };
    case 'PLAY_FRACTION': {
      if (st.hasPlayedCards) return st;
      if (action.card.type !== 'fraction') return st;
      const cp = st.players[st.currentPlayerIndex];
      const denom = fractionDenominator(action.card.fraction!);

      // ── BLOCK MODE: fraction-on-fraction during defense ──
      // Any fraction card is valid. New target = denom of the blocking fraction
      // (same mechanic as attack mode), always a whole number.
      if (st.pendingFractionTarget !== null) {
        const newTarget = denom;
        const cardToDiscard = { ...action.card, resolvedTarget: newTarget };
        const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
        let ns = { ...st, players: np, discardPile: [...st.discardPile, cardToDiscard], hasPlayedCards: true };
        ns = checkWin(ns);
        if (ns.phase === 'game-over') return ns;
        const next = (ns.currentPlayerIndex + 1) % ns.players.length;
        const blockFracUni = action.card.fraction === '1/2' ? '½' : action.card.fraction === '1/3' ? '⅓' : action.card.fraction === '1/4' ? '¼' : action.card.fraction === '1/5' ? '⅕' : action.card.fraction;
        const blockMsg = tf('local.fractionBlockToast', { name: cp.name, fraction: String(blockFracUni ?? action.card.fraction ?? '?') });
        return {
          ...ns, players: ns.players.map(p => ({ ...p, calledLolos: false })),
          currentPlayerIndex: next, phase: 'turn-transition', dice: null,
          selectedCards: [], stagedCards: [], equationResult: null, validTargets: [],
          activeOperation: null, challengeSource: cp.name, equationOpsUsed: [],
          activeFraction: null, consecutiveIdenticalPlays: 0,
          hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null, lastDiscardCount: 0,
          pendingFractionTarget: newTarget, fractionPenalty: denom,
          fractionAttackResolved: false,
          lastMoveMessage: blockMsg,
          message: tf('local.fractionBlockMsg', { name: cp.name }),
          moveHistory: [...st.moveHistory, { playerIndex: st.currentPlayerIndex, cardsDiscarded: 1, description: blockMsg }],
          lastTurnPlayedCards: [...st.currentTurnPlayedCards, cardToDiscard],
          currentTurnPlayedCards: [],
        };
      }

      // ── ATTACK MODE: fraction played offensively ──
      console.log('PLAY_FRACTION dispatch:', action.card.fraction, 'phase:', st.phase, 'pendingFractionTarget:', st.pendingFractionTarget);
      if (st.phase !== 'pre-roll' && st.phase !== 'building' && st.phase !== 'solved') { console.log('PLAY_FRACTION REJECTED - bad phase:', st.phase); return st; }
      const newTarget = denom;
      console.log('SET pendingFractionTarget:', newTarget);
      const cardToDiscard = { ...action.card, resolvedTarget: denom };
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      let ns = { ...st, players: np, discardPile: [...st.discardPile, cardToDiscard], hasPlayedCards: true };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return ns;
      const next = (ns.currentPlayerIndex + 1) % ns.players.length;
      const fracUni = action.card.fraction === '1/2' ? '½' : action.card.fraction === '1/3' ? '⅓' : action.card.fraction === '1/4' ? '¼' : action.card.fraction === '1/5' ? '⅕' : action.card.fraction;
      const atkMsg = tf('local.fractionAttackToast', { name: cp.name, fraction: String(fracUni ?? action.card.fraction ?? '?') });
      return {
        ...ns, players: ns.players.map(p => ({ ...p, calledLolos: false })),
        currentPlayerIndex: next, phase: 'turn-transition', dice: null,
        selectedCards: [], stagedCards: [], equationResult: null, validTargets: [],
        activeOperation: null, challengeSource: cp.name, equationOpsUsed: [],
        activeFraction: null, consecutiveIdenticalPlays: 0,
        hasPlayedCards: false, hasDrawnCard: false, lastCardValue: null, lastDiscardCount: 0,
        pendingFractionTarget: newTarget, fractionPenalty: denom,
        fractionAttackResolved: false,
        lastMoveMessage: atkMsg,
        message: tf('local.fractionAttackMsg', { name: cp.name }),
        moveHistory: [...st.moveHistory, { playerIndex: st.currentPlayerIndex, cardsDiscarded: 1, description: atkMsg }],
        lastTurnPlayedCards: [...st.currentTurnPlayedCards, cardToDiscard],
        currentTurnPlayedCards: [],
      };
    }
    case 'DEFEND_FRACTION_SOLVE': {
      if (st.pendingFractionTarget === null) return st;
      const pen = st.fractionPenalty;
      if (pen <= 0) return st;
      const maxWild = st.mathRangeMax;
      const cp = st.players[st.currentPlayerIndex];
      let cardToDiscard: Card;
      let lastVal: number;
      if (action.card.type === 'number') {
        const nv = action.card.value;
        if (nv == null || nv <= 0 || nv % pen !== 0) return st;
        cardToDiscard = action.card;
        lastVal = nv;
      } else if (action.card.type === 'wild') {
        const v = action.wildResolve;
        if (v == null || v <= 0 || v > maxWild || v % pen !== 0) return st;
        cardToDiscard = { ...action.card, resolvedValue: v };
        lastVal = v;
      } else {
        // סלינדה לא מגנה; שבר עובר דרך PLAY_FRACTION
        return st;
      }
      const np = st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, hand: cp.hand.filter(c => c.id !== action.card.id) } : p);
      const defMsg = tf('toast.defenseOk');
      let ns = {
        ...st,
        players: np,
        discardPile: [...st.discardPile, cardToDiscard],
        selectedCards: [],
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: true,
        lastCardValue: lastVal,
        lastMoveMessage: defMsg,
        message: tf('msg.defenseOk'),
        moveHistory: [...st.moveHistory, { playerIndex: st.currentPlayerIndex, cardsDiscarded: 1, description: defMsg }],
        notifications: (st.notifications ?? []).filter((n) => !n.id.startsWith('frac-')),
      };
      ns = checkWin(ns);
      if (ns.phase === 'game-over') return ns;
      return endTurnLogic(ns, tf);
    }
    case 'DEFEND_FRACTION_PENALTY': {
      if (st.pendingFractionTarget === null) return st;
      const cp = st.players[st.currentPlayerIndex];
      let s = drawFromPile(st, st.fractionPenalty, st.currentPlayerIndex);
      const penMsg = tf('toast.penaltyDraw', { name: cp.name, count: String(st.fractionPenalty) });
      s = {
        ...s,
        pendingFractionTarget: null,
        fractionPenalty: 0,
        fractionAttackResolved: true,
        lastMoveMessage: penMsg,
        message: tf('msg.penaltyDraw', { name: cp.name, count: String(st.fractionPenalty) }),
        moveHistory: [...st.moveHistory, { playerIndex: st.currentPlayerIndex, cardsDiscarded: 0, description: penMsg }],
        notifications: (s.notifications ?? []).filter((n) => !n.id.startsWith('frac-')),
      };
      return endTurnLogic(s, tf);
    }
    case 'OPEN_JOKER_MODAL': return { ...st, jokerModalOpen: true, selectedCards: [action.card] };
    case 'CLOSE_JOKER_MODAL': return { ...st, jokerModalOpen: false, selectedCards: [] };
    case 'ADD_SLINDA_TO_HAND': {
      const cpIdx = st.currentPlayerIndex;
      const newCard: Card = { id: makeId(), type: 'joker' };
      const updatedPlayers = st.players.map((p, i) =>
        i === cpIdx ? { ...p, hand: [...p.hand, newCard] } : p,
      );
      return { ...st, players: updatedPlayers };
    }
    case 'PLAY_JOKER': {
      return { ...st, jokerModalOpen: false, selectedCards: [], message: tf('joker.onlyInEquation') };
    }
    case 'DRAW_CARD': {
      if (st.hasPlayedCards || st.hasDrawnCard) return st;
      const drawCp = st.players[st.currentPlayerIndex];
      let s = reshuffleDiscard(st);
      if (s.drawPile.length === 0) return { ...s, hasDrawnCard: true, message: '' };
      const drawnCard = s.drawPile[0];
      s = drawFromPile(s, 1, s.currentPlayerIndex);
      const drawMsg = tf('toast.drawOne', { name: drawCp.name });
      s = { ...s, hasDrawnCard: true, activeOperation: null, challengeSource: null, equationOpsUsed: [], lastMoveMessage: drawMsg, moveHistory: [...st.moveHistory, { playerIndex: st.currentPlayerIndex, cardsDiscarded: 0, description: drawMsg }] };
      return endTurnLogic(s, tf);
    }
    case 'CALL_LOLOS': {
      const cp = st.players[st.currentPlayerIndex];
      if (cp.hand.length > 2) return st;
      const lolosMsg = tf('local.callLolosDeclared', { name: cp.name });
      return {
        ...st,
        players: st.players.map((p, i) => i === st.currentPlayerIndex ? { ...p, calledLolos: true } : p),
        message: lolosMsg,
        moveHistory: [...st.moveHistory, { playerIndex: st.currentPlayerIndex, cardsDiscarded: 0, description: lolosMsg }],
      };
    }
    case 'END_TURN': return endTurnLogic(st, tf);
    case 'SET_MESSAGE': return { ...st, message: action.message };
    case 'PUSH_NOTIFICATION': {
      const payload = action.payload;
      const id = payload.id;
      const notifs = st.notifications ?? [];
      /** בועת ONB אחת עם requireAck בכל פעם — מונע הצפת הודעות ברצף */
      if (id.startsWith('onb-') && payload.requireAck) {
        const hasOpenOnbAck = notifs.some((n) => n.requireAck && n.id.startsWith('onb-'));
        if (hasOpenOnbAck) {
          if (__DEV__) console.log('[PUSH] skip onb — already open:', id);
          return st;
        }
      }
      // Fraction toasts can spam on repeated taps; keep only the latest one.
      const baseList = id.startsWith('frac-')
        ? notifs.filter((n) => !n.id.startsWith('frac-'))
        : notifs;
      const next = [...baseList, payload];
      if (id.startsWith('onb-')) {
        const onbStorageKey = id.slice(4);
        void AsyncStorage.setItem(onbStorageKey, 'true');
      }
      if (id.startsWith('guidance-') || id.startsWith('onb-')) {
        AsyncStorage.setItem('lulos_guidance_notifications', JSON.stringify(next.filter(n => n.id.startsWith('guidance-') || n.id.startsWith('onb-')).slice(-10)));
      }
      console.log('[PUSH]', JSON.stringify({id:action.payload.id,title:action.payload.title,emoji:action.payload.emoji,msg:action.payload.message?.slice(0,40),style:action.payload.style}));
      return { ...st, notifications: next };
    }
    case 'DISMISS_NOTIFICATION': {
      const next = st.notifications.filter(n => n.id !== action.id);
      if (action.id.startsWith('guidance-') || action.id.startsWith('onb-')) {
        const toStore = next.filter(n => n.id.startsWith('guidance-') || n.id.startsWith('onb-'));
        if (toStore.length) AsyncStorage.setItem('lulos_guidance_notifications', JSON.stringify(toStore));
        else AsyncStorage.removeItem('lulos_guidance_notifications');
      }
      console.log('[DISMISS]', action.id, 'remaining:', next.length);
      return { ...st, notifications: next };
    }
    case 'RESTORE_NOTIFICATIONS':
      return { ...st, notifications: normalizeRestoredNotifications(action.payload) };
    case 'SET_SOUNDS_ENABLED':
      return { ...st, soundsEnabled: action.enabled };
    case 'UPDATE_PLAYER_NAME':
      return {
        ...st,
        players: st.players.map((p, i) => i === action.playerIndex ? { ...p, name: action.name.slice(0, 7) } : p),
        tournamentTable: st.tournamentTable.map((row) =>
          row.playerId === action.playerIndex ? { ...row, playerName: action.name.slice(0, 7) } : row
        ),
      };
    case 'SET_GUIDANCE_ENABLED':
      return { ...st, guidanceEnabled: action.enabled };
    case 'DISMISS_INTRO_HINT':
      return { ...st, hasSeenIntroHint: true };
    case 'USE_POSSIBLE_RESULTS_INFO': {
      if (st.possibleResultsInfoCountedThisTurn) {
        return st;
      }
      const nextUses = st.possibleResultsInfoUses + 1;
      if (nextUses < 4) {
        return {
          ...st,
          possibleResultsInfoUses: nextUses,
          possibleResultsInfoCountedThisTurn: true,
          message: tf('local.possibleResultsUseCount', { n: String(nextUses) }),
        };
      }
      let s = reshuffleDiscard(st);
      if (s.drawPile.length === 0) {
        return {
          ...s,
          possibleResultsInfoUses: 0,
          possibleResultsInfoCountedThisTurn: true,
          message: tf('local.possibleResultsPaidNoDeck'),
        };
      }
      s = drawFromPile(s, 1, s.currentPlayerIndex);
      const cp = s.players[s.currentPlayerIndex];
      return {
        ...s,
        possibleResultsInfoUses: 0,
        possibleResultsInfoCountedThisTurn: true,
        message: tf('local.possibleResultsPaidDraw', { name: cp.name }),
      };
    }
    case 'BOT_STEP': {
      // Always increment the tick counter, even for no-op paths. The bot clock
      // useEffect dep array depends on botTickSeq to guarantee re-scheduling
      // on every BOT_STEP regardless of outcome, preventing "frozen bot" bugs.
      const stWithTick = { ...st, botTickSeq: st.botTickSeq + 1 };

      if (stWithTick.phase === 'game-over') return stWithTick;
      if (!stWithTick.botConfig) return stWithTick;
      const current = stWithTick.players[stWithTick.currentPlayerIndex];
      if (!current) return stWithTick;
      if (!stWithTick.botConfig.playerIds.includes(current.id)) return stWithTick;

      // Bot's turn during turn-transition: auto-advance to pre-roll (equivalent
      // of the human pressing "I'm ready"). Without this the game would freeze
      // because the lockUiForBotTurn overlay blocks all touches and the button is
      // hidden.
      if (stWithTick.phase === 'turn-transition') {
        return gameReducer(stWithTick, { type: 'BEGIN_TURN' }, tf);
      }

      const pendingIds = stWithTick.botPendingStagedIds;
      if (pendingIds != null && (stWithTick.phase !== 'solved' || stWithTick.hasPlayedCards)) {
        return {
          ...stWithTick,
          botPendingStagedIds: null,
          botPendingDemoActions: null,
          botNoSolutionTicks: 0,
          botNoSolutionDrawPending: false,
          botDicePausePending: false,
          botFractionDefenseTicks: 0,
          botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
          botPostEquationPauseTicks: 0,
        };
      }

      if (stWithTick.phase === 'building' && stWithTick.botDicePausePending) {
        return {
          ...stWithTick,
          botDicePausePending: false,
          botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
          botPostEquationPauseTicks: 0,
        };
      }
      if (stWithTick.pendingFractionTarget !== null && stWithTick.botFractionDefenseTicks > 0) {
        return { ...stWithTick, botFractionDefenseTicks: stWithTick.botFractionDefenseTicks - 1 };
      }

      const activePresentation = stWithTick.botPresentation;
      if (activePresentation.action != null) {
        if (activePresentation.ticks > 0) {
          return {
            ...stWithTick,
            botPresentation: { ...activePresentation, ticks: activePresentation.ticks - 1 },
          };
        }
        const notification =
          stWithTick.guidanceEnabled !== false ? activePresentation.notification : null;
        const stateForAction = notification
          ? {
              ...stWithTick,
              notifications: [
                ...stWithTick.notifications.filter((n) => !n.id.startsWith('bot-step-')),
                notification,
              ],
            }
          : stWithTick;
        const presentedAction = activePresentation.action;
        if (presentedAction.kind === 'drawCard' && stateForAction.phase === 'building') {
          // Bot can't solve with its hand + dice — narration bubbles disabled per user preference.
          return {
            ...stateForAction,
            botNoSolutionDrawPending: true,
            botNoSolutionTicks: 2,
            botDicePausePending: false,
            botFractionDefenseTicks: 0,
            botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
            botPostEquationPauseTicks: 0,
          };
        }
        let afterPresented = applyBotActionAtomically(stateForAction, presentedAction);
        if (
          presentedAction.kind === 'stageCard' &&
          stWithTick.botPendingStagedIds != null &&
          stWithTick.botPendingStagedIds[0] === presentedAction.cardId
        ) {
          afterPresented = {
            ...afterPresented,
            botPendingStagedIds: stWithTick.botPendingStagedIds.slice(1),
          };
        }
        if (presentedAction.kind === 'confirmStaged') {
          afterPresented = { ...afterPresented, botPendingStagedIds: null };
        }
        return {
          ...afterPresented,
          botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
        };
      }

      if (
        pendingIds != null &&
        stWithTick.phase === 'solved' &&
        !stWithTick.hasPlayedCards &&
        stWithTick.botPostEquationPauseTicks > 0
      ) {
        return {
          ...stWithTick,
          botPostEquationPauseTicks: stWithTick.botPostEquationPauseTicks - 1,
        };
      }

      if (pendingIds != null && stWithTick.phase === 'solved' && !stWithTick.hasPlayedCards) {
        if (pendingIds.length > 0) {
          return {
            ...stWithTick,
            botPresentation: buildBotPresentation(stWithTick, {
              kind: 'stageCard',
              cardId: pendingIds[0]!,
            }),
          };
        }
        return {
          ...stWithTick,
          botPresentation: buildBotPresentation(stWithTick, { kind: 'confirmStaged' }),
        };
      }

      if (stWithTick.botNoSolutionDrawPending) {
        if (stWithTick.botNoSolutionTicks > 1) {
          return {
            ...stWithTick,
            botNoSolutionTicks: stWithTick.botNoSolutionTicks - 1,
            botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
            botPostEquationPauseTicks: 0,
          };
        }
        const drawTranslated = translateBotAction(stWithTick, { kind: 'drawCard' });
        if (!drawTranslated) {
          return {
            ...stWithTick,
            botNoSolutionTicks: 0,
            botNoSolutionDrawPending: false,
            botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
            botPostEquationPauseTicks: 0,
          };
        }
        const afterDraw = gameReducer(
          {
            ...stWithTick,
            botPendingStagedIds: null,
            botPendingDemoActions: null,
            botNoSolutionTicks: 0,
            botNoSolutionDrawPending: false,
            botDicePausePending: false,
            botFractionDefenseTicks: 0,
            botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
            botPostEquationPauseTicks: 0,
          },
          drawTranslated,
          tf,
        );
        if (
          afterDraw.hasDrawnCard &&
          afterDraw.currentPlayerIndex === stWithTick.currentPlayerIndex &&
          afterDraw.phase !== 'game-over'
        ) {
          return gameReducer(afterDraw, { type: 'END_TURN' }, tf);
        }
        return afterDraw;
      }

      const pendingDemoActions = stWithTick.botPendingDemoActions;
      if (pendingDemoActions != null) {
        if (pendingDemoActions.length === 0) {
          return { ...stWithTick, botPendingDemoActions: null };
        }
        const nextDemoAction = pendingDemoActions[0]!;
        const rest = pendingDemoActions.slice(1);
        return {
          ...stWithTick,
          botPendingDemoActions: rest.length > 0 ? rest : null,
          botPresentation: buildBotPresentation(stWithTick, nextDemoAction),
        };
      }

      /** Single-step bot actions; confirmEquation only applies CONFIRM_EQUATION then queues staging. */
      function describeBotCard(s: GameState, cardId: string): string {
        const card = s.players[s.currentPlayerIndex]?.hand.find((c) => c.id === cardId);
        if (!card) return '—';
        if (card.type === 'number') return String(card.value ?? '?');
        if (card.type === 'fraction') return String(card.fraction ?? '?');
        if (card.type === 'operation') return String(card.operation ?? '?');
        if (card.type === 'wild') return tf('labels.wild');
        if (card.type === 'joker') return tf('labels.joker');
        return '—';
      }
      function getBotCardType(
        s: GameState,
        cardId: string,
      ): CardType | null {
        return s.players[s.currentPlayerIndex]?.hand.find((c) => c.id === cardId)?.type ?? null;
      }
      function buildBotActionNotification(s: GameState, a: BotAction): Notification | null {
        // Generic bot narration bubbles are disabled — no "מהלך הבוט" bubbles
        // during bot turns. Exceptions: the teaching beats that the vs-bot
        // game uses to demo "possible results" and "mini cards", and the
        // identical-card play (including wild-as-identical) which gets its
        // own bubble so the player can see what the bot is doing.
        const isBubbleKind =
          a.kind === 'checkPossibleResults' ||
          a.kind === 'useMiniCards' ||
          a.kind === 'playIdentical';
        if (!isBubbleKind) return null;
        if (s.guidanceEnabled === false) return null;
        const name = s.players[s.currentPlayerIndex]?.name ?? tf('botOffline.botName');
        const base = {
          id: `bot-step-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: tf('botOffline.explain.title'),
          style: 'info' as const,
          body: '',
          autoDismissMs: 2400,
        };
        if (a.kind === 'checkPossibleResults') {
          return { ...base, emoji: '🔎', message: tf('botOffline.explain.checkPossibleResults', { name }) };
        }
        if (a.kind === 'useMiniCards') {
          return { ...base, emoji: '🧩', message: tf('botOffline.explain.useMiniCards', { name }) };
        }
        // playIdentical — pick wild vs normal copy by the card type.
        const card = s.players[s.currentPlayerIndex]?.hand.find((c) => c.id === a.cardId);
        if (card?.type === 'wild') {
          return { ...base, emoji: '', message: tf('botOffline.explain.useIdenticalWild', { name }) };
        }
        return { ...base, emoji: '♻️', message: tf('botOffline.explain.useIdentical', { name }) };
      }
      function botActionCandidateCardId(a: BotAction): string | null {
        switch (a.kind) {
          case 'playIdentical':
          case 'playFractionAttack':
          case 'playFractionBlock':
          case 'defendFractionSolve':
          case 'stageCard':
          case 'unstageCard':
            return a.cardId;
          case 'confirmEquation':
            return a.equationCommits[0]?.cardId ?? null;
          default:
            return null;
        }
      }
      function buildBotPresentation(s: GameState, a: BotAction): BotPresentationState {
        const candidateCardId = botActionCandidateCardId(a);
        const notification = buildBotActionNotification(s, a);
        let ticks = 0;
        if (a.kind === 'playFractionAttack' || a.kind === 'playFractionBlock') {
          ticks = 2;
        } else if (a.kind === 'playIdentical') {
          // Give the player time to see the fan land on the identical card
          // and read the bubble before the card is actually played.
          ticks = 3;
        } else if (a.kind === 'stageCard' || a.kind === 'confirmStaged') {
          // Post-equation staging / confirm — apply straight away (no
          // watch-and-wait tick). The fan still visibly scrolls to each
          // pick via the follow effect in SimpleHand.
          ticks = 0;
        } else if (candidateCardId != null) {
          ticks = 1;
        } else if (a.kind === 'checkPossibleResults' || a.kind === 'useMiniCards') {
          // Demo beats need enough ticks for the strip to open, render, and
          // pulse visibly before the next beat clears them.
          ticks = 3;
        } else if (
          a.kind === 'rollDice' ||
          a.kind === 'confirmEquation' ||
          a.kind === 'drawCard' ||
          a.kind === 'beginTurn'
        ) {
          ticks = 1;
        }
        return { action: a, candidateCardId, ticks, notification };
      }
      function applyBotActionAtomically(s: GameState, a: BotAction): GameState {
        // Teaching-only beats are pure narration/highlighting; they do not
        // change game state. Return s unchanged so the surrounding clear of
        // botPresentation (in the caller) advances to the next demo beat.
        if (a.kind === 'checkPossibleResults' || a.kind === 'useMiniCards') {
          return s;
        }
        if (a.kind !== 'confirmEquation') {
          const translated = translateBotAction(s, a);
          if (!translated) {
            if (a.kind === 'drawCard') return s;
            const drawTranslated = translateBotAction(s, { kind: 'drawCard' });
            if (!drawTranslated) return s;
            return gameReducer(
              {
                ...s,
                botPendingStagedIds: null,
                botNoSolutionTicks: 0,
                botNoSolutionDrawPending: false,
                botDicePausePending: false,
                botFractionDefenseTicks: 0,
                botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
                botPostEquationPauseTicks: 0,
              },
              drawTranslated,
              tf,
            );
          }
          const result = gameReducer(
            {
              ...s,
              botPendingStagedIds: null,
              botNoSolutionTicks: 0,
              botNoSolutionDrawPending: false,
              botDicePausePending: false,
              botFractionDefenseTicks: 0,
              botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
              botPostEquationPauseTicks: 0,
            },
            translated,
            tf,
          );
          if (
            result.hasDrawnCard &&
            result.currentPlayerIndex === s.currentPlayerIndex &&
            result.phase !== 'game-over'
          ) {
            return gameReducer(result, { type: 'END_TURN' }, tf);
          }
          return result;
        }

        const confirmTranslated = translateBotAction(s, a);
        if (!confirmTranslated) {
          const drawTranslated = translateBotAction(s, { kind: 'drawCard' });
          if (!drawTranslated) return s;
          return gameReducer(
            {
              ...s,
              botPendingStagedIds: null,
              botNoSolutionTicks: 0,
              botNoSolutionDrawPending: false,
              botDicePausePending: false,
              botFractionDefenseTicks: 0,
              botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
              botPostEquationPauseTicks: 0,
            },
            drawTranslated,
            tf,
          );
        }
        let next = gameReducer(
          {
            ...s,
            botPendingStagedIds: null,
            botNoSolutionTicks: 0,
            botNoSolutionDrawPending: false,
            botDicePausePending: false,
            botFractionDefenseTicks: 0,
            botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
            botPostEquationPauseTicks: 0,
          },
          confirmTranslated,
          tf,
        );
        const ids = [...a.stagedCardIds];
        if (ids.length === 0) {
          const confirmStagedTranslated = translateBotAction(next, { kind: 'confirmStaged' });
          if (!confirmStagedTranslated) return next;
          return gameReducer(next, confirmStagedTranslated, tf);
        }
        return { ...next, botPendingStagedIds: ids, botPostEquationPauseTicks: 3 };
      }

      const action_ = decideBotAction(stWithTick, stWithTick.botConfig.difficulty, {
        rng:
          typeof stWithTick.botConfig.rng === 'function'
            ? stWithTick.botConfig.rng
            : Math.random,
      });
      if (!action_) {
        return {
          ...stWithTick,
          botPresentation: buildBotPresentation(stWithTick, { kind: 'drawCard' }),
        };
      }
      // Teaching demo: right before the bot confirms an equation, show two
      // short narration beats that open the "possible results" strip and draw
      // the player's attention to the mini result cards. Only in vs-bot with
      // guidance on, and only once per turn. Total extension ≈ 2 × tick ≈ 2.4s.
      if (
        action_.kind === 'confirmEquation' &&
        stWithTick.guidanceEnabled !== false &&
        !stWithTick.botConfirmDemoShownThisTurn &&
        stWithTick.validTargets.length > 0
      ) {
        return {
          ...stWithTick,
          botConfirmDemoShownThisTurn: true,
          botPendingDemoActions: [{ kind: 'useMiniCards' }, action_],
          botPresentation: buildBotPresentation(stWithTick, { kind: 'checkPossibleResults' }),
        };
      }
      return { ...stWithTick, botPresentation: buildBotPresentation(stWithTick, action_) };
    }
    case 'RESET_GAME':
      AsyncStorage.removeItem('lulos_guidance_notifications');
      return { ...initialState, hasSeenIntroHint: st.hasSeenIntroHint, hasSeenSolvedHint: st.hasSeenSolvedHint, soundsEnabled: st.soundsEnabled, guidanceEnabled: st.guidanceEnabled };
    case 'TUTORIAL_SET_HANDS': {
      const newPlayers = st.players.map((p, i) =>
        i < action.hands.length ? { ...p, hand: action.hands[i] } : p,
      );
      return {
        ...st,
        players: newPlayers,
        ...(action.drawPile ? { drawPile: action.drawPile } : {}),
        ...(action.discardPile ? { discardPile: action.discardPile } : {}),
      };
    }
    case 'TUTORIAL_SET_DICE': {
      // Tutorial-only: force-set the dice regardless of phase. The game's
      // ROLL_DICE reducer rejects any call outside 'pre-roll', which breaks
      // re-entry into lesson 4 after GO_BACK (phase is already 'building').
      // This keeps the on-screen dice in sync with the tutorial's L4 config.
      if (!st.isTutorial) return st;
      const vt = generateValidTargets(action.values, st.enabledOperators, st.allowNegativeTargets, st.mathRangeMax);
      return {
        ...st,
        dice: action.values,
        validTargets: vt,
        diceRollSeq: (st.diceRollSeq ?? 0) + 1,
        equationResult: null,
      };
    }
    case 'TUTORIAL_SET_SHOW_POSSIBLE_RESULTS': {
      // Tutorial-only: toggle the ResultsChip visibility mid-game. Lesson 6
      // (possible-results) enables it on entry; earlier lessons boot with
      // it disabled so the chip doesn't appear until it's the lesson focus.
      if (!st.isTutorial) return st;
      return { ...st, showPossibleResults: action.value };
    }
    case 'TUTORIAL_SET_SHOW_SOLVE_EXERCISE': {
      if (!st.isTutorial) return st;
      return { ...st, showSolveExercise: action.value };
    }
    case 'TUTORIAL_SET_VALID_TARGETS': {
      if (!st.isTutorial) return st;
      if (action.targets === null) {
        // Filter current validTargets to parens-right only: a op (b op c)
        const filtered = st.validTargets.filter((t) => {
          const eq = t.equation.trimStart();
          return eq.includes('(') && !eq.startsWith('(');
        });
        return { ...st, validTargets: filtered };
      }
      return { ...st, validTargets: action.targets };
    }
    case 'TUTORIAL_SET_ENABLED_OPERATORS': {
      if (!st.isTutorial) return st;
      const dice = st.dice;
      const vt =
        dice != null
          ? generateValidTargets(dice, action.operators, st.allowNegativeTargets, st.mathRangeMax)
          : st.validTargets;
      return { ...st, enabledOperators: action.operators, validTargets: vt };
    }
    case 'TUTORIAL_FRACTION_SETUP': {
      if (!st.isTutorial) return st;
      const z = action.slice;
      const vt =
        z.dice != null
          ? generateValidTargets(z.dice, st.enabledOperators, st.allowNegativeTargets, st.mathRangeMax)
          : st.validTargets;
      return {
        ...st,
        currentPlayerIndex: z.currentPlayerIndex,
        phase: z.phase,
        players: st.players.map((p, i) => (i < z.hands.length && z.hands[i] ? { ...p, hand: z.hands[i] } : p)),
        discardPile: z.discardPile,
        dice: z.dice ?? st.dice,
        validTargets: vt,
        pendingFractionTarget: z.pendingFractionTarget,
        fractionPenalty: z.fractionPenalty,
        fractionAttackResolved: z.fractionAttackResolved,
        showFractions: z.showFractions,
        fractionKinds: [...z.fractionKinds],
        hasPlayedCards: false,
        hasDrawnCard: false,
        selectedCards: [],
        stagedCards: [],
        equationResult: null,
        equationHandSlots: [null, null],
        equationHandPick: null,
        jokerModalOpen: false,
        message: '',
        lastMoveMessage: null,
        lastDiscardCount: 0,
        lastEquationDisplay: null,
        activeOperation: null,
        challengeSource: null,
        equationOpsUsed: [],
        notifications: (st.notifications ?? []).filter((n) => !n.id.startsWith('frac-')),
      };
    }
    case 'TUTORIAL_FORCE_SOLVED': {
      if (!st.isTutorial) return st;
      const pi = st.currentPlayerIndex;
      // Always restore the human player (index 1) as current player.
      // After the bot demo runs CONFIRM_STAGED, currentPlayerIndex shifts to 0
      // (bot's turn). We must reset it to 1 so the fan shows the human's hand.
      return {
        ...st,
        phase: 'solved',
        equationResult: action.equationResult,
        lastEquationDisplay: `■ + ■ = ${action.equationResult}`,
        stagedCards: [],
        hasPlayedCards: false,
        selectedCards: [],
        currentPlayerIndex: 1,
        discardPile: action.discardPile ?? st.discardPile,
        players: st.players.map((p, i) => {
          if (i === 1) return { ...p, hand: action.playerHand };
          if (i === 0) return { ...p, hand: action.botHand };
          return p;
        }),
        message: '',
      };
    }
    case 'RESET_ONLINE_EQ_UI':
      return { ...st, equationHandSlots: [null, null], equationHandPick: null, jokerModalOpen: false, selectedCards: [] };
    default: return st;
  }
}

// ═══════════════════════════════════════════════════════════════
//  CONTEXT
// ═══════════════════════════════════════════════════════════════

const GameContext = createContext<{ state: GameState; dispatch: React.Dispatch<GameAction> }>({ state: initialState, dispatch: () => undefined });
function GameProvider({ children }: { children: ReactNode }) {
  const mp = useMultiplayerOptional();
  const override = mp?.gameOverride ?? null;
  const { t } = useLocale();
  const reducer = useCallback((s: GameState, a: GameAction) => gameReducer(s, a, t), [t]);
  const [localState, localDispatch] = useReducer(reducer, initialState);
  const onlineDiceSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (override) return;
    AsyncStorage.getItem('lulos_guidance_notifications').then((raw) => {
      if (!raw) return;
      try {
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr) || arr.length === 0) return;
        const filtered = arr.filter((item: unknown) => {
          const n = item as { id?: string; title?: string };
          const id = String(n.id ?? '');
          const title = String(n.title ?? '');
          if (id.startsWith('onb-welcome') || WELCOME_NOTIFICATION_TITLES.has(title)) return false;
          return true;
        });
        if (filtered.length > 0) localDispatch({ type: 'RESTORE_NOTIFICATIONS', payload: filtered });
      } catch (_) {}
    });
  }, [override]);

  useEffect(() => {
    AsyncStorage.getItem('lulos_sounds_enabled').then((v) => {
      if (v === 'false') localDispatch({ type: 'SET_SOUNDS_ENABLED', enabled: false });
    });
  }, []);

  const effectivePhase = override ? override.state.phase : localState.phase;

  /** הגרלת פותח — פעם אחת למשחק; מתאפס כשיוצאים מהחדר (אין serverState) */
  const openingDrawPushedRef = useRef<string | null>(null);
  const openingDrawDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!mp?.serverState) {
      openingDrawPushedRef.current = null;
      if (openingDrawDismissTimerRef.current) {
        clearTimeout(openingDrawDismissTimerRef.current);
        openingDrawDismissTimerRef.current = null;
      }
    }
  }, [mp?.serverState]);
  useEffect(() => {
    const drawSource = override
      ? { oid: override.state.openingDrawId, players: override.state.players, idx: override.state.currentPlayerIndex }
      : localState.openingDrawId
        ? { oid: localState.openingDrawId, players: localState.players, idx: localState.currentPlayerIndex }
        : null;
    if (!drawSource?.oid) return;
    if (effectivePhase !== 'turn-transition') return;
    const oid = drawSource.oid;
    if (openingDrawPushedRef.current === oid) return;
    openingDrawPushedRef.current = oid;
    const firstName = drawSource.players[drawSource.idx]?.name ?? t('labels.player');
    const notifId = `opening-draw-${oid}`;
    const dismissMs = 8000;
    localDispatch({
      type: 'PUSH_NOTIFICATION',
      payload: {
        id: notifId,
        title: t('local.openingDrawTitle'),
        body: t('local.openingDrawBody', { name: firstName }),
        message: '',
        emoji: '🎉',
        style: 'celebration' as any,
        autoDismissMs: dismissMs,
      },
    });
    /** הטיימר ב-NotificationZone מתאפס כש-notif משתנה בגלל שינויי phase,
     *  וההודעה נשארת ב-state.notifications ואז מופיעה שוב בכל turn-transition.
     *  כאן מבטיחים שחרור עצמאי פעם אחת למשחק. */
    if (openingDrawDismissTimerRef.current) {
      clearTimeout(openingDrawDismissTimerRef.current);
    }
    openingDrawDismissTimerRef.current = setTimeout(() => {
      localDispatch({ type: 'DISMISS_NOTIFICATION', id: notifId });
      openingDrawDismissTimerRef.current = null;
    }, dismissMs);
  }, [override, effectivePhase, localState.openingDrawId, localState.players, localState.currentPlayerIndex, localDispatch, t]);
  useEffect(() => () => {
    if (openingDrawDismissTimerRef.current) {
      clearTimeout(openingDrawDismissTimerRef.current);
      openingDrawDismissTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!override) {
      onlineDiceSigRef.current = null;
      return;
    }
    const d = override.state.dice;
    const sig =
      override.state.phase === 'building' && d ? `${d.die1}-${d.die2}-${d.die3}` : null;
    if (sig != null && onlineDiceSigRef.current !== sig) {
      onlineDiceSigRef.current = sig;
      localDispatch({ type: 'RESET_ONLINE_EQ_UI' });
    }
    if (override.state.phase !== 'building') onlineDiceSigRef.current = null;
  }, [override, override?.state.phase, override?.state.dice?.die1, override?.state.dice?.die2, override?.state.dice?.die3]);

  const useServerEquationHand =
    !!override &&
    override.state.phase === 'solved' &&
    override.state.equationResult != null &&
    (override.state.equationHandSlots[0] != null || override.state.equationHandSlots[1] != null);

  useEffect(() => {
    if (!override) return;
    if (override.state.identicalAlert) return;
    if (!localState.suppressIdenticalOverlayOnline) return;
    localDispatch({ type: 'CLEAR_ONLINE_IDENTICAL_SUPPRESS' });
  }, [override, override?.state.identicalAlert, localState.suppressIdenticalOverlayOnline]);

  // ────────────────────────────────────────────────────────────────
  // Bot clock (M5.6) — schedules BOT_STEP dispatches when a bot is
  // the current player. Reads from localState (not merged state) so
  // online-mode renders don't churn the timer. useRef-backed deadline
  // prevents unrelated re-renders from thrashing the schedule.
  // See spec §0.5.2.
  // ────────────────────────────────────────────────────────────────
  const botTimerDeadlineRef = useRef<{ dueAt: number; turnSignature: string } | null>(null);

  useEffect(() => {
    // Hard gate: never run the bot clock during online mode.
    if (override) {
      botTimerDeadlineRef.current = null;
      return;
    }
    if (localState.phase === 'game-over') return;
    if (!localState.botConfig) return;
    const current = localState.players[localState.currentPlayerIndex];
    if (!current || !localState.botConfig.playerIds.includes(current.id)) {
      botTimerDeadlineRef.current = null;
      return;
    }
    // Only schedule in phases the bot can act in.
    if (
      localState.phase !== 'turn-transition' &&
      localState.phase !== 'pre-roll' &&
      localState.phase !== 'roll-dice' &&
      localState.phase !== 'building' &&
      localState.phase !== 'solved'
    ) {
      return;
    }

    // Signature of the current turn context. When this changes, we want a
    // new timer. When it stays the same across unrelated re-renders, we
    // want to keep the existing pending timer.
    const turnSignature = [
      localState.phase,
      localState.currentPlayerIndex,
      localState.hasPlayedCards ? '1' : '0',
      localState.stagedCards.length,
      localState.equationResult ?? 'null',
      localState.pendingFractionTarget ?? 'null',
      localState.botDicePausePending ? '1' : '0',
      localState.botTickSeq,
      (localState.botPendingStagedIds ?? []).join(','),
    ].join('|');

    const now = Date.now();
    const existing = botTimerDeadlineRef.current;
    if (existing && existing.turnSignature === turnSignature && existing.dueAt > now) {
      // Same turn context, existing timer still pending — no reschedule.
      return;
    }

    const diff = localState.botConfig?.difficulty ?? 'medium';
    const { min, max } = botTeachingDelayRange(localState, diff);
    const delay = min + Math.floor(Math.random() * Math.max(1, max - min + 1));
    // Slower pacing improves readability of bot teaching steps.
    const slowedDelay = localState.botDicePausePending ? delay : Math.round(delay * 1.4);
    const dueAt = now + slowedDelay;
    botTimerDeadlineRef.current = { dueAt, turnSignature };

    const timer = setTimeout(() => {
      botTimerDeadlineRef.current = null;
      localDispatch({ type: 'BOT_STEP' });
    }, slowedDelay);

    return () => {
      clearTimeout(timer);
      botTimerDeadlineRef.current = null;
    };
  }, [
    override,
    localState.phase,
    localState.currentPlayerIndex,
    localState.hasPlayedCards,
    localState.stagedCards.length,
    localState.equationResult,
    localState.pendingFractionTarget,
    localState.botDicePausePending,
    localState.botConfig,
    localState.botTickSeq,
    localState.botPendingStagedIds,
    localState.players,
  ]);
  // ────────────────────────────────────────────────────────────────

  // במצב מולטיפלייר ה־override מגיע עם notifications: [] ו־guidanceEnabled חסר — שומרים מקומית ומוצגים תמיד
  const state = override
    ? {
        ...override.state,
        equationHandSlots: useServerEquationHand ? override.state.equationHandSlots : localState.equationHandSlots,
        equationHandPick: useServerEquationHand ? null : localState.equationHandPick,
        jokerModalOpen: localState.jokerModalOpen,
        selectedCards: localState.jokerModalOpen ? localState.selectedCards : override.state.selectedCards,
        notifications: localState.notifications,
        guidanceEnabled: override.state.guidanceEnabled ?? localState.guidanceEnabled,
        soundsEnabled: localState.soundsEnabled,
        identicalAlert:
          localState.suppressIdenticalOverlayOnline && override.state.identicalAlert
            ? null
            : override.state.identicalAlert,
        suppressIdenticalOverlayOnline: localState.suppressIdenticalOverlayOnline,
      }
    : localState;

  const dispatch = useCallback((action: GameAction) => {
    if (override && action.type === 'DISMISS_IDENTICAL_ALERT') {
      localDispatch({ type: 'SUPPRESS_ONLINE_IDENTICAL_OVERLAY' });
    }
    const isLocalOnlyAction =
      action.type === 'PUSH_NOTIFICATION' ||
      action.type === 'DISMISS_NOTIFICATION' ||
      action.type === 'RESTORE_NOTIFICATIONS' ||
      action.type === 'SET_GUIDANCE_ENABLED' ||
      action.type === 'SET_SOUNDS_ENABLED' ||
      action.type === 'DISMISS_INTRO_HINT';
    const eqUiActions = new Set<GameAction['type']>([
      'SELECT_EQ_OP', 'SELECT_EQ_JOKER', 'PLACE_EQ_OP', 'REMOVE_EQ_HAND_SLOT', 'CLEAR_EQ_HAND', 'CLEAR_EQ_HAND_PICK',
      'OPEN_JOKER_MODAL', 'CLOSE_JOKER_MODAL', 'RESET_ONLINE_EQ_UI',
    ]);
    const myIdx = override?.state?.myPlayerIndex;
    const canActOnline =
      !override || typeof myIdx !== 'number' || override.state.currentPlayerIndex === myIdx;
    if (isLocalOnlyAction) localDispatch(action);
    else if (override) {
      if (action.type === 'RESET_GAME') {
        override.dispatch(action);
        return;
      }
      if (!canActOnline) return;
      if (eqUiActions.has(action.type)) localDispatch(action);
      if (action.type === 'CONFIRM_EQUATION') localDispatch({ type: 'RESET_ONLINE_EQ_UI' });
      override.dispatch(action);
    } else localDispatch(action);
  }, [override, localDispatch]);
  const contextValue = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>;
}
function useGame() { return useContext(GameContext); }

// ═══════════════════════════════════════════════════════════════
//  BUTTON — (old Btn removed, using LulosButton from components)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════════════

function AppModal({
  visible,
  onClose,
  title,
  children,
  overlayOpacity = 0.6,
  boxStyle,
  topAligned = false,
  customHeader,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  overlayOpacity?: number;
  boxStyle?: any;
  topAligned?: boolean;
  /** כותרת מותאמת (למשך רצף ויזואלי); אם מוגדר — לא משתמשים ב־title+✕ ברירת המחדל */
  customHeader?: React.ReactNode;
}) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[mS.overlay, topAligned && mS.overlayTop, { backgroundColor: `rgba(0,0,0,${overlayOpacity})` }]}><View style={[mS.box, boxStyle]}>
        {customHeader != null ? (
          customHeader
        ) : (
          <View style={mS.header}>
            <Text style={mS.title}>{title ?? ''}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={mS.close}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      </View></View>
    </RNModal>
  );
}
const mS = StyleSheet.create({
  overlay: { flex:1, justifyContent:'center', alignItems:'center', padding:20 },
  overlayTop: { justifyContent:'flex-start', paddingTop: 10 },
  box: { backgroundColor:'#1F2937', borderRadius:16, padding:20, width:'100%', maxHeight:'80%' },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  title: { color:'#FFF', fontSize:18, fontWeight:'700', flex:1, textAlign:'center' },
  close: { color:'#9CA3AF', fontSize:22 },
});

const ONLINE_BOT_DIFF_KEYS: BotDifficulty[] = ['easy', 'medium', 'hard'];

function OnlineBotDifficultyModal({
  visible,
  onClose,
  current,
  isHost,
  onSelectLevel,
}: {
  visible: boolean;
  onClose: () => void;
  current: BotDifficulty | null;
  isHost: boolean;
  onSelectLevel: (d: BotDifficulty) => void;
}) {
  const { t, isRTL } = useLocale();
  const ta = isRTL ? 'right' : 'left';
  if (current == null) return null;
  const labels: Record<BotDifficulty, string> = {
    easy: t('start.botEasy'),
    medium: t('start.botMedium'),
    hard: t('start.botHard'),
  };
  return (
    <AppModal visible={visible} onClose={onClose} title={t('game.onlineBotDifficultyTitle')}>
      <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 12 }}>
        <Text style={{ color: '#9CA3AF', fontSize: 13, lineHeight: 20, textAlign: ta }}>
          {isHost ? t('game.onlineBotDifficultyHostHint') : t('game.onlineBotDifficultyViewerHint')}
        </Text>
        <Text style={{ color: '#E5E7EB', fontSize: 15, fontWeight: '700', textAlign: ta }}>
          {t('game.onlineBotDifficultyCurrent', { level: labels[current] })}
        </Text>
        {isHost ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {ONLINE_BOT_DIFF_KEYS.map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => onSelectLevel(key)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: current === key ? '#F97316' : 'rgba(255,255,255,0.15)',
                  backgroundColor: current === key ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.06)',
                }}
              >
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>{labels[key]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </AppModal>
  );
}

// ═══════════════════════════════════════════════════════════════
//  RULES SCREEN — מסך כללים + טיפ של התור
// ═══════════════════════════════════════════════════════════════

function getTipOfTheTurn(st: GameState, tf: (key: string, params?: MsgParams) => string): string {
  const cp = st.players[st.currentPlayerIndex];
  if (!cp) return tf('gameTip.start');
  const td = st.discardPile[st.discardPile.length - 1];
  if (st.phase === 'pre-roll') {
    if (st.pendingFractionTarget !== null)
      return tf('gameTip.fractionDefend', { d: st.fractionPenalty });
    if (!st.hasPlayedCards && st.consecutiveIdenticalPlays < 2 && td && cp.hand.some(c => validateIdenticalPlay(c, td)))
      return tf('gameTip.identical');
    return tf('gameTip.rollOrMatch');
  }
  if (st.phase === 'building') {
    const cpHand = st.players[st.currentPlayerIndex]?.hand ?? [];
    if (cpHand.some(c => c.type === 'operation' || c.type === 'joker')) {
      return tf('gameTip.opInEquation');
    }
    return tf('gameTip.buildEquation');
  }
  if (st.phase === 'solved' && st.equationResult != null)
    return tf('gameTip.pickSum', { n: st.equationResult });
  return tf('gameTip.defaultGuide');
}

function fractionCardCountFromKinds(fractions: boolean, kinds?: Fraction[] | null): number {
  if (!fractions || !kinds || kinds.length === 0) return 0;
  const table = new Map(DEFAULT_FRAC_DECK.map((x) => [x.frac, x.count] as const));
  return kinds.reduce((s, f) => s + (table.get(f) ?? 0), 0);
}

function formatOpsForRulesDisplay(ops: readonly Operation[]): string {
  const sym: Record<Operation, string> = { '+': '+', '-': '−', 'x': '×', '÷': '÷' };
  return ops.map((o) => sym[o]).join(', ');
}

/** הקשר לחוקים לפני START_GAME — חייב כש־state === null */
type RulesPregameContext = {
  numberRange: 'easy' | 'full';
  fractions: boolean;
  fractionKinds: Fraction[];
  difficultyStage: DifficultyStageId;
  enabledOperators: Operation[];
  allowNegativeTargets: boolean;
  showPossibleResults: boolean;
  showSolveExercise: boolean;
};

function getDeckCounts(
  numberRange: 'easy' | 'full',
  fractions: boolean,
  enabledOperators: Operation[] = ['+', '-', 'x', '÷'],
  fractionKinds?: Fraction[] | null,
) {
  const numCount = numberRange === 'easy' ? 52 : 104;
  const maxNumber = numberRange === 'easy' ? 12 : 25;
  const fracCount = fractionCardCountFromKinds(fractions, fractionKinds);
  const opCount = enabledOperators.reduce((sum, op) => sum + (op === '÷' ? 3 : 4), 0);
  return { numCount, fracCount, opCount, jokerCount: 4, wildCount: wildDeckCount(maxNumber, fractions) };
}

function CardsCatalogContent({
  numberRange,
  fractions,
  enabledOperators,
  fractionKinds,
}: {
  numberRange: 'easy' | 'full';
  fractions: boolean;
  enabledOperators?: Operation[];
  fractionKinds?: Fraction[] | null;
}) {
  const { t, isRTL } = useLocale();
  const ta = isRTL ? 'right' : 'left';
  const rangeLabel = numberRange === 'easy' ? '0–12' : '0–25';
  const fk = fractionKinds && fractionKinds.length > 0 ? fractionKinds : [...ALL_FRACTION_KINDS];
  const counts = getDeckCounts(numberRange, fractions, enabledOperators ?? ['+', '-'], fk);
  const items: { title: string; body: string; count: number }[] = [
    { title: t('catalog.numberTitle', { range: rangeLabel }), body: t('catalog.numberBody', { range: rangeLabel }), count: counts.numCount },
    { title: t('catalog.opTitle'), body: t('catalog.opBody'), count: counts.opCount },
    { title: t('catalog.jokerTitle'), body: t('catalog.jokerBody'), count: counts.jokerCount },
    { title: t('catalog.wildTitle'), body: t('catalog.wildBody'), count: counts.wildCount },
  ];
  if (fractions) {
    items.splice(2, 0, { title: t('catalog.fracTitle'), body: t('catalog.fracBody'), count: counts.fracCount });
  }
  return (
    <ScrollView style={{ maxHeight: 420 }}>
      <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12, textAlign: ta }}>
        {t('rules.deckSettings', { range: rangeLabel, mode: fractions ? t('rules.deckWithFrac') : t('rules.deckNoFrac') })}
      </Text>
      {items.map((item, i) => (
        <View key={i} style={{ marginBottom: 14, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#93C5FD', marginBottom: 4, textAlign: ta }}>{t('rules.cardsCount', { count: item.count })}</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#E2E8F0', marginBottom: 4, textAlign: ta }}>{item.title}</Text>
          <Text style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 20, textAlign: ta }}>{item.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function RulesContent({ state, pregame }: { state: GameState | null; pregame?: RulesPregameContext | null }) {
  const { t, isRTL } = useLocale();
  const ta = isRTL ? 'right' : 'left';
  const tip = state ? getTipOfTheTurn(state, t) : t('gameTip.start');
  const range = state?.difficulty ?? pregame?.numberRange ?? 'full';
  const showFractions = state?.showFractions ?? pregame?.fractions ?? true;
  const fractionKinds =
    state?.fractionKinds ?? pregame?.fractionKinds ?? [...ALL_FRACTION_KINDS];
  const difficultyStage = state?.difficultyStage ?? pregame?.difficultyStage ?? 'H';
  const enabledOperators = state?.enabledOperators ?? pregame?.enabledOperators ?? (['+', '-'] as Operation[]);
  const showPossibleResults = state?.showPossibleResults ?? pregame?.showPossibleResults ?? true;
  const kindsForDeckCounts =
    !showFractions ? null : (fractionKinds.length > 0 ? fractionKinds : [...ALL_FRACTION_KINDS]);
  const counts = getDeckCounts(range, showFractions, enabledOperators, kindsForDeckCounts);
  const hasFractionCardsInDeck =
    showFractions && fractionKinds.length > 0 && fractionCardCountFromKinds(true, fractionKinds) > 0;
  const rangeLabel = range === 'easy' ? '0–12' : '0–25';
  const sessionLine = t('rules.sessionContextLine', {
    stage: difficultyStage,
    range: rangeLabel,
    frac: hasFractionCardsInDeck ? t('rules.sessionWithFractions') : t('rules.sessionNoFractions'),
    ops: formatOpsForRulesDisplay(enabledOperators),
  });
  const cardTypeLines: { text: string; count: number; detail?: string }[] = [
    { text: t('rulesLine.numCard'), count: counts.numCount },
    { text: t('rulesLine.fracCard'), count: counts.fracCount, detail: '½×6, ⅓×4, ¼×3, ⅕×2' },
    { text: t('rulesLine.opCard'), count: counts.opCount },
    { text: t('rulesLine.jokerCard'), count: counts.jokerCount },
    { text: t('rulesLine.wildCard'), count: counts.wildCount },
  ];
  const cardTypesToShow = showFractions ? cardTypeLines : cardTypeLines.filter((_, i) => i !== 1);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
      {/* טיפ של התור */}
      <View style={{ backgroundColor: 'rgba(52,168,83,0.2)', borderRadius: 12, borderWidth: 2, borderColor: '#4ADE80', padding: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#4ADE80', marginBottom: 6, textAlign: ta }}>{t('rules.tipBanner')}</Text>
        <Text style={{ color: '#D1FAE5', fontSize: 13, lineHeight: 20, textAlign: ta }}>{tip}</Text>
      </View>
      <View style={{ backgroundColor: 'rgba(30,64,175,0.35)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(147,197,253,0.45)', padding: 12, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#93C5FD', marginBottom: 6, textAlign: ta }}>{t('rules.sessionContextTitle')}</Text>
        <Text style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 20, textAlign: ta }}>{sessionLine}</Text>
      </View>
      <View style={{ backgroundColor: 'rgba(59,130,246,0.2)', borderRadius: 12, borderWidth: 2, borderColor: '#93C5FD', padding: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#93C5FD', marginBottom: 8, textAlign: ta }}>{t('rules.newUser')}</Text>
        <Text style={{ color: '#E2E8F0', fontSize: 14, lineHeight: 22, textAlign: ta }}>
          {showPossibleResults ? t('welcome.body') : t('welcome.bodyNoPossibleResults')}
        </Text>
        {hasFractionCardsInDeck ? (
          <Text style={{ color: '#E2E8F0', fontSize: 14, lineHeight: 22, textAlign: ta, marginTop: 10 }}>{t('welcome.fractionsLine')}</Text>
        ) : null}
      </View>
      <View style={{ backgroundColor: '#111827', borderRadius: 12, borderWidth: 1, borderColor: '#374151', padding: 12, marginBottom: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#93C5FD', marginBottom: 8, textAlign: ta }}>{t('rules.goalHeading')}</Text>
        <Text style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 21, marginBottom: 6, textAlign: ta }}>{t('start.rules.goal1', { n: CARDS_PER_PLAYER })}</Text>
        <Text style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 21, textAlign: ta }}>{t('start.rules.goal2')}</Text>
      </View>
      <View style={{ backgroundColor: '#111827', borderRadius: 12, borderWidth: 1, borderColor: '#374151', padding: 12, marginBottom: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#93C5FD', marginBottom: 8, textAlign: ta }}>{t('rules.turnHeading')}</Text>
        <Text style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 21, marginBottom: 6, textAlign: ta }}>{t('start.rules.t1')}</Text>
        <Text style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 21, marginBottom: 6, textAlign: ta }}>{t('start.rules.t2')}</Text>
        <Text style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 21, textAlign: ta }}>{t('start.rules.t3')}</Text>
      </View>
      <View style={{ backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: 12, borderWidth: 2, borderColor: '#FB923C', padding: 14, marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#FB923C', marginBottom: 8, textAlign: ta }}>{t('rules.challengesHeading')}</Text>
        {hasFractionCardsInDeck ? (
          <Text style={{ color: '#FED7AA', fontSize: 13, lineHeight: 22, textAlign: ta, marginBottom: 6 }}>{t('start.rules.c1')}</Text>
        ) : null}
        <Text style={{ color: '#FED7AA', fontSize: 13, lineHeight: 22, textAlign: ta }}>{t('start.rules.c2')}</Text>
      </View>
      <View style={{ backgroundColor: 'rgba(234,179,8,0.15)', borderRadius: 12, borderWidth: 2, borderColor: '#D97706', padding: 14, marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#FCD34D', marginBottom: 8, textAlign: ta }}>{t('rules.excellenceHeading')}</Text>
        <Text style={{ color: '#FEF3C7', fontSize: 13, lineHeight: 22, textAlign: ta }}>{t('rules.excellenceBody')}</Text>
      </View>
      <View style={{ backgroundColor: '#111827', borderRadius: 12, borderWidth: 1, borderColor: '#374151', padding: 12, marginBottom: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#93C5FD', marginBottom: 8, textAlign: ta }}>{t('rules.cardTypesFooter')}</Text>
        {cardTypesToShow.map((item, i) => (
          <View key={`cards${i}`} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#93C5FD', marginLeft: 8 }}>{t('rules.cardsCount', { count: item.count })}</Text>
              <Text style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 21, textAlign: ta, flex: 1 }}>{item.text}</Text>
            </View>
            {item.detail != null && <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 2 }}>{item.detail}</Text>}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  3D SHADOW + GLOW HELPERS
// ═══════════════════════════════════════════════════════════════

const shadow3D = (color='#000', elev=10) => Platform.select({
  ios: { shadowColor: color, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 8 },
  android: { elevation: elev },
}) as any;

const glowActive = () => Platform.select({
  ios: { shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  android: { elevation: 14 },
}) as any;

// ═══════════════════════════════════════════════════════════════
//  3D TEXT HELPERS
// ═══════════════════════════════════════════════════════════════

function interpolateColor(hex1: string, hex2: string, steps: number): string[] {
  const parse = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  return Array.from({ length: steps }, (_, i) => {
    const t = steps <= 1 ? 0 : i / (steps - 1);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  });
}

function Text3D({ text, fontSize, faceColor, darkColor, lightColor, maxOffset = 10 }: {
  text: string; fontSize: number; faceColor: string; darkColor: string; lightColor: string; maxOffset?: number;
}) {
  const colors = interpolateColor(darkColor, lightColor, maxOffset);
  const fontFamily = displayFontFamily(text);
  return (
    <View>
      {colors.map((color, i) => (
        <Text key={i} style={{
          position: 'absolute', top: maxOffset - i, left: maxOffset - i,
          color, fontSize, fontFamily,
        }}>{text}</Text>
      ))}
      <Text style={{ color: faceColor, fontSize, fontFamily }}>{text}</Text>
    </View>
  );
}

function Line3D({ width, height, faceColor, darkColor, lightColor, layers = 3 }: {
  width: number; height: number; faceColor: string; darkColor: string; lightColor: string; layers?: number;
}) {
  const colors = interpolateColor(darkColor, lightColor, layers);
  return (
    <View style={{ width: width + layers, height: height + layers }}>
      {colors.map((color, i) => (
        <View key={i} style={{
          position: 'absolute', top: layers - i, left: layers - i,
          width, height, backgroundColor: color, borderRadius: height / 2,
        }} />
      ))}
      <View style={{ width, height, backgroundColor: faceColor, borderRadius: height / 2 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  JESTER SVG
// ═══════════════════════════════════════════════════════════════

function JesterSvg({ size = 45 }: { size?: number }) {
  const h = size * 1.4;
  return (
    <Svg width={size} height={h} viewBox="0 0 60 84">
      {/* Hat - 3 sharp triangles with bells */}
      <SvgPolygon points="30,28 8,4 25,26" fill="#EA4335" />
      <SvgPolygon points="30,28 30,0 35,26" fill="#4285F4" />
      <SvgPolygon points="30,28 52,4 35,26" fill="#34A853" />
      <SvgCircle cx={8} cy={4} r={3.5} fill="#FBBC05" />
      <SvgCircle cx={30} cy={0} r={3.5} fill="#FBBC05" />
      <SvgCircle cx={52} cy={4} r={3.5} fill="#FBBC05" />
      {/* Face */}
      <SvgCircle cx={30} cy={38} r={11} fill="#FFE0B2" />
      {/* Evil eyebrows */}
      <SvgPath d="M 23 34 L 28 32" stroke="#333" strokeWidth={2} strokeLinecap="round" />
      <SvgPath d="M 37 34 L 32 32" stroke="#333" strokeWidth={2} strokeLinecap="round" />
      {/* Eyes */}
      <SvgCircle cx={26} cy={37} r={2} fill="#333" />
      <SvgCircle cx={34} cy={37} r={2} fill="#333" />
      {/* Wide mischievous grin */}
      <SvgPath d="M 23 43 Q 26 49 30 46 Q 34 49 37 43" stroke="#333" strokeWidth={1.8} strokeLinecap="round" fill="none" />
      {/* Scalloped yellow collar */}
      <SvgPath d="M 17 50 Q 21 46 25 50 Q 29 46 33 50 Q 37 46 41 50 L 41 53 L 17 53 Z" fill="#FBBC05" />
      {/* Split body — red left, green right */}
      <SvgRect x={19} y={53} width={11} height={16} fill="#EA4335" />
      <SvgRect x={30} y={53} width={11} height={16} fill="#34A853" />
      {/* Yellow diamonds */}
      <SvgPolygon points="25,58 27,55 29,58 27,61" fill="#FBBC05" />
      <SvgPolygon points="31,58 33,55 35,58 33,61" fill="#FBBC05" />
      <SvgPolygon points="25,65 27,62 29,65 27,68" fill="#FBBC05" />
      <SvgPolygon points="31,65 33,62 35,65 33,68" fill="#FBBC05" />
      {/* Legs — blue left, orange right */}
      <SvgRect x={20} y={69} width={9} height={11} rx={2} fill="#4285F4" />
      <SvgRect x={31} y={69} width={9} height={11} rx={2} fill="#F97316" />
      {/* Pointed shoes */}
      <SvgPath d="M 16 80 L 29 80 L 25 77" fill="#4285F4" />
      <SvgPath d="M 44 80 L 31 80 L 35 77" fill="#F97316" />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BASE CARD — 3D white gradient, gloss sheen, colored border
// ═══════════════════════════════════════════════════════════════

function BaseCard({ children, borderColor = '#9CA3AF', selected = false, active = false, onPress, faceDown = false, small = false }: {
  children: React.ReactNode; borderColor?: string; selected?: boolean; active?: boolean; onPress?: () => void; faceDown?: boolean; small?: boolean;
}) {
  const w = small ? 100 : 110;
  const h = small ? 140 : 158;
  // Face-down card (draw pile) — fixed indigo style, not themed
  if (faceDown) return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[{ width: w, borderRadius: 12, borderBottomWidth: 6, borderBottomColor: '#1E1B4B' }, shadow3D('#000')]}>
        <LinearGradient colors={['#4338CA', '#312E81']} style={{ width: w, height: h, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(129,140,248,0.3)' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'rgba(165,180,252,0.5)' }} />
          <View style={{ position: 'absolute', top: 8, left: 8, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(165,180,252,0.15)' }} />
          <View style={{ position: 'absolute', bottom: 8, right: 8, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(165,180,252,0.15)' }} />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  // Face-up card — white gradient + gloss sheen
  const bottomEdge = selected ? '#C2410C' : (active ? '#15803D' : borderColor);
  const shadowStyle = active ? glowActive() : (selected ? shadow3D('#FF9100', 16) : shadow3D('#000', 10));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      <View style={[{
        width: w, height: h, borderRadius: 12,
        borderBottomWidth: small ? 2 : 6, borderBottomColor: bottomEdge,
        transform: [{ translateY: selected ? (small ? -4 : -8) : (active ? -4 : 0) }],
      }, small
        ? Platform.select({ ios: { shadowColor: selected ? '#FF9100' : '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: selected ? 0.45 : 0.2, shadowRadius: selected ? 6 : 3 }, android: { elevation: selected ? 8 : 3 } })
        : shadowStyle
      ]}>
        <View style={{
          width: w, height: h, borderRadius: 12, overflow: 'hidden',
          borderWidth: selected ? 3 : 2,
          borderColor: selected ? '#FF6B00' : borderColor,
        }}>
          {/* White-to-gray gradient background (160deg) */}
          <LinearGradient
            colors={['#FFFFFF', '#F5F5F5', '#E8E8E8']}
            locations={[0, 0.7, 1]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Gloss sheen overlay (radial ellipse approximation) */}
          <View style={{
            position: 'absolute', top: -(h * 0.15), left: w * 0.05,
            width: w * 0.9, height: h * 0.5, borderRadius: w,
            backgroundColor: 'rgba(255,255,255,0.45)',
          }} />
          {/* Card content */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {children}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}


// ═══════════════════════════════════════════════════════════════
//  CARD TYPE COMPONENTS — 3D text on white gradient cards
// ═══════════════════════════════════════════════════════════════

function getNumColors(v: number) {
  if (v <= 9) return { face: '#2196F3', border: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9' };
  if (v <= 19) return { face: '#FBBC05', border: '#FBBC05', dark: '#8B6800', light: '#DC9E00' };
  return { face: '#34A853', border: '#34A853', dark: '#1B5E2B', light: '#36944F' };
}

function NumberCard({ card, selected, active, onPress, small }: { card: Card; selected?: boolean; active?: boolean; onPress?: () => void; small?: boolean }) {
  const v = card.value ?? 0;
  const cl = getNumColors(v);
  const fs = small ? 52 : 58;
  const maxOff = small ? 10 : 12;
  return (
    <BaseCard borderColor={cl.border} selected={selected} active={active} onPress={onPress} small={small}>
      <Text3D text={String(v)} fontSize={fs} faceColor={cl.face} darkColor={cl.dark} lightColor={cl.light} maxOffset={maxOff} />
    </BaseCard>
  );
}

// Mini result card — מסגרת שטוחה וברורה, בלי נפח/בֶבֶל
const MINI_W = 36;
const MINI_H = 48;
const MINI_R = 8;
function MiniResultCard({ value, fractionLabel, index = 0, pulseToken = 0, loopPulse = false, highlighted = false, onPress }: { value: number; fractionLabel?: string; index?: number; pulseToken?: number; loopPulse?: boolean; highlighted?: boolean; onPress?: () => void }) {
  const cl = fractionLabel
    ? (() => {
        const den = fractionLabel.split('/')[1] ?? '2';
        const fc = fracColors[den] ?? numRed;
        return { border: fc.dark, face: fc.face };
      })()
    : getNumColors(value);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  // Stronger "pop" animation (no translateY to avoid clipping)
  const scaleAnim = useRef(new Animated.Value(0.35)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  // Press "pop" multiplier (increase only during touch-in)
  // Boosted x2 versus previous touch feedback.
  const PRESS_SCALE = 1.32;
  useEffect(() => {
    const stagger = index * 80;
    Animated.sequence([
      Animated.delay(stagger),
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.45, duration: 340, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 160, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        ]),
      ]),
    ]).start();
  }, [index]);
  useEffect(() => {
    if (!pulseToken) return;
    pulseAnim.stopAnimation();
    pulseAnim.setValue(0);
    const pulse = Animated.sequence([
      Animated.delay(index * 70 + 120),
      Animated.timing(pulseAnim, { toValue: 1, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 210, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
    ]);
    pulse.start();
    return () => pulse.stop();
  }, [pulseToken, index, pulseAnim]);
  // First-time user: loop the pulse until they tap a mini card for the first
  // time (tracked app-wide via AsyncStorage). The parent flips loopPulse to
  // false as soon as the user taps any mini card, which ends the loop.
  useEffect(() => {
    if (!loopPulse) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return;
    }
    pulseAnim.stopAnimation();
    pulseAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 80),
        Animated.timing(pulseAnim, { toValue: 1, duration: 360, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 360, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.delay(280),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [loopPulse, index, pulseAnim]);
  const handlePressIn = useCallback(() => {
    Animated.spring(pressScaleAnim, { toValue: PRESS_SCALE, useNativeDriver: true, friction: 6, tension: 230 }).start();
  }, []);
  const handlePressOut = useCallback(() => {
    Animated.spring(pressScaleAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 210 }).start();
  }, []);
  const cardContent = (
    <View style={{
      width: MINI_W, height: MINI_H, borderRadius: MINI_R, overflow: 'hidden',
      borderWidth: highlighted ? 3 : 1.5,
      borderColor: highlighted ? '#FCD34D' : cl.border,
      backgroundColor: 'rgba(255,255,255,0.95)',
      ...(highlighted ? Platform.select({
        ios: { shadowColor: '#FCD34D', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.95, shadowRadius: 12 },
        android: { elevation: 12 },
      }) : {}),
    }}>
      <LinearGradient
        colors={['rgba(255,255,255,0.9)', 'rgba(248,248,248,0.85)', 'rgba(240,240,240,0.9)']}
        locations={[0, 0.6, 1]}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{
          fontSize: fractionLabel ? 16 : 18, fontWeight: '900', color: cl.face,
          textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1,
        }}>{fractionLabel ?? value}</Text>
      </View>
    </View>
  );
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  return (
    <Animated.View style={{ opacity: opacityAnim, transform: [{ scale: Animated.multiply(Animated.multiply(scaleAnim, pressScaleAnim), pulseScale) }] }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {cardContent}
      </TouchableOpacity>
    </Animated.View>
  );
}

const fracColors: Record<string, { face: string; dark: string; light: string }> = {
  '2': { face: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9' },
  '3': { face: '#34A853', dark: '#1B5E2B', light: '#36944F' },
  '4': { face: '#FBBC05', dark: '#8B6800', light: '#DC9E00' },
  '5': { face: '#EA4335', dark: '#8B1A12', light: '#DC4736' },
};
const numRed = { face: '#EA4335', dark: '#8B1A12', light: '#DC4736' };

function FractionCard({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const f = card.fraction ?? '1/2';
  const [num, den] = f.split('/');
  const denCl = fracColors[den] ?? numRed;
  const fs = small ? 36 : 42;
  const maxOff = small ? 6 : 8;
  const lineW = small ? 38 : 44;
  const lineH = small ? 5 : 6;
  return (
    <BaseCard borderColor={denCl.face} selected={selected} onPress={onPress} small={small}>
      <View style={{ alignItems: 'center' }}>
        <Text3D text={num} fontSize={fs} faceColor={numRed.face} darkColor={numRed.dark} lightColor={numRed.light} maxOffset={maxOff} />
        <View style={{ marginVertical: small ? 2 : 3 }}>
          <Line3D width={lineW} height={lineH} faceColor={denCl.face} darkColor={denCl.dark} lightColor={denCl.light} layers={3} />
        </View>
        <Text3D text={den} fontSize={fs} faceColor={denCl.face} darkColor={denCl.dark} lightColor={denCl.light} maxOffset={maxOff} />
      </View>
    </BaseCard>
  );
}

const opColors: Record<string, { face: string; dark: string; light: string }> = {
  '+': { face: '#EA4335', dark: '#8B1A12', light: '#DC4736' },
  '/': { face: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9' },
  'x': { face: '#34A853', dark: '#1B5E2B', light: '#36944F' },
  '-': { face: '#FBBC05', dark: '#8B6800', light: '#DC9E00' },
};
// Android: Fredoka_700Bold font is missing Unicode math glyphs (× − ÷).
// iOS renders them fine; on Android fall back to ASCII-equivalent chars.
const opDisplay: Record<string, string> = Platform.OS === 'android'
  ? { 'x': 'x', '-': '-', '/': '÷', '+': '+', '×': 'x', '−': '-' }
  : { 'x': '×', '-': '−', '/': '÷', '+': '+' };
const parallelOp: Record<string, string> = { '+': '-', '-': '+', 'x': '/', '/': 'x' };

type StagedChipDisplay = {
  cardId: string;
  label: string;
  bg: string;
  border: string;
  text: string;
};

function chipColorsForStagedCard(c: Card): { bg: string; border: string; text: string } {
  if (c.type === 'number') {
    const cl = getNumColors(c.value ?? 0);
    return { bg: '#FFFFFF', border: cl.border, text: cl.face };
  }
  if (c.type === 'wild') {
    return { bg: '#EDE9FE', border: '#7C3AED', text: '#5B21B6' };
  }
  if (c.type === 'operation') {
    const o = c.operation ?? '+';
    const cl = opColors[o] ?? opColors['+'];
    return { bg: cl.face, border: cl.dark, text: '#FFFFFF' };
  }
  return { bg: '#F3F4F6', border: '#6B7280', text: '#111827' };
}

/** מטא־צ'יפים ליד כפתורי הנחה — צבעים כמו הקלף, לפי סדר staging. */
function stagedSelectionChipsDisplay(
  staged: Card[],
  equationResult: number | null,
  maxWild: number,
): StagedChipDisplay[] {
  const numbers = staged.filter(c => c.type === 'number' || c.type === 'wild');
  const opCard = staged.find(c => c.type === 'operation') ?? null;
  const wildVal =
    equationResult != null && numbers.some(c => c.type === 'wild')
      ? computeWildValueInStaged(numbers, opCard, equationResult, maxWild)
      : null;
  return staged.map((c) => {
    let label: string;
    if (c.type === 'number') label = String(c.value ?? '·');
    else if (c.type === 'wild') label = wildVal !== null ? String(wildVal) : '?';
    else if (c.type === 'operation') {
      const o = c.operation ?? '+';
      label = opDisplay[o] ?? o;
    } else label = '…';
    const colors = chipColorsForStagedCard(c);
    return { cardId: c.id, label, ...colors };
  });
}

const STAGED_CHIP_ORBIT_SIZE = 44;
const STAGED_CHIP_ORBIT_H = 48;
const STAGED_CHIP_ORBIT_GAP = 6;

/**
 * פריסת צ'יפים בשתי עמודות (שמאל/ימין) בלי חפיפה ביניהם ובלי חפיפה עם בלוק הכפתורים.
 * עמודות נוספות נפתחות אופקית כשיש יותר קלפים מגובה השורה.
 */
function layoutStagedChipOrbitPositions(
  cardIds: string[],
  containerW: number,
  anchorLeft: number,
  anchorWidth: number,
  orbitHeight: number,
  chipW: number = STAGED_CHIP_ORBIT_SIZE,
  chipH: number = STAGED_CHIP_ORBIT_H,
  gap: number = STAGED_CHIP_ORBIT_GAP,
): { left: number; top: number }[] {
  const n = cardIds.length;
  if (n === 0) return [];

  const margin = 8;
  const anchorRight = anchorLeft + anchorWidth;
  const leftColRight = anchorLeft - margin;
  const rightColLeft = anchorRight + margin;
  const leftColX = Math.max(2, leftColRight - chipW);
  const rightColX = Math.min(containerW - chipW - 2, rightColLeft);
  const rows = Math.max(1, Math.floor((orbitHeight - 8) / (chipH + gap)));

  const numLeft = Math.ceil(n / 2);
  const numRight = Math.floor(n / 2);

  const buildSide = (count: number, startX: number, dir: -1 | 1): { left: number; top: number }[] => {
    const out: { left: number; top: number }[] = [];
    for (let i = 0; i < count; i++) {
      const col = Math.floor(i / rows);
      const row = i % rows;
      let left = startX + dir * col * (chipW + gap);
      left = Math.max(2, Math.min(left, containerW - chipW - 2));
      if (dir === -1 && left + chipW > leftColRight) {
        left = Math.max(2, leftColRight - chipW);
      }
      if (dir === 1 && left < rightColLeft) {
        left = Math.min(containerW - chipW - 2, rightColLeft);
      }
      out.push({ left, top: 4 + row * (chipH + gap) });
    }
    return out;
  };

  const leftPos = buildSide(numLeft, leftColX, -1);
  const rightPos = buildSide(numRight, rightColX, 1);

  const merged: { left: number; top: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = i % 2 === 0 ? leftPos[Math.floor(i / 2)] : rightPos[Math.floor(i / 2)];
    if (p) merged.push(p);
  }
  return merged;
}

function StagedChipOrbitLayer({
  chips,
  positions,
  stagedCards,
  dispatch,
  t,
}: {
  chips: StagedChipDisplay[];
  positions: { left: number; top: number }[];
  stagedCards: Card[];
  dispatch: (a: GameAction) => void;
  t: (key: string, params?: MsgParams) => string;
}) {
  const animByIdRef = useRef<Record<string, Animated.Value>>({});
  useEffect(() => {
    const active = new Set(chips.map((chip) => chip.cardId));
    for (const chip of chips) {
      if (!animByIdRef.current[chip.cardId]) {
        const v = new Animated.Value(0);
        animByIdRef.current[chip.cardId] = v;
        Animated.timing(v, {
          toValue: 1,
          duration: 170,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }).start();
      }
    }
    for (const id of Object.keys(animByIdRef.current)) {
      if (!active.has(id)) delete animByIdRef.current[id];
    }
  }, [chips]);
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((chip, i) => {
        const card = stagedCards.find((c) => c.id === chip.cardId);
        const pos = positions[i];
        if (!card || !pos) return null;
        const anim = animByIdRef.current[chip.cardId] ?? new Animated.Value(1);
        return (
          <Animated.View
            key={chip.cardId}
            style={{
              position: 'absolute',
              left: pos.left,
              top: pos.top,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('game.unstageChipA11y', { label: chip.label })}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.85}
              onPress={() => dispatch({ type: 'UNSTAGE_CARD', card })}
              style={{
              width: STAGED_CHIP_ORBIT_SIZE,
              minHeight: STAGED_CHIP_ORBIT_SIZE,
              paddingHorizontal: chip.label.length > 1 ? 4 : 0,
              borderRadius: STAGED_CHIP_ORBIT_SIZE / 2,
              backgroundColor: chip.bg,
              borderWidth: 2,
              borderColor: chip.border,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.14,
                  shadowRadius: 2,
                },
                android: { elevation: 2 },
              }),
            }}
            >
              <Text
                style={{
                  color: chip.text,
                  fontSize: chip.label.length > 2 ? 12 : 16,
                  fontWeight: '800',
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </>
  );
}

function OperationCardComp({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const op = card.operation ?? '+';
  const cl = opColors[op] ?? opColors['+'];
  const display = opDisplay[op] ?? op;
  // Bigger operation symbols, with about half 3D depth.
  const fs = small ? 50 : 56;
  const maxOff = small ? 5 : 6;
  return (
    <BaseCard borderColor={cl.face} selected={selected} onPress={onPress} small={small}>
      <Text3D text={display} fontSize={fs} faceColor={cl.face} darkColor={cl.dark} lightColor={cl.light} maxOffset={maxOff} />
    </BaseCard>
  );
}

function JokerCard({ card: _c, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const w = small ? 100 : 110;
  const h = small ? 140 : 158;
  const bw = 3;
  // Joker corner symbols: flat look (no 3D depth).
  const maxOff = 1;
  // Make joker symbols/image noticeably larger in fan (small cards).
  const cornerFs = small ? 20 : 24;
  const svgSize = small ? 56 : 66;
  const innerW = w - 2 * bw;
  const innerH = h - 2 * bw;

  const corners = [
    { sym: '+', face: '#EA4335', dark: '#8B1A12', light: '#DC4736', pos: { top: 7, left: 7 } as any, rot: '-10deg' },
    { sym: '÷', face: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9', pos: { top: 7, right: 7 } as any, rot: '10deg' },
    { sym: '×', face: '#34A853', dark: '#1B5E2B', light: '#36944F', pos: { bottom: 14, left: 7 } as any, rot: '10deg' },
    { sym: '−', face: '#FBBC05', dark: '#8B6800', light: '#DC9E00', pos: { bottom: 14, right: 7 } as any, rot: '-10deg' },
  ];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      <View style={[{
        width: w, height: h, borderRadius: 12,
        transform: [{ translateY: selected ? -8 : 0 }],
      }, selected ? shadow3D('#FF9100', 16) : shadow3D('#000', 10)]}>
        {/* Rainbow conic-gradient border (diagonal approximation) */}
        <LinearGradient
          colors={['#EA4335', '#4285F4', '#34A853', '#FBBC05', '#EA4335']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: w, height: h, borderRadius: 12, padding: bw }}
          >
            <View style={{ width: innerW, height: innerH, borderRadius: 12 - bw, overflow: 'hidden', position: 'relative' }}>
              {/* White gradient fill — שכבה תחתונה */}
              <LinearGradient
                colors={['#FFFFFF', '#F5F5F5', '#E8E8E8']}
                locations={[0, 0.7, 1]}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
              />
              {/* Gloss sheen */}
              <View style={{
                position: 'absolute', top: -(innerH * 0.15), left: innerW * 0.05,
                width: innerW * 0.9, height: innerH * 0.5, borderRadius: innerW,
                backgroundColor: 'rgba(255,255,255,0.4)',
                zIndex: 1,
              }} />
              {/* Joker image — מידות ו־zIndex מפורשים (לא flex:1 בתוך overflow) */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* התמונה עצמה מכילה סמלי פעולות בפינות; ממקמים חלון ריבועי על מרכז הליצן (source y=200-770, x=117-687) כך שהדמות כולה — מקצות הכובע עד הרגליים — נראית ללא חיתוך */}
                <View style={{ width: svgSize, height: svgSize, borderRadius: 6, overflow: 'hidden' }}>
                  <Image
                    source={require('./assets/joker.jpg')}
                    style={{
                      position: 'absolute',
                      width: svgSize * 1.404,
                      height: svgSize * 1.796,
                      left: -svgSize * 0.206,
                      top: -svgSize * 0.351,
                    }}
                  />
                </View>
              </View>
              {/* 3D corner symbols — מעל התמונה */}
              {corners.map((c, i) => (
                <View key={i} style={[{ position: 'absolute', zIndex: 10, transform: [{ rotate: c.rot }] }, c.pos]}>
                  <Text3D text={c.sym} fontSize={cornerFs} faceColor={c.face} darkColor={c.dark} lightColor={c.light} maxOffset={maxOff} />
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
  );
}

function WildCard({ card, selected, onPress, small }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) {
  const { state } = useGame();
  const w = small ? 100 : 110;
  const h = small ? 140 : 158;
  const fs = small ? 22 : 26;
  const resolved = card.resolvedValue != null;
  return (
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View style={[{
          width: w, height: h, borderRadius: 12,
          transform: [{ translateY: selected ? -8 : 0 }],
        }, selected ? shadow3D('#FF9100', 16) : shadow3D('#000', 10)]}>
          <LinearGradient
            colors={['#7C3AED', '#5B21B6', '#4C1D95', '#6D28D9']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: w, height: h, borderRadius: 12, padding: 3 }}
          >
            <View style={{ flex: 1, borderRadius: 9, overflow: 'hidden' }}>
              <LinearGradient
                colors={['#EDE9FE', '#DDD6FE', '#C4B5FD']}
                locations={[0, 0.5, 1]}
                start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <View style={{
                position: 'absolute', top: -(h * 0.12), left: w * 0.1,
                width: w * 0.8, height: h * 0.4, borderRadius: w,
                backgroundColor: 'rgba(255,255,255,0.5)',
              }} />
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                {resolved ? (
                  <>
                    <Text style={{ fontSize: small ? 12 : 14, fontWeight: '700', color: '#6D28D9' }}>★</Text>
                    <Text style={{ fontSize: fs, fontWeight: '900', color: '#5B21B6', textAlign: 'center' }}>{card.resolvedValue}</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: fs, fontWeight: '900', color: '#5B21B6', textAlign: 'center' }}>★</Text>
                    <Text style={{ fontSize: small ? 10 : 11, fontWeight: '700', color: '#6D28D9', marginTop: 2 }}>{state.mathRangeMax === 12 ? '0–12' : '0–25'}</Text>
                  </>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
  );
}

function GameCard({ card, selected, active, onPress, small }: { card: Card; selected?: boolean; active?: boolean; onPress?: () => void; small?: boolean }) {
  switch (card.type) {
    case 'number': return <NumberCard card={card} selected={selected} active={active} onPress={onPress} small={small} />;
    case 'fraction': return <FractionCard card={card} selected={selected} onPress={onPress} small={small} />;
    case 'operation': return <OperationCardComp card={card} selected={selected} onPress={onPress} small={small} />;
    case 'joker': return <JokerCard card={card} selected={selected} onPress={onPress} small={small} />;
    case 'wild': return <WildCard card={card} selected={selected} onPress={onPress} small={small} />;
  }
}

// ═══════════════════════════════════════════════════════════════
//  DRAW PILE — 4-layer messy 3D stack
// ═══════════════════════════════════════════════════════════════

const pileRotations = [
  { rotate: '-3deg', translateX: -2, translateY: 4 },
  { rotate: '2deg', translateX: 3, translateY: 2 },
  { rotate: '-1deg', translateX: -1, translateY: 1 },
  { rotate: '0deg', translateX: 0, translateY: 0 },
];

function DrawPile() {
  const { t } = useLocale();
  const { state, dispatch } = useGame();
  const canDraw =
    (state.phase === 'pre-roll' || state.phase === 'building' || state.phase === 'solved') &&
    !state.hasPlayedCards &&
    state.pendingFractionTarget === null;
  const count = state.drawPile.length;
  const layers = Math.min(count, 4);
  return (
    <View style={{ alignItems:'center' }}>
      <View style={{ width:96, height:132, alignItems:'center', justifyContent:'center' }}>
        {layers > 0 ? pileRotations.slice(4 - layers).map((r, i) => {
          const isTop = i === layers - 1;
          return (
            <View key={i} style={{ position:'absolute', transform:[{rotate:r.rotate},{translateX:r.translateX},{translateY:r.translateY}] }}>
              <BaseCard faceDown small onPress={isTop && canDraw ? () => dispatch({ type:'DRAW_CARD' }) : undefined}><></></BaseCard>
            </View>
          );
        }) : <View style={dpS.empty}><Text style={{color:'#6B7280',fontSize:10}}>{t('game.discardEmpty')}</Text></View>}
      </View>
      <Text style={{color:'#6B7280',fontSize:10,marginTop:2}}>{count}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DISCARD PILE — 3-layer messy stack showing top card
// ═══════════════════════════════════════════════════════════════

const discardRotations = [
  { rotate: '4deg', translateX: 2, translateY: 3 },
  { rotate: '-2deg', translateX: -1, translateY: 1 },
  { rotate: '0deg', translateX: 0, translateY: 0 },
];

function DiscardPile() {
  const { t } = useLocale();
  const { state } = useGame();
  const pileSize = state.discardPile.length;
  const top = pileSize > 0 ? state.discardPile[pileSize - 1] : null;
  const layers = Math.min(pileSize, 3);

  // Detect spill: fraction challenge card on top
  const hasSpill = !!top && top.type === 'fraction' && state.pendingFractionTarget !== null;
  const spillCard = hasSpill ? top : null;
  const visibleTop = hasSpill && pileSize > 1
    ? state.discardPile[pileSize - 2]
    : (hasSpill ? null : top);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hasSpill) {
      slideAnim.setValue(0);
      pulseAnim.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 1, tension: 50, friction: 8, useNativeDriver: true,
      }).start();
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      slideAnim.setValue(0);
      pulseAnim.setValue(0);
    }
  }, [hasSpill]);

  // Fractions spill right
  const spillDir = 1;

  // Second card from top — peek beneath the top card
  const secondCard = pileSize > 1 ? state.discardPile[hasSpill && pileSize > 2 ? pileSize - 3 : pileSize - 2] : null;

  return (
    <View style={{ alignItems:'center', gap:4 }}>
      <View style={{ width: hasSpill ? 140 : 96, height: hasSpill ? 148 : 140, alignItems:'center', justifyContent:'center' }}>
        {/* Pile layers — second card peeks out below */}
        {layers > 0 ? (<>
          {/* Bottom face-down cards for depth */}
          {layers > 2 && (
            <View style={{ position:'absolute', transform:[{rotate:discardRotations[0].rotate},{translateX:discardRotations[0].translateX},{translateY:discardRotations[0].translateY}] }}>
              <BaseCard faceDown small><></></BaseCard>
            </View>
          )}
          {/* Second card — offset to peek below top card */}
          {secondCard && (
            <View style={{ position:'absolute', transform:[{rotate:'-3deg'},{translateX:-6},{translateY:18}] }}>
              <GameCard card={secondCard} small />
            </View>
          )}
          {/* Top visible card */}
          {visibleTop && (
            <View style={{ position:'absolute', transform:[{rotate:'0deg'},{translateX:0},{translateY:-6}] }}>
              <GameCard card={visibleTop} active small />
            </View>
          )}
        </>) : <View style={dpS.empty}><Text style={{color:'#6B7280',fontSize:11}}>{t('game.discardEmpty')}</Text></View>}

        {/* Spill card — slides out half on / half off the pile */}
        {spillCard && (
          <Animated.View style={{
            position:'absolute', zIndex:10,
            transform: [
              { translateX: slideAnim.interpolate({
                inputRange: [0, 1], outputRange: [0, 44 * spillDir],
              }) },
              { translateY: slideAnim.interpolate({
                inputRange: [0, 1], outputRange: [0, -12],
              }) },
              { rotate: slideAnim.interpolate({
                inputRange: [0, 1], outputRange: ['0deg', `${12 * spillDir}deg`],
              }) as any },
            ],
          }}>
            {/* Pulsing red glow behind card */}
            <Animated.View style={{
              position:'absolute', top:-5, left:-5, right:-5, bottom:-5,
              borderRadius:16, backgroundColor:'rgba(231,76,60,0.25)',
              opacity: pulseAnim.interpolate({ inputRange:[0,1], outputRange:[0.3, 0.9] }),
            }} />
            <GameCard card={spillCard} small />
          </Animated.View>
        )}

      </View>
    </View>
  );
}
const dpS = StyleSheet.create({ empty: { width:80, height:115, borderRadius:12, borderWidth:2, borderStyle:'dashed', borderColor:'#4B5563', alignItems:'center', justifyContent:'center' } });

// ═══════════════════════════════════════════════════════════════
//  RESULTS CHIP BUTTON (squircle casino chip)
// ═══════════════════════════════════════════════════════════════

const CHIP_W = 76;
const CHIP_H = 68;
const CHIP_R = 14;
const SOLVE_CHIP_W = CHIP_W + 30;

function ResultsSlot({
  onToggle,
  filteredResults,
  matchCount,
  boostedPulse = false,
  noPulse = false,
  timerResetVisible,
  onTimerReset,
}: {
  onToggle: () => void;
  filteredResults: EquationOption[];
  matchCount: number;
  boostedPulse?: boolean;
  noPulse?: boolean;
  timerResetVisible?: boolean;
  onTimerReset?: () => void;
}) {
  const { t } = useLocale();
  const chipStackH = CHIP_H + 6;
  // matchCount is authoritative — it already counts numeric targets matching a
  // hand card AND fraction cards whose denominator divides any equation result.
  const hasVisibleResults = matchCount > 0;
  return (
    <View style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8, position: 'relative', height: chipStackH, overflow: 'visible' }}>
      <View style={{ width: CHIP_W, height: chipStackH }}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <ResultsChip
            onPress={onToggle}
            matchCount={matchCount}
            boostedPulse={boostedPulse && hasVisibleResults}
            noPulse={noPulse}
          />
        </View>
      </View>
      {timerResetVisible && onTimerReset ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onTimerReset}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            alignSelf: 'center',
            minWidth: 44,
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: 'rgba(185,28,28,0.92)',
            borderWidth: 1,
            borderColor: 'rgba(248,113,113,0.65)',
            zIndex: 3,
          }}
        >
          <Text style={{ color: '#FEE2E2', fontSize: 10, fontWeight: '800', textAlign: 'center' }} numberOfLines={1}>
            {t('ui.timerResetShort')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function ResultsStripNearPile({ resultsOpen, filteredResults, onSelectEquation }: { resultsOpen: boolean; filteredResults: EquationOption[]; onSelectEquation?: (eq: EquationOption) => void }) {
  const stripSlide = useRef(new Animated.Value(0)).current;
  const stripOpacity = useRef(new Animated.Value(0)).current;
  /** Avoid re-running entrance when `filteredResults.length` changes while strip stays open (was jumping / flickering). */
  const stripEntranceRef = useRef({ wasOpen: false, hadItems: false });
  useEffect(() => {
    const hasItems = filteredResults.length > 0;
    if (!resultsOpen) {
      stripEntranceRef.current = { wasOpen: false, hadItems: false };
      return;
    }
    if (!hasItems) {
      stripEntranceRef.current = { wasOpen: true, hadItems: false };
      return;
    }
    const prev = stripEntranceRef.current;
    const needEntrance = !prev.wasOpen || !prev.hadItems;
    stripEntranceRef.current = { wasOpen: true, hadItems: true };
    if (!needEntrance) return;
    stripSlide.setValue(20);
    stripOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(stripOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(stripSlide, { toValue: 0, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [resultsOpen, filteredResults.length]);
  if (!resultsOpen || filteredResults.length === 0) return null;
  return (
    <Animated.View style={{flexShrink:0,flex:1,minWidth:0,opacity:stripOpacity,transform:[{translateY:stripSlide}]}}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10,paddingHorizontal:6,alignItems:'center',justifyContent:'flex-start'}}>
        {filteredResults.map((t, i) => (
          <View key={`${t.equation}-${t.result}-${i}`} style={{width:MINI_W + 14}}>
            <MiniResultCard value={t.result} index={i} onPress={onSelectEquation ? () => onSelectEquation(t) : undefined} />
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function ResultsStripBelowTable({ resultsOpen, filteredResults, fractionCards = [], onSelectEquation, miniPulseToken = 0, loopPulse = false, highlightResult, highlightAll = false }: { resultsOpen: boolean; filteredResults: EquationOption[]; fractionCards?: Card[]; onSelectEquation?: (eq: EquationOption) => void; miniPulseToken?: number; loopPulse?: boolean; highlightResult?: number; highlightAll?: boolean }) {
  const normalizedResults = useMemo(() => {
    const byResult = new Map<number, EquationOption>();
    for (const option of filteredResults) {
      if (!byResult.has(option.result)) byResult.set(option.result, option);
    }
    return [...byResult.values()].sort((a, b) => a.result - b.result);
  }, [filteredResults]);
  const uniqueFractions = useMemo(() => {
    const seen = new Set<string>();
    const out: Card[] = [];
    for (const c of fractionCards) {
      if (c.fraction && !seen.has(c.fraction)) { seen.add(c.fraction); out.push(c); }
    }
    return out;
  }, [fractionCards]);
  const stripSlide = useRef(new Animated.Value(0)).current;
  const stripOpacity = useRef(new Animated.Value(0)).current;
  const stripEntranceRef = useRef({ wasOpen: false, hadItems: false });
  useEffect(() => {
    const hasItems = normalizedResults.length > 0;
    if (!resultsOpen) {
      stripEntranceRef.current = { wasOpen: false, hadItems: false };
      return;
    }
    if (!hasItems) {
      stripEntranceRef.current = { wasOpen: true, hadItems: false };
      return;
    }
    const prev = stripEntranceRef.current;
    const needEntrance = !prev.wasOpen || !prev.hadItems;
    stripEntranceRef.current = { wasOpen: true, hadItems: true };
    if (!needEntrance) return;
    stripSlide.setValue(20);
    stripOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(stripOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(stripSlide, { toValue: 0, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [resultsOpen, normalizedResults.length]);
  if (!resultsOpen || (normalizedResults.length === 0 && uniqueFractions.length === 0)) return null;
  return (
    <Animated.View style={{flexShrink:0,width:'100%',alignItems:'center',justifyContent:'center',opacity:stripOpacity,transform:[{translateY:stripSlide}]}}>
      <View style={{minHeight:MINI_H + 16,backgroundColor:'transparent',paddingVertical:10,paddingHorizontal:12,width:'100%',maxWidth:360,alignItems:'center'}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10,paddingHorizontal:6,alignItems:'center',justifyContent:'center'}}>
          {normalizedResults.map((t, i) => (
            <View key={`${t.equation}-${t.result}-${i}`} style={{width:MINI_W + 14}}>
              <MiniResultCard value={t.result} index={i} pulseToken={miniPulseToken} loopPulse={loopPulse} highlighted={highlightAll || (highlightResult != null && t.result === highlightResult)} onPress={onSelectEquation ? () => onSelectEquation(t) : undefined} />
            </View>
          ))}
          {uniqueFractions.map((c, i) => (
            <View key={`frac-${c.fraction}-${i}`} style={{width:MINI_W + 14}}>
              <MiniResultCard value={0} fractionLabel={c.fraction} index={normalizedResults.length + i} pulseToken={miniPulseToken} loopPulse={loopPulse} highlighted={highlightAll} />
            </View>
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

function ResultsChip({ onPress, matchCount, boostedPulse = false, noPulse = false }: { onPress: () => void; matchCount: number; boostedPulse?: boolean; noPulse?: boolean }) {
  const { t, isRTL } = useLocale();
  const twinkleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(twinkleAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (noPulse) {
      heartScale.setValue(1);
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        ...(boostedPulse
          ? [
              Animated.timing(heartScale, { toValue: 1.1, duration: 170, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
              Animated.timing(heartScale, { toValue: 1.02, duration: 120, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
              Animated.timing(heartScale, { toValue: 1.16, duration: 210, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
              Animated.timing(heartScale, { toValue: 1, duration: 230, useNativeDriver: true, easing: ease }),
              Animated.delay(720),
            ]
          : [
              Animated.timing(heartScale, { toValue: 1.055, duration: 1100, useNativeDriver: true, easing: ease }),
              Animated.timing(heartScale, { toValue: 1, duration: 650, useNativeDriver: true, easing: ease }),
              Animated.delay(120),
              Animated.timing(heartScale, { toValue: 1.028, duration: 750, useNativeDriver: true, easing: ease }),
              Animated.timing(heartScale, { toValue: 1, duration: 550, useNativeDriver: true, easing: ease }),
              Animated.delay(1700),
            ]),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      heartScale.setValue(1);
    };
  }, [heartScale, boostedPulse, noPulse]);

  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start();
  }, []);
  const handlePressOut = useCallback(() => {
    Animated.timing(pressAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
  }, []);

  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  const combinedScale = Animated.multiply(heartScale, scale);
  const translateY = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 2] });
  const pulseGlowOpacity = heartScale.interpolate({ inputRange: [1, 1.08, 1.16], outputRange: [0.15, 0.45, 0.8] });
  const pulseGlowScale = heartScale.interpolate({ inputRange: [1, 1.16], outputRange: [0.95, 1.12] });
  const tw1 = twinkleAnim.interpolate({ inputRange: [0, 0.3, 0.5, 0.8, 1], outputRange: [0.1, 0.7, 0.15, 0.6, 0.1] });
  const tw2 = twinkleAnim.interpolate({ inputRange: [0, 0.2, 0.6, 0.9, 1], outputRange: [0.5, 0.1, 0.6, 0.15, 0.5] });
  const tw3 = twinkleAnim.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: [0.15, 0.55, 0.1, 0.15] });

  const rim = 4;
  const inset = 2;
  const innerR = CHIP_R - 3;
  const feltPad = rim + inset;

  return (
    <View style={{ width: CHIP_W, height: CHIP_H + 6 }}>
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Animated.View style={{ width: CHIP_W, height: CHIP_H + 4, transform: [{ scale: combinedScale }, { translateY }] }}>
          {boostedPulse ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -8,
                left: -8,
                right: -8,
                bottom: -8,
                borderRadius: CHIP_R + 12,
                borderWidth: 2,
                borderColor: 'rgba(253,224,71,0.92)',
                opacity: pulseGlowOpacity,
                transform: [{ scale: pulseGlowScale }],
              }}
            />
          ) : null}
          {/* Bottom shadow */}
          <View style={{
            position: 'absolute', bottom: 0, left: 2, right: 2, height: CHIP_H,
            borderRadius: CHIP_R + 2, backgroundColor: '#1A0D00',
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 10 },
              android: { elevation: 10 },
            }),
          }} />
          {/* Mid shadow */}
          <View style={{
            position: 'absolute', bottom: 2, left: 1, right: 1, height: CHIP_H,
            borderRadius: CHIP_R + 2, backgroundColor: '#3A2504',
          }} />
          {/* Gold rim */}
          <LinearGradient
            colors={['#FFF0A0', '#F5D45A', '#E8BC28', '#D4A010', '#C09018', '#E8C030', '#F5D860']}
            locations={[0, 0.15, 0.35, 0.55, 0.75, 0.9, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: CHIP_H, borderRadius: CHIP_R + 2 }}
          />
          {/* Gold specular highlight */}
          <View style={{
            position: 'absolute', top: 1, left: CHIP_R, right: CHIP_R,
            height: CHIP_H * 0.3, borderBottomLeftRadius: CHIP_H, borderBottomRightRadius: CHIP_H,
            backgroundColor: 'rgba(255,255,230,0.2)',
          }} />
          {/* Dark inset ring */}
          <View style={{
            position: 'absolute', top: rim - 1, left: rim - 1, right: rim - 1, bottom: rim + 2,
            borderRadius: CHIP_R - 1, backgroundColor: '#0A1A0E',
          }} />
          {/* Green felt surface */}
          <LinearGradient
            colors={['#2D6B48', '#245C3C', '#1C4C30', '#143824']}
            start={{ x: 0.3, y: 0.2 }} end={{ x: 0.7, y: 0.9 }}
            style={{
              position: 'absolute', top: feltPad, left: feltPad, right: feltPad, bottom: feltPad + 1,
              borderRadius: innerR, overflow: 'hidden',
            }}
          >
            {/* Felt edge vignette */}
            <View style={{
              ...StyleSheet.absoluteFillObject, borderRadius: innerR,
              borderWidth: 6, borderColor: 'rgba(0,0,0,0.2)',
            }} />
            {/* Twinkle dots */}
            <Animated.View style={{ position: 'absolute', left: '18%', top: '25%', width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(220,255,230,0.7)', opacity: tw1 }} />
            <Animated.View style={{ position: 'absolute', left: '60%', top: '50%', width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: 'rgba(220,255,230,0.6)', opacity: tw2 }} />
            <Animated.View style={{ position: 'absolute', left: '40%', top: '70%', width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(220,255,230,0.65)', opacity: tw3 }} />
            {/* Inner felt glow */}
            <View style={{
              position: 'absolute', top: 0, left: '20%', right: '20%', height: '45%',
              borderBottomLeftRadius: 100, borderBottomRightRadius: 100,
              backgroundColor: 'rgba(80,180,100,0.08)',
            }} />
          </LinearGradient>
          {/* Inner rim highlight */}
          <View style={{
            position: 'absolute', top: feltPad, left: feltPad, right: feltPad, bottom: feltPad + 1,
            borderRadius: innerR, borderWidth: 0.7, borderColor: 'rgba(80,180,100,0.22)',
          }} />
          {/* Outer gold edge highlight */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: CHIP_H,
            borderRadius: CHIP_R + 2, borderWidth: 0.8, borderColor: 'rgba(255,248,180,0.25)',
          }} />
          {/* Text label */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: CHIP_H,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text numberOfLines={2} style={{
              color: '#F0E8B0', fontSize: 11, fontWeight: '900', textAlign: 'center', lineHeight: 14,
              textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}>{t('results.possibleChip')}</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
      {/* Match count badge */}
      {matchCount > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -4, backgroundColor: '#FFD700',
          borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#1a1a2e', zIndex: 5,
        }}>
          <Text style={{ color: '#1a1a2e', fontSize: 11, fontWeight: '900' }}>{matchCount}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Format an equation string for display in the SolveExerciseChip.
 * Converts "a op1 b op2 c = r" → "(a op1 b) op2 c = r" so the evaluation
 * order is clear. Keeps ASCII operators on Android (font issue).
 */
function formatEquationForDisplay(equation: string): string {
  // iOS/web: upgrade to Unicode math glyphs. Android: keep ASCII.
  const isAndroid = Platform.OS === 'android';
  const norm = isAndroid
    ? equation
    : equation.replace(/ x /g, ' \u00d7 ').replace(/ - /g, ' \u2212 ');
  // Match 3-term: a op b op c = r (both ASCII and Unicode operators)
  const opPat = '[+\\-x\\u00d7\\u2212\\u00f7/]';
  const re = new RegExp(`^(-?\\d+)\\s+(${opPat})\\s+(-?\\d+)\\s+(${opPat})\\s+(-?\\d+)\\s+=\\s+(-?\\d+)$`);
  const match = norm.match(re);
  if (match) {
    const [, a, op1, b, op2, c, r] = match;
    const highPrec = (op: string) => op === 'x' || op === '\u00d7' || op === '\u00f7' || op === '/';
    if (highPrec(op2) && !highPrec(op1)) {
      return `${a} ${op1} (${b} ${op2} ${c}) = ${r}`;
    }
    return `(${a} ${op1} ${b}) ${op2} ${c} = ${r}`;
  }
  return norm;
}

function SolveExerciseChip({ equation, onPress, pulseKey = 0, loopPulse = false }: { equation: string; onPress: () => void; pulseKey?: number; loopPulse?: boolean }) {
  const pressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start();
  }, []);
  const handlePressOut = useCallback(() => {
    Animated.timing(pressAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
  }, []);
  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  const translateY = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 2] });
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const pulseGlow = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  useEffect(() => {
    if (!pulseKey) return;
    pulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 180, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
    ]).start();
  }, [pulseKey]);
  useEffect(() => {
    if (!loopPulse) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 230, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 280, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      Animated.delay(650),
    ]));
    loop.start();
    return () => { loop.stop(); pulseAnim.setValue(0); };
  }, [loopPulse, pulseAnim]);
  const rim = 4;
  const inset = 2;
  const innerR = CHIP_R - 3;
  const feltPad = rim + inset;
  return (
    <View style={{ width: SOLVE_CHIP_W, height: CHIP_H + 6 }}>
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={{ width: SOLVE_CHIP_W, height: CHIP_H + 4, transform: [{ scale: Animated.multiply(scale, pulseScale) }, { translateY }] }}>
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
            borderRadius: CHIP_R + 8, borderWidth: 2, borderColor: 'rgba(252,165,165,0.9)',
            opacity: pulseGlow,
            transform: [{ scale: pulseScale }],
          }} />
          <View style={{
            position: 'absolute', bottom: 0, left: 2, right: 2, height: CHIP_H,
            borderRadius: CHIP_R + 2, backgroundColor: '#1A0D00',
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 10 },
              android: { elevation: 10 },
            }),
          }} />
          <View style={{
            position: 'absolute', bottom: 2, left: 1, right: 1, height: CHIP_H,
            borderRadius: CHIP_R + 2, backgroundColor: '#3A1515',
          }} />
          <LinearGradient
            colors={['#FCA5A5', '#F87171', '#EF4444', '#DC2626', '#B91C1C', '#E85C5C', '#F87272']}
            locations={[0, 0.15, 0.35, 0.55, 0.75, 0.9, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: CHIP_H, borderRadius: CHIP_R + 2 }}
          />
          <View style={{
            position: 'absolute', top: 1, left: CHIP_R, right: CHIP_R,
            height: CHIP_H * 0.3, borderBottomLeftRadius: CHIP_H, borderBottomRightRadius: CHIP_H,
            backgroundColor: 'rgba(255,230,230,0.2)',
          }} />
          <View style={{
            position: 'absolute', top: rim - 1, left: rim - 1, right: rim - 1, bottom: rim + 2,
            borderRadius: CHIP_R - 1, backgroundColor: '#1C0A0A',
          }} />
          <LinearGradient
            colors={['#7F1D1D', '#991B1B', '#B91C1C', '#991B1B']}
            start={{ x: 0.3, y: 0.2 }} end={{ x: 0.7, y: 0.9 }}
            style={{
              position: 'absolute', top: feltPad, left: feltPad, right: feltPad, bottom: feltPad + 1,
              borderRadius: innerR, overflow: 'hidden',
            }}
          >
            <View style={{
              ...StyleSheet.absoluteFillObject, borderRadius: innerR,
              borderWidth: 6, borderColor: 'rgba(0,0,0,0.2)',
            }} />
          </LinearGradient>
          <View style={{
            position: 'absolute', top: feltPad, left: feltPad, right: feltPad, bottom: feltPad + 1,
            borderRadius: innerR, borderWidth: 0.7, borderColor: 'rgba(248,113,113,0.25)',
          }} />
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: CHIP_H,
            borderRadius: CHIP_R + 2, borderWidth: 0.8, borderColor: 'rgba(254,202,202,0.3)',
          }} />
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: CHIP_H,
            alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
          }}>
            <Text numberOfLines={3} allowFontScaling={false} style={{
              color: '#FECACA', fontSize: 11, fontWeight: '900', textAlign: 'center', lineHeight: 13,
              writingDirection: 'ltr',
              ...(Platform.OS !== 'android' ? {
                textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
              } : {}),
            }}>{'\u2066'}{formatEquationForDisplay(equation)}{'\u2069'}</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DICE AREA
// ═══════════════════════════════════════════════════════════════

// DiceArea removed — roll button is now in SLOT 4 (notification zone)

// ── RoamingDice — walking dice characters (inlined) ──
const DICE_BODY = 40;
const DICE_PAD = 40;
const { width: SCREEN_W_DICE, height: SCREEN_H_DICE } = Dimensions.get('window');
const ROAM_MAX_Y = SCREEN_H_DICE * 0.45;
const PIP_R = 3.5;

const PIPS_MAP: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.7], [0.7, 0.3]],
  3: [[0.3, 0.7], [0.5, 0.5], [0.7, 0.3]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.3, 0.26], [0.7, 0.26], [0.3, 0.5], [0.7, 0.5], [0.3, 0.74], [0.7, 0.74]],
};

const DICE_CONFIGS = [
  { face: 4, driftBase: 15000, startX: SCREEN_W_DICE * 0.2, startY: SCREEN_H_DICE * 0.12 },
  { face: 2, driftBase: 19500, startX: SCREEN_W_DICE * 0.5, startY: SCREEN_H_DICE * 0.28 },
  { face: 6, driftBase: 13500, startX: SCREEN_W_DICE * 0.75, startY: SCREEN_H_DICE * 0.18 },
];

interface DiceCharacterRef { summon: () => void; scatter: () => void; }

const DiceCharacter = React.forwardRef<DiceCharacterRef, { config: typeof DICE_CONFIGS[0] }>(({ config }, ref) => {
  const mounted = useRef(true);
  const drifting = useRef(true);
  const driftX = useRef(new Animated.Value(config.startX)).current;
  const driftY = useRef(new Animated.Value(config.startY)).current;
  const walk = useRef(new Animated.Value(0)).current;
  const bobY = useRef(new Animated.Value(0)).current;
  const eyeX = useRef(new Animated.Value(0)).current;
  const dcOpacity = useRef(new Animated.Value(0.55)).current;
  const dcScale = useRef(new Animated.Value(1)).current;
  const pips = PIPS_MAP[config.face] || PIPS_MAP[1];

  const startDrift = useCallback(() => {
    drifting.current = true;
    const drift = () => {
      if (!mounted.current || !drifting.current) return;
      const tx = DICE_PAD + Math.random() * (SCREEN_W_DICE - DICE_PAD * 2);
      const ty = DICE_PAD + Math.random() * (ROAM_MAX_Y - DICE_PAD);
      const dur = config.driftBase + (Math.random() - 0.5) * 9000;
      Animated.parallel([
        Animated.timing(driftX, { toValue: tx, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(driftY, { toValue: ty, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) drift(); });
    };
    drift();
  }, []);

  useEffect(() => {
    startDrift();
    Animated.loop(Animated.timing(walk, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(bobY, { toValue: -4, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bobY, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(eyeX, { toValue: -1.5, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(eyeX, { toValue: 1.5, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(400),
    ])).start();
    return () => { mounted.current = false; };
  }, []);

  React.useImperativeHandle(ref, () => ({
    summon: () => {
      drifting.current = false;
      driftX.stopAnimation(); driftY.stopAnimation();
      Animated.parallel([
        Animated.timing(driftX, { toValue: SCREEN_W_DICE / 2 - DICE_BODY / 2, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(driftY, { toValue: SCREEN_H_DICE * 0.3, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(dcOpacity, { toValue: 0, duration: 350, delay: 150, useNativeDriver: true }),
        Animated.timing(dcScale, { toValue: 0.4, duration: 500, useNativeDriver: true }),
      ]).start();
    },
    scatter: () => {
      const edge = Math.floor(Math.random() * 4);
      let sx: number, sy: number;
      if (edge === 0) { sx = -DICE_BODY; sy = Math.random() * ROAM_MAX_Y; }
      else if (edge === 1) { sx = SCREEN_W_DICE + DICE_BODY; sy = Math.random() * ROAM_MAX_Y; }
      else if (edge === 2) { sx = Math.random() * SCREEN_W_DICE; sy = -DICE_BODY; }
      else { sx = Math.random() * SCREEN_W_DICE; sy = ROAM_MAX_Y + DICE_BODY; }
      driftX.setValue(sx); driftY.setValue(sy); dcScale.setValue(1);
      Animated.timing(dcOpacity, { toValue: 0.55, duration: 400, useNativeDriver: true }).start(() => startDrift());
    },
  }));

  const leftLegRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['-12deg', '0deg', '12deg', '0deg', '-12deg'] });
  const rightLegRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['12deg', '0deg', '-12deg', '0deg', '12deg'] });
  const leftArmRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['10deg', '0deg', '-15deg', '0deg', '10deg'] });
  const rightArmRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['-10deg', '0deg', '15deg', '0deg', '-10deg'] });
  const combinedY = Animated.add(driftY, bobY);

  return (
    <Animated.View style={{ position: 'absolute', opacity: dcOpacity, transform: [{ translateX: driftX }, { translateY: combinedY as any }, { scale: dcScale }] }}>
      <View style={dcS.shadow} />
      <Animated.View style={[dcS.legPivotL, { transform: [{ rotate: leftLegRot as any }] }]}><View style={dcS.leg} /></Animated.View>
      <Animated.View style={[dcS.legPivotR, { transform: [{ rotate: rightLegRot as any }] }]}><View style={dcS.leg} /></Animated.View>
      <Animated.View style={[dcS.armPivotL, { transform: [{ rotate: leftArmRot as any }] }]}><View style={dcS.arm} /></Animated.View>
      <Animated.View style={[dcS.armPivotR, { transform: [{ rotate: rightArmRot as any }] }]}><View style={dcS.arm} /></Animated.View>
      <View style={dcS.body}>
        <LinearGradient colors={['#FFD54F', '#F5C842', '#D4A520']} style={{ width: DICE_BODY, height: DICE_BODY }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={dcS.shine} />
          {pips.map(([px, py], idx) => (
            <View key={idx} style={[dcS.pip, { left: px * DICE_BODY - PIP_R, top: py * DICE_BODY - PIP_R }]} />
          ))}
        </LinearGradient>
      </View>
      <View style={dcS.eyeRow}>
        <View style={dcS.eyeWhite}><Animated.View style={[dcS.pupil, { transform: [{ translateX: eyeX }] }]} /></View>
        <View style={dcS.eyeWhite}><Animated.View style={[dcS.pupil, { transform: [{ translateX: eyeX }] }]} /></View>
      </View>
    </Animated.View>
  );
});
DiceCharacter.displayName = 'DiceCharacter';

interface RoamingDiceRef { summon: () => void; scatter: () => void; }
const RoamingDice = React.forwardRef<RoamingDiceRef, {}>((_, ref) => {
  const d0 = useRef<DiceCharacterRef>(null);
  const d1 = useRef<DiceCharacterRef>(null);
  const d2 = useRef<DiceCharacterRef>(null);
  React.useImperativeHandle(ref, () => ({
    summon: () => {
      d0.current?.summon();
      setTimeout(() => d1.current?.summon(), 200);
      setTimeout(() => d2.current?.summon(), 400);
    },
    scatter: () => { d0.current?.scatter(); d1.current?.scatter(); d2.current?.scatter(); },
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <DiceCharacter ref={d0} config={DICE_CONFIGS[0]} />
      <DiceCharacter ref={d1} config={DICE_CONFIGS[1]} />
      <DiceCharacter ref={d2} config={DICE_CONFIGS[2]} />
    </View>
  );
});
RoamingDice.displayName = 'RoamingDice';

const dcS = StyleSheet.create({
  shadow: { position: 'absolute', top: DICE_BODY + 14, left: DICE_BODY * 0.15, width: DICE_BODY * 0.7, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.15)' },
  legPivotL: { position: 'absolute', top: DICE_BODY - 2, left: DICE_BODY * 0.25 - 1.5, width: 3, height: 0, overflow: 'visible' as const },
  legPivotR: { position: 'absolute', top: DICE_BODY - 2, left: DICE_BODY * 0.65 - 1.5, width: 3, height: 0, overflow: 'visible' as const },
  leg: { width: 3, height: 18, backgroundColor: '#444', borderRadius: 1.5 },
  armPivotL: { position: 'absolute', top: DICE_BODY * 0.35, left: -1.25, width: 2.5, height: 0, overflow: 'visible' as const },
  armPivotR: { position: 'absolute', top: DICE_BODY * 0.35, left: DICE_BODY - 1.25, width: 2.5, height: 0, overflow: 'visible' as const },
  arm: { width: 2.5, height: 14, backgroundColor: '#444', borderRadius: 1.25 },
  body: { width: DICE_BODY, height: DICE_BODY, borderRadius: 8, overflow: 'hidden' as const, borderWidth: 2, borderColor: '#B8860B' },
  shine: { position: 'absolute', top: 2, left: 2, width: DICE_BODY - 4, height: DICE_BODY * 0.4, borderRadius: 6, backgroundColor: 'rgba(255,245,200,0.35)' },
  pip: { position: 'absolute', width: PIP_R * 2, height: PIP_R * 2, borderRadius: PIP_R, backgroundColor: '#333', opacity: 0.8 },
  eyeRow: { position: 'absolute', top: -10, left: 0, width: DICE_BODY, flexDirection: 'row' as const, justifyContent: 'center' as const, gap: DICE_BODY * 0.12 },
  eyeWhite: { width: 9, height: 10, borderRadius: 5, backgroundColor: '#fff', borderWidth: 0.6, borderColor: '#bbb', alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const },
  pupil: { width: 4.4, height: 4.4, borderRadius: 2.2, backgroundColor: '#333' },
});

// ── RoamingCoins — Slinda coins rolling in the background ──
// Uses Animated.View + Image (not Animated.Image) for reliable native-driver
// rotation. combinedY is stored in a ref so it's stable across re-renders.
const COIN_CONFIGS = [
  { driftBase: 17000, startX: SCREEN_W_DICE * 0.12, startY: SCREEN_H_DICE * 0.08, spinMs: 2200 },
  { driftBase: 21000, startX: SCREEN_W_DICE * 0.78, startY: SCREEN_H_DICE * 0.28, spinMs: 2800 },
  { driftBase: 19000, startX: SCREEN_W_DICE * 0.45, startY: SCREEN_H_DICE * 0.40, spinMs: 2500 },
];

const CoinCharacter = React.memo(({ config }: { config: typeof COIN_CONFIGS[0] }) => {
  const mounted     = useRef(true);
  const driftX      = useRef(new Animated.Value(config.startX)).current;
  const driftY      = useRef(new Animated.Value(config.startY)).current;
  const bobY        = useRef(new Animated.Value(0)).current;
  const spin        = useRef(new Animated.Value(0)).current;
  const coinOpacity = useRef(new Animated.Value(0.6)).current;
  // combinedY created once so the animated node is stable across re-renders
  const combinedY   = useRef(Animated.add(driftY, bobY)).current;
  const rotate      = useRef(
    spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  ).current;

  useEffect(() => {
    const drift = () => {
      if (!mounted.current) return;
      const tx  = DICE_PAD + Math.random() * (SCREEN_W_DICE - DICE_PAD * 2);
      const ty  = DICE_PAD + Math.random() * (ROAM_MAX_Y - DICE_PAD);
      const dur = config.driftBase + (Math.random() - 0.5) * 9000;
      Animated.parallel([
        Animated.timing(driftX, { toValue: tx, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(driftY, { toValue: ty, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) drift(); });
    };
    drift();
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: config.spinMs, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(Animated.sequence([
      Animated.timing(bobY, { toValue: -4, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bobY, { toValue:  0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    return () => { mounted.current = false; };
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      opacity: coinOpacity,
      transform: [{ translateX: driftX }, { translateY: combinedY as any }],
    }}>
      <View style={ccS.shadow} />
      {/* Animated.View wrapper handles rotation reliably on all platforms */}
      <Animated.View style={{ width: DICE_BODY, height: DICE_BODY, transform: [{ rotate }] }}>
        <Image
          source={require('./assets/slinda_coin_nobg.png')}
          style={{ width: DICE_BODY, height: DICE_BODY }}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
});
CoinCharacter.displayName = 'CoinCharacter';

const RoamingCoins = React.memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <CoinCharacter config={COIN_CONFIGS[0]} />
    <CoinCharacter config={COIN_CONFIGS[1]} />
    <CoinCharacter config={COIN_CONFIGS[2]} />
  </View>
));
RoamingCoins.displayName = 'RoamingCoins';

const ccS = StyleSheet.create({
  shadow: {
    position: 'absolute',
    top: DICE_BODY + 10,
    left: DICE_BODY * 0.15,
    width: DICE_BODY * 0.7,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});

// ═══════════════════════════════════════════════════════════════
//  CELEBRATION (Joker rainbow)
// ═══════════════════════════════════════════════════════════════

const RAINBOW = ['#EF4444','#F97316','#EAB308','#22C55E','#3B82F6','#8B5CF6'];
function CelebrationFlash({ onDone }: { onDone: () => void }) {
  const { t } = useLocale();
  const opacity = useRef(new Animated.Value(1)).current;
  const colorIdx = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.sequence([Animated.timing(colorIdx,{toValue:RAINBOW.length-1,duration:800,useNativeDriver:false}),Animated.timing(opacity,{toValue:0,duration:300,useNativeDriver:false})]).start(()=>onDone()); }, []);
  const bg = colorIdx.interpolate({inputRange:RAINBOW.map((_,i)=>i),outputRange:RAINBOW});
  return <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:bg as any,opacity:opacity as any}]} pointerEvents="none"><View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:60,fontWeight:'900',color:'#FFF'}}>{t('joker.banner')}</Text></View></Animated.View>;
}

// ═══════════════════════════════════════════════════════════════
//  EQUATION BUILDER
// ═══════════════════════════════════════════════════════════════

// Module-level one-shot dice-roll sound for use inside EquationBuilder
// (EquationBuilder doesn't own the main diceSoundRef, so we use a simple
// fire-and-forget helper here).
async function _playDiceRollOneShot(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(require('./assets/dice_roll.m4a'));
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (_e) {
    // silent fail — sound is non-critical
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = hex.replace('#', '');
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function mixHexColor(fromHex: string, toHex: string, t: number): string {
  const c1 = hexToRgb(fromHex);
  const c2 = hexToRgb(toHex);
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(c1.r + (c2.r - c1.r) * k);
  const g = Math.round(c1.g + (c2.g - c1.g) * k);
  const b = Math.round(c1.b + (c2.b - c1.b) * k);
  return `rgb(${r},${g},${b})`;
}

function withAlpha(rgb: string, a: number): string {
  return rgb.replace('rgb(', 'rgba(').replace(')', `,${Math.max(0, Math.min(1, a))})`);
}

function timerProgressColor(progress: number): string {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0.5) return mixHexColor('#16A34A', '#FACC15', p / 0.5);
  return mixHexColor('#FACC15', '#DC2626', (p - 0.5) / 0.5);
}


export type EquationBuilderRef = { resetAll: () => void } | null;
// ─── Exports for src/bot/ (single-player vs bot feature) ──────────────────
// See docs/superpowers/plans/2026-04-11-single-player-vs-bot.md
export { gameReducer, initialState, validateFractionPlay, validateIdenticalPlay, validateStagedCards, fractionDenominator };
export { GameProvider, useGame };
export type { GameState, GameAction, Card, Player, Operation, Fraction, CardType, GamePhase, DiceResult, EquationOption };
// EquationCommitPayload is exported above, near the GameAction union definition.
const EquationBuilder = forwardRef<EquationBuilderRef, { onConfirmChange?: (data: { onConfirm: () => void } | null) => void; onResultChange?: (data: { result: number | null; ok: boolean; hasError: boolean } | null) => void; timerProgress?: number | null; interactive?: boolean; parensRight?: boolean; onParensRightChange?: (v: boolean) => void }>(function EquationBuilder({ onConfirmChange, onResultChange, timerProgress = null, interactive = true, parensRight: parensRightProp, onParensRightChange }, ref) {
  const { state, dispatch } = useGame();
  const { t } = useLocale();

  // Lesson 5 is the "all four signs" lesson — the whole point is cycling
  // through +, −, ×, ÷. The tutorial game starts with enabledOperators=['+']
  // so without this override the cycle would loop on + only. Check BOTH the
  // guided-mode flag AND the L5a block-fan-taps flag: either one being on is
  // proof the learner is inside lesson 5, and both are now wired to notify
  // the UI so this re-derives on the very next render.
  // Lesson 7 (parens): same — learners must cycle both operator slots; L7
  // guided mode must not be stuck on '+'-only from tutorial boot state.
  const isTutorialFullOpCycle =
    state.isTutorial &&
    (tutorialBus.getL5GuidedMode() ||
      tutorialBus.getL5aBlockFanTaps() ||
      tutorialBus.getL7GuidedMode() ||
      tutorialBus.getL9ParensFilter());
  const eqOpChoices = isTutorialFullOpCycle
    ? buildEqOpDisplayCycle(['+', '-', 'x', '÷'])
    : buildEqOpDisplayCycle(state.enabledOperators);

  // Dice placement: index into diceValues (0-2), or null — starts empty, player fills manually
  const [dice1, setDice1] = useState<number | null>(null);
  const [dice2, setDice2] = useState<number | null>(null);
  const [dice3, setDice3] = useState<number | null>(null);
  // Operators: null = empty, tap-to-cycle through allowed ops for current stage
  const [op1, setOp1] = useState<string | null>(null);
  const [op2, setOp2] = useState<string | null>(null);
  const l5SeenCycleOpsRef = useRef<Set<Operation>>(new Set());
  // Parentheses mode: false = (d1 op1 d2) op2 d3  |  true = d1 op1 (d2 op2 d3)
  const [parensRightLocal, setParensRightLocal] = useState<boolean>(false);
  const parensRight = parensRightProp ?? parensRightLocal;
  const setParensRight: React.Dispatch<React.SetStateAction<boolean>> = (v) => {
    const next = typeof v === 'function' ? (v as (p: boolean) => boolean)(parensRight) : v;
    if (onParensRightChange) onParensRightChange(next);
    else setParensRightLocal(next);
  };
  // resultsOpen removed — possible results moved to SLOT 2

  // Result animation
  const resultFade = useRef(new Animated.Value(0)).current;
  // Tutorial-only: pulsing halo around the green result box once the
  // equation is solvable (`ok`), so the learner sees the target value.
  const tutorialResultPulse = useRef(new Animated.Value(0)).current;
  // Real-game: small pulse on the result box once the equation is confirmed
  // (`isSolved`) — draws the eye to the final answer while the rest of the
  // builder dims to opacity 0.5.
  const solvedResultPulse = useRef(new Animated.Value(0)).current;
  /** Bumps when tutorialBus L5 flags change (module-level). */
  const [l5UiTick, setL5UiTick] = useState(0);
  useEffect(() => tutorialBus.subscribeL5Ui(() => setL5UiTick((n) => n + 1)), []);

  // Tutorial op-button pulse: driven by tutorialBus so InteractiveTutorialScreen
  // can animate the empty operator slot without prop-drilling.
  const [opPulse, setOpPulse] = useState(tutorialBus.getOpButtonPulse());
  useEffect(() => {
    return tutorialBus.subscribeOpButtonPulse(setOpPulse);
  }, []);

  // Tutorial-only: 4 inward-pointing arrows converge on each empty op slot
  // so the learner sees EXACTLY where to drop the picked card. Used in two
  // situations:
  //   • L5.2 (joker): after the learner picks a sign inside the joker
  //     modal and the joker card is waiting for placement.
  //   • L5.1 (place-op): as soon as the learner picks any operation card
  //     from the fan, the target empty slot lights up with arrows so
  //     they don't have to guess where the card goes.
  const jokerArrowsPulse = useRef(new Animated.Value(0)).current;
  const showJokerArrows =
    !!state.isTutorial && (
      (state.equationHandPick?.card?.type === 'joker' && state.equationHandPick?.jokerAs != null) ||
      (tutorialBus.getL5aTargetResult() !== null && state.equationHandPick?.card?.type === 'operation')
    );
  useEffect(() => {
    if (!showJokerArrows) {
      jokerArrowsPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(jokerArrowsPulse, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(jokerArrowsPulse, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showJokerArrows, jokerArrowsPulse]);

  // Drop-in animation: one Animated.Value per dice (0=hidden, 1=visible)
  const dropAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const eqRowAnim = useRef(new Animated.Value(0)).current;
  // Flip animation: 0=dice face visible, 1=number visible
  const flipAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const [showingFace, setShowingFace] = useState([true, true, true]);

  // Reset on new dice roll + trigger staggered drop-in → pause → flip → equation
  const diceKey = state.dice ? `${state.diceRollSeq}-${state.dice.die1}-${state.dice.die2}-${state.dice.die3}` : '';
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    // Clear any pending timers from previous roll
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    setDice1(null); setDice2(null); setDice3(null);
    setOp1(null); setOp2(null);
    setParensRight(false);
    resultFade.setValue(0);
    if (diceKey) {
      // Reset all animations
      dropAnims.forEach(a => a.setValue(0));
      flipAnims.forEach(a => a.setValue(0));
      eqRowAnim.setValue(0);
      setShowingFace([true, true, true]);

      // Phase 1: Staggered drop-in (200ms between each)
      Animated.stagger(200,
        dropAnims.map(anim =>
          Animated.spring(anim, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true })
        )
      ).start(() => {
        // Phase 2: Show dice faces for 1.5s, then staggered flip to numbers
        const FACE_HOLD = 1500;
        const FLIP_STAGGER = 100;
        const FLIP_SHRINK = 150;

        flipAnims.forEach((anim, i) => {
          const delay = FACE_HOLD + i * FLIP_STAGGER;
          // Swap face→number at midpoint of each flip
          timersRef.current.push(setTimeout(() => {
            setShowingFace(prev => { const n = [...prev]; n[i] = false; return n; });
          }, delay + FLIP_SHRINK));
          // Run the flip animation
          timersRef.current.push(setTimeout(() => {
            Animated.sequence([
              Animated.timing(anim, { toValue: 0.5, duration: FLIP_SHRINK, easing: Easing.in(Easing.ease), useNativeDriver: true }),
              Animated.timing(anim, { toValue: 1, duration: 200, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
            ]).start();
          }, delay));
        });

        // Phase 3: Equation row slides in after all dice have flipped
        const totalFlipTime = FACE_HOLD + 2 * FLIP_STAGGER + FLIP_SHRINK + 200 + 50;
        timersRef.current.push(setTimeout(() => {
          Animated.spring(eqRowAnim, { toValue: 1, friction: 10, tension: 60, useNativeDriver: true }).start();
        }, totalFlipTime));
      });
    }
    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  }, [diceKey]);

  useEffect(() => {
    setOp1((prev) => (prev != null && eqOpChoices.indexOf(prev) === -1 ? null : prev));
    setOp2((prev) => (prev != null && eqOpChoices.indexOf(prev) === -1 ? null : prev));
  }, [eqOpChoices]);

  const showBuilder = (state.phase === 'building' || state.phase === 'solved') && state.dice && state.pendingFractionTarget === null;
  const isSolved = state.phase === 'solved';
  const diceValues = state.dice ? [state.dice.die1, state.dice.die2, state.dice.die3] : [0, 0, 0];

  // Which dice indices are placed
  const usedDice = new Set([dice1, dice2, dice3].filter(d => d !== null) as number[]);

  // Tap dice: place in next empty slot, or remove if already placed
  const hDice = (dIdx: number) => {
    if (!interactive) return;
    if (isSolved) return;
    if (usedDice.has(dIdx)) {
      if (dice1 === dIdx) setDice1(null);
      else if (dice2 === dIdx) setDice2(null);
      else if (dice3 === dIdx) setDice3(null);
      return;
    }
    // L4 step 3: block adding a 3rd die before the 2-die equation is valid.
    // Without this guard, tapping all 3 dice before setting op1 leaves
    // finalResult=null (d3 filled but no op2), so ok=false and the confirm
    // button never appears — the learner has no way to progress.
    if (
      state.isTutorial &&
      tutorialBus.getL4Step3Mode() &&
      dice1 !== null && dice2 !== null &&
      subResult === null
    ) return;
    if (dice1 === null) setDice1(dIdx);
    else if (dice2 === null) setDice2(dIdx);
    else if (dice3 === null) setDice3(dIdx);
  };

  // Tutorial-driven equation building: subscribe to bus commands so the
  // bot's "demo" can fill the equation programmatically. No-op outside tutorial.
  //
  // The subscription is STABLE — it runs once per tutorial lifecycle — and
  // reads the latest dice placements via refs. Previously the effect depended
  // on `dice1/dice2/dice3/op1/op2` and re-subscribed on every state change,
  // which raced with back-to-back `eqPickDice` emissions during the L5a
  // pre-fill and occasionally dropped one, leaving dice1 null and the op1
  // cycle button disabled (= "stuck").
  const dice1Ref = useRef<number | null>(dice1);
  const dice2Ref = useRef<number | null>(dice2);
  const dice3Ref = useRef<number | null>(dice3);
  useEffect(() => { dice1Ref.current = dice1; }, [dice1]);
  useEffect(() => { dice2Ref.current = dice2; }, [dice2]);
  useEffect(() => { dice3Ref.current = dice3; }, [dice3]);
  const finalResultRef = useRef<number | null>(null);
  useEffect(() => {
    if (!state.isTutorial) return;
    return tutorialBus.subscribeFanDemo((cmd) => {
      if (cmd.kind === 'eqPickDice') {
        // Inline placement — uses refs for the latest slot state so back-to-back
        // emissions can see each other's side effects without re-subscribing.
        const dIdx = cmd.idx;
        const d1 = dice1Ref.current, d2 = dice2Ref.current, d3 = dice3Ref.current;
        const used = new Set([d1, d2, d3].filter((d) => d !== null) as number[]);
        if (used.has(dIdx)) {
          if (d1 === dIdx) { setDice1(null); dice1Ref.current = null; }
          else if (d2 === dIdx) { setDice2(null); dice2Ref.current = null; }
          else if (d3 === dIdx) { setDice3(null); dice3Ref.current = null; }
          return;
        }
        if (d1 === null) { setDice1(dIdx); dice1Ref.current = dIdx; }
        else if (d2 === null) { setDice2(dIdx); dice2Ref.current = dIdx; }
        else if (d3 === null) { setDice3(dIdx); dice3Ref.current = dIdx; }
      } else if (cmd.kind === 'eqSetOp') {
        if (cmd.which === 1) setOp1(cmd.op);
        else setOp2(cmd.op);
      } else if (cmd.kind === 'eqConfirm') {
        tutorialBus.setLastEquationResult(finalResultRef.current);
        confirmRef.current?.();
      } else if (cmd.kind === 'eqReset') {
        // Quick clear of the slots/ops without leaving 'building' phase.
        setDice1(null); setDice2(null); setDice3(null);
        setOp1(null); setOp2(null);
        dice1Ref.current = null; dice2Ref.current = null; dice3Ref.current = null;
      }
    });
  }, [state.isTutorial]);

  // ── Lesson 5.1 self-prefill ────────────────────────────────────────────
  // The parent InteractiveTutorialScreen used to push the prefill through
  // the bus with `emitFanDemo({kind:'eqPickDice'})`, which relies on this
  // component having already subscribed when the emits fire. In practice
  // that race ran both ways: sometimes the parent effect ran before the
  // child's subscribe effect mounted, so the emits landed on an empty
  // listener set and the equation showed zero dice ("המישוואה תקועה ואין
  // שני מיספרים"). Doing the prefill inside the owner of the slot state
  // removes the race entirely.
  //
  // Gate on `tutorialBus.getL5aBlockFanTaps()` which is set exclusively in
  // L5 step 0 (see InteractiveTutorialScreen). `l5UiTick` forces this
  // effect to re-run when the bus flags flip. Running while `state.dice`
  // is populated and all local slots are empty makes it idempotent — once
  // the slots fill, the effect exits on the next pass.
  useEffect(() => {
    if (!state.isTutorial) return;
    if (state.phase !== 'building') return;
    if (!state.dice) return;
    if (!tutorialBus.getL5aBlockFanTaps()) return;
    // L5.1: equation starts empty — learner places dice manually (no prefill).
    // L5.2: prefill d1+d2 so the layout mirrors 5.1.
    if (tutorialBus.getL5aDiceUnlocked()) {
      // Only clear stale operator values left over from L4.
      setOp1(null);
      setOp2(null);
      return;
    }
    // If dice slots are already filled, the learner may have started
    // interacting — bail out of the prefill. Same for hand cards already
    // placed in the operator slots.
    if (dice1 !== null || dice2 !== null || dice3 !== null) return;
    if (state.equationHandSlots[0] != null || state.equationHandSlots[1] != null) return;
    setDice1(0); dice1Ref.current = 0;
    setDice2(1); dice2Ref.current = 1;
    setOp1(null);
    setOp2(null);
  }, [state.isTutorial, state.phase, state.dice, l5UiTick, dice1, dice2, dice3, op1, op2, state.equationHandSlots]);

  // L6 (possible-results guided): pre-fill all three dice so the learner can
  // see the dice values while exploring mini cards.
  useEffect(() => {
    if (!state.isTutorial) return;
    if (state.phase !== 'building') return;
    if (!state.dice) return;
    if (!tutorialBus.getL6GuidedMode()) return;
    if (dice1 !== null || dice2 !== null || dice3 !== null) return;
    setDice1(0); dice1Ref.current = 0;
    setDice2(1); dice2Ref.current = 1;
    setDice3(2); dice3Ref.current = 2;
    setOp1(null);
    setOp2(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isTutorial, state.phase, state.dice, l5UiTick, dice1, dice2, dice3]);

  // Remove dice from a specific slot
  const removeDice = (slot: 1 | 2 | 3) => {
    if (!interactive) return;
    if (isSolved) return;
    // Lesson 5a: lock the pre-filled dice slots — only the op slots should
    // be interactive.
    if (state.isTutorial && tutorialBus.getL5aBlockFanTaps()) return;
    // L6 (possible-results): fixed reference — block dice removal.
    // L7 and L9 stage 1+ are exempt: learner places dice themselves.
    if (state.isTutorial && state.showPossibleResults && !tutorialBus.getL7GuidedMode() && !(tutorialBus.getL9ParensFilter() && !tutorialBus.getL5aBlockFanTaps())) return;
    if (slot === 1) setDice1(null);
    else if (slot === 2) setDice2(null);
    else setDice3(null);
  };

  // Cycle operator on tap — רק אופרטורים שמותרים בשלב (כמו generateValidTargets)
  const cycleOp = (which: 1 | 2) => {
    if (!interactive) return;
    if (isSolved) return;
    // Lesson 5.2 (pick & place operator card): block cycling entirely — the
    // learner must pick an operator card from their fan and drop it on the
    // slot, exactly like the real game. Tapping the `?` slot is a no-op.
    if (state.isTutorial && tutorialBus.getL5BlockOpCycle()) return;
    if (state.soundsEnabled !== false) {
      void playSfx('combo', { cooldownMs: 0, volumeOverride: 0.42 });
    }
    const cur = which === 1 ? op1 : op2;
    const idx = eqOpChoices.indexOf(cur);
    const safeIdx = idx === -1 ? 0 : idx;
    const next = eqOpChoices[(safeIdx + 1) % eqOpChoices.length];
    if (which === 1) setOp1(next);
    else setOp2(next);
    if (state.isTutorial && tutorialBus.getL5GuidedMode()) {
      const normalized = normalizeOperationToken(next);
      if (!normalized) return;
      tutorialBus.emitUserEvent({ kind: 'opSelected', op: normalized, via: 'cycle' });
      const seen = l5SeenCycleOpsRef.current;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        if (seen.size === 4) tutorialBus.emitUserEvent({ kind: 'l5AllSignsCycled' });
      }
    } else if (state.isTutorial && tutorialBus.getL7GuidedMode()) {
      const normalized = normalizeOperationToken(next);
      if (!normalized) return;
      tutorialBus.emitUserEvent({ kind: 'opSelected', op: normalized, via: 'cycle' });
    }
  };

  useEffect(() => {
    if (!state.isTutorial || !tutorialBus.getL5GuidedMode()) {
      l5SeenCycleOpsRef.current.clear();
    }
  }, [state.isTutorial, state.phase]);

  // Reset all — נגיש מבחוץ (כפתור איפוס באיזור תוצאות אפשריות)
  const hasEquationHand =
    state.equationHandPick != null || state.equationHandSlots[0] != null || state.equationHandSlots[1] != null;
  const resetAll = useCallback(() => {
    if (!interactive) return;
    if (state.phase === 'solved') dispatch({ type: 'REVERT_TO_BUILDING' });
    if (hasEquationHand) dispatch({ type: 'CLEAR_EQ_HAND' });
    setDice1(null); setDice2(null); setDice3(null);
    setOp1(null); setOp2(null);
    setParensRight(false);
    resultFade.setValue(0);
  }, [interactive, state.phase, hasEquationHand, dispatch]);
  useImperativeHandle(ref, () => ({ resetAll }), [resetAll]);

  // ── Computation: 2 קוביות L→R; 3 קוביות — evalThreeTerms (×÷ לפני +−) כמו validTargets מהשרת
  const d1v = dice1 !== null ? diceValues[dice1] : null;
  const d2v = dice2 !== null ? diceValues[dice2] : null;
  const d3v = dice3 !== null ? diceValues[dice3] : null;
  const isBotEquationAutofillTurn = (() => {
    const cp = state.players[state.currentPlayerIndex];
    if (!cp || state.phase !== 'solved' || state.hasPlayedCards) return false;
    const localBot = !!state.botConfig && state.botConfig.playerIds.includes(cp.id);
    const onlineBot = !!(cp as { isBot?: boolean }).isBot;
    return localBot || onlineBot;
  })();
  const botAutofillKeyRef = useRef<string | null>(null);
  const botAutofillTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    botAutofillTimersRef.current.forEach(clearTimeout);
    botAutofillTimersRef.current = [];
    if (!isBotEquationAutofillTurn) {
      botAutofillKeyRef.current = null;
      return;
    }
    const parsed = parseEquationDisplayForUi(state.lastEquationDisplay);
    if (!parsed) return;
    const runKey = `${state.currentPlayerIndex}|${state.lastEquationDisplay}|${state.equationResult ?? 'x'}`;
    if (botAutofillKeyRef.current === runKey) return;
    const used = [false, false, false];
    const pickIndexForValue = (value: number): number | null => {
      let idx = diceValues.findIndex((v, i) => v === value && !used[i]);
      if (idx === -1) idx = diceValues.findIndex((v) => v === value);
      if (idx === -1) return null;
      used[idx] = true;
      return idx;
    };
    const idx0 = pickIndexForValue(parsed.numbers[0] ?? Number.NaN);
    const idx1 = pickIndexForValue(parsed.numbers[1] ?? Number.NaN);
    const idx2 =
      parsed.numbers.length >= 3
        ? pickIndexForValue(parsed.numbers[2] ?? Number.NaN)
        : null;
    if (idx0 !== null && idx1 !== null) {
      botAutofillKeyRef.current = runKey;
      const stepMs = 1000;
      const playFillTone = () => {
        if (state.soundsEnabled === false) return;
        void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.24 });
      };
      const queueStep = (delayMs: number, fn: () => void) => {
        const t = setTimeout(() => {
          fn();
          playFillTone();
        }, delayMs);
        botAutofillTimersRef.current.push(t);
      };
      setParensRight(parsed.parensRight);
      queueStep(0, () => setDice1(idx0));
      queueStep(stepMs, () => setDice2(idx1));
      if (idx2 !== null) queueStep(stepMs * 2, () => setDice3(idx2));
      if (state.equationHandSlots[0] == null) {
        queueStep(idx2 !== null ? stepMs * 3 : stepMs * 2, () => setOp1(parsed.operators[0] ?? '+'));
      }
      if (state.equationHandSlots[1] == null && parsed.operators.length > 1) {
        queueStep(idx2 !== null ? stepMs * 4 : stepMs * 3, () => setOp2(parsed.operators[1] ?? null));
      }
    }
    return () => {
      botAutofillTimersRef.current.forEach(clearTimeout);
      botAutofillTimersRef.current = [];
    };
  }, [
    isBotEquationAutofillTurn,
    state.currentPlayerIndex,
    state.equationResult,
    state.lastEquationDisplay,
    state.equationHandSlots,
    state.soundsEnabled,
    diceValues[0],
    diceValues[1],
    diceValues[2],
  ]);

  // Effective operators: hand cards override local cycle when placed in position 0 or 1
  const handOp0 = getHandSlotOperation(state.equationHandSlots[0]);
  const handOp1 = getHandSlotOperation(state.equationHandSlots[1]);
  const effectiveOp1 = handOp0 ?? op1;
  const effectiveOp2 = handOp1 ?? op2;

  // Sub-expression: תלוי במצב הסוגריים. left=(d1 op1 d2), right=(d2 op2 d3)
  let subResult: number | null = null;
  if (parensRight && d2v !== null && d3v !== null && effectiveOp2 !== null) {
    subResult = applyOperation(d2v, effectiveOp2, d3v);
  } else if (!parensRight && d1v !== null && d2v !== null && effectiveOp1 !== null) {
    subResult = applyOperation(d1v, effectiveOp1, d2v);
  }

  let finalResult: number | null = null;
  if (d1v !== null && d2v !== null && effectiveOp1 !== null) {
    if (d3v !== null && effectiveOp2 !== null) {
      // כפיית סדר פעולות לפי מצב הסוגריים (מתעלם מקדימות טבעית)
      if (parensRight) {
        // d1 op1 (d2 op2 d3)
        const inner = applyOperation(d2v, effectiveOp2, d3v);
        finalResult = inner === null ? null : applyOperation(d1v, effectiveOp1, inner);
      } else {
        // (d1 op1 d2) op2 d3
        const inner = applyOperation(d1v, effectiveOp1, d2v);
        finalResult = inner === null ? null : applyOperation(inner, effectiveOp2, d3v);
      }
    } else if (d3v === null && effectiveOp2 === null) {
      finalResult = !parensRight ? subResult : applyOperation(d1v, effectiveOp1, d2v);
    } else if (
      d3v === null &&
      effectiveOp2 !== null &&
      state.equationHandSlots[1] != null &&
      handOp1
    ) {
      // קלף פעולה/סלינדה בסלוט השני אבל בלי קוביה שלישית — same as 2-dice finish; usedOps עדיין כולל את האתגר
      finalResult = !parensRight ? subResult : applyOperation(d1v, effectiveOp1, d2v);
    }
  }
  if (finalResult !== null && (typeof finalResult !== 'number' || !Number.isFinite(finalResult))) finalResult = null;
  finalResultRef.current = finalResult;

  // L7 (parens): publish both parens results whenever the equation is fully set
  // so the results strip can filter to only parens-relevant results.
  useEffect(() => {
    if (!state.isTutorial || !tutorialBus.getL7GuidedMode()) {
      tutorialBus.setL7ParensResults(null);
      return;
    }
    if (d1v === null || d2v === null || d3v === null || effectiveOp1 === null || effectiveOp2 === null) {
      tutorialBus.setL7ParensResults(null);
      return;
    }
    const innerLeft = applyOperation(d1v, effectiveOp1, d2v);
    const leftResult = innerLeft !== null ? applyOperation(innerLeft, effectiveOp2, d3v) : null;
    const innerRight = applyOperation(d2v, effectiveOp2, d3v);
    const rightResult = innerRight !== null ? applyOperation(d1v, effectiveOp1, innerRight) : null;
    const left = (leftResult !== null && Number.isFinite(leftResult)) ? leftResult : null;
    const right = (rightResult !== null && Number.isFinite(rightResult)) ? rightResult : null;
    tutorialBus.setL7ParensResults({ left, right });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isTutorial, d1v, d2v, d3v, effectiveOp1, effectiveOp2]);

  // Lesson 5 (op-cycle) is SPECIFICALLY about learning all four operators, so
  // the stage's enabledOperators restriction (which limits the rest of the
  // tutorial to `+`) must be bypassed here — otherwise cycling to −, ×, ÷
  // triggers opsDisallowed → red "error" result box instead of the actual
  // computed value, defeating the lesson.
  const l5BypassOpRestriction = !!state.isTutorial && tutorialBus.getL5GuidedMode();
  const opsDisallowed = l5BypassOpRestriction
    ? false
    : (d1v !== null && d2v !== null && effectiveOp1 !== null && !isOperationAllowedForStage(effectiveOp1, state.enabledOperators)) ||
    (d1v !== null &&
      d2v !== null &&
      d3v !== null &&
      effectiveOp1 !== null &&
      effectiveOp2 !== null &&
      !isOperationAllowedForStage(effectiveOp2, state.enabledOperators));

  // Error states
  const hasError =
    opsDisallowed ||
    (d1v !== null && d2v !== null && effectiveOp1 !== null && !parensRight && subResult === null) ||
    (d1v !== null &&
      d2v !== null &&
      d3v !== null &&
      effectiveOp1 !== null &&
      effectiveOp2 !== null &&
      finalResult === null);

  // Animate result appearance
  const prevResult = useRef<number | null>(null);
  useEffect(() => {
    if (finalResult !== null && prevResult.current !== finalResult) {
      resultFade.setValue(0.3);
      Animated.spring(resultFade, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    } else if (finalResult === null) {
      resultFade.setValue(0);
    }
    prevResult.current = finalResult;
  }, [finalResult]);

  // Validation — חייב להתאים ל־hConfirm: אחרת «בחר קלפים» מוצג אבל לחיצה לא עושה כלום
  const filledCount = [dice1, dice2, dice3].filter(d => d !== null).length;
  const eqOpReady = state.equationHandPick === null;
  const jokerCommitReady =
    (!state.equationHandSlots[0] || state.equationHandSlots[0].card.type !== 'joker' || state.equationHandSlots[0].jokerAs != null) &&
    (!state.equationHandSlots[1] || state.equationHandSlots[1].card.type !== 'joker' || state.equationHandSlots[1].jokerAs != null) &&
    (!state.equationHandPick || state.equationHandPick.card.type !== 'joker' || state.equationHandPick.jokerAs != null);
  const ok =
    finalResult !== null &&
    Number.isFinite(finalResult) &&
    finalResult >= 0 &&
    Number.isInteger(finalResult) &&
    filledCount >= 2 &&
    state.validTargets.some(t => t.result === finalResult) &&
    eqOpReady &&
    jokerCommitReady;

  // Tutorial pulse halo around the green result box, looping while
  // `ok && isTutorial` so the result stays visually drawing the eye.
  // Also: auto-confirm the equation when it becomes valid — the learner
  // doesn't need to press the orange button; the tutorial engine handles it.
  const tutorialAutoConfirmedRef = useRef(false);
  useEffect(() => {
    // Also pulse the result box in L5.1 while we're showing the target
    // number — makes the `= 7` pop visually so the learner registers it as
    // the goal before reading the bubble.
    const hasL5aTarget = state.isTutorial && tutorialBus.getL5aTargetResult() != null && finalResult === null && !hasError;
    // L6 (possible-results): the mini-cards ARE the teaching focus, so the
    // halo around the equation's result box competes for attention. Skip it
    // entirely when showPossibleResults is on AND it's not the parens lesson.
    const isL6Tutorial = state.isTutorial && state.showPossibleResults && !tutorialBus.getL7GuidedMode();
    if (!state.isTutorial || (!ok && !hasL5aTarget) || isL6Tutorial) {
      tutorialResultPulse.setValue(0);
      tutorialAutoConfirmedRef.current = false;
      return;
    }
    if (hasL5aTarget && !ok) {
      // L5.1 target phase — animate the halo around the target number, but
      // DON'T auto-confirm or fire eqReadyToConfirm (the learner hasn't
      // placed a card yet).
    } else if (tutorialBus.getL4Step3Mode()) {
      // Lesson-4 step-3 guided full build: hand control over to the learner
      // — no auto-confirm, and let the tutorial know the equation is ready
      // so it can advance its "press the confirm button" sub-phase + arrow.
      if (!isSolved) tutorialBus.emitUserEvent({ kind: 'eqReadyToConfirm' });
    } else if (tutorialBus.getL5GuidedMode()) {
      // Lesson 5: sandbox for dice + operation signs (+ joker placement) —
      // never auto-confirm into solved / card-pick flow.
      tutorialAutoConfirmedRef.current = false;
    } else if (tutorialBus.getL7GuidedMode() && !tutorialBus.getParensRightValue()) {
      // L7 (parens-move): suppress auto-confirm while parensRight=false.
      tutorialAutoConfirmedRef.current = false;
    } else if (tutorialBus.getManualEqConfirm()) {
      // Manual-confirm mode (L7 await-mimic, L9 stage 1): show button, no auto-confirm.
      tutorialAutoConfirmedRef.current = false;
    } else if (!tutorialAutoConfirmedRef.current && !isSolved) {
      // Default tutorial behaviour: auto-confirm after a brief 600ms so the
      // learner sees the green result flash before the phase switches.
      tutorialAutoConfirmedRef.current = true;
      // Store the ACTUAL result so the outcome validator knows which card
      // to accept — not just any validSum, but the specific equation result.
      tutorialBus.setLastEquationResult(finalResult);
      setTimeout(() => confirmRef.current?.(), 600);
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(tutorialResultPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(tutorialResultPulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state.isTutorial, ok, isSolved, tutorialResultPulse, l5UiTick, finalResult, hasError, state.showPossibleResults]);

  // Solved-state pulse (real game): once the user confirms the equation
  // (phase='solved') the whole builder dims to opacity 0.5 — we counter
  // that by pulsing the result box so the final answer stands out.
  useEffect(() => {
    if (!isSolved || state.isTutorial) {
      solvedResultPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(solvedResultPulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(solvedResultPulse, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isSolved, state.isTutorial, solvedResultPulse]);

  // Operations actually used בתרגיל
  const usedOps: Operation[] = [];
  if (effectiveOp1) usedOps.push(effectiveOp1 as Operation);
  if (effectiveOp2) usedOps.push(effectiveOp2 as Operation);

  // Confirm handler
  const confirmRef = useRef<() => void>(() => {});
  const hConfirm = () => {
    if (!interactive) return;
    dispatch({ type: 'RECORD_EQUATION_ATTEMPT' });
    if (!ok || finalResult === null || d1v === null || d2v === null || effectiveOp1 === null) return;
    if (state.equationHandPick) return;
    let display: string;
    if (d3v !== null && effectiveOp2 !== null) {
      // Parens position depends on parensRight toggle
      display = parensRight
        ? `${d1v} ${effectiveOp1} (${d2v} ${effectiveOp2} ${d3v}) = ${finalResult}`
        : `(${d1v} ${effectiveOp1} ${d2v}) ${effectiveOp2} ${d3v} = ${finalResult}`;
    } else {
      display = `${d1v} ${effectiveOp1} ${d2v} = ${finalResult}`;
    }
    const equationCommits: { cardId: string; position: 0 | 1; jokerAs: Operation | null }[] = [];
    for (const pos of [0, 1] as const) {
      const slot = state.equationHandSlots[pos];
      if (!slot) continue;
      if (slot.card.type === 'joker' && slot.jokerAs == null) return;
      equationCommits.push({
        cardId: slot.card.id,
        position: pos,
        jokerAs: slot.card.type === 'joker' ? slot.jokerAs : null,
      });
    }
    dispatch({
      type: 'CONFIRM_EQUATION',
      result: finalResult,
      equationDisplay: display,
      equationOps: usedOps,
      equationCommits: equationCommits.length > 0 ? equationCommits : undefined,
    });
  };
  confirmRef.current = hConfirm;

  // Notify parent about confirm readiness
  const stableConfirm = useCallback(() => confirmRef.current(), []);
  useEffect(() => {
    if (onConfirmChange) {
      onConfirmChange(ok && !isSolved && interactive ? { onConfirm: stableConfirm } : null);
    }
  }, [ok, isSolved, interactive, onConfirmChange, stableConfirm]);
  useEffect(() => () => onConfirmChange?.(null), []);

  // Notify parent about result state for rendering outside the table
  useEffect(() => {
    if (onResultChange) {
      onResultChange(showBuilder ? { result: finalResult, ok, hasError } : null);
    }
  }, [finalResult, ok, hasError, showBuilder]);
  useEffect(() => () => onResultChange?.(null), []);

  if (!showBuilder) return null;

  // When (d1 op1 d2) is complete — הצג סלוט ל־op2 ולקוביה שלישית (אפשר גם לסיים רק משתי קוביות)
  // show3rd: left mode = אחרי חישוב הזוג הראשון. right mode = אחרי שd1+op1 הוצבו
  // L7 (parens) and L9 (identical copy) always show the full 3-dice layout so
  // the learner can tap operators and dice in any order without getting stuck.
  const isParensTutorial = state.isTutorial && (tutorialBus.getL7GuidedMode() || tutorialBus.getL9ParensFilter());
  const show3rd = isParensTutorial ? true : (!parensRight
    ? subResult !== null
    : d1v !== null && effectiveOp1 !== null && d2v !== null);
  // Lesson 5 (place-op + joker) renders the FULL 3-dice equation with both
  // operator slots and the sub-result box visible. The old L5a "simplified
  // shell" was retired when cycle-signs was replaced by a card-placement
  // flow — the learner now sees a complete `(d1 + d2) + d3 = result` from
  // the moment they enter the lesson.
  const isL5aSimple = false;
  const timerColor = timerProgress !== null ? timerProgressColor(timerProgress) : null;
  const eqRowDynamicStyle = timerColor ? {
    borderColor: withAlpha(timerColor, 0.72),
    backgroundColor: withAlpha(timerColor, 0.16),
  } : null;
  const equalsColor = timerColor ?? '#FFD700';
  const resultBoxDynamic = (!hasError && !ok && timerColor) ? {
    borderColor: withAlpha(timerColor, 0.82),
    backgroundColor: withAlpha(timerColor, 0.3),
  } : null;
  const resultTextColor = ok ? '#FFF' : (timerColor ?? (state.isTutorial ? '#FFD700' : '#7C3AED'));

  // ── Render helpers ──
  const renderDiceSlot = (slotValue: number | null, slotNum: 1 | 2 | 3) => (
    <TouchableOpacity
      style={[eqS.slot, slotValue !== null ? eqS.slotFilled : eqS.slotEmpty]}
      onPress={() => slotValue !== null && removeDice(slotNum)}
      activeOpacity={0.7} disabled={isSolved}>
      {slotValue !== null
        ? <Text style={eqS.slotVal}>{diceValues[slotValue]}</Text>
        : <Text style={eqS.slotPlaceholder}>?</Text>}
    </TouchableOpacity>
  );

  const renderOpBtn = (which: 1 | 2, currentOp: string | null, enabled: boolean) => {
    const posIdx = which - 1; // 0 or 1
    const slotBinding = state.equationHandSlots[posIdx as 0 | 1];
    const isHandPlaced = slotBinding !== null;
    const isWaitingPlacement = state.equationHandPick !== null;
    const isJoker = slotBinding?.card.type === 'joker';
    const handOp = getHandSlotOperation(slotBinding);
    const displayOp = isHandPlaced && handOp ? handOp : currentOp;

    const onPress = () => {
      if (isSolved || !enabled) return;
      // L6 (possible-results): block operator taps on the pre-filled reference equation.
      // L7 (parens) and L9 (identical copy) are exempt — learner sets operators themselves.
      if (state.isTutorial && state.showPossibleResults && !tutorialBus.getL7GuidedMode() && !tutorialBus.getL9ParensFilter()) return;
      // L5.1/5.2 (place-op + joker-place): only op slot 1 (position 0) is the
      // teaching target. Block op2 entirely so the learner can't place there.
      if (state.isTutorial && tutorialBus.getL5aBlockFanTaps() && posIdx === 1) return;
      if (isHandPlaced && !isWaitingPlacement) {
        dispatch({ type: 'REMOVE_EQ_HAND_SLOT', position: posIdx as 0 | 1 });
        return;
      }
      if (isWaitingPlacement) {
        const pick = state.equationHandPick;
        const pendingJokerOp =
          pick?.card.type === 'joker'
            ? normalizeOperationToken(pick.jokerAs)
            : null;
        const placedOperatorOp =
          pick?.card.type === 'operation'
            ? normalizeOperationToken(pick.card.operation)
            : null;
        dispatch({ type: 'PLACE_EQ_OP', position: posIdx });
        if (state.isTutorial && tutorialBus.getL5GuidedMode()) {
          if (pendingJokerOp) {
            tutorialBus.emitUserEvent({ kind: 'l5JokerPlaced', op: pendingJokerOp });
            tutorialBus.emitUserEvent({ kind: 'l5JokerFlowCompleted', op: pendingJokerOp });
          } else if (placedOperatorOp) {
            // Non-joker: regular operator card dropped from hand. Used by the
            // L5.2 pick-place exercises to decide correct-vs-wrong pick.
            tutorialBus.emitUserEvent({
              kind: 'l5OperatorPlaced',
              op: placedOperatorOp,
              position: posIdx as 0 | 1,
            });
          }
        }
        return;
      }
      cycleOp(which);
    };

    // Mini card visual when hand card is placed in this slot
    if (isHandPlaced && handOp) {
      const cardCl = isJoker ? null : (opColors[handOp] ?? opColors['+']);
      const cardBorder = isJoker ? '#A78BFA' : cardCl!.face;
      const cardBg = isJoker ? '#7C3AED' : cardCl!.face;
      const symDisplay = opDisplay[handOp] ?? handOp;

      // Joker: show joker card underneath with operation card tilted on top
      if (isJoker) {
        return (
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            disabled={isSolved}
            style={[eqS.opBtn, { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' as const }]}
          >
            <View style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{
                position: 'absolute', width: 32, height: 38, borderRadius: 8,
                backgroundColor: '#FFF', borderWidth: 2, borderColor: '#A78BFA',
                alignItems: 'center', justifyContent: 'center',
                transform: [{ rotate: '-7deg' }, { translateX: -3 }, { translateY: 1 }],
              }}>
                <Text style={{ fontSize: 12 }}></Text>
              </View>
              <View style={{
                width: 32, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#FFF', borderWidth: 2, borderColor: (opColors[handOp] ?? opColors['+']).face,
                transform: [{ rotate: '7deg' }, { translateX: 3 }, { translateY: -1 }],
                ...Platform.select({
                  ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
                  android: { elevation: 3 },
                }),
              }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: (opColors[handOp] ?? opColors['+']).face }}>{symDisplay}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }

      // Regular operation card — אותו תא 52×52 כמו סלוט קובייה כדי שלא ידרס את המספרים
      return (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          disabled={isSolved}
          style={[eqS.opBtn, { alignItems: 'center', justifyContent: 'center' }]}
        >
          <View style={{
            width: 40, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#FFF', borderWidth: 2, borderColor: cardBorder,
            ...Platform.select({
              ios: { shadowColor: cardBg, shadowOpacity: 0.45, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
              android: { elevation: 3 },
            }),
          }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: cardBg }}>{symDisplay}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Android: Fredoka_700Bold doesn't include Unicode math glyphs (×, −, ÷).
    // Use ASCII substitutes to guarantee they render on every device.
    const useAsciiOps = Platform.OS === 'android';
    const normalizedDisplayOp = displayOp === 'x'
      ? (useAsciiOps ? 'x' : '×')
      : displayOp === '-'
        ? (useAsciiOps ? '-' : '−')
        : displayOp;
    const isDivision = displayOp === '÷' || displayOp === '/';
    const divCl = opColors['/'];
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          eqS.opBtn,
          displayOp ? (isDivision ? { backgroundColor: divCl.face, borderWidth: 0, ...Platform.select({ ios: { shadowColor: divCl.dark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.6, shadowRadius: 4 }, android: { elevation: 4 } }) } : eqS.opBtnFilled) : eqS.opBtnEmpty,
          !enabled && { opacity: 0.3 },
          isWaitingPlacement && !isHandPlaced && { borderColor: '#A78BFA', borderWidth: 2, borderStyle: 'dashed' as any },
        ]}
        disabled={isSolved || !enabled}>
        {isDivision ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', width: 52, height: 52 }}>
            <View style={{ position: 'absolute', top: 10, left: 23, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' }} />
            <View style={{ width: 26, height: 4, borderRadius: 2, backgroundColor: '#FFF' }} />
            <View style={{ position: 'absolute', bottom: 10, left: 23, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' }} />
          </View>
        ) : (
            <Text allowFontScaling={false} style={[normalizedDisplayOp ? eqS.opBtnFilledTxt : eqS.opBtnEmptyTxt]}>
            {normalizedDisplayOp || (tutorialBus.getL5aTargetResult() !== null ? '?' : '⬦')}
          </Text>
        )}
        {opPulse > 0 && state.isTutorial ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -4, left: -4, right: -4, bottom: -4,
              borderRadius: 16,
              borderWidth: 3,
              borderColor: '#FCD34D',
              opacity: opPulse,
              transform: [{ scale: 1 + opPulse * 0.08 }],
            }}
          />
        ) : null}
        {/* L5b joker-placement hint: 4 inward-pointing arrows inside the op
            slot, one from each side, blinking together. Shown after the
            learner picks a sign in the joker modal and before they tap the
            slot to place it. Also adds an amber halo to the slot to draw
            the eye, since the hand card's dashed border is subtle. */}
        {showJokerArrows && !isHandPlaced ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -5, left: -5, right: -5, bottom: -5,
                borderRadius: 14,
                borderWidth: 3,
                borderColor: '#FBBF24',
                opacity: jokerArrowsPulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                transform: [{ scale: jokerArrowsPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
                ...Platform.select({
                  ios: { shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 10 },
                  android: { elevation: 10 },
                }),
              }}
            />
            <Animated.Text
              allowFontScaling={false}
              pointerEvents="none"
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center',
                fontSize: 14, fontWeight: '900', color: '#FBBF24',
                opacity: jokerArrowsPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
                transform: [{ translateY: jokerArrowsPulse.interpolate({ inputRange: [0, 1], outputRange: [-2, 2] }) }],
              }}
            >▼</Animated.Text>
            <Animated.Text
              allowFontScaling={false}
              pointerEvents="none"
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center',
                fontSize: 14, fontWeight: '900', color: '#FBBF24',
                opacity: jokerArrowsPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
                transform: [{ translateY: jokerArrowsPulse.interpolate({ inputRange: [0, 1], outputRange: [2, -2] }) }],
              }}
            >▲</Animated.Text>
            <Animated.Text
              allowFontScaling={false}
              pointerEvents="none"
              style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 14, textAlign: 'center', textAlignVertical: 'center',
                fontSize: 14, fontWeight: '900', color: '#FBBF24', lineHeight: 44,
                opacity: jokerArrowsPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
                transform: [{ translateX: jokerArrowsPulse.interpolate({ inputRange: [0, 1], outputRange: [-2, 2] }) }],
              }}
            >▶</Animated.Text>
            <Animated.Text
              allowFontScaling={false}
              pointerEvents="none"
              style={{
                position: 'absolute', right: 0, top: 0, bottom: 0,
                width: 14, textAlign: 'center', textAlignVertical: 'center',
                fontSize: 14, fontWeight: '900', color: '#FBBF24', lineHeight: 44,
                opacity: jokerArrowsPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
                transform: [{ translateX: jokerArrowsPulse.interpolate({ inputRange: [0, 1], outputRange: [2, -2] }) }],
              }}
            >◀</Animated.Text>
          </>
        ) : null}
      </TouchableOpacity>
    );
  };

  const buildTitle = t('equation.buildTitle');

  // When the equation is confirmed, dim the dice pool + equation row so the
  // final answer (result box) pops. We apply this per-section instead of on
  // the whole wrap, so the result box can keep full opacity and pulse
  // without fighting a parent opacity multiplier.
  const solvedDimStyle = isSolved && !state.isTutorial ? { opacity: 0.5 } : null;

  return (
    <View style={[
      eqS.wrap,
      { transform: [{ translateX: EQUATION_BUILDER_FINE_OFFSET_X }, { translateY: EQUATION_BUILDER_FINE_OFFSET_Y }] },
    ]}>
      <View style={{ alignSelf: 'stretch', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ color: '#000000', fontSize: 14, fontWeight: '800', textAlign: 'center' }}>
          {buildTitle}
        </Text>
      </View>
      {/* Dice pool — בטוטוריאל נשאר גלוי גם אחרי האישור כדי שהשחקן
          יראה שמתוך שלוש הקוביות בחרנו שתיים בלבד (השלישית עדיין זמינה).
          חריג: בשיעור 6 (possible-results; מזוהה לפי state.showPossibleResults
          שמופעל רק שם בתוך הדרכה) מסתירים את שורת הקוביות כי התרגיל כולו
          מלא מראש והקוביות רק מסיחות את הדעת מהמיני־קלפים. */}
      {(!isSolved || state.isTutorial) && !(state.isTutorial && state.showPossibleResults && !tutorialBus.getL7GuidedMode() && !tutorialBus.getL9ParensFilter()) && (
        <View style={eqS.diceRow}>
          {diceValues.map((dv, dIdx) => {
            const isUsed = usedDice.has(dIdx);
            const dropAnim = dropAnims[dIdx];
            const flipAnim = flipAnims[dIdx];
            const isFace = showingFace[dIdx];
            // Flip: scaleX goes 1→0→1 during flip
            const flipScaleX = flipAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 0, 1],
            });
            return (
              <Animated.View key={dIdx} style={{
                opacity: dropAnim,
                transform: [
                  { translateY: dropAnim.interpolate({ inputRange: [0, 1], outputRange: [-200, 0] }) },
                  { scale: dropAnim.interpolate({ inputRange: [0, 0.5, 0.8, 1], outputRange: [1.8, 1.05, 0.9, 1] }) },
                  { scaleX: flipScaleX },
                ],
              }}>
                <TouchableOpacity onPress={() => {
                  // Lesson 5a: in step 5.2 block unplaced-die taps (dice are
                  // pre-filled). In step 5.1 the equation starts empty so the
                  // learner places dice manually — allow taps there.
                  if (state.isTutorial && tutorialBus.getL5aBlockFanTaps() && !tutorialBus.getL5aDiceUnlocked()) return;
                  // L6 (possible-results): fixed reference equation — block die taps.
                  // L7 (parens await-mimic) and L9 stage 1+ (identical copy) are exempt:
                  // the learner must place all 3 dice themselves while the strip stays open.
                  if (state.isTutorial && state.showPossibleResults && !tutorialBus.getL7GuidedMode() && !(tutorialBus.getL9ParensFilter() && !tutorialBus.getL5aBlockFanTaps())) return;
                  hDice(dIdx);
                  if (state.soundsEnabled !== false) {
                    void playSfx('combo', { cooldownMs: 0, volumeOverride: 0.42 });
                  }
                  if (state.isTutorial) {
                    tutorialBus.emitUserEvent({ kind: 'eqUserPickedDice', idx: dIdx });
                  }
                }} activeOpacity={0.7}
                  style={[
                    eqS.diceBtn,
                    isFace && eqS.diceBtnFace,
                    isUsed && eqS.diceBtnUsed,
                    // Tutorial hint: unused dice glow when the equation is
                    // partially filled, nudging the learner to tap one.
                    state.isTutorial && !isUsed && !isFace && usedDice.size > 0 && {
                      borderColor: '#FCD34D',
                      borderWidth: 3,
                      backgroundColor: 'rgba(252,211,77,0.15)',
                    },
                  ]}
                  disabled={isFace}>
                  {isFace ? (
                    <GoldDieFace value={dv} size={52} />
                  ) : (
                    <Text style={[eqS.diceBtnT, isUsed && eqS.diceBtnUsedT]}>{dv}</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* ═══ שורת משוואה: מצב סוגריים משמאל או מימין לפי parensRight ═══
          Uniform slot layout — every cell exists in BOTH modes and keeps the
          same width; only which cells are visible differs. This guarantees
          d1/d2/d3/op1/op2 stay at the exact same horizontal positions when
          the user toggles the parens, so the equation doesn't shift.
          Slot order: [L-bracket] d1 op1 [mid-bracket-open] d2 [mid-bracket-close]
                      [=] [subBox] op2 d3 [R-bracket] */}
      <View style={[{ width: '100%' }, solvedDimStyle]}>
      <Animated.View style={{ width: '100%', maxWidth: '100%', alignItems: 'center', opacity: eqRowAnim, transform: [{ translateY: eqRowAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
        <View style={[eqS.eqRow, eqRowDynamicStyle]}>
          {(() => {
            const bColor = '#F97316';
            const renderBracket = (char: '(' | ')', visible: boolean) => (
              <Text
                style={[eqS.bracket, { color: bColor }, !visible && eqS.hiddenMiddle]}
                allowFontScaling={false}
              >
                {char}
              </Text>
            );
            const midEqVisible = !parensRight && show3rd;
            return (
              <>
                {/* outer left bracket — visible only in LEFT mode. Hidden in
                    L5a so the learner sees just `[d1] [?] [d2]`. */}
                {show3rd && !isL5aSimple ? renderBracket('(', !parensRight) : null}
                {/* d1 + op1 (kept as a chunk for inner gap). Op1 is always
                    tappable in L5a — even if dice1 hasn't been prefilled yet
                    (bus race) — so the sign-cycle never feels stuck. */}
                <View style={eqS.eqChunk}>
                  {renderDiceSlot(dice1, 1)}
                  {renderOpBtn(1, op1, isL5aSimple || dice1 !== null || isParensTutorial)}
                </View>
                {/* mid-open bracket — visible only in RIGHT mode (before d2) */}
                {show3rd && !isL5aSimple ? renderBracket('(', parensRight) : null}
                {/* d2 — always at the same column position */}
                <View style={[!show3rd && !state.isTutorial && { opacity: 0.25 }]}>{renderDiceSlot(dice2, 2)}</View>
                {/* mid-close bracket — visible only in LEFT mode (after d2) */}
                {show3rd && !isL5aSimple ? renderBracket(')', !parensRight) : null}
                {/* = + subResultBox — visible only in LEFT mode. Also hidden
                    during lesson 5a so the learner sees just `[a] [?] [b]`. */}
                {show3rd && !isL5aSimple ? (
                  <>
                    <Text
                      style={[eqS.equalsSmall, (!midEqVisible || subResult === null) && eqS.hiddenMiddle]}
                      allowFontScaling={false}
                    >=</Text>
                    <View style={[eqS.subResultBox, !midEqVisible && eqS.hiddenMiddle]} pointerEvents={midEqVisible ? 'auto' : 'none'}>
                      <Text
                        style={[eqS.subResultVal, (!midEqVisible || subResult === null) && eqS.hiddenMiddle]}
                        allowFontScaling={false}
                      >
                        {midEqVisible && subResult !== null ? String(subResult) : '0'}
                      </Text>
                    </View>
                  </>
                ) : null}
                {/* op2 + d3 (kept as a chunk for inner gap). Lesson 5a hides
                    the whole chunk — the third slot + second op belong to the
                    advanced equation and would confuse the sign-cycle lesson. */}
                {isL5aSimple ? null : (
                  <View style={[eqS.eqChunk, !show3rd && !state.isTutorial && { opacity: 0.25 }]}>
                    {renderOpBtn(2, op2, show3rd)}
                    {renderDiceSlot(dice3, 3)}
                  </View>
                )}
                {/* outer right bracket — visible only in RIGHT mode */}
                {show3rd && !isL5aSimple ? renderBracket(')', parensRight) : null}
              </>
            );
          })()}
        </View>
      </Animated.View>
      </View>
      {/* תוצאת התרגיל — מעט למעלה, רקע צבעוני (לא שקוף) */}
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: equalsColor }}>=</Text>
          <View style={{ position: 'relative' }}>
            {state.isTutorial && (ok || (tutorialBus.getL5aTargetResult() !== null && finalResult === null && !hasError)) ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -10, left: -10, right: -10, bottom: -10,
                  borderRadius: 18,
                  borderWidth: 3,
                  borderColor: '#FCD34D',
                  opacity: tutorialResultPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                  transform: [{ scale: tutorialResultPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
                  ...Platform.select({
                    ios: { shadowColor: '#FCD34D', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.95, shadowRadius: 14 },
                    android: { elevation: 14 },
                  }),
                }}
              />
            ) : null}
            {/* Solved-state halo — small pulsing ring around the result box,
                so the final answer stands out while the rest of the dimmed
                builder recedes. */}
            {isSolved && !state.isTutorial ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -8, left: -8, right: -8, bottom: -8,
                  borderRadius: 16,
                  borderWidth: 3,
                  borderColor: hasError ? '#FCA5A5' : '#86EFAC',
                  opacity: solvedResultPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] }),
                  transform: [{ scale: solvedResultPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
                  ...Platform.select({
                    ios: { shadowColor: hasError ? '#F87171' : '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 12 },
                    android: { elevation: 12 },
                  }),
                }}
              />
            ) : null}
            {(() => {
              // Lesson 5.1: when no finalResult yet, surface the target
              // number ("= 7") the learner is aiming for, so they know which
              // operator card to pick. Once the learner drops a card and
              // finalResult becomes non-null, fall back to the normal render
              // (green/red box reflects correctness against validTargets).
              const l5aTarget = state.isTutorial ? tutorialBus.getL5aTargetResult() : null;
              const showL5aTarget = l5aTarget !== null && finalResult === null && !hasError;
              return (
                <Animated.View style={[
                  {
                    minWidth: 76, height: 48, borderRadius: 12, borderWidth: 2,
                    // L5.1 target uses the same strong `ok`-style green fill
                    // as a solved answer — the earlier pale-mint rendering
                    // faded into the background; reusing the solved palette
                    // keeps the number visually prominent so it reads as
                    // "the goal", not as a disabled hint.
                    borderColor: hasError ? '#B91C1C' : ok ? '#15803D' : showL5aTarget ? '#15803D' : (state.isTutorial ? 'rgba(124,58,237,0.95)' : '#A16207'),
                    backgroundColor: hasError ? '#DC2626' : ok ? '#166534' : showL5aTarget ? '#166534' : (state.isTutorial ? 'rgba(124,58,237,0.45)' : '#854D0E'),
                    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
                  },
                  resultBoxDynamic,
                  isSolved && !state.isTutorial && {
                    transform: [{ scale: solvedResultPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
                  },
                ]}>
                  {hasError ? (
                    <Text allowFontScaling={false} style={{ fontSize: 20, fontWeight: '900', color: '#FFF' }}>✕</Text>
                  ) : finalResult !== null ? (
                    <Animated.Text allowFontScaling={false} numberOfLines={1} style={{
                      fontSize: 26, fontWeight: '900', color: resultTextColor,
                      transform: state.isTutorial && ok
                        ? [{ scale: tutorialResultPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }]
                        : [],
                    }}>{finalResult}</Animated.Text>
                  ) : showL5aTarget ? (
                    <Animated.Text allowFontScaling={false} numberOfLines={1} style={{
                      fontSize: 28, fontWeight: '900', color: '#FFFFFF',
                      transform: [{ scale: tutorialResultPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
                    }}>{l5aTarget}</Animated.Text>
                  ) : (
                    <Text allowFontScaling={false} style={{ fontSize: 24, fontWeight: '800', color: state.isTutorial ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.4)' }}>?</Text>
                  )}
                </Animated.View>
              );
            })()}
          </View>
        </View>
      </View>


      {/* רמז: אפשר לסיים משתי קוביות בלבד (בלי השלישית) */}
      {subResult !== null && dice3 === null && op2 === null && !isSolved && (
        <Text style={{ color: '#6B7280', fontSize: 10, textAlign: 'center', fontStyle: 'italic' }}>
          {t('equation.twoDiceOnly')}
        </Text>
      )}
    </View>
  );
});
const eqS = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', alignSelf: 'center' as any, width: '100%', maxWidth: '100%', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', overflow: 'visible' as const },
  title: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  diceRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', direction: 'ltr' as any },
  diceBtn: { width: 56, height: 56, borderRadius: 14, backgroundColor: 'rgba(255,200,60,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,200,60,0.2)', overflow: 'hidden' },
  diceBtnFace: { backgroundColor: 'transparent', borderColor: 'rgba(232,184,48,0.4)', borderWidth: 2, padding: 0 },
  diceBtnUsed: { opacity: 0.25 },
  diceBtnT: { fontSize: 26, fontWeight: '800', color: '#e8d84a' },
  diceBtnUsedT: { color: 'rgba(255,200,60,0.3)' },
  /** שורת משוואה אחת — כל הסלוטים והסוגריים באותה שורה; ללא wrap */
  eqRow: {
    width: 'auto',
    maxWidth: '100%',
    alignSelf: 'center' as any,
    flexDirection: 'row',
    direction: 'ltr' as any,
    flexWrap: 'nowrap' as const,
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 2,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  /** קבוצה שלמה של סלוטים+סימנים — לא נשברת באמצע */
  eqChunk: { flexDirection: 'row', direction: 'ltr' as any, alignItems: 'center', gap: 6, flexShrink: 0 },
  bracket: { fontSize: 36, lineHeight: 44, fontWeight: '900', color: '#F97316', marginHorizontal: 1, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  equalsSmall: { fontSize: 14, fontWeight: '800', color: 'rgba(0,0,0,0.5)', marginHorizontal: 1 },
  subResultBox: {
    minWidth: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  subResultVal: { fontSize: 14, fontWeight: '800', color: '#1a1a2e' },
  hiddenMiddle: { display: 'none' as any },
  // סלוטים למספרים — 44×44 לנוחות
  slot: { width: 44, height: 44, minWidth: 44, minHeight: 44, flexShrink: 0, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' as const },
  slotFilled: { backgroundColor: '#FFF', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  slotEmpty: { borderWidth: 2, borderStyle: 'dashed' as any, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.02)' },
  slotVal: { fontSize: 24, fontWeight: '800', color: '#1a1a2e' },
  slotPlaceholder: { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.15)' },
  // כפתור פעולה — אותו גודל כמו סלוט מספר (44×44) וגופן כמו slotVal
  opBtn: { width: 44, height: 44, minWidth: 44, minHeight: 44, flexShrink: 0, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' as const },
  opBtnEmpty: { borderWidth: 2, borderStyle: 'dashed' as any, borderColor: '#F9A825', backgroundColor: 'transparent' },
  opBtnFilled: { backgroundColor: '#F9A825', ...Platform.select({ ios: { shadowColor: 'rgba(249,168,37,0.3)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6 }, android: { elevation: 4 } }) },
  opBtnEmptyTxt: { fontSize: 26, fontWeight: '800', color: '#F9A825', textAlign: 'center' as const },
  opBtnFilledTxt: { fontSize: 28, fontWeight: Platform.OS === 'android' ? '800' : '900', color: '#FFFFFF', textAlign: 'center' as const, includeFontPadding: false, lineHeight: 32 },
  eqEquals: { fontSize: 24, fontWeight: '800', color: '#FFD700', marginHorizontal: 2 },
  resultBox: { minWidth: 48, height: 52, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(124,58,237,0.95)', backgroundColor: 'rgba(124,58,237,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  resultVal: { fontSize: 26, fontWeight: '800', color: '#FFD700' },
  resultPlaceholder: { fontSize: 26, fontWeight: '800', color: 'rgba(255,215,0,0.4)' },
  resultError: { fontSize: 20, fontWeight: '900', color: '#EA4335' },
  hint: { color: '#6B7280', fontSize: 12, textAlign: 'center' },
});

// ═══════════════════════════════════════════════════════════════
//  STAGING ZONE
// ═══════════════════════════════════════════════════════════════

const STAGING_HINT_KEY = 'lulos_staging_hint_seen';

function StagingZone() {
  const { state, dispatch } = useGame();
  const [hintSeen, setHintSeen] = useState<boolean | null>(null);
  const staged = state.phase === 'solved' ? (state.stagedCards ?? []) : [];
  const hasCards = staged.length > 0;

  useEffect(() => {
    AsyncStorage.getItem(STAGING_HINT_KEY).then((v) => setHintSeen(v === 'true'));
  }, []);

  useEffect(() => {
    if (hasCards && hintSeen === false) {
      AsyncStorage.setItem(STAGING_HINT_KEY, 'true');
      setHintSeen(true);
    }
  }, [hasCards, hintSeen]);

  if (state.phase !== 'solved' || state.equationResult === null || state.hasPlayedCards || state.pendingFractionTarget !== null) return null;

  const target = state.equationResult!;
  const maxW = state.mathRangeMax ?? 25;
  const numberAndWild = staged.filter(c => c.type === 'number' || c.type === 'wild');
  const stOpCard = staged.filter(c => c.type === 'operation')[0] ?? null;
  const hasWild = numberAndWild.some(c => c.type === 'wild');
  const wildVal = hasWild ? computeWildValueInStaged(numberAndWild, stOpCard, target, maxW) : null;
  const sum = numberAndWild.reduce((s, c) => s + (c.type === 'number' ? (c.value ?? 0) : (wildVal ?? 0)), 0);
  const matches = hasCards && validateStagedCards(numberAndWild, stOpCard, target, maxW);

  const clearAll = () => { staged.forEach(c => dispatch({type:'UNSTAGE_CARD',card:c})); };

  /* שורת "נבחר" מוצגת ב־bottom: 500 (מעל טווח 365–465); הודעות בהאזור 365–465 בוטלו */
  return <View style={szS.wrap} />;
}
const szS = StyleSheet.create({
  wrap:{backgroundColor:'transparent',borderRadius:0,padding:12,alignItems:'center',gap:8,borderWidth:0,borderColor:'transparent'},
  hint:{color:'#6B7280',fontSize:12,textAlign:'center'},
  undoBtn:{marginLeft:4,width:32,height:32,borderRadius:16,backgroundColor:'rgba(239,68,68,0.2)',alignItems:'center',justifyContent:'center'},
});

// ═══════════════════════════════════════════════════════════════
//  ACTION BAR
// ═══════════════════════════════════════════════════════════════

function ActionBar() {
  const { state, dispatch } = useGame();
  const { t } = useLocale();
  const cp = state.players[state.currentPlayerIndex]; if (!cp) return null;
  const pr=state.phase==='pre-roll', bl=state.phase==='building', so=state.phase==='solved', hp=state.hasPlayedCards;
  return (
    <View style={{width:'100%',gap:10}}>
      {(pr||bl||so)&&hp && !state.isTutorial && (
        <View style={{alignItems:'center',gap:6}}>
          <LulosButton text={t('game.endTurn')} color="green" width={160} height={52} onPress={()=>dispatch({type:'END_TURN'})} />
        </View>
      )}
      <AppModal visible={state.jokerModalOpen} onClose={()=>dispatch({type:'CLOSE_JOKER_MODAL'})} title={t('game.pickJokerOp')}>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,justifyContent:'center'}}>
          {(['+','-','x','÷'] as Operation[]).map(op => <LulosButton key={op} text={op} color="blue" width={100} height={64} fontSize={30} onPress={()=>{const j=state.selectedCards[0];if(!j)return;if(state.phase==='building'){if(state.isTutorial&&tutorialBus.getL5GuidedMode()){tutorialBus.emitUserEvent({kind:'l5JokerPickedInModal',op});tutorialBus.emitUserEvent({kind:'opSelected',op,via:'joker'});}dispatch({type:'SELECT_EQ_JOKER',card:j,chosenOperation:op});}else{dispatch({type:'PLAY_JOKER',card:j,chosenOperation:op});}}} />)}
        </View>
      </AppModal>
    </View>
  );
}
const aS = StyleSheet.create({ opS:{backgroundColor:'transparent',borderWidth:0,borderColor:'transparent',borderRadius:0,padding:12}, opT:{color:'#FDBA74',fontSize:13,fontWeight:'600',marginBottom:4}, opH:{color:'#9CA3AF',fontSize:11,marginBottom:8} });

// ═══════════════════════════════════════════════════════════════
//  CARD FAN — carousel/wheel with swipe + tap-to-select
//  Fan pivot below visible cards, center card enlarged with glow
// ═══════════════════════════════════════════════════════════════

const FAN_CARD_W = 100;
const FAN_CARD_H = 140;
const FAN_MAX_ANGLE = 30;
const FAN_CENTER_SCALE = 1.15;
const FAN_EDGE_SCALE = 0.82;
const FAN_DECEL = 0.92;
const FAN_MIN_SPACING = 0.4;
const FAN_MAX_SPACING = 1.6;
const FAN_DEFAULT_SPACING = 1.0;
const PINCH_CARD_THRESHOLD = 8;
const FAN_DRAG_START_DX = 6;

function SimpleHand({ cards, stagedCardIds, equationHandPlacedIds, equationHandPendingId, defenseValidCardIds, forwardCardId: _forwardCardId, onTap, onCenterCard, waitingMode = false, botTeachingActive = false, botCandidateCardId = null, botTeachingDifficulty = 'medium' }: {
  cards: Card[];
  stagedCardIds: Set<string>;
  equationHandPlacedIds: Set<string>;
  equationHandPendingId: string | null;
  defenseValidCardIds: Set<string> | null;
  forwardCardId: string | null;
  onTap: (card: Card) => void;
  onCenterCard?: (card: Card | null) => void;
  waitingMode?: boolean;
  botTeachingActive?: boolean;
  botCandidateCardId?: string | null;
  botTeachingDifficulty?: BotDifficulty;
}) {
  const count = cards.length;
  useEffect(() => {
    tutorialBus.setFanLength(count);
  }, [count]);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(0);

  // Center card glow pulse — slow gentle breathing
  const centerGlowPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(centerGlowPulse, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(centerGlowPulse, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const waitingPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!waitingMode) {
      waitingPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(waitingPulse, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(waitingPulse, { toValue: 0, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [waitingMode, waitingPulse]);
  // Tutorial L5a emphasis: scale+lift the op card matching the learner's
  // current cycle selection. Clears when lesson 5a unmounts.
  const [emphasizedCardPrefix, setEmphasizedCardPrefix] = React.useState<string | null>(
    tutorialBus.getEmphasizedCardId(),
  );
  React.useEffect(() => {
    return tutorialBus.subscribeEmphasizedCard(setEmphasizedCardPrefix);
  }, []);
  const emphasisPulse = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!emphasizedCardPrefix) {
      emphasisPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(emphasisPulse, { toValue: 1, duration: 650, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(emphasisPulse, { toValue: 0, duration: 650, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [emphasizedCardPrefix, emphasisPulse]);
  // Sparkling halo for the currently-picked hand card (equationHandPick).
  // A static purple ring was too easy to miss once the learner's eye
  // settled on the equation builder; the pulse signals "this card is
  // selected, drop it somewhere" without adding more UI chrome.
  const pickedHaloPulse = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!equationHandPendingId) {
      pickedHaloPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pickedHaloPulse, { toValue: 1, duration: 550, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(pickedHaloPulse, { toValue: 0, duration: 550, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [equationHandPendingId, pickedHaloPulse]);

  // Scroll the fan to bring the emphasized card to the center when the
  // learner cycles ops in L5a. scrollX maps 1:1 to card index, so
  // toValue === matchingIdx centers that card.
  React.useEffect(() => {
    if (!emphasizedCardPrefix) return;
    const matchingIdx = cards.findIndex((c) => c.id.startsWith(emphasizedCardPrefix));
    if (matchingIdx < 0) return;
    Animated.spring(scrollX, {
      toValue: matchingIdx,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [emphasizedCardPrefix, cards, scrollX]);

  const botScanOffset = useRef(new Animated.Value(0)).current;
  const botScanAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const botPickAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  // Sweep guard: one sweep per activation of botTeachingActive. Resets
  // back to false the instant the bot's turn ends. Everything the sweep
  // needs (current cards, current candidate) is read via refs so neither
  // prop change can retrigger the effect and snap the fan back to 0.
  const sweepStartedRef = useRef(false);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const countRef = useRef(cards.length);
  countRef.current = cards.length;
  const botCandidateIdRef = useRef<string | null>(botCandidateCardId);
  botCandidateIdRef.current = botCandidateCardId;
  const [pressedCardId, setPressedCardId] = useState<string | null>(null);
  // Tutorial-only: when the demo bot "picks" a card, render a thick
  // golden frame around that exact card so the learner sees the choice.
  const [tutorialFrameCardId, setTutorialFrameCardId] = useState<string | null>(null);
  // Tutorial-only gate: only emit fanScrolled when the scroll comes
  // from a real user pan gesture (not from the bot's animation, not
  // from a card tap that happens to recenter the fan).
  const userScrollGestureRef = useRef(false);
  const userScrollGestureClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botTapAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const stopScan = () => {
      if (botScanAnimRef.current) {
        botScanAnimRef.current.stop();
        botScanAnimRef.current = null;
      }
      if (botPickAnimRef.current) {
        botPickAnimRef.current.stop();
        botPickAnimRef.current = null;
      }
    };
    if (!botTeachingActive) {
      stopScan();
      botScanOffset.stopAnimation();
      botScanOffset.setValue(0);
      if (botTapAnimTimerRef.current) {
        clearTimeout(botTapAnimTimerRef.current);
        botTapAnimTimerRef.current = null;
      }
      setPressedCardId(null);
      sweepStartedRef.current = false;
      return;
    }
    // One sweep per activation. Later prop re-renders (cards identity,
    // candidate-card change, etc.) must not restart it — they read from
    // refs inside the callbacks instead.
    if (sweepStartedRef.current) return;
    sweepStartedRef.current = true;
    let cancelled = false;
    // סריקה: ימין עד הסוף → השהיה → שמאל עד הסוף → השהיה → התיישבות באמצע.
    // בסיום — אם יש קלף מועמד — אנימציית בחירה נפרדת (לא חלק מהסריקה, כדי
    // שלא נריץ מחדש את כל הרצף כשה-candidate מגיע באיחור).
    const initialCount = countRef.current;
    if (initialCount <= 1) {
      botScanOffset.setValue(0);
      return () => {
        cancelled = true;
        stopScan();
      };
    }
    const last = initialCount - 1;
    const mid = Math.floor(last / 2);
    const start = scrollRef.current;
    const toOffset = (absIdx: number): number => absIdx - start;
    botScanOffset.setValue(0);
    const sweep = Animated.sequence([
      Animated.timing(botScanOffset, {
        toValue: toOffset(last),
        duration: 900,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.sin),
      }),
      Animated.delay(400),
      Animated.timing(botScanOffset, {
        toValue: toOffset(0),
        duration: 900,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.sin),
      }),
      Animated.delay(400),
      Animated.timing(botScanOffset, {
        toValue: toOffset(mid),
        duration: 700,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]);
    botScanAnimRef.current = sweep;
    sweep.start(({ finished }) => {
      if (cancelled || !finished) return;
      botScanAnimRef.current = null;
      const candidateId = botCandidateIdRef.current;
      if (!candidateId) return;
      const targetIdx = cardsRef.current.findIndex((c) => c.id === candidateId);
      if (targetIdx < 0) return;
      const pick = Animated.sequence([
        Animated.delay(180),
        Animated.timing(botScanOffset, {
          toValue: targetIdx - scrollRef.current,
          duration: 420,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]);
      botPickAnimRef.current = pick;
      pick.start(({ finished: pickFinished }) => {
        botPickAnimRef.current = null;
        if (cancelled || !pickFinished) return;
        setPressedCardId(candidateId);
        if (botTapAnimTimerRef.current) clearTimeout(botTapAnimTimerRef.current);
        botTapAnimTimerRef.current = setTimeout(() => {
          setPressedCardId((prev) => (prev === candidateId ? null : prev));
          botTapAnimTimerRef.current = null;
        }, 260);
      });
    });
    return () => {
      cancelled = true;
      stopScan();
    };
  }, [botTeachingActive, botScanOffset]);

  // ── Follow botCandidateCardId changes: once the initial sweep has
  //    finished, animate botScanOffset so each subsequent candidate card
  //    (e.g. operator picked after the number) slides to the visual centre.
  //    While the sweep itself is still running we leave it alone; the sweep's
  //    own completion callback handles the very first pick.
  useEffect(() => {
    if (!botTeachingActive) return;
    if (!botCandidateCardId) return;
    if (botScanAnimRef.current) return; // sweep still in flight — it handles this pick
    const targetIdx = cardsRef.current.findIndex((c) => c.id === botCandidateCardId);
    if (targetIdx < 0) return;
    if (botPickAnimRef.current) {
      botPickAnimRef.current.stop();
      botPickAnimRef.current = null;
    }
    const pick = Animated.timing(botScanOffset, {
      toValue: targetIdx - scrollRef.current,
      duration: 420,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    });
    botPickAnimRef.current = pick;
    pick.start(({ finished }) => {
      if (!finished) return;
      botPickAnimRef.current = null;
      setPressedCardId(botCandidateCardId);
      if (botTapAnimTimerRef.current) clearTimeout(botTapAnimTimerRef.current);
      botTapAnimTimerRef.current = setTimeout(() => {
        setPressedCardId((prev) => (prev === botCandidateCardId ? null : prev));
        botTapAnimTimerRef.current = null;
      }, 260);
    });
  }, [botCandidateCardId, botTeachingActive, botScanOffset]);

  const dragStartVal = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const maxIdxRef = useRef(0);
  maxIdxRef.current = Math.max(0, count - 1);

  // Pinch-to-space state
  const [spacing, setSpacing] = useState(FAN_DEFAULT_SPACING);
  const spacingRef = useRef(FAN_DEFAULT_SPACING);
  const isPinching = useRef(false);
  const pinchStartDist = useRef(0);
  const pinchStartSpacing = useRef(FAN_DEFAULT_SPACING);

  const [centerIdx, setCenterIdx] = useState(0);
  const cardIdsSignature = useMemo(() => cards.map((c) => c.id).join('|'), [cards]);
  const lastCenterIdx = useRef(-1);
  const lastPanDecisionLogAt = useRef(0);
  const pinchLoggedRef = useRef(false);
  useEffect(() => {
  }, [waitingMode, cards.length]);
  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      scrollRef.current = value;
      const idx = Math.round(Math.max(0, Math.min(cards.length - 1, value)));
      if (idx !== lastCenterIdx.current) {
        lastCenterIdx.current = idx;
        setCenterIdx(idx);
        onCenterCard?.(cards[idx] ?? null);
        // Only count as a tutorial "fan scrolled" event when the change came
        // from a real user drag — not from bot demos or programmatic recentre.
        if (userScrollGestureRef.current) {
          tutorialBus.emitUserEvent({ kind: 'fanScrolled', toIdx: idx });
        }
      }
    });
    return () => scrollX.removeListener(id);
  }, [scrollX, cards, onCenterCard]);

  useEffect(() => {
    const unsub = tutorialBus.subscribeFanDemo((cmd) => {
      if (cmd.kind === 'scrollToIdx') {
        const target = Math.max(0, Math.min(cards.length - 1, cmd.idx));
        if (cmd.easing) {
          const easing = cmd.easing === 'settle' ? Easing.out(Easing.cubic) : Easing.inOut(Easing.sin);
          Animated.timing(scrollX, {
            toValue: target,
            duration: cmd.durationMs ?? 900,
            useNativeDriver: true,
            easing,
          }).start();
        } else {
          Animated.spring(scrollX, { toValue: target, useNativeDriver: true, friction: 7, tension: 50 }).start();
        }
      } else if (cmd.kind === 'pulseCardIdx') {
        const target = Math.max(0, Math.min(cards.length - 1, cmd.idx));
        const card = cards[target];
        if (!card) return;
        setPressedCardId(card.id);
        setTutorialFrameCardId(card.id);
        const dur = cmd.durationMs ?? 600;
        const t = setTimeout(() => {
          setPressedCardId(null);
          setTutorialFrameCardId(null);
        }, dur);
        return () => clearTimeout(t);
      } else if (cmd.kind === 'clearCardFrame') {
        setPressedCardId(null);
        setTutorialFrameCardId(null);
      }
    });
    return unsub;
  }, [scrollX, cards]);

  useEffect(() => {
    scrollX.setValue(0);
    scrollRef.current = 0;
    lastCenterIdx.current = 0;
    setCenterIdx(0);
    onCenterCard?.(cards[0] ?? null);
  }, [count]);

  // Use refs for functions so PanResponder always sees latest
  const snapRef = useRef(() => {});
  const momentumRef = useRef(() => {});

  snapRef.current = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const target = Math.round(Math.max(0, Math.min(maxIdxRef.current, scrollRef.current)));
    Animated.spring(scrollX, { toValue: target, useNativeDriver: true, friction: 7, tension: 50 }).start();
  };

  momentumRef.current = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      velocityRef.current *= FAN_DECEL;
      if (Math.abs(velocityRef.current) < 0.005) { snapRef.current(); return; }
      let next = scrollRef.current + velocityRef.current;
      const mx = maxIdxRef.current;
      if (next < 0) { next *= 0.4; velocityRef.current *= 0.6; }
      else if (next > mx) { next = mx + (next - mx) * 0.4; velocityRef.current *= 0.6; }
      scrollX.setValue(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gs) => {
        if (evt.nativeEvent.touches.length >= 2) {
          return true;
        }
        // Only activate on a clear horizontal swipe.
        // This prevents taps (with small finger jitter) from being captured,
        // which breaks mini-card press animations and onPress handlers.
        const shouldSet = Math.abs(gs.dx) > FAN_DRAG_START_DX && Math.abs(gs.dx) > Math.abs(gs.dy) * 0.35;
        const now = Date.now();
        if (now - lastPanDecisionLogAt.current > 250) {
          lastPanDecisionLogAt.current = now;
        }
        return shouldSet;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (evt, gs) => {
        if (evt.nativeEvent.touches.length >= 2) return true;
        return Math.abs(gs.dx) > FAN_DRAG_START_DX && Math.abs(gs.dx) > Math.abs(gs.dy) * 0.35;
      },
      onPanResponderGrant: () => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        scrollX.stopAnimation();
        dragStartVal.current = scrollRef.current;
        velocityRef.current = 0;
        isPinching.current = false;
        pinchLoggedRef.current = false;
        // Mark this as a real user gesture so the scroll listener emits
        // the tutorial fanScrolled event (and stays open through the snap).
        userScrollGestureRef.current = true;
        if (userScrollGestureClearTimerRef.current) {
          clearTimeout(userScrollGestureClearTimerRef.current);
          userScrollGestureClearTimerRef.current = null;
        }
      },
      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches;

        // ── Pinch mode (2 fingers, 8+ cards) ──
        if (touches.length >= 2 && maxIdxRef.current >= PINCH_CARD_THRESHOLD - 1) {
          const tdx = touches[0].pageX - touches[1].pageX;
          const tdy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(tdx * tdx + tdy * tdy);

          if (!isPinching.current) {
            isPinching.current = true;
            pinchStartDist.current = dist;
            pinchStartSpacing.current = spacingRef.current;
            if (!pinchLoggedRef.current) {
              pinchLoggedRef.current = true;
            }
          } else {
            const scale = dist / pinchStartDist.current;
            const next = Math.max(FAN_MIN_SPACING, Math.min(FAN_MAX_SPACING, pinchStartSpacing.current * scale));
            spacingRef.current = next;
            setSpacing(next);
          }
          return; // Don't scroll while pinching
        }

        // ── Single finger scroll (FIXED: drag right = cards scroll right) ──
        if (isPinching.current) return;
        const cardsDragged = gs.dx / (FAN_CARD_W * 0.8);
        let next = dragStartVal.current + cardsDragged;
        const mx = maxIdxRef.current;
        if (next < 0) next = next * 0.3;
        else if (next > mx) next = mx + (next - mx) * 0.3;
        scrollX.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        if (isPinching.current) { isPinching.current = false; snapRef.current(); return; }
        velocityRef.current = gs.vx * 0.25;
        if (Math.abs(velocityRef.current) > 0.02) momentumRef.current();
        else snapRef.current();
        // Keep the gesture flag open through the snap/momentum animation
        // (~700ms) so the resulting center-card change still counts as user.
        if (userScrollGestureClearTimerRef.current) clearTimeout(userScrollGestureClearTimerRef.current);
        userScrollGestureClearTimerRef.current = setTimeout(() => {
          userScrollGestureRef.current = false;
          userScrollGestureClearTimerRef.current = null;
        }, 800);
      },
      onPanResponderTerminate: () => {
        isPinching.current = false;
        snapRef.current();
        if (userScrollGestureClearTimerRef.current) clearTimeout(userScrollGestureClearTimerRef.current);
        userScrollGestureClearTimerRef.current = setTimeout(() => {
          userScrollGestureRef.current = false;
          userScrollGestureClearTimerRef.current = null;
        }, 800);
      },
    })
  ).current;

  // הדגשת לחיצה על קלף־בוט מטופלת כעת באפקט הסריקה שלמעלה — כשהסריקה מסתיימת.

  if (count === 0) return <View style={{ height: 80 }} />;

  const fanH = HAND_INNER_HEIGHT;
  const sp = spacing; // pinch multiplier for translateX + angles

  return (
    <View style={{ width: SCREEN_W, height: fanH, overflow: 'visible' }} {...panResponder.panHandlers}>
      {cards.map((card, i) => {
        const isStaged = stagedCardIds.has(card.id);
        const isEqPending = equationHandPendingId === card.id;
        const isEqPlacedInSlot = equationHandPlacedIds.has(card.id);
        const isEqOp = isEqPending || isEqPlacedInSlot;
        const isDefenseValid = defenseValidCardIds !== null && defenseValidCardIds.has(card.id);
        const isDefenseInvalid = defenseValidCardIds !== null && !defenseValidCardIds.has(card.id);
        const isForward = false;
        const isBotCandidate = botTeachingActive && botCandidateCardId === card.id;
        const isTutorialFramed = tutorialFrameCardId === card.id;

        // All interpolations from scrollX directly. When scrollX===i, card i is center.
        const ir = [i - 5, i - 3, i - 2, i - 1, i, i + 1, i + 2, i + 3, i + 5];
        const scanScrollX = Animated.add(scrollX, botScanOffset);

        const maxA = FAN_MAX_ANGLE * sp;
        const rotateStr = scanScrollX.interpolate({
          inputRange: ir,
          outputRange: [
            `${-maxA}deg`, `${-maxA}deg`,
            `${-maxA * 0.75}deg`, `${-maxA * 0.35}deg`,
            '0deg',
            `${maxA * 0.35}deg`, `${maxA * 0.75}deg`,
            `${maxA}deg`, `${maxA}deg`,
          ],
        });

        const scaleBase = scanScrollX.interpolate({
          inputRange: [i - 3, i - 1, i, i + 1, i + 3],
          outputRange: [FAN_EDGE_SCALE, FAN_EDGE_SCALE + 0.04, FAN_CENTER_SCALE, FAN_EDGE_SCALE + 0.04, FAN_EDGE_SCALE],
          extrapolate: 'clamp',
        });
        const scale = isStaged ? Animated.multiply(scaleBase, 1.08) : scaleBase;

        const translateX = scanScrollX.interpolate({
          inputRange: ir,
          outputRange: [-240*sp, -175*sp, -120*sp, -62*sp, 0, 62*sp, 120*sp, 175*sp, 240*sp],
        });
        const candidateLift = isBotCandidate ? -8 : 0;
        const candidateScaleBoost = isBotCandidate ? 1.1 : 1;

        const arcY = scanScrollX.interpolate({
          inputRange: [i - 3, i - 2, i - 1, i, i + 1, i + 2, i + 3],
          outputRange: [50, 28, 10, 0, 10, 28, 50],
          extrapolate: 'clamp',
        });

        const opacity = scanScrollX.interpolate({
          inputRange: [i - 4, i - 3, i, i + 3, i + 4],
          outputRange: [0.2, 0.55, 1, 0.55, 0.2],
          extrapolate: 'clamp',
        });

        const glowOpacity = scanScrollX.interpolate({
          inputRange: [i - 0.8, i - 0.25, i, i + 0.25, i + 0.8],
          outputRange: [0, 0, 1, 0, 0],
          extrapolate: 'clamp',
        });

        const distFromCenter = Math.abs(i - centerIdx);
        const zBase = (count - distFromCenter) * 10 + i;
        const isEmphasized = !!emphasizedCardPrefix && card.id.startsWith(emphasizedCardPrefix);
        const zIndex = isBotCandidate
          ? 120000 + zBase
          : isEmphasized
            ? 20000 + zBase
            : pressedCardId === card.id
              ? 100000 + zBase
              : zBase;
        const edgeHitSlop = distFromCenter >= 2
          ? { top: 14, bottom: 14, left: 22, right: 22 }
          : { top: 10, bottom: 10, left: 10, right: 10 };

        // Emphasis lift: -18px translateY when this card is the emphasized op card.
        const emphasisLift = isEmphasized ? -18 : 0;
        // Emphasis scale boost: pulses between 1.15 and 1.15*1.08 ≈ 1.24.
        const emphasisScaleBoost = isEmphasized
          ? emphasisPulse.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1.15 * 1.08] })
          : 1;

        return (
          <Animated.View
            key={card.id}
            style={{
              position: 'absolute',
              left: SCREEN_W / 2 - FAN_CARD_W / 2,
              top: isEqPending ? 30 : isStaged ? 35 : 20,
              width: FAN_CARD_W,
              height: FAN_CARD_H,
              transform: [
                { translateX },
                { translateY: Animated.add(arcY, candidateLift + emphasisLift) },
                { rotate: rotateStr },
                {
                  scale: pressedCardId === card.id
                    ? Animated.multiply(Animated.multiply(scale, 1.06 * candidateScaleBoost), emphasisScaleBoost)
                    : Animated.multiply(Animated.multiply(scale, candidateScaleBoost), emphasisScaleBoost),
                },
              ],
              opacity,
              zIndex,
            }}
          >
            {/* Sphera glow — tight golden border ring with focused bloom */}
            <Animated.View style={{
              position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
              borderRadius: 15,
              borderWidth: 2.5, borderColor: waitingMode ? 'rgba(147,197,253,0.95)' : 'rgba(255,190,50,0.9)',
              backgroundColor: 'transparent',
              opacity: Animated.multiply(
                glowOpacity,
                waitingMode
                  ? waitingPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] })
                  : centerGlowPulse.interpolate({ inputRange:[0,1], outputRange:[0.7,1.0] }),
              ),
              ...Platform.select({
                ios: {
                  shadowColor: waitingMode ? '#60A5FA' : '#FF8C00',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: waitingMode ? 0.65 : 0.9,
                  shadowRadius: waitingMode ? 10 : 8,
                },
                android: { elevation: waitingMode ? 6 : 8 },
              }),
            }} />
            {/* Sparkling halo behind the picked equation op card — pulses
                so the "this card is selected, drop it somewhere" signal
                stays alive even after the learner looks away at the
                equation builder. Color matches the card's own border.
                Suppressed in L5a tutorial mode: the op slot already has
                the arrows+halo, so the fan halo is redundant noise. */}
            {isEqPending && tutorialBus.getL5aTargetResult() === null && (() => {
              // Normalise '÷' → '/' to match opColors key convention.
              const rawOp = card.type === 'operation' ? (card.operation ?? '+') : null;
              const opKey = rawOp === '÷' ? '/' : rawOp;
              const cl = opKey ? (opColors[opKey] ?? opColors['+']) : null;
              const face = cl?.face ?? '#A78BFA';
              // Build rgba bg from the face hex so the halo tints match the card.
              const r = parseInt(face.slice(1, 3), 16);
              const g = parseInt(face.slice(3, 5), 16);
              const b = parseInt(face.slice(5, 7), 16);
              const haloBg = `rgba(${r},${g},${b},0.28)`;
              return (
                <Animated.View style={{
                  position: 'absolute', top: -10, left: -10, right: -10, bottom: -10,
                  borderRadius: 20, backgroundColor: haloBg,
                  borderWidth: 2.5, borderColor: face,
                  opacity: pickedHaloPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                  transform: [{ scale: pickedHaloPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
                  ...Platform.select({
                    ios: { shadowColor: face, shadowOffset:{width:0,height:0}, shadowOpacity: 0.9, shadowRadius: 18 },
                    android: { elevation: 16 },
                  }),
                }} />
              );
            })()}
            {/* Green glow behind valid defense cards */}
            {isDefenseValid && (
              <View style={{
                position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
                borderRadius: 18, backgroundColor: 'rgba(52,168,83,0.35)',
                borderWidth: 2, borderColor: '#34A853',
                ...Platform.select({
                  ios: { shadowColor: '#34A853', shadowOffset:{width:0,height:0}, shadowOpacity: 0.8, shadowRadius: 14 },
                  android: { elevation: 12 },
                }),
              }} />
            )}
            {/* Tutorial demo frame — bot is "picking" this card */}
            {isTutorialFramed && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -10,
                  left: -10,
                  right: -10,
                  bottom: -10,
                  borderRadius: 20,
                  borderWidth: 4,
                  borderColor: '#FCD34D',
                  backgroundColor: 'rgba(252,211,77,0.16)',
                  ...Platform.select({
                    ios: {
                      shadowColor: '#FCD34D',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.95,
                      shadowRadius: 18,
                    },
                    android: { elevation: 16 },
                  }),
                }}
              />
            )}
            {/* Bold orange ring — קלפים שנבחרו לשילוח (שלב solved) */}
            {isStaged && !isEqPending && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -10,
                  left: -10,
                  right: -10,
                  bottom: -10,
                  borderRadius: 20,
                  borderWidth: 3,
                  borderColor: '#FF6B00',
                  backgroundColor: 'rgba(255,107,0,0.12)',
                  ...Platform.select({
                    ios: {
                      shadowColor: '#FF9100',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.95,
                      shadowRadius: 16,
                    },
                    android: { elevation: 14 },
                  }),
                }}
              />
            )}
            {isBotCandidate && !isStaged && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -9,
                  left: -9,
                  right: -9,
                  bottom: -9,
                  borderRadius: 18,
                  borderWidth: 2,
                  borderColor: '#93C5FD',
                  backgroundColor: 'rgba(59,130,246,0.16)',
                }}
              />
            )}
            {isBotCandidate && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute', top: -6, left: -6,
                  width: 26, height: 26, borderRadius: 13,
                  backgroundColor: '#2563EB',
                  borderWidth: 2,
                  borderColor: '#DBEAFE',
                  alignItems: 'center', justifyContent: 'center', zIndex: 11,
                  ...Platform.select({ ios: { shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 8 }, android: { elevation: 10 } }),
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900', textAlign: 'center' }}>
                  {card.type === 'number'
                    ? String(card.value ?? '')
                    : card.type === 'operation'
                      ? (opDisplay[card.operation ?? '+'] ?? (card.operation ?? '+'))
                      : card.type === 'joker'
                        ? '★'
                        : card.type === 'wild'
                          ? (card.resolvedValue != null ? String(card.resolvedValue) : '★')
                          : ''}
                </Text>
              </View>
            )}
            {/* Gold glow behind forwardable operation card */}
            {isForward && (
              <View style={{
                position:'absolute', top:-4, left:-4, right:-4, bottom:-4,
                borderRadius:14, borderWidth:2.5, borderColor:'#FFD700',
                opacity: 0.8,
              }} pointerEvents="none" />
            )}
            <TouchableOpacity
              activeOpacity={0.8}
              hitSlop={edgeHitSlop}
              onPressIn={() => { if (!isDefenseInvalid && !waitingMode) setPressedCardId(card.id); }}
              onPressOut={() => setPressedCardId(null)}
              onPress={() => { setPressedCardId(null); tutorialBus.emitUserEvent({ kind: 'cardTapped', cardId: card.id }); onTap(card); }}
              disabled={isDefenseInvalid || waitingMode}
            >
              <View style={[
                isStaged && { borderWidth: 3, borderColor: '#FF6B00', borderRadius: 12 },
                isEqPending && { borderWidth: 2, borderColor: '#A78BFA', borderRadius: 12 },
                isDefenseValid && { borderWidth: 2, borderColor: '#34A853', borderRadius: 12 },
              ]}>
                <GameCard card={card} selected={isStaged} small onPress={undefined} />
              </View>
            </TouchableOpacity>
            {/* Dim overlay for invalid defense cards */}
            {isDefenseInvalid && (
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)',
              }} pointerEvents="none" />
            )}
            {/* Dim overlay for placed equation op card */}
            {isEqPlacedInSlot && (
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)',
              }} pointerEvents="none" />
            )}
            {waitingMode && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 12,
                  backgroundColor: 'rgba(15,23,42,0.52)',
                  borderWidth: 1,
                  borderColor: 'rgba(147,197,253,0.35)',
                }}
                pointerEvents="none"
              />
            )}
            {isStaged && (
              <View style={{
                position: 'absolute', top: -6, right: -6,
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: '#FF6B00',
                borderWidth: 2,
                borderColor: '#FFF7ED',
                alignItems: 'center', justifyContent: 'center', zIndex: 10,
                ...Platform.select({ ios: { shadowColor: '#FF9100', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 8 }, android: { elevation: 10 } }),
              }}>
                <Text style={{ color: '#1A0A00', fontSize: 14, fontWeight: '900' }}>✓</Text>
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PLAYER HAND
// ═══════════════════════════════════════════════════════════════

function PlayerHand({ onCenterCard, onFractionTapForOnb }: { onCenterCard?: (card: Card | null) => void; onFractionTapForOnb?: () => void } = {}) {
  const { state, dispatch } = useGame();
  const { t } = useLocale();
  const soundOn = state.soundsEnabled !== false;
  const mpOpt = useMultiplayerOptional();
  const myIdx = (state as { myPlayerIndex?: number }).myPlayerIndex;
  const useOnlineMyHand = !!mpOpt?.gameOverride && typeof myIdx === 'number';
  const handPlayerIndex = useOnlineMyHand ? myIdx! : state.currentPlayerIndex;
  const isOnlineWaiting = useOnlineMyHand && state.currentPlayerIndex !== myIdx;
  const cp = state.players[handPlayerIndex];
  if (!cp) return null;
  useEffect(() => {
  }, [state.phase, state.currentPlayerIndex, handPlayerIndex, isOnlineWaiting, cp.hand.length, state.hasPlayedCards]);
  const pr=state.phase==='pre-roll', bl=state.phase==='building', so=state.phase==='solved';
  const td = state.discardPile[state.discardPile.length-1];
  const hasFracDefense = state.pendingFractionTarget !== null;
  const botTeachingPhase = getBotTeachingPhase(state);
  const isLocalBotTurn =
    !useOnlineMyHand &&
    !!state.botConfig &&
    state.botConfig.playerIds.includes(cp.id) &&
    botTeachingPhase !== 'done';
  const predictedBotAction = useMemo(() => {
    if (!isLocalBotTurn || !state.botConfig) return null;
    return decideBotAction(state, state.botConfig.difficulty, { rng: () => 0.5 });
  }, [isLocalBotTurn, state]);
  const botPredictedCardId =
    predictedBotAction?.kind === 'playFractionAttack' ||
    predictedBotAction?.kind === 'playFractionBlock' ||
    predictedBotAction?.kind === 'playIdentical' ||
    predictedBotAction?.kind === 'defendFractionSolve'
      ? predictedBotAction.cardId
      : null;
  const botCandidateCardId = useMemo(() => {
    if (!isLocalBotTurn) return null;
    if (state.botPresentation?.candidateCardId) return state.botPresentation.candidateCardId;
    if (botTeachingPhase === 'pick' || botTeachingPhase === 'place') {
      return state.botPendingStagedIds?.[0] ?? null;
    }
    return botPredictedCardId;
  }, [
    isLocalBotTurn,
    botTeachingPhase,
    state.botPendingStagedIds,
    botPredictedCardId,
    state.botPresentation?.candidateCardId,
  ]);
  const maxWildDefense = state.mathRangeMax;
  const wildDefensePickValues = useMemo(
    () => (hasFracDefense && state.fractionPenalty > 0 ? validWildValuesForFractionDefense(state.fractionPenalty, maxWildDefense) : []),
    [hasFracDefense, state.fractionPenalty, maxWildDefense],
  );
  const emptySet = useMemo(() => new Set<string>(), []);
  const [wildFracDefenseCard, setWildFracDefenseCard] = useState<Card | null>(null);
  const sorted = sortHandCards(cp.hand);
  const cardSoundRef = useRef<Audio.Sound | null>(null);
  const cardSoundLoadingRef = useRef(false);
  const fractionDefenseHintKeyRef = useRef('');
  const lastBotPredictedCueRef = useRef<string>('');
  useEffect(() => {
    if (!isLocalBotTurn || !soundOn || !botPredictedCardId) return;
    const cueKey = `${state.roundsPlayed}-${state.currentPlayerIndex}-${state.phase}-${botPredictedCardId}`;
    if (lastBotPredictedCueRef.current === cueKey) return;
    lastBotPredictedCueRef.current = cueKey;
    void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.26 });
  }, [
    isLocalBotTurn,
    soundOn,
    botPredictedCardId,
    state.roundsPlayed,
    state.currentPlayerIndex,
    state.phase,
  ]);
  // צליל בחירת קלף — קובץ: card/assets/card_select.mov (העתק מ־Downloads: "קלף אחד מקוצר.MOV" → card_select.mov)
  useEffect(() => {
    (async () => {
      if (cardSoundRef.current) return;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(require('./assets/card_select.mov'));
        cardSoundRef.current = sound;
        if (__DEV__) console.log('[card_select] נטען');
      } catch (e) {
        if (__DEV__) console.warn('[card_select] טעינה נכשלה. העתק קלף אחד מקוצר.MOV ל־card/assets/card_select.mov', e);
      }
    })();
    return () => {
      const s = cardSoundRef.current;
      if (s) s.unloadAsync().catch(() => {});
      cardSoundRef.current = null;
    };
  }, []);
  const playCardSelectSound = useCallback(() => {
    if (!soundOn) return;
    const sound = cardSoundRef.current;
    if (sound) {
      sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
      return;
    }
    if (cardSoundLoadingRef.current) return;
    cardSoundLoadingRef.current = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(require('./assets/card_select.mov'));
        cardSoundRef.current = sound;
        if (!soundOn) return;
        await sound.playAsync();
      } catch (e) {
        if (__DEV__) console.warn('[card_select] טעינה בלחיצה נכשלה.', e);
      }
      cardSoundLoadingRef.current = false;
    })();
  }, [soundOn]);
  // Mute pressed mid-playback must also silence the in-flight card-select sound.
  useEffect(() => {
    if (soundOn) return;
    const sound = cardSoundRef.current;
    if (!sound) return;
    sound.stopAsync().catch(() => {});
  }, [soundOn]);

  const tap = (card:Card) => {
    // (L5.1 (place-op) expects the learner to pick an operation card from
    // the fan, so fan-tap blocking was removed when cycle-signs was retired.)
    if (isOnlineWaiting) {
      return;
    }
    // במשחק מול הבוט — חסימת לחיצות על קלפים כשהבוט במהלכו
    if (isLocalBotTurn) return;
    console.log('CARD TAP', card.id, card.type, card.type==='operation'?card.operation:'', 'phase=', state.phase, 'hp=', state.hasPlayedCards);
    if (state.hasPlayedCards) {
      console.log('BLOCKED: hasPlayedCards'); return;
    }
    if (soundOn) playCardSelectSound();

    if (card.type === 'fraction' && !hasFracDefense) onFractionTapForOnb?.();

    // ── Fraction defense: מספר (מתחלק), פרא (בחירת ערך במודאל), או שבר; סלינדה לא מגנה ──
    // Block during tutorial bot-demo — the engine is not yet in await-mimic so
    // OUTCOME_MATCHED would be silently dropped, leaving the game stuck.
    if (hasFracDefense) {
      if (state.isTutorial && tutorialBus.getBotDemoActive()) return;
      if (
        card.type === 'number' &&
        card.value != null &&
        card.value > 0 &&
        card.value % state.fractionPenalty === 0
      ) {
        const pen = state.fractionPenalty;
        dispatch({ type: 'DEFEND_FRACTION_SOLVE', card });
        if (state.isTutorial && tutorialBus.getFracGuidedMode()) {
          tutorialBus.emitUserEvent({ kind: 'fracDefenseSolved', penaltyDenom: pen });
        }
      } else if (card.type === 'wild' && wildDefensePickValues.length > 0) {
        setWildFracDefenseCard(card);
      } else if (card.type === 'fraction') {
        if (state.isTutorial && tutorialBus.getFracGuidedMode()) {
          // Skip PLAY_FRACTION — it would pass the attack to the bot who has no defense,
          // triggering a game-over screen. The tutorial advances via the event alone.
          tutorialBus.emitUserEvent({ kind: 'fracDefenseWithFraction' });
        } else {
          const defenseHintKey = `${state.roundsPlayed}-${state.currentPlayerIndex}-${state.fractionPenalty}-${state.pendingFractionTarget ?? 0}`;
          if (fractionDefenseHintKeyRef.current !== defenseHintKey) {
            fractionDefenseHintKeyRef.current = defenseHintKey;
            dispatch({
              type: 'PUSH_NOTIFICATION',
              payload: {
                id: `frac-defense-hint-${Date.now()}`,
                title: t('fraction.challengeToastTitle'),
                message: '',
                body: `${t('fraction.counterHint')}\n\n${t('fraction.counterHintDetail')}`,
                emoji: '🛡️',
                style: 'info',
                autoDismissMs: 10000,
              },
            });
          }
          dispatch({ type: 'PLAY_FRACTION', card });
        }
      }
      return;
    }

    if (pr) {
      if (card.type === 'fraction') {
        if (fracTapIntercept.fn && fracTapIntercept.fn(card)) return;
        if (state.isTutorial && tutorialBus.getFracGuidedMode() && !hasFracDefense) {
          if (!validateFractionPlay(card, td)) return;
          dispatch({ type: 'PLAY_FRACTION', card });
          if (card.fraction) tutorialBus.emitUserEvent({ kind: 'fracAttackPlayed', fraction: card.fraction });
          return;
        }
        dispatch({ type: 'PLAY_FRACTION', card });
        return;
      }
      if (card.type !== 'operation' && card.type !== 'joker' && state.consecutiveIdenticalPlays < 2 && validateIdenticalPlay(card,td)) {
        if (state.isTutorial && tutorialBus.getBotDemoActive()) return;
        dispatch({ type: 'PLAY_IDENTICAL', card });
        if (state.isTutorial) tutorialBus.emitUserEvent({ kind: 'identicalPlayed' });
      }
      return;
    }
    if (bl) {
      if (card.type === 'operation') {
        if (state.equationHandSlots[0]?.card.id === card.id) {
          // already placed in equation — no-op
        } else if (state.equationHandSlots[1]?.card.id === card.id) {
          // already placed in equation — no-op
        } else if (state.equationHandPick?.card.id === card.id) {
          dispatch({ type: 'CLEAR_EQ_HAND_PICK' });
        } else {
          dispatch({ type: 'SELECT_EQ_OP', card });
        }
      }
      else if (card.type === 'fraction') {
        if (fracTapIntercept.fn && fracTapIntercept.fn(card)) return;
        if (state.isTutorial && tutorialBus.getFracGuidedMode() && !hasFracDefense) {
          if (!validateFractionPlay(card, td)) return;
          dispatch({ type: 'PLAY_FRACTION', card });
          if (card.fraction) tutorialBus.emitUserEvent({ kind: 'fracAttackPlayed', fraction: card.fraction });
          return;
        }
        dispatch({ type: 'PLAY_FRACTION', card });
      }
      else if (card.type === 'joker') {
        if (state.isTutorial && tutorialBus.getL5GuidedMode()) {
          tutorialBus.emitUserEvent({ kind: 'l5JokerModalOpened' });
        }
        dispatch({ type: 'OPEN_JOKER_MODAL', card });
      }
      else if (card.type === 'number' || card.type === 'wild') {
        // Tutorial: number/wild cards are display-only during building phase — no message
        if (!state.isTutorial) dispatch({ type: 'SET_MESSAGE', message: t('hand.buildingNumberWildHint') });
      }
      return;
    }
    if (so) {
      // Solved phase: number + operation + wild → stage/unstage, fraction, joker
      if(card.type==='number' || card.type==='operation' || card.type==='wild') {
        // During bot-demo in tutorial, block user staging so mid-demo taps don't corrupt state
        if (state.isTutorial && tutorialBus.getBotDemoActive() && card.type !== 'operation') return;
        const isStaged = state.stagedCards.some(c => c.id === card.id);
        if (isStaged) dispatch({type:'UNSTAGE_CARD',card});
        else dispatch({type:'STAGE_CARD',card});
      }
      else if (card.type === 'fraction') {
        if (fracTapIntercept.fn && fracTapIntercept.fn(card)) return;
        if (state.isTutorial && tutorialBus.getFracGuidedMode() && !hasFracDefense) {
          if (!validateFractionPlay(card, td)) return;
          dispatch({ type: 'PLAY_FRACTION', card });
          if (card.fraction) tutorialBus.emitUserEvent({ kind: 'fracAttackPlayed', fraction: card.fraction });
          return;
        }
        dispatch({ type: 'PLAY_FRACTION', card });
      }
      else if(card.type==='joker') dispatch({ type: 'SET_MESSAGE', message: t('joker.onlyInEquation') });
    }
  };

  const stagedIds = new Set(state.stagedCards.map(c => c.id));

  // Defense highlight: auto-highlight valid cards when fraction challenge active
  const defenseValidIds = hasFracDefense
    ? new Set<string>(
        sorted.filter(c => {
          const pen = state.fractionPenalty;
          if (c.type === 'number' && c.value != null && c.value > 0 && c.value % pen === 0) return true;
          if (c.type === 'fraction') return true;
          if (c.type === 'wild' && wildDefensePickValues.length > 0) return true;
          return false;
        }).map(c => c.id),
      )
    : null;

  const forwardCardId = null;
  const equationHandPlacedIds = new Set(
    [state.equationHandSlots[0]?.card.id, state.equationHandSlots[1]?.card.id].filter(
      (id): id is string => id != null && id !== '',
    ),
  );
  const equationHandPendingId = state.equationHandPick?.card.id ?? null;

  return (
    <>
      {(() => {
        const isRTL = true;
        return (
      <AppModal
        visible={wildFracDefenseCard !== null}
        onClose={() => setWildFracDefenseCard(null)}
        title={t('wildModal.title')}
      >
        <Text style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', marginBottom: 14, lineHeight: 20 }}>
          {t('wildModal.mustDivide', { pen: String(state.fractionPenalty), max: String(maxWildDefense) })}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {wildDefensePickValues.map((v) => (
            <LulosButton
              key={v}
              text={String(v)}
              color="green"
              width={56}
              height={48}
              fontSize={18}
              onPress={() => {
                if (wildFracDefenseCard) {
                  dispatch({ type: 'DEFEND_FRACTION_SOLVE', card: wildFracDefenseCard, wildResolve: v });
                }
                setWildFracDefenseCard(null);
              }}
            />
          ))}
        </View>
      </AppModal>
        );
      })()}
      <View style={{ width: '100%', overflow: 'visible' }} pointerEvents="box-none">
        <SimpleHand
          cards={sorted}
          stagedCardIds={(state.isTutorial && !tutorialBus.getL9ParensFilter()) ? emptySet : stagedIds}
          equationHandPlacedIds={equationHandPlacedIds}
          equationHandPendingId={equationHandPendingId}
          defenseValidCardIds={defenseValidIds}
          forwardCardId={forwardCardId}
          onTap={tap}
          onCenterCard={onCenterCard}
          waitingMode={isOnlineWaiting}
          botTeachingActive={isLocalBotTurn}
          botCandidateCardId={botCandidateCardId}
          botTeachingDifficulty={state.botConfig?.difficulty ?? 'medium'}
        />
      </View>
    </>
  );
}

function BottomControlsBar() {
  const { state, dispatch } = useGame();
  const { t } = useLocale();
  const soundOn = state.soundsEnabled !== false;
  const so = state.phase === 'solved';
  const showSolved = so && !state.hasPlayedCards;
  const hasStaged = showSolved && state.stagedCards.length > 0;

  const placeMultipleSoundRef = useRef<Audio.Sound | null>(null);
  const placeMultipleLoadingRef = useRef(false);
  useEffect(() => {
    (async () => {
      if (placeMultipleSoundRef.current) return;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(require('./assets/card_place_multiple.mp3'));
        placeMultipleSoundRef.current = sound;
      } catch (e) {
        if (__DEV__) console.warn('[card_place_multiple] טעינה נכשלה. קובץ card_place_multiple.mp3 ב־card/assets/', e);
      }
    })();
    return () => {
      const s = placeMultipleSoundRef.current;
      if (s) s.unloadAsync().catch(() => {});
      placeMultipleSoundRef.current = null;
    };
  }, []);
  const playPlaceMultipleSound = useCallback(() => {
    if (!soundOn) return;
    const sound = placeMultipleSoundRef.current;
    if (sound) {
      sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
      return;
    }
    if (placeMultipleLoadingRef.current) return;
    placeMultipleLoadingRef.current = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(require('./assets/card_place_multiple.mp3'));
        placeMultipleSoundRef.current = sound;
        if (!soundOn) return;
        await sound.playAsync();
      } catch (e) {
        if (__DEV__) console.warn('[card_place_multiple] טעינה בלחיצה נכשלה.', e);
      }
      placeMultipleLoadingRef.current = false;
    })();
  }, [soundOn]);
  useEffect(() => {
    if (soundOn) return;
    const sound = placeMultipleSoundRef.current;
    if (!sound) return;
    sound.stopAsync().catch(() => {});
  }, [soundOn]);

  const showBar = showSolved;

  const onPlaceCards = useCallback(() => {
    if (soundOn && state.stagedCards.length >= 2) playPlaceMultipleSound();
    dispatch({ type: 'CONFIRM_STAGED' });
  }, [state.stagedCards.length, dispatch, playPlaceMultipleSound, soundOn]);

  const BOTTOM_PLACE_BTN_W = 160;
  const bottomRowW = BOTTOM_PLACE_BTN_W;
  /** לפחות רוחב שורת הכפתורים + מרווח — אחרת anchor שלילי והכפתורים חופפים */
  const bottomOrbitW = Math.max(bottomRowW + 24, Math.min(SCREEN_W - 24, 400));
  const bottomAnchorLeft = (bottomOrbitW - bottomRowW) / 2;
  const barChipsDisplay = useMemo(
    () =>
      hasStaged
        ? stagedSelectionChipsDisplay(state.stagedCards, state.equationResult, state.mathRangeMax ?? 25)
        : [],
    [hasStaged, state.stagedCards, state.equationResult, state.mathRangeMax],
  );
  const barOrbitH = Math.max(
    88,
    12 + Math.ceil(barChipsDisplay.length / 2) * (STAGED_CHIP_ORBIT_H + STAGED_CHIP_ORBIT_GAP),
  );
  const barChipPositions = useMemo(
    () =>
      layoutStagedChipOrbitPositions(
        barChipsDisplay.map((c) => c.cardId),
        bottomOrbitW,
        bottomAnchorLeft,
        bottomRowW,
        barOrbitH,
      ),
    [barChipsDisplay, bottomOrbitW, bottomAnchorLeft, barOrbitH],
  );

  return (
    <View style={{minHeight:40,alignItems:'center',justifyContent:'center',paddingHorizontal:0}}>
      {showSolved ? (
        hasStaged ? (
          <View
            style={{
              width: bottomOrbitW,
              minHeight: barOrbitH,
              position: 'relative',
              alignSelf: 'center',
            }}
            pointerEvents="box-none"
          >
            <StagedChipOrbitLayer
              chips={barChipsDisplay}
              positions={barChipPositions}
              stagedCards={state.stagedCards}
              dispatch={dispatch}
              t={t}
            />
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: bottomAnchorLeft,
                top: 22,
                zIndex: 2,
                width: bottomRowW,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={[
                  { flexShrink: 0, width: BOTTOM_PLACE_BTN_W },
                  Platform.select({
                    ios: {
                      shadowColor: '#FF6B00',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.9,
                      shadowRadius: 18,
                    },
                    android: { elevation: 16 },
                  }),
                ]}
              >
                <LulosButton
                  text={t('game.placeCards')}
                  color="orange"
                  width={BOTTOM_PLACE_BTN_W}
                  height={44}
                  fontSize={15}
                  textColor="#FFFFFF"
                  onPress={onPlaceCards}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <LulosButton
              text={t('game.pickCards_revert')}
              color="blue"
              textColor="#FFFFFF"
              width={160}
              height={44}
              fontSize={17}
              onPress={() => dispatch({ type: 'REVERT_TO_BUILDING' })}
            />
          </View>
        )
      ) : null}
    </View>
  );
}


// ═══════════════════════════════════════════════════════════════
//  START SCREEN
// ═══════════════════════════════════════════════════════════════

// Floating background items data — math symbols + dice, all same white outline style
type FloatItem = { kind: 'sym'; sym: string; left: string; startY: number; size: number; speed: number; drift: number; opacity: number }
              | { kind: 'dice'; face: number; left: string; startY: number; size: number; speed: number; drift: number; opacity: number }
              | { kind: 'brand'; text: string; rtlLabel: boolean; left: string; startY: number; size: number; speed: number; drift: number; opacity: number };

const FLOAT_ITEMS: FloatItem[] = [
  // Operators
  { kind: 'sym', sym: '+', left: '8%', startY: 0.1, size: 28, speed: 1.0, drift: 12, opacity: 0.04 },
  { kind: 'sym', sym: '−', left: '25%', startY: 0.5, size: 22, speed: 1.2, drift: -8, opacity: 0.04 },
  { kind: 'sym', sym: '×', left: '50%', startY: 0.2, size: 32, speed: 0.8, drift: 15, opacity: 0.04 },
  { kind: 'sym', sym: '÷', left: '75%', startY: 0.7, size: 24, speed: 1.1, drift: -10, opacity: 0.04 },
  { kind: 'sym', sym: '+', left: '18%', startY: 0.8, size: 20, speed: 1.3, drift: 6, opacity: 0.04 },
  { kind: 'sym', sym: '−', left: '60%', startY: 0.35, size: 26, speed: 0.9, drift: -14, opacity: 0.04 },
  { kind: 'sym', sym: '×', left: '40%', startY: 0.65, size: 30, speed: 1.0, drift: 10, opacity: 0.04 },
  { kind: 'sym', sym: '÷', left: '88%', startY: 0.45, size: 22, speed: 1.15, drift: -6, opacity: 0.04 },
  // Fractions
  { kind: 'sym', sym: '½', left: '12%', startY: 0.25, size: 26, speed: 0.9, drift: -11, opacity: 0.06 },
  { kind: 'sym', sym: '¾', left: '68%', startY: 0.1, size: 24, speed: 1.05, drift: 8, opacity: 0.06 },
  { kind: 'sym', sym: '⅓', left: '33%', startY: 0.55, size: 28, speed: 0.85, drift: -13, opacity: 0.06 },
  { kind: 'sym', sym: '⅔', left: '80%', startY: 0.3, size: 22, speed: 1.25, drift: 7, opacity: 0.06 },
  { kind: 'sym', sym: '¼', left: '4%', startY: 0.7, size: 30, speed: 0.75, drift: -9, opacity: 0.06 },
  { kind: 'sym', sym: '⅛', left: '45%', startY: 0.85, size: 20, speed: 1.35, drift: 12, opacity: 0.06 },
  { kind: 'sym', sym: '⅝', left: '93%', startY: 0.4, size: 24, speed: 1.1, drift: -7, opacity: 0.06 },
  { kind: 'sym', sym: '⅕', left: '55%', startY: 0.75, size: 26, speed: 0.95, drift: 14, opacity: 0.06 },
  // Dice — same opacity/weight as symbols, colorless white outline
  { kind: 'dice', face: 6, left: '15%', startY: 0.15, size: 28, speed: 0.75, drift: 10,  opacity: 0.04 },
  { kind: 'dice', face: 3, left: '42%', startY: 0.6,  size: 22, speed: 1.1,  drift: -12, opacity: 0.04 },
  { kind: 'dice', face: 5, left: '72%', startY: 0.32, size: 26, speed: 0.85, drift: 14,  opacity: 0.05 },
  { kind: 'dice', face: 1, left: '90%', startY: 0.78, size: 20, speed: 1.2,  drift: -8,  opacity: 0.04 },
  { kind: 'dice', face: 4, left: '5%',  startY: 0.48, size: 24, speed: 0.95, drift: 11,  opacity: 0.05 },
  { kind: 'dice', face: 2, left: '58%', startY: 0.88, size: 30, speed: 0.7,  drift: -14, opacity: 0.04 },
  { kind: 'dice', face: 5, left: '32%', startY: 0.05, size: 20, speed: 1.25, drift: 7,   opacity: 0.04 },
  { kind: 'dice', face: 3, left: '82%', startY: 0.52, size: 24, speed: 0.9,  drift: -10, opacity: 0.05 },
];

// Pip positions for die face SVG (fraction of size, 0-1)
const FLOAT_PIP_POS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.7], [0.7, 0.3]],
  3: [[0.3, 0.7], [0.5, 0.5], [0.7, 0.3]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.3, 0.26], [0.7, 0.26], [0.3, 0.5], [0.7, 0.5], [0.3, 0.74], [0.7, 0.74]],
};

// Outline-only SVG die — white strokes, no fill, matches text symbol style
function FloatingDieSvg({ size, face, color }: { size: number; face: number; color: string }) {
  const pips = FLOAT_PIP_POS[face] || FLOAT_PIP_POS[1];
  const pipR = size * 0.07;
  const sw = size * 0.07; // stroke weight scales with size like font weight
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgRect
        x={sw / 2} y={sw / 2}
        width={size - sw} height={size - sw}
        rx={size * 0.18} ry={size * 0.18}
        fill="none" stroke={color} strokeWidth={sw}
      />
      {pips.map(([px, py], i) => (
        <SvgCircle
          key={i}
          cx={px * size} cy={py * size} r={pipR}
          fill={color} stroke="none"
        />
      ))}
    </Svg>
  );
}

function FloatingMathBackground() {
  const { t } = useLocale();
  const items = useMemo<FloatItem[]>(() => {
    // Higher-frequency branding: always show at least one random-language brand.
    const hebrewBrand = t('brand.salindaHebrew');
    const makeBrandItem = (): FloatItem => {
      const rtl = Math.random() < 0.5;
      return {
        kind: 'brand',
        text: rtl ? hebrewBrand : 'Salinda',
        rtlLabel: rtl,
        left: `${10 + Math.floor(Math.random() * 76)}%`,
        startY: 0.08 + Math.random() * 0.8,
        size: 13 + Math.floor(Math.random() * 4),
        speed: 1.05, // faster cycle => appears more frequently
        drift: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.floor(Math.random() * 6)),
        opacity: 0.13,
      };
    };
    const brandItems: FloatItem[] = [makeBrandItem()];
    // Often show a second logo for stronger presence.
    if (Math.random() < 0.75) brandItems.push(makeBrandItem());
    return [...FLOAT_ITEMS, ...brandItems];
  }, [t]);

  // Ensure anim arrays always cover all items (items length may change when `t` changes)
  const floatAnimsRef = useRef<Animated.Value[]>([]);
  while (floatAnimsRef.current.length < items.length) floatAnimsRef.current.push(new Animated.Value(0));
  const floatAnims = floatAnimsRef.current;
  const swayAnimsRef = useRef<Animated.Value[]>([]);
  while (swayAnimsRef.current.length < items.length) swayAnimsRef.current.push(new Animated.Value(0));
  const swayAnims = swayAnimsRef.current;

  useEffect(() => {
    items.forEach((item, i) => {
      const startPos = SCREEN_H * item.startY;
      floatAnims[i].setValue(startPos);
      const fullDur = (10000 + i * 1200) / item.speed;
      const firstDur = fullDur * ((startPos + 80) / (SCREEN_H + 80));

      Animated.timing(floatAnims[i], {
        toValue: -80, duration: firstDur, useNativeDriver: true,
      }).start(() => {
        floatAnims[i].setValue(SCREEN_H);
        Animated.loop(
          Animated.timing(floatAnims[i], { toValue: -80, duration: fullDur, useNativeDriver: true })
        ).start();
      });

      Animated.loop(
        Animated.sequence([
          Animated.timing(swayAnims[i], { toValue: item.drift, duration: 2500 + i * 300, useNativeDriver: true }),
          Animated.timing(swayAnims[i], { toValue: -item.drift, duration: 2500 + i * 300, useNativeDriver: true }),
        ])
      ).start();
    });
  }, [items, floatAnims, swayAnims]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map((item, i) => {
        const color = `rgba(255,255,255,${item.opacity})`;
        if (item.kind === 'brand') {
          return (
            <Animated.View
              key={`brand-${i}`}
              style={{
                position: 'absolute', left: item.left as any,
                transform: [
                  { translateY: floatAnims[i] },
                  { translateX: swayAnims[i] },
                ],
              }}
            >
              <View style={{ backgroundColor: 'rgba(17,24,39,0.22)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(34,211,238,0.18)' }}>
                <Text
                  style={{
                    fontSize: item.size,
                    fontWeight: '800',
                    color: `rgba(245,158,11,${item.opacity})`,
                    textAlign: 'center',
                    ...(item.rtlLabel ? ({ writingDirection: 'rtl' as const } as const) : {}),
                  }}
                >
                  {item.text}
                </Text>
              </View>
            </Animated.View>
          );
        }
        if (item.kind === 'sym') {
          return (
            <Animated.Text
              key={`sym-${i}`}
              style={{
                position: 'absolute', left: item.left as any,
                fontSize: item.size, fontWeight: '900',
                color,
                transform: [
                  { translateY: floatAnims[i] },
                  { translateX: swayAnims[i] },
                ],
              }}
            >
              {item.sym}
            </Animated.Text>
          );
        }
        return (
          <Animated.View
            key={`dice-${i}`}
            style={{
              position: 'absolute', left: item.left as any,
              transform: [
                { translateY: floatAnims[i] },
                { translateX: swayAnims[i] },
              ],
            }}
          >
            <FloatingDieSvg size={item.size} face={item.face} color={color} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function ConditionalFloatingBg() {
  const { state } = useGame();
  if (state.phase === 'pre-roll' || state.phase === 'building' || state.phase === 'solved') return null;
  return <FloatingMathBackground />;
}

function ConditionalWalkingDice() {
  const { state } = useGame();
  // GameScreen has its own WalkingDice inside ImageBackground, so skip here
  if (state.phase === 'pre-roll' || state.phase === 'building' || state.phase === 'solved') return null;
  return <WalkingDice />;
}

function ConditionalRoamingCoins() {
  const { state } = useGame();
  // GameScreen renders its own RoamingCoins layer; hide here during active play
  if (state.phase === 'pre-roll' || state.phase === 'building' || state.phase === 'solved') return null;
  return <RoamingCoins />;
}

// צלילי מספר שחקנים במסך הכניסה (2–6) — קבצים: players_2.mp3 … players_6.mp3
const PLAYER_COUNT_SOUNDS: Record<number, number> = {
  2: require('./assets/players_2.mp3'),
  3: require('./assets/players_3.mp3'),
  4: require('./assets/players_4.mp3'),
  5: require('./assets/players_5.mp3'),
  6: require('./assets/players_6.mp3'),
};

type DemoGradeBand = 'g1' | 'g2' | 'g3';
type DemoLevel = 'easy' | 'medium' | 'hard';
const DEMO_GRADE_BANDS: DemoGradeBand[] = ['g1', 'g2', 'g3'];
const DEMO_LEVELS: DemoLevel[] = ['easy', 'medium', 'hard'];

type FutureLabId = 'shield' | 'stats' | 'learning' | 'challenge4' | 'ideas' | 'power' | 'zero' | 'reroll' | 'steal';
const FUTURE_LAB_SPECS: { id: FutureLabId; detailCount: number }[] = [
  { id: 'shield', detailCount: 3 },
  { id: 'stats', detailCount: 6 },
  { id: 'learning', detailCount: 6 },
  { id: 'challenge4', detailCount: 2 },
  { id: 'ideas', detailCount: 0 },
  { id: 'power', detailCount: 4 },
  { id: 'zero', detailCount: 3 },
  { id: 'reroll', detailCount: 3 },
  { id: 'steal', detailCount: 3 },
];

function StartScreen({ onBackToChoice, onHowToPlay, onShop, onMyThemes, preferredName }: { onBackToChoice?: () => void; onHowToPlay?: () => void; onShop?: () => void; onMyThemes?: () => void; preferredName?: string }) {
  const { t, isRTL } = useLocale();
  const { dispatch, state: gameState } = useGame();
  const safe = useGameSafeArea();
  const [playerCount, setPlayerCount] = useState(2);
  const [numberRange, setNumberRange] = useState<'easy' | 'full'>('full');
  const [gameMode, setGameMode] = useState<'pass-and-play' | 'vs-bot'>('vs-bot');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [botDisplayName, setBotDisplayName] = useState('');
  // Saved human player name — loaded once from AsyncStorage so we don't
  // fall back to "שחקן 1" on every new game. Uses a ref alongside state
  // so startGame always reads the latest value, even if the user taps
  // "play" before the async load resolves.
  const savedPlayerNameRef = useRef('');
  const [, setSavedPlayerNameTrigger] = useState(0);
  useEffect(() => {
    AsyncStorage.getItem(PLAYER_SAVED_NAME_KEY).then((v) => {
      if (v) {
        savedPlayerNameRef.current = v;
        setSavedPlayerNameTrigger((n) => n + 1);
      }
    });
  }, []);
  const difficultyStage: DifficultyStageId = 'H';
  const [enabledOperators, setEnabledOperators] = useState<Operation[]>(['+', '-', 'x', '÷']);
  const [allowNegativeTargets, setAllowNegativeTargets] = useState(false);
  const [abVariant, setAbVariant] = useState<AbVariant>('control_0_12_plus');
  const [fractions, setFractions] = useState(true);
  const [fractionKinds, setFractionKinds] = useState<Fraction[]>([...ALL_FRACTION_KINDS]);
  const [showPossibleResults, setShowPossibleResults] = useState(true);
  const [showSolveExercise, setShowSolveExercise] = useState(true);
  const [timer, setTimer] = useState<'30' | '60' | 'off' | 'custom'>('off');
  const [customTimerSeconds, setCustomTimerSeconds] = useState(60);
  const [timerCustomModalOpen, setTimerCustomModalOpen] = useState(false);
  /** אם לא null — ביטול מודאל המשנה מחזיר לערך הזה; null = כבר היינו ב«מותאם» (רק עורכים שניות) */
  const timerRestoreOnCancelRef = useRef<'30' | '60' | 'off' | null>(null);
  const [guidancePromptOpen, setGuidancePromptOpen] = useState(false);
  const [guidanceOn, setGuidanceOn] = useState(false); // הדרכה והסברים — ברירת מחדל: כבוי
  const [advancedSetupOpen, setAdvancedSetupOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cardsCatalogOpen, setCardsCatalogOpen] = useState(false);
  const [futureLabOpen, setFutureLabOpen] = useState(false);
  const [benefitsDemoOpen, setBenefitsDemoOpen] = useState(false);
  const [teacherScreenOpen, setTeacherScreenOpen] = useState(false);
  const [demoGradeBand, setDemoGradeBand] = useState<DemoGradeBand>('g2');
  const [demoLevel, setDemoLevel] = useState<DemoLevel>('medium');
  const [demoClassGames, setDemoClassGames] = useState(120);
  const [demoSimRunning, setDemoSimRunning] = useState(false);
  const [demoSimTurns, setDemoSimTurns] = useState(0);
  const [demoSimProgress, setDemoSimProgress] = useState(0);
  const [demoSimResult, setDemoSimResult] = useState<'success' | 'almost' | null>(null);
  const [demoSimMessage, setDemoSimMessage] = useState('');
  const demoSimTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [teacherKpi, setTeacherKpi] = useState({
    classAccuracy: 63,
    avgTurns: 24,
    atRiskStudents: 6,
    taskCompletion: 71,
  });
  const [teacherAlertsOn, setTeacherAlertsOn] = useState(true);
  const [teacherLastAction, setTeacherLastAction] = useState('');
  const [teacherRecommendation, setTeacherRecommendation] = useState('');
  const [teacherActionLog, setTeacherActionLog] = useState<string[]>([]);
  const timerWheelOptions = useMemo((): HorizontalWheelOption[] => [
    { key: 'off', label: t('lobby.off'), accessibilityLabel: t('start.timerA11y.off') },
    { key: '30', label: t('lobby.timerSec', { n: 30 }), accessibilityLabel: t('start.timerA11y.sec30') },
    { key: '60', label: t('lobby.timerMin'), accessibilityLabel: t('start.timerA11y.min1') },
    { key: 'custom', label: t('lobby.timerCustom'), accessibilityLabel: t('start.timerA11y.custom') },
  ], [t]);
  // Minimal welcome layout: mode (0) → player count (1, pass-and-play only) → number range → guidance → advanced.
  // Indices must match the physical render order so the 3D tilt is centered on each visible row.
  const showsPlayerCountRow = gameMode === 'pass-and-play';
  const numberRangeWheelIndex = showsPlayerCountRow ? 2 : 1;
  const guidanceWheelIndex = showsPlayerCountRow ? 3 : 2;
  const advancedWheelIndex = showsPlayerCountRow ? 4 : 3;

  useEffect(() => {
    if (fractions && fractionKinds.length === 0) setFractionKinds([...ALL_FRACTION_KINDS]);
  }, [fractions, fractionKinds.length]);

  // Range 0-12: remove 1/4 and 1/5 (too few valid targets — only multiples
  // of 4 or 5 within 0-12). When switching back to 0-25, restore all.
  const allowedFractionsForRange: Fraction[] = numberRange === 'easy'
    ? ['1/2', '1/3']
    : [...ALL_FRACTION_KINDS];
  useEffect(() => {
    if (numberRange === 'easy') {
      setFractionKinds((prev) => {
        const filtered = prev.filter((f) => f === '1/2' || f === '1/3');
        return filtered.length > 0 ? filtered : ['1/2', '1/3'];
      });
    }
  }, [numberRange]);

  const toggleFractionKind = useCallback((f: Fraction) => {
    setFractionKinds((prev) => {
      if (!prev.includes(f)) return [...prev, f];
      if (prev.length <= 1) return prev;
      return prev.filter((x) => x !== f);
    });
  }, []);

  const operatorPreset: 'plusMinus' | 'mulDiv' | 'all' = useMemo(() => {
    const has = (op: Operation) => enabledOperators.includes(op);
    if (has('+') && has('-') && has('x') && has('÷')) return 'all';
    if (has('x') && has('÷') && !has('+') && !has('-')) return 'mulDiv';
    return 'plusMinus';
  }, [enabledOperators]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const key = 'beginner_ab_variant_v1';
        let saved = await AsyncStorage.getItem(key);
        if (!saved) {
          saved = Math.random() < 0.5 ? 'control_0_12_plus' : 'variant_0_15_plus';
          await AsyncStorage.setItem(key, saved);
        }
        if (cancelled) return;
        const variant = saved === 'variant_0_15_plus' ? 'variant_0_15_plus' : 'control_0_12_plus';
        setAbVariant(variant);
      } catch {
        if (!cancelled) {
          setAbVariant('control_0_12_plus');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!demoSimRunning) setDemoSimMessage(t('demoSim.pickLevel'));
  }, [t, demoSimRunning]);

  useEffect(() => {
    setTeacherLastAction(t('demoSim.teacherNoAction'));
    setTeacherRecommendation(t('demoSim.teacherRecoDefault'));
    setTeacherActionLog([t('demoSim.logOpen')]);
  }, [t]);
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  // גלגלת תלת־מימד: מרכז שורה i ב־scroll ב־(i+0.5)*ROW_H + PADDING_V; viewport center ≈ 110
  const WHEEL_ROW_H = 64;
  const WHEEL_PADDING_V = 100;
  const WHEEL_VIEWPORT_H = 220;
  const wheelCenterForIndex = (i: number) => WHEEL_PADDING_V + (i + 0.5) * WHEEL_ROW_H - WHEEL_VIEWPORT_H / 2;
  const WheelRow = useCallback(({ index, children }: { index: number; children: React.ReactNode }) => {
    const centerY = wheelCenterForIndex(index);
    const rotateX = scrollY.interpolate({
      inputRange: [centerY - 90, centerY - 35, centerY, centerY + 35, centerY + 90],
      outputRange: ['-8deg', '-3deg', '0deg', '3deg', '8deg'],
    });
    const opacity = scrollY.interpolate({
      inputRange: [centerY - 90, centerY - 35, centerY, centerY + 35, centerY + 90],
      outputRange: [0.82, 0.94, 1, 0.94, 0.82],
    });
    return (
      <Animated.View style={{ transform: [{ perspective: 1000 }, { rotateX }], opacity }}>{children}</Animated.View>
    );
  }, [scrollY]);

  const playPlayerCountSound = useCallback((count: number) => {
    if (gameState.soundsEnabled === false) return;
    const src = PLAYER_COUNT_SOUNDS[count];
    if (!src) return;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(src);
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((s: any) => { if (s?.didJustFinish || s?.didJustFinishNotify) sound.unloadAsync().catch(() => {}); });
      } catch (_) {}
    })();
  }, [gameState.soundsEnabled]);

  const setGuidance = useCallback((on: boolean) => {
    setGuidanceOn(on);
    void AsyncStorage.setItem('lulos_guidance_enabled', on ? 'true' : 'false');
    dispatch({ type: 'SET_GUIDANCE_ENABLED', enabled: on });
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem('lulos_guidance_enabled');
        if (cancelled) return;
        if (saved != null) {
          // Pre-fill toggle with saved preference, then still open the prompt.
          const enabled = saved !== 'false';
          setGuidanceOn(enabled);
          dispatch({ type: 'SET_GUIDANCE_ENABLED', enabled });
        }
        // Always show the prompt so the user can choose each session.
        setGuidancePromptOpen(true);
      } catch (_) {
        if (!cancelled) setGuidancePromptOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);
  const chooseGuidanceMode = useCallback((on: boolean) => {
    if (on) {
      void clearAllLulosOnboardingKeys().catch(() => {});
    }
    setGuidance(on);
    setGuidancePromptOpen(false);
  }, [setGuidance]);
  useEffect(() => {
    void initializeSfx();
    return () => {
      void disposeSfx();
    };
  }, []);
  useEffect(() => {
    setSfxMuted(gameState.soundsEnabled === false);
  }, [gameState.soundsEnabled]);

  useEffect(() => {
    // Joker gentle bounce (4s loop, 6px)
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -6, duration: 2000, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const startGame = () => {
    // השם מגיע קודם כל מתוך ה-prop (ChoiceScreen), ואז מ-AsyncStorage (PlayerNameModal קודם),
    // ורק לבסוף נופל לברירת המחדל "שחקן 1". מסונכרן לשני המפתחות כדי שמסכים עתידיים יקראו אותו.
    const effectiveSavedName = (preferredName?.trim() || savedPlayerNameRef.current || '').slice(0, 7);
    if (effectiveSavedName) {
      void AsyncStorage.setItem(PLAYER_SAVED_NAME_KEY, effectiveSavedName);
    }
    const humanName = effectiveSavedName || t('start.playerPlaceholder', { n: String(1) });
    const players =
      gameMode === 'vs-bot'
        ? [
            {
              name: humanName,
              isBot: false,
            },
            {
              name: botDisplayName.trim() || t('botOffline.botName'),
              isBot: true,
            },
          ]
        : Array.from({ length: playerCount }, (_, i) => ({
            name: i === 0 && effectiveSavedName
              ? effectiveSavedName
              : t('start.playerPlaceholder', { n: String(i + 1) }),
            isBot: false,
          }));
    if (gameState.soundsEnabled !== false) {
      void playSfx('start', { cooldownMs: 250, volumeOverride: 0.4 });
    }
    dispatch({
      type: 'START_GAME',
      mode: gameMode,
      botDifficulty: gameMode === 'vs-bot' ? botDifficulty : undefined,
      players,
      difficulty: numberRange,
      fractions,
      fractionKinds: fractions ? fractionKinds : [...ALL_FRACTION_KINDS],
      showPossibleResults,
      showSolveExercise,
      timerSetting: timer,
      timerCustomSeconds: timer === 'custom' ? customTimerSeconds : 60,
      difficultyStage,
      enabledOperators,
      allowNegativeTargets,
      mathRangeMax: numberRange === 'easy' ? 12 : 25,
      abVariant,
    });
  };

  // תחתית מסע — תפריט קומפקטי כדי שסלינדה (פנים/מותג) תופיע במלואה
  const MENU_H = 160;
  const bottomPad = safe.SAFE_BOTTOM_PAD || 12;
  const PLAY_BTN_H = 56;
  const totalBottomH = MENU_H + PLAY_BTN_H + bottomPad;
  const TOP_ACTIONS_TOP = safe.insets.top || 12;
  // Reserve enough vertical space for the absolute top action buttons
  // so they never overlap the Salinda hero image.
  // Includes two stacked button rows (shop/themes + rules) plus wrap safety.
  const TOP_ACTIONS_H = 136;
  const HERO_TOP = TOP_ACTIONS_TOP + TOP_ACTIONS_H + 8;
  // תמונת סלינדה — גודל מקורי במסך ברוכים הבאים
  // Shrink hero joker card by ~1/3 to free vertical space for scrolling.
  const JOKER_SIZE = Math.min(SCREEN_W * 0.52, 220) * (2 / 3);

  const stopDemoSimulation = useCallback(() => {
    if (demoSimTimerRef.current) {
      clearInterval(demoSimTimerRef.current);
      demoSimTimerRef.current = null;
    }
    setDemoSimRunning(false);
  }, []);

  const appendTeacherLog = useCallback((entry: string) => {
    const ts = new Date().toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    setTeacherActionLog((prev) => [`${ts} - ${entry}`, ...prev].slice(0, 12));
  }, [isRTL]);

  const resetDemoSimulation = useCallback(() => {
    stopDemoSimulation();
    setDemoSimTurns(0);
    setDemoSimProgress(0);
    setDemoSimResult(null);
    setDemoSimMessage(t('demoSim.pickLevel'));
  }, [stopDemoSimulation, t]);

  const startDemoSimulation = useCallback(() => {
    stopDemoSimulation();
    setDemoSimTurns(0);
    setDemoSimProgress(0);
    setDemoSimResult(null);
    setDemoSimRunning(true);
    setDemoSimMessage(t('demoSim.running'));

    const targetTurns = demoLevel === 'easy' ? 14 : demoLevel === 'hard' ? 26 : 20;
    const tickMs = 650;
    demoSimTimerRef.current = setInterval(() => {
      setDemoSimTurns((prev) => {
        const next = prev + 1;
        const progress = Math.min(100, Math.round((next / targetTurns) * 100));
        setDemoSimProgress(progress);
        if (next >= targetTurns) {
          stopDemoSimulation();
          const successChance = demoLevel === 'easy' ? 0.82 : demoLevel === 'hard' ? 0.5 : 0.66;
          const success = Math.random() <= successChance;
          setDemoSimResult(success ? 'success' : 'almost');
          setDemoSimMessage(
            success
              ? t('demoSim.doneStats', { pct: String(progress), turns: String(next) })
              : t('demoSim.almostStats', { turns: String(next) }),
          );
        } else if (next % 5 === 0) {
          setDemoSimMessage(t('demoSim.turnRise', { n: String(next) }));
        }
        return next;
      });
    }, tickMs);
  }, [demoLevel, stopDemoSimulation, t]);

  type TeacherDemoAction =
    | 'lower'
    | 'raise'
    | 'support'
    | 'challenge'
    | 'remedial'
    | 'reinforce'
    | 'extend'
    | 'stopSim'
    | 'newRound'
    | 'export'
    | 'toggleAlerts';

  const TEACHER_DEMO_ACTIONS: TeacherDemoAction[] = [
    'lower', 'raise', 'support', 'challenge', 'remedial', 'reinforce', 'extend', 'stopSim', 'newRound', 'export',
  ];

  const teacherDemoActionTitle = useCallback(
    (id: Exclude<TeacherDemoAction, 'toggleAlerts'>) => {
      const key: Record<Exclude<TeacherDemoAction, 'toggleAlerts'>, string> = {
        lower: 'teacher.action.lower',
        raise: 'teacher.action.raise',
        support: 'teacher.action.support',
        challenge: 'teacher.action.challenge',
        remedial: 'teacher.action.remedial',
        reinforce: 'teacher.action.reinforce',
        extend: 'teacher.action.extend',
        stopSim: 'teacher.action.stopSim',
        newRound: 'teacher.action.newRound',
        export: 'teacher.action.export',
      };
      return t(key[id]);
    },
    [t],
  );

  const applyTeacherIntervention = useCallback(
    (action: TeacherDemoAction) => {
      if (action === 'toggleAlerts') {
        setTeacherLastAction(teacherAlertsOn ? t('teacher.alertsOn') : t('teacher.alertsOff'));
        setTeacherAlertsOn((prev) => {
          const next = !prev;
          appendTeacherLog(t(next ? 'teacher.log.toggleOn' : 'teacher.log.toggleOff'));
          return next;
        });
        return;
      }
      setTeacherLastAction(teacherDemoActionTitle(action));
      if (action === 'lower') {
        setDemoLevel('easy');
        setTeacherKpi((prev) => ({
          ...prev,
          classAccuracy: Math.min(100, prev.classAccuracy + 6),
          avgTurns: Math.max(10, prev.avgTurns - 2),
          atRiskStudents: Math.max(0, prev.atRiskStudents - 1),
        }));
        setTeacherRecommendation(t('teacher.reco.lower'));
        appendTeacherLog(t('teacher.log.lower'));
        return;
      }
      if (action === 'raise') {
        setDemoLevel('hard');
        setTeacherKpi((prev) => ({
          ...prev,
          classAccuracy: Math.max(0, prev.classAccuracy - 4),
          avgTurns: Math.min(60, prev.avgTurns + 2),
          taskCompletion: Math.max(0, prev.taskCompletion - 2),
        }));
        setTeacherRecommendation(t('teacher.reco.raise'));
        appendTeacherLog(t('teacher.log.raise'));
        return;
      }
      if (action === 'support') {
        setDemoLevel('easy');
        setTeacherKpi((prev) => ({
          ...prev,
          classAccuracy: Math.min(100, prev.classAccuracy + 4),
          atRiskStudents: Math.max(0, prev.atRiskStudents - 2),
          taskCompletion: Math.min(100, prev.taskCompletion + 3),
        }));
        setTeacherRecommendation(t('teacher.reco.support'));
        appendTeacherLog(t('teacher.log.support'));
        return;
      }
      if (action === 'challenge') {
        setDemoLevel('hard');
        setTeacherKpi((prev) => ({
          ...prev,
          classAccuracy: Math.max(0, prev.classAccuracy - 2),
          taskCompletion: Math.min(100, prev.taskCompletion + 2),
        }));
        setTeacherRecommendation(t('teacher.reco.challengeMode'));
        appendTeacherLog(t('teacher.log.challengeMode'));
        return;
      }
      if (action === 'remedial') {
        setTeacherKpi((prev) => ({
          ...prev,
          atRiskStudents: Math.max(0, prev.atRiskStudents - 1),
          taskCompletion: Math.min(100, prev.taskCompletion + 2),
        }));
        setTeacherRecommendation(t('teacher.reco.remedial'));
        appendTeacherLog(t('teacher.log.remedial'));
        return;
      }
      if (action === 'reinforce') {
        setTeacherKpi((prev) => ({
          ...prev,
          classAccuracy: Math.min(100, prev.classAccuracy + 3),
          taskCompletion: Math.min(100, prev.taskCompletion + 4),
        }));
        setTeacherRecommendation(t('teacher.reco.reinforce'));
        appendTeacherLog(t('teacher.log.reinforce'));
        return;
      }
      if (action === 'extend') {
        setTeacherKpi((prev) => ({
          ...prev,
          avgTurns: Math.min(60, prev.avgTurns + 1),
          taskCompletion: Math.min(100, prev.taskCompletion + 3),
        }));
        setTeacherRecommendation(t('teacher.reco.extend'));
        appendTeacherLog(t('teacher.log.extend'));
        return;
      }
      if (action === 'stopSim') {
        stopDemoSimulation();
        setTeacherRecommendation(t('teacher.reco.stopSim'));
        appendTeacherLog(t('teacher.log.stopSim'));
        return;
      }
      if (action === 'newRound') {
        resetDemoSimulation();
        setTeacherRecommendation(t('teacher.reco.newRound'));
        appendTeacherLog(t('teacher.log.newRound'));
        return;
      }
      if (action === 'export') {
        setTeacherRecommendation(t('teacher.reco.export'));
        appendTeacherLog(t('teacher.log.export'));
      }
    },
    [appendTeacherLog, resetDemoSimulation, stopDemoSimulation, t, teacherDemoActionTitle, teacherAlertsOn],
  );

  useEffect(() => {
    if (!benefitsDemoOpen) {
      setTeacherScreenOpen(false);
      stopDemoSimulation();
    }
  }, [benefitsDemoOpen, stopDemoSimulation]);

  useEffect(() => () => {
    if (demoSimTimerRef.current) clearInterval(demoSimTimerRef.current);
  }, []);

  if (benefitsDemoOpen) {
    const successRate = demoLevel === 'easy' ? 78 : demoLevel === 'hard' ? 46 : 63;
    const avgTurns = demoLevel === 'easy' ? 18 : demoLevel === 'hard' ? 33 : 24;
    if (teacherScreenOpen) {
      const demoBandLabel = t(`demo.band.${demoGradeBand}`);
      const demoLevelLabel = t(`demo.level.${demoLevel}`);
      return (
        <View style={{ flex: 1, backgroundColor: '#071426', paddingTop: safe.insets.top || 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
            <LulosButton text={t('teacher.backDashboard')} color="blue" width={110} height={38} fontSize={12} onPress={() => setTeacherScreenOpen(false)} />
            <Text style={{ color: '#E2E8F0', fontSize: 18, fontWeight: '800' }}>{t('teacher.title')}</Text>
            <View style={{ width: 110 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            <View style={{ backgroundColor: 'rgba(14,116,144,0.2)', borderColor: 'rgba(125,211,252,0.38)', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: '#CFFAFE', fontSize: 15, fontWeight: '800', textAlign: 'right', marginBottom: 6 }}>{t('teacher.liveStatus')}</Text>
              <Text style={{ color: '#E0F2FE', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
                {t('teacher.liveStatusLine', { band: demoBandLabel, level: demoLevelLabel })}
              </Text>
              <Text style={{ color: '#BAE6FD', fontSize: 12, textAlign: 'right', marginTop: 6 }}>{t('teacher.goalLine')}</Text>
            </View>

            <View style={{ backgroundColor: 'rgba(30,64,175,0.18)', borderColor: 'rgba(147,197,253,0.45)', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: '#DBEAFE', fontSize: 15, fontWeight: '800', textAlign: 'right', marginBottom: 8 }}>{t('teacher.kpiTitle')}</Text>
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                <View style={{ width: '48%', backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: 10, padding: 10 }}>
                  <Text style={{ color: '#93C5FD', fontSize: 11, textAlign: 'right' }}>{t('teacher.kpi.accuracy')}</Text>
                  <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900', textAlign: 'right' }}>{teacherKpi.classAccuracy}%</Text>
                </View>
                <View style={{ width: '48%', backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: 10, padding: 10 }}>
                  <Text style={{ color: '#93C5FD', fontSize: 11, textAlign: 'right' }}>{t('teacher.kpi.avgTurns')}</Text>
                  <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900', textAlign: 'right' }}>{teacherKpi.avgTurns}</Text>
                </View>
                <View style={{ width: '48%', backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: 10, padding: 10 }}>
                  <Text style={{ color: '#93C5FD', fontSize: 11, textAlign: 'right' }}>{t('teacher.kpi.atRisk')}</Text>
                  <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900', textAlign: 'right' }}>{teacherKpi.atRiskStudents}</Text>
                </View>
                <View style={{ width: '48%', backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: 10, padding: 10 }}>
                  <Text style={{ color: '#93C5FD', fontSize: 11, textAlign: 'right' }}>{t('teacher.kpi.tasks')}</Text>
                  <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900', textAlign: 'right' }}>{teacherKpi.taskCompletion}%</Text>
                </View>
              </View>
            </View>

            <View style={{ backgroundColor: 'rgba(22,163,74,0.14)', borderColor: 'rgba(134,239,172,0.38)', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: '#DCFCE7', fontSize: 15, fontWeight: '800', textAlign: 'right', marginBottom: 8 }}>{t('teacher.intervention')}</Text>
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                {TEACHER_DEMO_ACTIONS.map((action) => (
                  <LulosButton
                    key={action}
                    text={teacherDemoActionTitle(action as Exclude<TeacherDemoAction, 'toggleAlerts'>)}
                    color="green"
                    width={120}
                    height={34}
                    fontSize={11}
                    onPress={() => applyTeacherIntervention(action)}
                  />
                ))}
                <LulosButton
                  text={teacherAlertsOn ? t('teacher.alertsOn') : t('teacher.alertsOff')}
                  color="blue"
                  width={120}
                  height={34}
                  fontSize={11}
                  onPress={() => applyTeacherIntervention('toggleAlerts')}
                />
              </View>
            </View>

            <View style={{ backgroundColor: 'rgba(99,102,241,0.16)', borderColor: 'rgba(165,180,252,0.38)', borderWidth: 1, borderRadius: 12, padding: 12 }}>
              <Text style={{ color: '#E0E7FF', fontSize: 15, fontWeight: '800', textAlign: 'right', marginBottom: 8 }}>{t('teacher.statusLog')}</Text>
              <Text style={{ color: '#C7D2FE', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
                {t('teacher.alertsState', { state: teacherAlertsOn ? t('teacher.alerts.active') : t('teacher.alerts.inactive') })}
              </Text>
              <Text style={{ color: '#C7D2FE', fontSize: 12, textAlign: 'right', lineHeight: 18, marginTop: 2 }}>{t('teacher.lastAction', { action: teacherLastAction })}</Text>
              <Text style={{ color: '#A5B4FC', fontSize: 12, textAlign: 'right', lineHeight: 18, marginTop: 6 }}>{t('teacher.systemReco', { text: teacherRecommendation })}</Text>
              <Text style={{ color: '#E0E7FF', fontSize: 13, fontWeight: '800', textAlign: 'right', marginTop: 10, marginBottom: 6 }}>{t('teacher.actionLogTitle')}</Text>
              {teacherActionLog.map((line, idx) => (
                <Text key={`${line}-${idx}`} style={{ color: '#C7D2FE', fontSize: 11, textAlign: 'right', lineHeight: 17, marginBottom: 2 }}>
                  • {line}
                </Text>
              ))}
            </View>
          </ScrollView>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: '#071426', paddingTop: safe.insets.top || 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <LulosButton text={t('demo.benefitsBack')} color="red" width={100} height={38} fontSize={13} onPress={() => { stopDemoSimulation(); setTeacherScreenOpen(false); setBenefitsDemoOpen(false); }} />
          <Text style={{ color: '#E2E8F0', fontSize: 18, fontWeight: '800' }}>{t('demo.benefitsTitle')}</Text>
          <View style={{ width: 100 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={{ color: '#93C5FD', fontSize: 13, lineHeight: 20, textAlign: 'right', marginBottom: 12 }}>
            {t('demo.benefitsIntro')}
          </Text>

          <View style={{ backgroundColor: 'rgba(30,64,175,0.18)', borderColor: 'rgba(147,197,253,0.45)', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: '#DBEAFE', fontSize: 15, fontWeight: '800', textAlign: 'right', marginBottom: 8 }}>{t('demo.curriculumMap')}</Text>
            <Text style={{ color: '#BFDBFE', fontSize: 12, textAlign: 'right', marginBottom: 8 }}>{t('demo.ageBandLabel')}</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 8 }}>
              {DEMO_GRADE_BANDS.map((band) => (
                <LulosButton key={band} text={t(`demo.band.${band}`)} color={demoGradeBand === band ? 'green' : 'blue'} width={110} height={34} fontSize={11} onPress={() => setDemoGradeBand(band)} />
              ))}
            </View>
            <Text style={{ color: '#E2E8F0', fontSize: 12, textAlign: 'right', lineHeight: 18 }}>
              {t('demo.topicsCovered')}
            </Text>
          </View>

          <View style={{ backgroundColor: 'rgba(2,132,199,0.14)', borderColor: 'rgba(125,211,252,0.35)', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: '#E0F2FE', fontSize: 15, fontWeight: '800', textAlign: 'right', marginBottom: 8 }}>{t('demo.teacherDashDemo')}</Text>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: '#BAE6FD', fontSize: 13 }}>{t('demo.successRateLabel', { n: String(successRate) })}</Text>
              <Text style={{ color: '#BAE6FD', fontSize: 13 }}>{t('demo.avgTurnsLabel', { n: String(avgTurns) })}</Text>
            </View>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#7DD3FC', fontSize: 12 }}>{t('demo.sampleGamesLabel', { n: String(demoClassGames) })}</Text>
              <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                <LulosButton text="+20" color="blue" width={62} height={30} fontSize={11} onPress={() => setDemoClassGames(v => Math.min(500, v + 20))} />
                <LulosButton text="-20" color="blue" width={62} height={30} fontSize={11} onPress={() => setDemoClassGames(v => Math.max(20, v - 20))} />
              </View>
            </View>
            <View style={{ marginTop: 10, alignItems: 'flex-end' }}>
              <LulosButton text={t('demo.openTeacherScreen')} color="green" width={200} height={36} fontSize={11} onPress={() => setTeacherScreenOpen(true)} />
            </View>
          </View>

          <View style={{ backgroundColor: 'rgba(22,163,74,0.14)', borderColor: 'rgba(134,239,172,0.38)', borderWidth: 1, borderRadius: 12, padding: 12 }}>
            <Text style={{ color: '#DCFCE7', fontSize: 15, fontWeight: '800', textAlign: 'right', marginBottom: 8 }}>{t('demo.diffTitle')}</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {DEMO_LEVELS.map((level) => (
                <LulosButton key={level} text={t(`demo.level.${level}`)} color={demoLevel === level ? 'green' : 'blue'} width={96} height={34} fontSize={11} onPress={() => setDemoLevel(level)} />
              ))}
            </View>
            <Text style={{ color: '#BBF7D0', fontSize: 12, textAlign: 'right' }}>
              {t('demo.profileLine', { level: t(`demo.level.${demoLevel}`), band: t(`demo.band.${demoGradeBand}`) })}
            </Text>
          </View>

          <View style={{ backgroundColor: 'rgba(99,102,241,0.16)', borderColor: 'rgba(165,180,252,0.38)', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 }}>
            <Text style={{ color: '#E0E7FF', fontSize: 15, fontWeight: '800', textAlign: 'right', marginBottom: 8 }}>{t('demo.simTitle')}</Text>
            <Text style={{ color: '#C7D2FE', fontSize: 12, textAlign: 'right', lineHeight: 18, marginBottom: 8 }}>
              {t('demo.simBody')}
            </Text>
            <View style={{ height: 10, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.55)', overflow: 'hidden', marginBottom: 8 }}>
              <View style={{ height: '100%', width: `${demoSimProgress}%`, backgroundColor: demoSimResult === 'almost' ? '#F59E0B' : '#4F46E5' }} />
            </View>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: '#A5B4FC', fontSize: 12 }}>{t('demo.progressPct', { n: String(demoSimProgress) })}</Text>
              <Text style={{ color: '#A5B4FC', fontSize: 12 }}>{t('demo.turnsPlayed', { n: String(demoSimTurns) })}</Text>
            </View>
            <Text style={{ color: '#E5E7EB', fontSize: 12, textAlign: 'right', lineHeight: 18, marginBottom: 10 }}>{demoSimMessage}</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
              <LulosButton
                text={demoSimRunning ? t('demoSim.btnRunning') : t('demoSim.btnStart')}
                color={demoSimRunning ? 'blue' : 'green'}
                width={146}
                height={36}
                fontSize={12}
                onPress={startDemoSimulation}
              />
              <LulosButton text={t('demoSim.reset')} color="red" width={88} height={36} fontSize={12} onPress={resetDemoSimulation} />
            </View>
            {demoSimResult && (
              <Text style={{ color: demoSimResult === 'success' ? '#86EFAC' : '#FCD34D', fontSize: 12, textAlign: 'right', marginTop: 8 }}>
                {demoSimResult === 'success' ? t('demoSim.success') : t('demoSim.almost')}
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (futureLabOpen) {
    const labItems = FUTURE_LAB_SPECS.map(({ id, detailCount }) => ({
      id,
      title: t(`lab.${id}.title`),
      desc: t(`lab.${id}.desc`),
      details:
        detailCount === 0
          ? []
          : Array.from({ length: detailCount }, (_, j) => t(`lab.${id}.d${j + 1}`)),
    }));
    return (
      <View style={{ flex: 1, backgroundColor: '#1E293B', paddingTop: safe.insets.top || 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <LulosButton text={t('lab.back')} color="red" width={100} height={38} fontSize={13} onPress={() => { setFutureLabOpen(false); }} />
          <Text style={{ color: '#E2E8F0', fontSize: 18, fontWeight: '800' }}>{t('lab.title')}</Text>
          <View style={{ width: 100 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={{ color: '#93C5FD', fontSize: 14, marginBottom: 16, textAlign: 'right' }}>{t('lab.intro')}</Text>
          {labItems.map((item, i) => (
            <View key={i} style={{ marginBottom: 16, alignItems: 'stretch', gap: 8 }}>
              <Text style={{ color: '#E2E8F0', fontSize: 16, fontWeight: '800', textAlign: 'right' }}>{item.title}</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 13, lineHeight: 20, textAlign: 'right' }}>{item.desc}</Text>
              {item.details?.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  {item.details.map((d, j) => (
                    <Text key={j} style={{ color: '#6B7280', fontSize: 12, lineHeight: 18, textAlign: 'right', marginBottom: 2, paddingRight: 8 }}>• {d}</Text>
                  ))}
                </View>
              )}
              <View style={{ marginTop: 6, alignItems: 'center' }}>
                <LulosButton
                  text={t('lab.openDemo')}
                  color="blue"
                  width={200}
                  height={44}
                  fontSize={15}
                  onPress={() => {
                    if (item.id === 'learning') {
                      setBenefitsDemoOpen(true);
                      return;
                    }
                    Alert.alert(t('lab.soonTitle'), t('lab.soonBody'));
                  }}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {/* כפתור חזרה + חוקים — בצד למעלה */}
      <View style={{ position: 'absolute', top: TOP_ACTIONS_TOP, left: 16, right: 16, minHeight: TOP_ACTIONS_H, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', zIndex: 20, flexWrap: 'wrap', gap: 8 }}>
        {onBackToChoice && (
          <LulosButton text={t('lobby.backToMode')} color="blue" width={130} height={38} fontSize={11} onPress={onBackToChoice} />
        )}
        {onHowToPlay && (
          <LulosButton text={t('mode.howToPlay')} color="orange" width={110} height={38} fontSize={12} onPress={onHowToPlay} />
        )}
        <View style={{ flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {onShop && (
              <LulosButton text={t('shop.openShop')} color="yellow" width={90} height={38} fontSize={13} onPress={onShop} />
            )}
            {onMyThemes && (
              <LulosButton text={t('themes.openMyThemes')} color="yellow" width={90} height={38} fontSize={13} onPress={onMyThemes} />
            )}
          </View>
          <LulosButton text={t('start.rulesButton')} color="blue" width={90} height={38} fontSize={13} onPress={() => setRulesOpen(true)} />
        </View>
      </View>
      <AppModal
        visible={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title={t('start.rulesModalTitle')}
        overlayOpacity={0.82}
        topAligned
        boxStyle={{
          width: '100%',
          height: SCREEN_H - 150,
          maxHeight: SCREEN_H - 150,
          marginTop: 150,
          borderRadius: 0,
          backgroundColor: 'rgba(15,23,42,0.94)',
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.45)',
          padding: 0,
        }}
      >
        <RulesContent
          state={null}
          pregame={{
            numberRange,
            fractions,
            fractionKinds: fractions ? fractionKinds : [],
            difficultyStage,
            enabledOperators,
            allowNegativeTargets,
            showPossibleResults,
            showSolveExercise,
          }}
        />
      </AppModal>
      <AppModal visible={cardsCatalogOpen} onClose={() => setCardsCatalogOpen(false)} title={t('start.catalogTitle')}>
        <CardsCatalogContent
          numberRange={numberRange}
          fractions={fractions}
          enabledOperators={DIFFICULTY_STAGE_CONFIG[difficultyStage].enabledOperators}
          fractionKinds={fractionKinds}
        />
      </AppModal>
      <AppModal
        visible={advancedSetupOpen}
        onClose={() => setAdvancedSetupOpen(false)}
        overlayOpacity={0.82}
        topAligned
        customHeader={(
          <LinearGradient
            colors={['#fbbf24', '#f472b6', '#a855f7', '#38bdf8']}
            start={{ x: isRTL ? 1 : 0, y: 0 }}
            end={{ x: isRTL ? 0 : 1, y: 1 }}
            style={{
              marginHorizontal: -12,
              marginTop: -8,
              paddingTop: 14,
              paddingBottom: 14,
              paddingHorizontal: 14,
              marginBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.14)',
            }}
          >
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 24 }}>✨</Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 20,
                      fontWeight: '900',
                      textShadowColor: 'rgba(0,0,0,0.35)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 3,
                      flex: 1,
                      textAlign: isRTL ? 'right' : 'left',
                      writingDirection: isRTL ? 'rtl' : 'ltr',
                    }}
                  >
                    {t('start.advancedSetup.entryTitle')}
                  </Text>
                </View>
                <Text
                  style={{
                    color: 'rgba(254,249,195,0.96)',
                    fontSize: 12,
                    fontWeight: '700',
                    lineHeight: 17,
                    marginTop: 6,
                    textAlign: isRTL ? 'right' : 'left',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  }}
                >
                  {t('start.advancedSetup.entryRowTeaser')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAdvancedSetupOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('start.advancedSetup.back')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 22,
                  backgroundColor: 'rgba(15,23,42,0.5)',
                  borderWidth: 1.5,
                  borderColor: 'rgba(255,255,255,0.4)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  maxWidth: '42%',
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: '800',
                    textAlign: 'center',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  }}
                  numberOfLines={2}
                >
                  {t('start.advancedSetup.back')}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}
        boxStyle={{
          width: '100%',
          maxHeight: SCREEN_H - 56,
          /* גובה מפורש — אחרת flex:1 על ה־ScrollView עלול לקבל 0 (במיוחד Web) והמודאל נראה «שבור» */
          height: Math.max(
            280,
            SCREEN_H - ((safe.insets.top || 12) + 8) - bottomPad - 16,
          ),
          marginTop: (safe.insets.top || 12) + 8,
          borderRadius: 0,
          backgroundColor: 'rgba(15,23,42,0.97)',
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.45)',
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 12,
          overflow: 'hidden',
        }}
      >
        <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1, direction: 'rtl' }}
          contentContainerStyle={{ paddingBottom: 16, direction: 'rtl' }}
          showsVerticalScrollIndicator
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              color: 'rgba(226,232,240,0.95)',
              fontSize: 12,
              lineHeight: 18,
              fontWeight: '600',
              textAlign: 'center',
              writingDirection: 'rtl',
              marginBottom: 14,
              paddingHorizontal: 4,
            }}
          >
            {t('start.advancedSetup.modalLead')}
          </Text>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <ExcellenceMeter
              title={t('meter.excellenceTitle')}
              value={EXCELLENCE_METER_DEMO_VALUE}
              height={128}
            />
          </View>

          <View style={[hsS.advSection, gameMode === 'pass-and-play' ? { opacity: 0.5 } : null]}>
            <View style={hsS.advSectionHdr}>
              <Text
                style={[
                  hsS.rowLabel,
                  {
                    fontSize: 15,
                    fontWeight: '800',
                    marginBottom: 6,
                    textAlign: isRTL ? 'left' : 'right',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  },
                ]}
              >
                {t('start.advancedSetup.sectionPlayModeHeading')}
              </Text>
            </View>
            {gameMode === 'pass-and-play' && (
              <LinearGradient colors={['#188038','#34A853']} start={{x:0,y:0}} end={{x:1,y:1}} style={hsS.rowGradientOuter}>
                <View style={[hsS.row, hsS.rowPlayers, { flexDirection: 'row' }]}>
                  <Text style={[hsS.rowLabel, { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{t('start.playerCount')}</Text>
                  <View style={hsS.stepper}>
                    <Text style={hsS.stepVal}>{playerCount}</Text>
                  </View>
                </View>
              </LinearGradient>
            )}
            <View pointerEvents={gameMode === 'pass-and-play' ? 'none' : 'auto'}>
              <GameModeToggleBlock gameMode={gameMode} setGameMode={setGameMode} />
              <BotDifficultySettingsBlock
                botDifficulty={botDifficulty}
                setBotDifficulty={setBotDifficulty}
                botDisplayName={botDisplayName}
                setBotDisplayName={setBotDisplayName}
              />
            </View>
          </View>

          <View style={hsS.advSection}>
            <View style={hsS.advSectionHdr}>
              <Text
                style={[
                  hsS.rowLabel,
                  {
                    fontSize: 15,
                    fontWeight: '800',
                    marginBottom: 6,
                    textAlign: isRTL ? 'left' : 'right',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  },
                ]}
              >
                {t('start.advancedSetup.sectionNumbersHeading')}
              </Text>
              <Text
                style={{
                  color: 'rgba(226,232,240,0.92)',
                  fontSize: 12,
                  lineHeight: 18,
                  fontWeight: '600',
                  textAlign: isRTL ? 'left' : 'right',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                  marginBottom: 8,
                }}
              >
                {t('start.advancedSetup.sectionNumbersIntro')}
              </Text>
            </View>
          <LinearGradient colors={['#1a73e8', '#4285F4']} start={{ x: isRTL ? 1 : 0, y: 0 }} end={{ x: isRTL ? 0 : 1, y: 1 }} style={hsS.rowGradientOuter}>
            <View style={[hsS.row, hsS.rowRange, { flexDirection: 'row' }]}>
              <Text style={[hsS.rowLabel, { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{t('start.wheel.numberRange')}</Text>
              <View style={hsS.toggleGroup}>
                {([['full', '0-25'], ['easy', '0-12']] as const).map(([key, label]) => (
                  <TouchableOpacity key={key} onPress={() => setNumberRange(key)} activeOpacity={0.7}
                    style={[hsS.toggleBtn, numberRange === key ? hsS.toggleOn : hsS.toggleOff]}>
                    <Text style={numberRange === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </LinearGradient>
          <Text style={[hsS.advHint, { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
            {t('start.advancedSetup.hint.numberRangeRow')}
          </Text>
          <LinearGradient colors={['#4285F4', '#8ab4f8']} start={{ x: isRTL ? 1 : 0, y: 0 }} end={{ x: isRTL ? 0 : 1, y: 1 }} style={hsS.rowGradientOuter}>
            <View style={[hsS.row, hsS.rowFractions, { flexDirection: 'row' }]}>
              <Text style={[hsS.rowLabel, { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{t('lobby.fractions')}</Text>
              <View style={hsS.toggleGroup}>
                {([
                  [true, t('lobby.withFractions')],
                  [false, t('lobby.noFractions')],
                ] as const).map(([key, label]) => (
                  <TouchableOpacity key={String(key)} onPress={() => setFractions(key as boolean)} activeOpacity={0.7}
                    style={[hsS.toggleBtn, fractions === key ? hsS.toggleOn : hsS.toggleOff]}>
                    <Text style={fractions === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </LinearGradient>
          <Text style={[hsS.advHint, { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
            {t('start.advancedSetup.hint.fractionsRow')}
          </Text>
          {fractions && (
            <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
              <Text
                style={{
                  color: 'rgba(226,232,240,0.92)',
                  fontSize: 12,
                  fontWeight: '700',
                  marginBottom: 8,
                  textAlign: isRTL ? 'left' : 'right',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
              >
                {t('start.advancedSetup.fractionKindsTitle')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {([...ALL_FRACTION_KINDS] as Fraction[]).map((fk) => {
                  const on = fractionKinds.includes(fk);
                  return (
                    <TouchableOpacity
                      key={fk}
                      onPress={() => toggleFractionKind(fk)}
                      activeOpacity={0.75}
                      style={{
                        minWidth: 52,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: on ? '#92400E' : 'rgba(255,255,255,0.25)',
                        backgroundColor: on ? '#FBBF24' : 'rgba(15,23,42,0.45)',
                        alignItems: 'center',
                        ...(on
                          ? Platform.select({
                              ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.7, shadowRadius: 10 },
                              android: { elevation: 6 },
                            })
                          : null),
                      }}
                    >
                      <Text style={{ color: on ? '#451A03' : '#fff', fontSize: 15, fontWeight: '900' }}>{fk}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 8 }}>
            <Text style={{ color: 'rgba(226,232,240,0.92)', fontSize: 12, fontWeight: '700', textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }}>
              {t('start.advancedSetup.operatorsTitle')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {([
                ['plusMinus', ['+', '-'] as Operation[], 'start.advancedSetup.operators.plusMinus.label', 'start.advancedSetup.operators.plusMinus.help'],
                ['all', ['+', '-', 'x', '÷'] as Operation[], 'start.advancedSetup.operators.all.label', 'start.advancedSetup.operators.all.help'],
              ] as const).map(([key, ops, labelKey, helpKey]) => {
                const on = operatorPreset === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setEnabledOperators([...ops])}
                    activeOpacity={0.75}
                    style={{
                      minWidth: 92,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: on ? '#92400E' : 'rgba(255,255,255,0.25)',
                      backgroundColor: on ? '#FBBF24' : 'rgba(15,23,42,0.45)',
                      alignItems: 'center',
                      ...(on
                        ? Platform.select({
                            ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.7, shadowRadius: 10 },
                            android: { elevation: 6 },
                          })
                        : null),
                    }}
                  >
                    <Text style={{ color: on ? '#451A03' : '#fff', fontSize: 14, fontWeight: '900' }}>{t(labelKey)}</Text>
                    <Text style={{ color: on ? '#7C2D12' : 'rgba(255,255,255,0.86)', fontSize: 11, marginTop: 2, fontWeight: on ? '700' : '400' }}>{t(helpKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
          </View>

          <View style={hsS.advSection}>
            <View style={hsS.advSectionHdr}>
              <Text
                style={[
                  hsS.rowLabel,
                  {
                    fontSize: 15,
                    fontWeight: '800',
                    marginBottom: 6,
                    textAlign: isRTL ? 'left' : 'right',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  },
                ]}
              >
                {t('start.advancedSetup.sectionHelpersHeading')}
              </Text>
              <Text
                style={{
                  color: 'rgba(226,232,240,0.92)',
                  fontSize: 12,
                  lineHeight: 18,
                  fontWeight: '600',
                  textAlign: isRTL ? 'left' : 'right',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                  marginBottom: 8,
                }}
              >
                {t('start.advancedSetup.sectionHelpersIntro')}
              </Text>
            </View>
          <LinearGradient colors={['#d93025', '#EA4335']} start={{ x: isRTL ? 1 : 0, y: 0 }} end={{ x: isRTL ? 0 : 1, y: 1 }} style={hsS.rowGradientOuter}>
            <View style={[hsS.rowStackToggle, hsS.rowPossibleResults]}>
              <Text style={[hsS.rowLabel, { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{t('lobby.possibleResults')}</Text>
              <View style={hsS.toggleGroupFull}>
                {([
                  [true, t('lobby.show')],
                  [false, t('lobby.hide')],
                ] as const).map(([key, label]) => (
                  <TouchableOpacity key={String(key)} onPress={() => {
                    const v = key as boolean;
                    setShowPossibleResults(v);
                    if (!v) setShowSolveExercise(false);
                  }} activeOpacity={0.7}
                    style={[hsS.toggleBtn, showPossibleResults === key ? hsS.toggleOn : hsS.toggleOff]}>
                    <Text style={showPossibleResults === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </LinearGradient>
          <Text style={[hsS.advHint, { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
            {t('start.advancedSetup.hint.possibleResultsRow')}
          </Text>
          <LinearGradient colors={['#34A853', '#81c995']} start={{ x: isRTL ? 1 : 0, y: 0 }} end={{ x: isRTL ? 0 : 1, y: 1 }} style={hsS.rowGradientOuter}>
            <View style={[hsS.rowStackToggle, hsS.rowSolveExercise]}>
              <Text style={[hsS.rowLabel, { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{t('lobby.solveExercise')}</Text>
              <View style={hsS.toggleGroupFull}>
                {([
                  [true, t('lobby.on')],
                  [false, t('lobby.off')],
                ] as const).map(([key, label]) => (
                  <TouchableOpacity key={String(key)} onPress={() => {
                    if (key && !showPossibleResults) return;
                    setShowSolveExercise(key as boolean);
                  }} activeOpacity={key && !showPossibleResults ? 1 : 0.7}
                    style={[
                      hsS.toggleBtn,
                      showSolveExercise === key ? hsS.toggleOn : hsS.toggleOff,
                      key && !showPossibleResults ? { opacity: 0.45 } : null,
                    ]}>
                    <Text style={showSolveExercise === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </LinearGradient>
          <Text style={[hsS.advHint, { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
            {t('start.advancedSetup.hint.solveExerciseRow')}
          </Text>
          </View>

          <View style={hsS.advSection}>
            <View style={hsS.advSectionHdr}>
              <Text
                style={[
                  hsS.rowLabel,
                  {
                    fontSize: 15,
                    fontWeight: '800',
                    marginBottom: 6,
                    textAlign: isRTL ? 'left' : 'right',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  },
                ]}
              >
                {t('start.advancedSetup.sectionTimerHeading')}
              </Text>
              <Text
                style={{
                  color: 'rgba(226,232,240,0.92)',
                  fontSize: 12,
                  lineHeight: 18,
                  fontWeight: '600',
                  textAlign: isRTL ? 'left' : 'right',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                  marginBottom: 8,
                }}
              >
                {t('start.advancedSetup.sectionTimerIntro')}
              </Text>
            </View>
          <LinearGradient colors={['#EA4335', '#f28b82']} start={{ x: isRTL ? 1 : 0, y: 0 }} end={{ x: isRTL ? 0 : 1, y: 1 }} style={hsS.rowGradientOuter}>
            <View style={[hsS.row, hsS.rowTimer, { flexDirection: 'row' }]}>
              <Text style={[hsS.rowLabel, { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{t('start.wheel.timerRow')}</Text>
              <View style={hsS.timerWheelWrap}>
                <HorizontalOptionWheel
                  options={timerWheelOptions}
                  selectedKey={timer}
                  snapFocus="leading"
                  scrollAfterSelect={(key) => key !== 'custom'}
                  onSelect={(key) => {
                    if (key === 'custom') {
                      timerRestoreOnCancelRef.current = timer === 'custom' ? null : (timer as '30' | '60' | 'off');
                      setTimer('custom');
                      setTimerCustomModalOpen(true);
                    } else {
                      setTimer(key as '30' | '60' | 'off');
                    }
                  }}
                />
              </View>
            </View>
          </LinearGradient>
          {timer === 'custom' && (
            <LinearGradient colors={['#EA4335', '#f28b82']} start={{ x: isRTL ? 1 : 0, y: 0 }} end={{ x: isRTL ? 0 : 1, y: 1 }} style={hsS.rowGradientOuter}>
              <View style={[hsS.row, hsS.rowTimer, { marginTop: -4, flexDirection: 'row', alignItems: 'center' }]}>
                <Text style={[hsS.rowLabel, { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.85)', textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {customTimerSeconds >= 60
                    ? t('start.customTimerMinSec', {
                        min: String(Math.floor(customTimerSeconds / 60)),
                        sec: String(customTimerSeconds % 60),
                      })
                    : t('start.customTimerSecOnly', { sec: String(customTimerSeconds) })}
                </Text>
              </View>
            </LinearGradient>
          )}
          <Text style={[hsS.advHint, { textAlign: isRTL ? 'left' : 'right', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
            {t('start.advancedSetup.hint.timerOptions')}
          </Text>
          </View>
        </ScrollView>
        <View
          style={{
            paddingTop: 12,
            paddingBottom: 6,
            borderTopWidth: 1,
            borderTopColor: 'rgba(148,163,184,0.28)',
            alignItems: 'center',
          }}
        >
          <CasinoButton
            text={t('start.letsPlay')}
            width={220}
            height={48}
            fontSize={19}
            onPress={() => {
              Keyboard.dismiss();
              startGame();
              setAdvancedSetupOpen(false);
            }}
          />
        </View>
        </View>
      </AppModal>
      {/* קבלת פנים — רק כשההדרכה מופעלת */}
      {guidanceOn && (
        <View style={{ alignItems: 'center', paddingTop: 8, paddingHorizontal: 16 }}>
          <Text style={{ color: '#4285F4', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{t('start.welcomeSalinda')}</Text>
        </View>
      )}
      {/* סלינדה — מוצמדת מתחת לשורת הכפתורים העליונה (top + buttons + margin) */}
      <View style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: HERO_TOP }}>
        <Animated.View style={{
          transform: [{ translateY: bounceAnim }],
          width: JOKER_SIZE,
          height: JOKER_SIZE,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 24 },
            android: { elevation: 12 },
          }),
        }}>
          <Image
            source={require('./assets/joker.jpg')}
            style={{ width: JOKER_SIZE, height: JOKER_SIZE }}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Bottom menu — הגלילה מתחילה מתחת לסלינדה ומשתרעת עד לתחתית */}
      <View style={{ position: 'absolute', top: HERO_TOP + JOKER_SIZE + 10, bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: bottomPad, backgroundColor: 'transparent', zIndex: 10 }}>
        <Animated.ScrollView
          style={{ maxHeight: '100%', backgroundColor: 'transparent' }}
          contentContainerStyle={{ paddingTop: WHEEL_PADDING_V, paddingBottom: WHEEL_PADDING_V }}
          showsVerticalScrollIndicator={true}
          bounces={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
        >
        <View style={hsS.settings}>
          <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start', width: '100%', marginBottom: 8 }}>
            <LanguageToggle />
          </View>

          {/* 1. מצב משחק: מקומי / מול בוט (ברירת מחדל: בוט) */}
          <WheelRow index={0}>
            <GameModeToggleBlock gameMode={gameMode} setGameMode={setGameMode} />
          </WheelRow>

          {/* 2. מספר שחקנים — רק במצב מקומי */}
          {gameMode === 'pass-and-play' && (
          <WheelRow index={1}>
          <LinearGradient colors={['#188038','#34A853']} start={{x:0,y:0}} end={{x:1,y:1}} style={hsS.rowGradientOuter}>
          <View style={[hsS.row, hsS.rowPlayers]}>
            <Text style={hsS.rowLabel}>{t('start.playerCount')}</Text>
            <View style={hsS.stepper}>
              <TouchableOpacity
                onPress={() => {
                  const next = Math.max(2, playerCount - 1);
                  playPlayerCountSound(next);
                  setPlayerCount(next);
                }}
                disabled={playerCount <= 2} activeOpacity={0.7}
                style={[hsS.stepBtnWrap, playerCount <= 2 && { opacity: 0.3 }]}
              >
                <LinearGradient colors={['#fde293','#FBBC05','#f9ab00','#e37400']} locations={[0,0.4,0.8,1]} style={hsS.stepBtn}>
                  <View style={hsS.stepBtnInner} />
                  <Text style={hsS.stepBtnTxt}>−</Text>
                </LinearGradient>
              </TouchableOpacity>
              <Text style={hsS.stepVal}>{playerCount}</Text>
              <TouchableOpacity
                onPress={() => {
                  const next = Math.min(6, playerCount + 1);
                  playPlayerCountSound(next);
                  setPlayerCount(next);
                }}
                disabled={playerCount >= 6} activeOpacity={0.7}
                style={[hsS.stepBtnWrap, playerCount >= 6 && { opacity: 0.3 }]}
              >
                <LinearGradient colors={['#fde293','#FBBC05','#f9ab00','#e37400']} locations={[0,0.4,0.8,1]} style={hsS.stepBtn}>
                  <View style={hsS.stepBtnInner} />
                  <Text style={hsS.stepBtnTxt}>+</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
          </LinearGradient>
          </WheelRow>
          )}

          {/* 3. טווח מספרים */}
          <WheelRow index={numberRangeWheelIndex}>
          <LinearGradient colors={['#1a73e8', '#4285F4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={hsS.rowGradientOuter}>
          <View style={[hsS.row, hsS.rowRange]}>
            <Text style={hsS.rowLabel}>{t('start.wheel.numberRange')}</Text>
            <View style={hsS.toggleGroup}>
              {([['full', '0-25'], ['easy', '0-12']] as const).map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setNumberRange(key)} activeOpacity={0.7}
                  style={[hsS.toggleBtn, numberRange === key ? hsS.toggleOn : hsS.toggleOff]}>
                  <Text style={numberRange === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          </LinearGradient>
          </WheelRow>

          <WheelRow index={guidanceWheelIndex}>
          <LinearGradient colors={['#7C3AED', '#A78BFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={hsS.rowGradientOuter}>
          <View style={[hsS.row, hsS.rowRange]}>
            <Text style={hsS.rowLabel}>{t('start.wheel.guidanceRow')}</Text>
            <View style={hsS.toggleGroup}>
              {([
                [true, t('lobby.on')],
                [false, t('lobby.off')],
              ] as const).map(([key, label]) => (
                <TouchableOpacity
                  key={String(key)}
                  onPress={() => {
                    setGuidance(key);
                  }}
                  activeOpacity={0.7}
                  style={[hsS.toggleBtn, guidanceOn === key ? hsS.toggleOn : hsS.toggleOff]}
                >
                  <Text style={guidanceOn === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          </LinearGradient>
          </WheelRow>

          <WheelRow index={advancedWheelIndex}>
          <LinearGradient
            colors={['#fbbf24', '#f472b6', '#a855f7', '#38bdf8']}
            start={{ x: isRTL ? 1 : 0, y: 0 }}
            end={{ x: isRTL ? 0 : 1, y: 1 }}
            style={hsS.rowGradientOuter}
          >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${t('start.advancedSetup.entryTitle')}, ${t('start.advancedSetup.entryOpenCta')}`}
            activeOpacity={0.88}
            hitSlop={{ top: 16, bottom: 16, left: 12, right: 12 }}
            onPress={() => setAdvancedSetupOpen(true)}
            style={hsS.advancedEntryInner}
          >
            {/* שורה אחת: תמיד [תוכן | כפתור] בציר LTR הפיזי — אותו סדר כמו כותרת המודל (המשכיות כיוון) */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 26 }}>✨</Text>
                  <Text style={[hsS.advancedEntryTitle, { textAlign: isRTL ? 'right' : 'left', flex: 1, writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                    {t('start.advancedSetup.entryTitle')}
                  </Text>
                </View>
                <Text style={[hsS.advancedEntryTeaser, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {t('start.advancedSetup.entryRowTeaser')}
                </Text>
                <View style={[hsS.advancedEntryChipRow, { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 }]}>
                  <View style={[hsS.advancedStageChip, hsS.advancedStageChipActive]}>
                    <Text style={[hsS.advancedStageChipTxt, hsS.advancedStageChipTxtActive]}>
                      {t('start.advancedSetup.entryChip.operators', {
                        value: operatorPreset === 'all' ? t('start.advancedSetup.operators.all.label') : operatorPreset === 'mulDiv' ? t('start.advancedSetup.operators.mulDiv.label') : t('start.advancedSetup.operators.plusMinus.label'),
                      })}
                    </Text>
                  </View>
                  <View style={[hsS.advancedStageChip, hsS.advancedStageChipActive]}>
                    <Text style={[hsS.advancedStageChipTxt, hsS.advancedStageChipTxtActive]}>
                      {t('start.advancedSetup.entryChip.fractions', { value: fractions ? t('lobby.withFractions') : t('lobby.noFractions') })}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[hsS.advancedEntryCtaWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={hsS.advancedEntryCtaTxt}>{t('start.advancedSetup.entryOpenCta')}</Text>
                <Text style={hsS.advancedEntryCtaArrow}>{isRTL ? '‹' : '›'}</Text>
              </View>
            </View>
          </TouchableOpacity>
          </LinearGradient>
          </WheelRow>
        </View>
        </Animated.ScrollView>

        <RNModal visible={timerCustomModalOpen} transparent animationType="fade">
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
            onPress={() => {
              const r = timerRestoreOnCancelRef.current;
              if (r != null) setTimer(r);
              setTimerCustomModalOpen(false);
            }}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={{ backgroundColor: '#1F2937', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320 }}>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>{t('lobby.timerCustomHint')}</Text>
              <View style={{ flexDirection: Platform.OS === 'android' ? 'row-reverse' : 'row', justifyContent: 'center', gap: 24, marginBottom: 20 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{t('start.timerPickerMin')}</Text>
                  <ScrollView style={{ height: 120 }} showsVerticalScrollIndicator={false} snapToInterval={36} decelerationRate="fast">
                    {Array.from({ length: 6 }, (_, i) => i).map((m) => (
                      <TouchableOpacity key={m} onPress={() => setCustomTimerSeconds(prev => Math.min(300, Math.max(1, (m * 60) + (prev % 60))))} style={{ height: 36, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: customTimerSeconds >= 60 ? Math.floor(customTimerSeconds / 60) === m ? '#FBBC05' : '#9CA3AF' : m === 0 ? '#FBBC05' : '#9CA3AF', fontSize: 18, fontWeight: '700' }}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{t('start.timerPickerSec')}</Text>
                  <ScrollView style={{ height: 120 }} showsVerticalScrollIndicator={false} snapToInterval={36} decelerationRate="fast">
                    {Array.from({ length: 60 }, (_, i) => i).map((s) => (
                      <TouchableOpacity key={s} onPress={() => setCustomTimerSeconds(prev => Math.min(300, Math.max(1, Math.floor(prev / 60) * 60 + s)))} style={{ height: 36, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: (customTimerSeconds % 60) === s ? '#FBBC05' : '#9CA3AF', fontSize: 18, fontWeight: '700' }}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
                <TouchableOpacity
                  onPress={() => {
                    const r = timerRestoreOnCancelRef.current;
                    if (r != null) setTimer(r);
                    setTimerCustomModalOpen(false);
                  }}
                  style={{ backgroundColor: '#374151', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>{t('ui.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setTimer('custom'); timerRestoreOnCancelRef.current = null; setTimerCustomModalOpen(false); }} style={{ backgroundColor: '#34A853', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>{t('start.timerModalStart')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </RNModal>
        {/* Start button — למטה, ללא מסגרת/רקע נוסף סביב הכפתור */}
        <View style={{ marginTop: 40, marginBottom: 4, alignItems: 'center' }}>
          <CasinoButton text={t('start.letsPlay')} width={220} height={48} fontSize={19} onPress={startGame} />
        </View>
        <TouchableOpacity
          onLongPress={() => {
            void clearAllLulosOnboardingKeys().then(() => {
              if (__DEV__) console.log('[DEV] Long-press: cleared all onboarding keys');
              Alert.alert(t('dev.onboardingClearedTitle'), t('dev.onboardingClearedBody'));
            });
          }}
          activeOpacity={0.5}
          delayLongPress={2000}
        >
          <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, textAlign: 'center', marginTop: 6 }}>v1.0.0</Text>
        </TouchableOpacity>
      </View>
      <RNModal visible={guidancePromptOpen} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
          <LinearGradient colors={['#7C3AED', '#2563EB', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', maxWidth: 360, borderRadius: 28, padding: 3 }}>
            <View style={[alertBubbleStyle.box, { maxWidth: '100%', backgroundColor: 'rgba(15,23,42,0.96)', borderColor: 'rgba(255,255,255,0.18)', paddingVertical: 20, paddingHorizontal: 18 }]}>
              <Text style={[alertBubbleStyle.title, { color: '#FDE68A', fontSize: 22 }]}>{t('guidance.welcomeTitle')}</Text>
              <Text style={[alertBubbleStyle.body, { marginTop: 10, fontSize: 14, lineHeight: 22, color: '#E0F2FE' }]}>
                {t('guidance.welcomeBody')}
              </Text>
              <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => chooseGuidanceMode(false)}
                  style={{ backgroundColor: '#F59E0B', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: '#111827', fontSize: 15, fontWeight: '900' }}>{t('guidance.skip')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => chooseGuidanceMode(true)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: '#E5E7EB', fontSize: 15, fontWeight: '800' }}>{t('guidance.need')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      </RNModal>
    </View>
  );
}
const hsS = StyleSheet.create({
  // Joker area — flex:1 fills space between top and bottom menu
  jokerArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  // Settings container
  settings: { width: '96%', alignSelf: 'flex-end', marginTop: 8 },
  // Setting row — horizontal, label left, controls right; רקע קל לקריאות מעל רקע מעופף
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(10,22,40,0.9)',
    borderRadius: 10,
    marginHorizontal: 2,
    marginBottom: 4,
  },
  /** תווית מעל טוגלים — מונע דחיסת כפתורי הראה/הסתר ב־RTL */
  rowStackToggle: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(10,22,40,0.9)',
    borderRadius: 10,
    marginHorizontal: 2,
    marginBottom: 4,
    gap: 8,
  },
  toggleGroupFull: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    gap: 5,
    direction: 'ltr',
  },
  // מעטפת חיצונית לגרדיאנט של שורות נבחרות
  rowGradientOuter: {
    borderRadius: 12,
    padding: 1,
    marginHorizontal: 2,
    marginBottom: 4,
  },
  // גווני גוגל — שורות הגלילה
  rowPlayers: {
    backgroundColor: 'rgba(52,168,83,0.92)',
  },
  rowRange: {
    backgroundColor: 'rgba(26,115,232,0.92)',
  },
  rowFractions: { backgroundColor: 'rgba(66,133,244,0.92)' },
  rowPossibleResults: { backgroundColor: 'rgba(234,67,53,0.92)' },
  rowSolveExercise: { backgroundColor: 'rgba(52,168,83,0.92)' },
  rowTimer: { backgroundColor: 'rgba(234,67,53,0.92)' },
  rowGuidance: { backgroundColor: 'rgba(26,115,232,0.92)' },
  /** מיכל לגלגלת טיימר — snapFocus=leading מצמיד את הצ'יפ הצהוב ליד התווית */
  timerWheelWrap: { flex: 1, minWidth: 0, marginStart: 4 },
  /** קטעים במודאל «מתקדמים» */
  advSection: {
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.42)',
  },
  advSectionHdr: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 2,
  },
  advHint: {
    fontSize: 11,
    lineHeight: 17,
    color: 'rgba(226,232,240,0.78)',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  rowLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', flexShrink: 0 },
  rowHint: { color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 16, flexShrink: 1 },
  rowSubHint: { color: 'rgba(255,255,255,0.88)', fontSize: 11, lineHeight: 16, flexShrink: 1 },
  // LTR: ברירת מחדל (האופציה הראשונה בכל מערך) תמיד משמאל גם תחת forceRTL
  toggleGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, direction: 'ltr' },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  toggleOn: {
    backgroundColor: '#FBBF24', borderColor: '#92400E', borderWidth: 2,
    ...Platform.select({
      ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.7, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  toggleOnVsBot: {
    backgroundColor: '#F97316', borderColor: 'rgba(249,115,22,0.65)',
    ...Platform.select({
      ios: { shadowColor: '#F97316', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.32, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  toggleOffVsBot: {
    backgroundColor: 'rgba(249,115,22,0.24)',
    borderColor: 'rgba(251,146,60,0.5)',
  },
  toggleOff: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
  toggleOnTxt: { fontSize: 12, fontWeight: '900', color: '#451A03' },
  toggleOnTxtVsBot: { color: '#3b1a00' },
  toggleOffTxtVsBot: { fontSize: 12, fontWeight: '700', color: 'rgba(255,237,213,0.96)' },
  toggleOffTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  modeToggleOn: {
    backgroundColor: '#FBBF24',
    borderColor: '#7C2D12',
    borderWidth: 2,
    ...Platform.select({
      ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.75, shadowRadius: 10 },
      android: { elevation: 7 },
    }),
  },
  modeToggleOff: {
    backgroundColor: 'rgba(15,23,42,0.45)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  modeToggleOnTxt: { fontSize: 12, fontWeight: '900', color: '#451A03' },
  modeToggleOffTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  modeRowGradientOuter: {
    ...Platform.select({
      ios: { shadowColor: '#FB923C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  modeRowRange: {
    backgroundColor: 'rgba(234,88,12,0.86)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, direction: 'ltr' },
  stepBtnWrap: {
    borderRadius: 10,
    ...Platform.select({
      ios: { shadowColor: '#e37400', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.5, shadowRadius: 6 },
      android: { elevation: 8 },
    }),
  },
  stepBtn: {
    width: 42, height: 58, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'rgba(251,188,5,0.5)',
    overflow: 'hidden',
  },
  stepBtnInner: {
    position: 'absolute', top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  stepBtnTxt: {
    fontSize: 28, fontWeight: '700', color: '#3c3c00',
    textShadowColor: 'rgba(255,255,255,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0,
  },
  stepVal: {
    fontSize: 26, fontWeight: '700', color: '#FFF', minWidth: 28, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  advancedEntryInner: {
    borderRadius: 11,
    marginHorizontal: 2,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(15,23,42,0.58)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  advancedEntryTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  advancedEntryTeaser: {
    color: 'rgba(254,249,195,0.98)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 8,
  },
  advancedEntryChipRow: {
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 10,
    alignItems: 'center',
  },
  advancedStageChip: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    opacity: 0.88,
  },
  advancedStageChipActive: {
    borderColor: '#FDE68A',
    borderWidth: 2,
    opacity: 1,
    ...Platform.select({
      ios: { shadowColor: '#FDE68A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  advancedStageChipTxt: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
  },
  advancedStageChipTxtActive: {
    color: '#FFFFFF',
  },
  advancedEntryCtaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignSelf: 'flex-start',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
      android: { elevation: 5 },
    }),
  },
  advancedEntryCtaTxt: {
    color: '#5b21b6',
    fontSize: 13,
    fontWeight: '900',
  },
  advancedEntryCtaArrow: {
    color: '#7c3aed',
    fontSize: 18,
    fontWeight: '900',
    marginTop: -1,
  },
});

/** שורת מצב משחק (מול בוט / במכשיר אחד) — משותף לגלגל ולמודאל מתקדמים */
function GameModeToggleBlock({
  gameMode,
  setGameMode,
}: {
  gameMode: 'pass-and-play' | 'vs-bot';
  setGameMode: (m: 'pass-and-play' | 'vs-bot') => void;
}) {
  const { t } = useLocale();
  return (
    <LinearGradient
      colors={['#EA580C', '#FB923C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[hsS.rowGradientOuter, hsS.modeRowGradientOuter]}
    >
      <View style={[hsS.row, hsS.rowRange, hsS.modeRowRange]}>
        <Text style={hsS.rowLabel}>{t('start.mode')}</Text>
        <View style={hsS.toggleGroup}>
          {([['pass-and-play', t('start.modePassAndPlay')], ['vs-bot', t('start.modeVsBot')]] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => {
                setGameMode(key);
                Keyboard.dismiss();
              }}
              activeOpacity={0.7}
              style={[
                hsS.toggleBtn,
                gameMode === key ? hsS.modeToggleOn : hsS.modeToggleOff,
              ]}
            >
              <Text
                style={[
                  gameMode === key ? hsS.modeToggleOnTxt : hsS.modeToggleOffTxt,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
}

/** רמת בוט + שם — רק במצב vs-bot; משותף לגלגל ולמודאל מתקדמים */
function BotDifficultySettingsBlock({
  botDifficulty,
  setBotDifficulty,
  botDisplayName,
  setBotDisplayName,
}: {
  botDifficulty: BotDifficulty;
  setBotDifficulty: (d: BotDifficulty) => void;
  botDisplayName: string;
  setBotDisplayName: (s: string) => void;
}) {
  const { t } = useLocale();
  return (
    <LinearGradient colors={['#1a73e8', '#4285F4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={hsS.rowGradientOuter}>
      <View style={{ paddingVertical: 10, paddingHorizontal: 4, gap: 10 }}>
        <View style={[hsS.row, hsS.rowRange, { paddingVertical: 0, marginBottom: 0 }]}>
          <Text style={hsS.rowLabel}>{t('start.botDifficulty')}</Text>
          <View style={hsS.toggleGroup}>
            {(
              [
                ['easy', t('start.botEasy')],
                ['medium', t('start.botMedium')],
                ['hard', t('start.botHard')],
              ] as const
            ).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => setBotDifficulty(key)}
                activeOpacity={0.7}
                style={[hsS.toggleBtn, botDifficulty === key ? hsS.toggleOn : hsS.toggleOff]}
              >
                <Text style={botDifficulty === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={{ alignSelf: 'stretch' }}>
          <Text style={[hsS.rowLabel, { fontSize: 12, marginBottom: 6 }]}>{t('start.botNameLabel')}</Text>
          <TextInput
            value={botDisplayName}
            onChangeText={setBotDisplayName}
            placeholder={t('start.botNamePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.45)"
            maxLength={24}
            style={{
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.28)',
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '600',
              backgroundColor: 'rgba(15,23,42,0.35)',
            }}
          />
        </View>
      </View>
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TURN TRANSITION
// ═══════════════════════════════════════════════════════════════

// מוקאפ שם שחקן — מופיע פעם אחת, נשמר ב־AsyncStorage ולא מופיע שוב
const PLAYER_NAME_MODAL_SEEN_KEY = 'lulos_player_name_modal_seen';
/** שם השחקן האנושי — נשמר אחרי הזנה ראשונה, משמש ב-startGame כדי לא לחזור ל-"שחקן 1". */
const PLAYER_SAVED_NAME_KEY = 'lulos_player_saved_name';

/** האם השם הוא ברירת מחדל (שחקן N) — אם כן, תמיד להציג את המוקאפ גם אם המפתח נשמר (ועדת חקירה: מונע "הוא לא מופיע") */
function isDefaultPlayerName(name: string): boolean {
  const n = (name || '').trim();
  return /^שחקן \d+$/.test(n) || /^Player \d+$/i.test(n);
}

/** מוקאפ חדש להכנסת שם — מנהל visibility בעצמו מ־AsyncStorage, state מקומי לשם בלבד (לא סוגר בהקלדה). forceOpen = פתיחה מכפתור במסך השחקן */
function PlayerNameModal({
  initialName,
  playerSlot,
  onConfirm,
  forceOpen,
  onClose,
}: {
  initialName: string;
  /** 1-based — אם השדה ריק באישור, שם ברירת מחדל: "שחקן {playerSlot}" */
  playerSlot: number;
  onConfirm: (name: string) => void;
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const { t } = useLocale();
  const [show, setShow] = useState<boolean>(true);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    sendDebugLog('H5', 'index.tsx:PlayerNameModal.useEffect', 'PlayerNameModal state', {
      show,
      initialName,
      forceOpen: Boolean(forceOpen),
      playerSlot,
    });
  }, [show, initialName, forceOpen, playerSlot]);

  useEffect(() => {
    if (forceOpen) {
      setShow(true);
      return;
    }
    AsyncStorage.getItem(PLAYER_NAME_MODAL_SEEN_KEY).then((v) => {
      // אחרי אישור (גם בלי להקליד שם) לא חוזרים על המודל — מספיק "נראה" ב־AsyncStorage
      setShow(v !== 'true');
    });
  }, [initialName, forceOpen]);

  useEffect(() => {
    if (show) setName(initialName);
  }, [show, initialName]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    const fallback = (initialName || '').trim() || t('start.playerPlaceholder', { n: String(playerSlot) });
    const finalName = (trimmed || fallback).slice(0, 7);
    sendDebugLog('H5', 'index.tsx:PlayerNameModal.handleConfirm', 'Name confirm pressed', {
      typedName: name,
      trimmed,
      fallback,
      finalName,
    });
    AsyncStorage.setItem(PLAYER_NAME_MODAL_SEEN_KEY, 'true');
    // Persist the name for future games so startGame uses it instead of
    // reverting to "שחקן 1" every time.
    void AsyncStorage.setItem(PLAYER_SAVED_NAME_KEY, finalName);
    setShow(false);
    onConfirm(finalName);
    onClose?.();
  };

  const handleRequestClose = () => {
    setShow(false);
    onClose?.();
    Keyboard.dismiss();
  };

  if (!show) return null;

  return (
    <RNModal transparent animationType="fade" onRequestClose={handleRequestClose} statusBarTranslucent visible={true}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
        <LinearGradient
          colors={['rgba(0,0,0,0.97)', 'rgba(6,8,18,0.94)', 'rgba(0,0,0,0.96)']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}
        >
          <ScrollView contentContainerStyle={{flexGrow:1,justifyContent:'center',alignItems:'center'}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View
              style={{
                backgroundColor: 'rgba(30,41,59,0.98)',
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderWidth: 2,
                borderColor: '#FACC15',
                maxWidth: 340,
                width: '100%',
                ...Platform.select({
                  ios: {
                    shadowColor: '#FACC15',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 28,
                  },
                  android: { elevation: 18 },
                }),
              }}
            >
              <Text style={{color:'#FDE68A',fontSize:18,fontWeight:'800',textAlign:'center',marginBottom:10}}>{t('player.namePrompt')}</Text>
              <TextInput
                value={name}
                onChangeText={(txt) => {
                  const sliced = txt.slice(0, 7);
                  sendDebugLog('H5', 'index.tsx:PlayerNameModal.onChangeText', 'Name input changed', {
                    rawLength: txt.length,
                    slicedLength: sliced.length,
                    value: sliced,
                  });
                  setName(sliced);
                }}
                onFocus={() => {
                  if (isDefaultPlayerName(name)) setName('');
                }}
                placeholder=""
                placeholderTextColor="rgba(255,255,255,0.4)"
                maxLength={7}
                editable
                blurOnSubmit={false}
                style={{
                  backgroundColor: 'rgba(15,23,42,0.95)',
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: 'rgba(255,215,0,0.4)',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  color: '#FFF',
                  fontSize: 18,
                  fontWeight: '700',
                  textAlign: 'center',
                  marginBottom: 14,
                }}
              />
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <CasinoButton text={t('ui.confirm')} width={220} height={48} fontSize={19} onPress={handleConfirm} />
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

/** פעם ראשונה במסך השחקן (TurnTransition) — בועת ברוכים */
const WELCOME_PLAYER_SCREEN_KEY = 'lulos_welcome_player_screen_seen';

/** מצב מקוצר: עד 3 כפתורים (המשחק תומך עד 6 משתתפים). תמיד כולל את השחקן בתור, ואז משלימים עד maxCollapsed */
const COLLAPSED_PLAYER_CHIP_COUNT = 3;
function getVisiblePlayerChips(players: Player[], currentPlayerIndex: number, showAll: boolean, maxCollapsed: number): Player[] {
  if (showAll) return [...players].sort((a, b) => a.hand.length - b.hand.length);
  const sorted = [...players].sort((a, b) => a.hand.length - b.hand.length);
  const cp = players[currentPlayerIndex];
  if (!cp) return sorted.slice(0, maxCollapsed);
  const others = sorted.filter((p) => p.id !== cp.id);
  const out: Player[] = [cp];
  for (const p of others) {
    if (out.length >= maxCollapsed) break;
    out.push(p);
  }
  return out;
}

const playerTurnChipActiveRing = {
  padding: 0,
} as const;

const START_TURN_TIMER_SECONDS = 15;

function StartTurnCountdownCircle({ deadlineAt, size = 74, soundEnabled = true, containerStyle, labelStyle, showLabel = true }: { deadlineAt: number | null; size?: number; soundEnabled?: boolean; containerStyle?: any; labelStyle?: any; showLabel?: boolean }) {
  const { t } = useLocale();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const tickLastSecondRef = useRef<number | null>(null);
  const prevDeadlineRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset nowMs immediately when a new deadline is set to avoid stale display
    if (deadlineAt != null && deadlineAt !== prevDeadlineRef.current) {
      prevDeadlineRef.current = deadlineAt;
      setNowMs(Date.now());
      tickLastSecondRef.current = null;
    }
    if (deadlineAt == null) { prevDeadlineRef.current = null; return; }
    const id = setInterval(() => setNowMs(Date.now()), 120);
    return () => clearInterval(id);
  }, [deadlineAt]);

  const totalMs = START_TURN_TIMER_SECONDS * 1000;
  const remainingMs = deadlineAt == null ? 0 : Math.max(0, deadlineAt - nowMs);
  const progress = Math.max(0, Math.min(1, remainingMs / totalMs));
  const sec = Math.ceil(remainingMs / 1000);

  useEffect(() => {
    if (!soundEnabled) { tickLastSecondRef.current = null; return; }
    if (sec < 1 || sec > 3) return;
    if (tickLastSecondRef.current === sec) return;
    tickLastSecondRef.current = sec;
    const key = sec === 1 ? 'timerEnd' : 'timerTick';
    void playSfx(key, { cooldownMs: 0, volumeOverride: 0.55 });
  }, [sec, soundEnabled]);

  if (deadlineAt == null) return null;

  const stroke = Math.max(2, Math.min(7, Math.round(size * 0.14)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const digitFontSize = Math.max(10, Math.round(size * 0.36));

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, containerStyle]}>
      <View style={{ width: size, height: size }} pointerEvents="none">
        <Svg width={size} height={size}>
          <SvgCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(245,216,96,0.28)"
            strokeWidth={stroke}
            fill="rgba(32,20,4,0.62)"
          />
          <SvgCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F5D860"
            strokeWidth={stroke}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        </Svg>
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FDE68A', fontSize: digitFontSize, fontWeight: '900' }}>{sec}</Text>
        </View>
      </View>
      {showLabel && (
        <Text style={[{ color: '#FDE68A', fontSize: 11, fontWeight: '700', marginTop: 4 }, labelStyle]}>{t('ui.turnTimerLabel')}</Text>
      )}
    </View>
  );
}

/** רמז פרא כקלף זהה — כוכב מודגש + טקסט (Sheet C, בועת חץ, ברוכים) */
function IdenticalWildStarHint({ compact }: { compact?: boolean }) {
  const { t, isRTL } = useLocale();
  const { state } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  const hasWildInHand = !!cp?.hand?.some((card) => card.type === 'wild');
  if (!hasWildInHand) return null;
  const starSize = compact ? 30 : 44;
  return (
    <View
      style={{
        marginTop: compact ? 8 : 12,
        alignItems: 'center',
        alignSelf: 'stretch',
        backgroundColor: 'rgba(88,28,135,0.38)',
        borderRadius: 14,
        paddingVertical: compact ? 8 : 12,
        paddingHorizontal: compact ? 8 : 12,
        borderWidth: 2,
        borderColor: 'rgba(250,204,21,0.7)',
      }}
    >
      <Text
        style={{
          fontSize: starSize,
          lineHeight: starSize + 4,
          color: '#FDE047',
          fontWeight: '900',
          textShadowColor: '#A855F7',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: compact ? 6 : 10,
          marginBottom: compact ? 4 : 8,
        }}
      >
        ★
      </Text>
      <Text
        style={{
          color: '#FEF9C3',
          fontSize: compact ? 11 : 13,
          fontWeight: '700',
          textAlign: 'center',
          lineHeight: compact ? 16 : 21,
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {t('ui.wildIdenticalHint')}
      </Text>
    </View>
  );
}

function TurnTransition() {
  const { t, isRTL } = useLocale();
  const ta = isRTL ? 'right' : 'left';
  const { state, dispatch } = useGame();
  const soundOn = state.soundsEnabled !== false;
  const mp = useMultiplayerOptional();
  const { profile } = useAuth();
  const cp = state.players[state.currentPlayerIndex];
  const myPlayerIndex = (state as { myPlayerIndex?: number }).myPlayerIndex;
  const myPlayerState =
    typeof myPlayerIndex === 'number' ? (state.players[myPlayerIndex] as any) : null;
  const isEliminatedSpectator = !!myPlayerState?.isEliminated || !!myPlayerState?.isSpectator;
  const isOnlineSpectator =
    !!mp?.gameOverride && typeof myPlayerIndex === 'number' && (state.currentPlayerIndex !== myPlayerIndex || isEliminatedSpectator);
  const isMyTurnOnline =
    !!mp?.gameOverride && typeof myPlayerIndex === 'number' && state.currentPlayerIndex === myPlayerIndex && !isEliminatedSpectator;
  const isLocalBotTurn =
    !mp?.gameOverride &&
    !!(
      state.botConfig &&
      cp &&
      state.botConfig.playerIds.includes(cp.id) &&
      state.phase !== 'game-over'
    );
  const lockUiForBotTurn = isLocalBotTurn && !state.isTutorial;
  const showOnlineBotDifficultyBtn = !!mp?.gameOverride && state.hostBotDifficulty != null;
  const currentIdx = state.currentPlayerIndex;
  const lastPlayerIndex = (state.currentPlayerIndex - 1 + state.players.length) % Math.max(state.players.length, 1);
  const PLAYER_BUBBLE_COLORS = ['#14532d', '#1d4ed8', '#7c2d12', '#4b5563'] as const;
  const PLAYER_BUBBLE_BORDER_COLORS = ['rgba(74,222,128,0.7)', 'rgba(129,140,248,0.7)', 'rgba(248,113,113,0.7)', 'rgba(156,163,175,0.7)'] as const;
  const lastPlayerBubbleColor = PLAYER_BUBBLE_COLORS[lastPlayerIndex % PLAYER_BUBBLE_COLORS.length];
  const lastPlayerBorderColor = PLAYER_BUBBLE_BORDER_COLORS[lastPlayerIndex % PLAYER_BUBBLE_BORDER_COLORS.length];
  const [tooltipCard, setTooltipCard] = useState<Card | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [onlineBotDiffOpen, setOnlineBotDiffOpen] = useState(false);
  const [cardsCatalogOpen, setCardsCatalogOpen] = useState(false);
  const [handHintDismissed, setHandHintDismissed] = useState(false);
  /** כפתור "אני מוכן" חייב להיות זמין תמיד במסך מעבר תור */
  const beginTurnEnabled = true;
  const [localStartTurnDeadlineAt, setLocalStartTurnDeadlineAt] = useState<number | null>(null);
  const startTurnTimeoutFiredRef = useRef(false);
  const [startTurnNowMs, setStartTurnNowMs] = useState(() => Date.now());
  const turnPhaseRef = useRef(state.phase);
  const turnPlayerIdxRef = useRef(state.currentPlayerIndex);
  const beginReadyBlinkOpacity = useRef(new Animated.Value(1)).current;
  const beginReadyBlinkLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  /** null לפני הידרציה נחשב «הדרכה דולקת» — כמו ב־reducer (guidanceEnabled !== false) */
  const guidanceOn = state.guidanceEnabled !== false;

  // "אותגרת!" challenge bubble — surfaces on the turn-transition screen when
  // the incoming player is the fraction-attack target. Dedup'd per attack so
  // it fires once and re-fires only when a new attack begins.
  const fracChallengeTransitionKeyRef = useRef('');
  useEffect(() => {
    if (state.phase !== 'turn-transition') return;
    if (state.pendingFractionTarget === null || state.fractionAttackResolved) return;
    const dedupeKey = `frac-${state.roundsPlayed}-${state.currentPlayerIndex}-${state.pendingFractionTarget}-${state.fractionPenalty}`;
    if (fracChallengeTransitionKeyRef.current === dedupeKey) return;
    const challengedPlayer = state.players[state.currentPlayerIndex] ?? null;
    if (!challengedPlayer) return;
    const challengedIsBot =
      state.botConfig?.playerIds.includes(challengedPlayer.id) === true ||
      (challengedPlayer as { isBot?: boolean }).isBot === true;
    if (challengedIsBot) {
      fracChallengeTransitionKeyRef.current = dedupeKey;
      return;
    }
    const onlineGame = !!mp?.gameOverride;
    const isChallengedMe = onlineGame
      ? myPlayerIndex === state.currentPlayerIndex
      : true;
    fracChallengeTransitionKeyRef.current = dedupeKey;
    dispatch({
      type: 'PUSH_NOTIFICATION',
      payload: {
        id: `frac-challenge-${dedupeKey}`,
        title: isChallengedMe
          ? t('notification.fractionAttack.titleSelf')
          : t('notification.fractionAttack.titleWatch'),
        message: '',
        body: isChallengedMe
          ? t('notification.fractionAttack.bodySelf', {
              target: String(Math.round(state.pendingFractionTarget)),
              penalty: String(state.fractionPenalty),
            })
          : t('notification.fractionAttack.bodyWatch', {
              name: challengedPlayer.name,
              target: String(Math.round(state.pendingFractionTarget)),
              penalty: String(state.fractionPenalty),
            }),
        emoji: '⚔️',
        style: 'warning',
        requireAck: isChallengedMe,
        autoDismissMs: isChallengedMe ? undefined : 14000,
      },
    });
  }, [
    state.phase,
    state.pendingFractionTarget,
    state.fractionAttackResolved,
    state.fractionPenalty,
    state.currentPlayerIndex,
    state.roundsPlayed,
    state.players,
    state.botConfig,
    mp?.gameOverride,
    myPlayerIndex,
    dispatch,
    t,
  ]);

  const [playerWelcomeDismissed, setPlayerWelcomeDismissed] = useState(true);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(WELCOME_PLAYER_SCREEN_KEY)
      .then((v) => {
        if (!cancelled) setPlayerWelcomeDismissed(v === 'true');
      })
      .catch(() => {
        if (!cancelled) setPlayerWelcomeDismissed(false);
      });
    return () => { cancelled = true; };
  }, []);
  const dismissPlayerWelcome = useCallback(() => {
    setPlayerWelcomeDismissed(true);
    AsyncStorage.setItem(WELCOME_PLAYER_SCREEN_KEY, 'true');
  }, []);
  const showPlayerWelcomeBubble = guidanceOn && !isOnlineSpectator && !playerWelcomeDismissed && !state.isTutorial;
  useEffect(() => {
    turnPhaseRef.current = state.phase;
    turnPlayerIdxRef.current = state.currentPlayerIndex;
  }, [state.phase, state.currentPlayerIndex]);
  useEffect(() => {
    if (state.phase !== 'turn-transition') {
      setLocalStartTurnDeadlineAt(null);
      startTurnTimeoutFiredRef.current = false;
      return;
    }
    if (isOnlineSpectator) {
      setLocalStartTurnDeadlineAt(null);
      startTurnTimeoutFiredRef.current = false;
      return;
    }
    if (isLocalBotTurn) {
      setLocalStartTurnDeadlineAt(null);
      startTurnTimeoutFiredRef.current = false;
      return;
    }
    if (mp?.gameOverride) {
      setLocalStartTurnDeadlineAt(null);
      startTurnTimeoutFiredRef.current = false;
      return;
    }
    const deadline = Date.now() + START_TURN_TIMER_SECONDS * 1000;
    setLocalStartTurnDeadlineAt(deadline);
    startTurnTimeoutFiredRef.current = false;
    const id = setInterval(() => {
      if (startTurnTimeoutFiredRef.current) return;
      if (Date.now() < deadline) return;
      startTurnTimeoutFiredRef.current = true;
      dispatch({ type: 'DRAW_CARD' });
      setLocalStartTurnDeadlineAt(null);
    }, 180);
    return () => clearInterval(id);
  }, [state.phase, state.currentPlayerIndex, state.roundsPlayed, isOnlineSpectator, isLocalBotTurn, mp?.gameOverride, dispatch]);
  const startTurnDeadlineAt = isLocalBotTurn ? null : (isMyTurnOnline ? (state.turnDeadlineAt ?? null) : localStartTurnDeadlineAt);
  const showSmallTurnTimerHint = state.roundsPlayed < TURN_TIMER_HINT_UNTIL_ROUNDS_PLAYED;
  useEffect(() => {
    if (startTurnDeadlineAt == null) return;
    const id = setInterval(() => setStartTurnNowMs(Date.now()), 140);
    return () => clearInterval(id);
  }, [startTurnDeadlineAt]);
  const startTurnSecsLeft = startTurnDeadlineAt == null
    ? null
    : Math.max(0, Math.ceil((startTurnDeadlineAt - startTurnNowMs) / 1000));
  const shouldBlinkBeginTurn = !!(
    !isOnlineSpectator &&
    !isLocalBotTurn &&
    beginTurnEnabled &&
    state.phase === 'turn-transition' &&
    startTurnSecsLeft != null &&
    startTurnSecsLeft > 0 &&
    startTurnSecsLeft <= 5
  );
  useEffect(() => {
    beginReadyBlinkLoopRef.current?.stop();
    beginReadyBlinkLoopRef.current = null;
    if (!shouldBlinkBeginTurn) {
      beginReadyBlinkOpacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beginReadyBlinkOpacity, { toValue: 0.35, duration: 280, useNativeDriver: true }),
        Animated.timing(beginReadyBlinkOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ])
    );
    beginReadyBlinkLoopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      beginReadyBlinkLoopRef.current = null;
      beginReadyBlinkOpacity.setValue(1);
    };
  }, [shouldBlinkBeginTurn, beginReadyBlinkOpacity]);
  const emptySet = useMemo(() => new Set<string>(), []);
  const cardSoundRef = useRef<Audio.Sound | null>(null);
  const cardSoundLoadingRef = useRef(false);
  useEffect(() => {
    (async () => {
      if (cardSoundRef.current) return;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(require('./assets/card_select.mov'));
        cardSoundRef.current = sound;
      } catch (e) {
        if (__DEV__) console.warn('[card_select] טעינה נכשלה (מסך שחקן). העתק card_select.mov ל־card/assets/', e);
      }
    })();
    return () => {
      const s = cardSoundRef.current;
      if (s) s.unloadAsync().catch(() => {});
      cardSoundRef.current = null;
    };
  }, []);
  const playCardSelectSound = useCallback(() => {
    if (!soundOn) return;
    const sound = cardSoundRef.current;
    if (sound) {
      sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
      return;
    }
    if (cardSoundLoadingRef.current) return;
    cardSoundLoadingRef.current = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(require('./assets/card_select.mov'));
        cardSoundRef.current = sound;
        if (!soundOn) return;
        await sound.playAsync();
      } catch (e) {
        if (__DEV__) console.warn('[card_select] טעינה בלחיצה נכשלה (מסך שחקן).', e);
      }
      cardSoundLoadingRef.current = false;
    })();
  }, [soundOn]);
  useEffect(() => {
    if (soundOn) return;
    const sound = cardSoundRef.current;
    if (!sound) return;
    sound.stopAsync().catch(() => {});
  }, [soundOn]);

  const [editingPlayerIndex, setEditingPlayerIndex] = useState<number | null>(null);
  const handlePlayerNameConfirm = useCallback((name: string) => {
    const targetIndex = editingPlayerIndex ?? currentIdx;
    dispatch({ type: 'UPDATE_PLAYER_NAME', playerIndex: targetIndex, name });
    setEditingPlayerIndex(null);
  }, [dispatch, currentIdx, editingPlayerIndex]);

  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [tournamentInfoOpen, setTournamentInfoOpen] = useState(false);
  const visiblePlayers = useMemo(
    () => getVisiblePlayerChips(state.players, state.currentPlayerIndex, showAllPlayers, COLLAPSED_PLAYER_CHIP_COUNT),
    [state.players, state.currentPlayerIndex, showAllPlayers]
  );
  const displayPlayers = useMemo(() => {
    const reversed = [...visiblePlayers].reverse();
    const activeIdx = reversed.findIndex((p) => p.id === cp?.id);
    if (activeIdx === -1 || reversed.length < 2) return reversed;
    const targetIdx = Math.floor(reversed.length / 2);
    const next = [...reversed];
    const [active] = next.splice(activeIdx, 1);
    next.splice(targetIdx, 0, active);
    const waitingPlayer = state.players[(state.currentPlayerIndex + 1) % Math.max(state.players.length, 1)];
    const waitingIdx = next.findIndex((p) => p.id === waitingPlayer?.id);
    const activeNowIdx = next.findIndex((p) => p.id === cp?.id);
    if (waitingIdx === -1 || activeNowIdx === -1 || waitingIdx === activeNowIdx) return next;
    const swapped = [...next];
    [swapped[activeNowIdx], swapped[waitingIdx]] = [swapped[waitingIdx], swapped[activeNowIdx]];
    return swapped;
  }, [visiblePlayers, cp?.id, state.players, state.currentPlayerIndex]);
  const hasMorePlayers = state.players.length > COLLAPSED_PLAYER_CHIP_COUNT && !showAllPlayers;
  const topDiscardCard = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : null;
  const lastMoveChallengeLine = useMemo(() => null, []);
  const turnTimerBannerValue =
    state.timerSetting === 'custom'
      ? (state.timerCustomSeconds >= 60
        ? `${Math.floor(state.timerCustomSeconds / 60)}:${String(state.timerCustomSeconds % 60).padStart(2, '0')}`
        : `${state.timerCustomSeconds}s`)
      : state.timerSetting === '60'
        ? '1:00'
        : state.timerSetting === '30'
          ? '30s'
          : null;
  const compactPlayerScreen = state.roundsPlayed > 0;

  if (!cp) return null;

  // Sort cards identically to PlayerHand
  const sorted = sortHandCards(cp.hand);

  const getCardTooltip = (card: Card): string => {
    switch (card.type) {
      case 'number': return `קלף מספר (${card.value}) — הנח אותו בתרגיל כדי לפתור את המשוואה`;
      case 'fraction': {
        const fracTips: Record<string, string> = {
          '1/2': 'קלף שבר — מחלק את היעד ב-2. יעד 10 הופך ל-5. גם קלף התקפה: הנח על הערימה כדי לאתגר את השחקן הבא.',
          '1/3': 'קלף שבר — מחלק את היעד ב-3. יעד 9 הופך ל-3. גם קלף התקפה: הנח על הערימה כדי לאתגר את השחקן הבא.',
          '1/4': 'קלף שבר — מחלק את היעד ב-4. יעד 12 הופך ל-3. גם קלף התקפה: הנח על הערימה כדי לאתגר את השחקן הבא.',
          '1/5': 'קלף שבר — מחלק את היעד ב-5. יעד 10 הופך ל-2. גם קלף התקפה: הנח על הערימה כדי לאתגר את השחקן הבא.',
        };
        return fracTips[card.fraction] ?? `קלף שבר (${card.fraction}). גם קלף התקפה — הנח על הערימה כדי לאתגר את השחקן הבא.`;
      }
      case 'operation': return `קלף פעולה (${card.operation}) — שלב אותו בתוך התרגיל כדי להיפטר מהקלף.`;
      case 'joker': return `ג'וקר — תחליף לסימן (+, −, ×, ÷). שלבו אותו בתרגיל והיפטרו מקלף. לא מגן מפני אתגר שבר.`;
      case 'wild': return `קלף פרא — נספר ככל מספר 0–25. הנח בתרגיל או זהה לערימה כדי להיפטר ממנו.`;
      default: return '';
    }
  };

  const safe = useSafeAreaInsets();
  // קפיאת safe area למיקום המניפה — קופא רק אחרי שיש insets אמיתיים (מונע 0 בריענון)
  const safeFrozen = useRef<{ top: number; bottom: number } | null>(null);
  if (safeFrozen.current === null && (safe.top > 0 || safe.bottom > 0)) safeFrozen.current = { top: safe.top, bottom: safe.bottom };
  const safeBottom = (safeFrozen.current ?? safe).bottom;

  // בדיקת פריסת יד (פיתוח בלבד)
  devCheckHandLayout();
  const HEADER_PAD = 0;
  const BTN_STRIP_H = HAND_BOTTOM_OFFSET;
  return (
    <View style={{ flex: 1, width: SCREEN_W, minHeight: 0, overflow: 'visible' }} collapsable={false}>
      {/* רקע נפרד ממסך המשחק — מסך המשחק משתמש ב־bg.jpg; כאן מעבר כחול כדי שלא ייראה כמו אותו מסך.
          בטוטוריאל אנחנו מחליפים לכהה אטום כדי שלא יציץ כחול שקוף סביב המניפה. */}
      {state.isTutorial ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a1628' }]} />
      ) : (
        <LinearGradient colors={[...playerScreensGradientColors]} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {lockUiForBotTurn ? (
        <View
          pointerEvents="auto"
          style={[StyleSheet.absoluteFillObject, { zIndex: 300, backgroundColor: 'transparent' }]}
        />
      ) : null}
      <View style={{ flex: 1, paddingTop: HEADER_PAD, paddingBottom: Math.max(safeBottom, 20), overflow: 'visible' }}>
      {/* ── Header — מצב נקי אחרי תור ראשון: רק יציאה/טורניר/מד ושחקנים ── */}
      <View pointerEvents="box-none" style={{flexDirection:'row',direction:'ltr' as any,alignItems:'flex-start',justifyContent:'space-between',paddingHorizontal:12,paddingTop: safe.top || 6,paddingBottom:6}}>
        <View style={{flexShrink:0,flexDirection:'column',alignItems:'center',gap:0,marginTop:-65}}>
          <LulosButton text={t('ui.exitGame')} color="red" width={72} height={32} fontSize={11} onPress={()=>{ if (state.isTutorial) tutorialBus.emitRequestExit(); else dispatch({type:'RESET_GAME'}); }} style={{ marginBottom: -8 }} />
          {!state.isTutorial && (
            <LulosButton text={t('ui.tournament')} color="orange" width={72} height={32} fontSize={11} onPress={() => setTournamentInfoOpen(true)} style={{ marginBottom: -8 }} />
          )}
          <LulosButton text={soundOn ? '🔊' : '🔇'} color="blue" width={56} height={32} fontSize={14} onPress={() => dispatch({ type: 'SET_SOUNDS_ENABLED', enabled: !soundOn })} />
          {!state.isTutorial && (() => { const hp = state.players.find(p => !p.isBot) ?? (state.players.length === 1 ? state.players[0] : null); return hp ? (
            <View style={{ marginTop: 10, alignItems: 'center', gap: 4, marginLeft: -6 }}>
              <ExcellenceMeter
                value={hp.courageMeterPercent ?? 0}
                pulseKey={hp.courageRewardPulseId ?? 0}
                isCelebrating={state.lastCourageCoinsAwarded}
                compact
              />
            </View>
          ) : null; })()}
        </View>
        <View pointerEvents="box-none" style={{flexDirection:'column',alignItems:'flex-end',gap:2,flex:1,minWidth:0,marginTop:-65,marginLeft:8}}>
          {/* תגי מידע (שברים/טיימר/פתרון תרגיל) הועברו לטורניר — שורות 446, 458, 461 ב-TournamentInfoModal */}
          <View style={{flexDirection:'row-reverse',alignItems:'center',gap:4,flexWrap:'wrap',justifyContent:'flex-end',alignSelf:'flex-end',marginTop:2,marginRight:4}}>
            {!state.isTutorial && displayPlayers.map((p) => {
              const isCurrent = cp?.id === p.id;
              const shortName = (p.name || 'שחקן').length > 5 ? (p.name || 'שחקן').slice(0, 4) + '…' : (p.name || 'שחקן');
              const btnText = isCurrent ? `${shortName}\nיש לך ${p.hand.length} קלפים` : `${shortName}\n${p.hand.length} קלפים`;
              const btn = (
                <LulosButton
                  text={btnText}
                  color={isCurrent ? 'green' : 'blue'}
                  width={124}
                  height={64}
                  fontSize={14}
                  onPress={() => {
                    if (!p.isBot) return;
                    if (!isDefaultPlayerName(p.name)) return;
                    const idx = state.players.findIndex((x) => x.id === p.id);
                    if (idx < 0) return;
                    setEditingPlayerIndex(idx);
                    setNameModalOpen(true);
                  }}
                />
              );
              if (isCurrent) {
                return (
                  <View key={p.id} style={playerTurnChipActiveRing}>
                    {btn}
                  </View>
                );
              }
              return (
                <View key={p.id} style={{ opacity: 0.34 }}>
                  {btn}
                </View>
              );
            })}
            {hasMorePlayers && (
              <TouchableOpacity onPress={() => setShowAllPlayers(true)} style={{marginLeft:4,width:56,height:56,borderRadius:28,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'}}>
                <Text style={{fontSize:28,fontWeight:'700',color:'#FFF'}}>+</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      {!compactPlayerScreen && turnTimerBannerValue && (
        <View style={{ alignItems: 'center', paddingHorizontal: 12, paddingTop: 2, paddingBottom: 8 }}>
          <View style={[alertBubbleStyle.box, { paddingVertical: 6, paddingHorizontal: 12 }]}>
            <Text style={[alertBubbleStyle.body, { marginTop: 0, fontWeight: '800', textAlign: 'center' }]}>
              {t('ui.timedGameBanner', { value: turnTimerBannerValue })}
            </Text>
          </View>
        </View>
      )}

      <TournamentInfoModal
        visible={tournamentInfoOpen}
        onClose={() => setTournamentInfoOpen(false)}
        rows={getTournamentRowsForModal(state)}
        gameInfo={{
          modeLabel: state.mode === 'vs-bot' ? 'נגד בוט' : 'מסירה בין שחקנים',
          difficultyLabel: state.difficulty === 'easy' ? 'קל' : 'מלא',
          playersCount: state.players.length,
          diceModeLabel: state.diceMode === '2' ? '2 קוביות' : '3 קוביות',
        }}
        onOpenRules={() => setRulesOpen(true)}
        settings={{
          mathRangeMax: state.mathRangeMax,
          showFractions: state.showFractions,
          fractionKinds: state.fractionKinds,
          enabledOperators: state.enabledOperators,
          allowNegativeTargets: state.allowNegativeTargets,
          showPossibleResults: state.showPossibleResults,
          showSolveExercise: state.showSolveExercise,
          timerSetting: state.timerSetting,
          timerCustomSeconds: state.timerCustomSeconds,
        }}
      />

      <View style={{flex:1,paddingBottom:BTN_STRIP_H + HAND_STRIP_HEIGHT}}>
      {/* ── מידע — הודעות וטולטיפ (תגיות הועברו ל־Header) ── */}
      <View style={{flex:1,minHeight:60,paddingHorizontal:24,alignItems:'center',justifyContent:'center'}}>
        {(!compactPlayerScreen || !!state.lastMoveMessage || state.lastDiscardCount === 1) ? (
          <>
        {!showPlayerWelcomeBubble && (
          <View style={{ height: 0 }} />
        )}
        {/* Last move summary — הודעות צבעוניות (ללא כפילות במצב אתגר שבר) */}
        {!!state.lastMoveMessage && state.pendingFractionTarget === null && !state.isTutorial && (
          state.lastDiscardCount > 0 && state.lastEquationDisplay ? (
            <View style={{alignSelf:'center',marginBottom:8,maxWidth:340,width:'100%',alignItems:'center'}}>
              <View style={[alertBubbleStyle.box, { backgroundColor: lastPlayerBubbleColor, borderColor: lastPlayerBorderColor }]}>
                <Text style={[alertBubbleStyle.title, {textAlign:'center'}]}>{state.players[(currentIdx - 1 + state.players.length) % state.players.length].name} הניח {state.lastDiscardCount} קלפים</Text>
                <Text style={[alertBubbleStyle.body, {marginTop:6,textAlign:'center'}]}>{state.lastEquationDisplay}</Text>
                {lastMoveChallengeLine ? (
                  <Text style={[alertBubbleStyle.body, { marginTop: 8, textAlign: 'center', fontWeight: '700', color: '#FEF9C3' }]}>{lastMoveChallengeLine}</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={{alignSelf:'center',marginBottom:8,maxWidth:340,width:'100%',alignItems:'center'}}>
              <View style={[alertBubbleStyle.box, { backgroundColor: lastPlayerBubbleColor, borderColor: lastPlayerBorderColor }]}>
                <Text style={[alertBubbleStyle.title, { textAlign: 'center', writingDirection: 'rtl' }]}>{state.lastMoveMessage}</Text>
              </View>
            </View>
          )
        )}
        {state.lastDiscardCount === 1 && state.pendingFractionTarget === null && !state.players[lastPlayerIndex]?.isBot && !state.isTutorial && (
          <View style={{ alignSelf: 'center', marginBottom: 8, maxWidth: 360, width: '100%', alignItems: 'center' }}>
            <View
              style={[
                alertBubbleStyle.box,
                {
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  maxWidth: 340,
                  backgroundColor: '#0F766E',
                  borderColor: 'rgba(94,234,212,0.95)',
                  borderWidth: 3,
                },
              ]}
            >
              <Text
                style={[
                  alertBubbleStyle.title,
                  {
                    fontSize: 22,
                    color: '#ECFEFF',
                    textShadowColor: 'rgba(0,0,0,0.3)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                  },
                ]}
              >
                🎉 איזה יופי — יש לנו קלף פחות!
              </Text>
            </View>
          </View>
        )}
        {/* Excellence-meter reward explanation — shown once, after a turn in
            which the meter advanced (triple roll or equation played). The
            reason is cleared in BEGIN_TURN, so it's naturally one-shot. */}
        {!!state.lastCourageRewardReason && !state.players[lastPlayerIndex]?.isBot && !state.isTutorial && (
          <View style={{ alignSelf: 'center', marginBottom: 8, maxWidth: 360, width: '100%', alignItems: 'center' }}>
            <View
              style={[
                alertBubbleStyle.box,
                {
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  maxWidth: 340,
                  backgroundColor: '#B45309',
                  borderColor: '#FCD34D',
                  borderWidth: 3,
                },
              ]}
            >
              <Text
                style={[
                  alertBubbleStyle.title,
                  { fontSize: 16, color: '#FEF3C7', textAlign: 'center', marginBottom: 4 },
                ]}
              >
                {t('courage.reason.title')}
              </Text>
              <Text
                style={[
                  alertBubbleStyle.body,
                  { fontSize: 15, color: '#FFFBEB', textAlign: 'center', writingDirection: isRTL ? 'rtl' : 'ltr' },
                ]}
              >
                {state.lastCourageRewardReason}
              </Text>
            </View>
          </View>
        )}

        {/* +5 coins animated notification — shown only when meter fills and resets */}
        {!!state.lastCourageCoinsAwarded && !state.players[lastPlayerIndex]?.isBot && !state.isTutorial && (
          <View style={{ alignSelf: 'center', marginBottom: 8, maxWidth: 360, width: '100%', alignItems: 'center' }}>
            <View style={[alertBubbleStyle.box, { paddingVertical: 12, paddingHorizontal: 20, maxWidth: 340, backgroundColor: '#854D0E', borderColor: '#FDE68A', borderWidth: 3, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <SlindaCoin size={28} spin pulseKey={state.courageRewardPulseId} />
              <View style={{ flex: 1 }}>
                <Text style={[alertBubbleStyle.title, { fontSize: 18, color: '#FEF3C7', marginBottom: 2, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('courage.coinAward.title')}
                </Text>
                <Text style={{ color: '#FDE68A', fontSize: 13, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}>
                  {t('courage.coinAward.body')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Strip of mini-cards played in the previous turn */}
        {(state.lastTurnPlayedCards?.length ?? 0) > 0 && (
          <View style={{ alignSelf: 'center', marginBottom: 8, maxWidth: 340, width: '100%', alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>
              {t('ui.lastTurnPlayedCards')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingHorizontal: 8 }}>
              {(state.lastTurnPlayedCards ?? []).map((card: Card, i: number) => {
                if (card.type === 'number') {
                  return <MiniResultCard key={card.id} value={card.value!} index={i} />;
                }
                if (card.type === 'wild') {
                  // Purple — matches WildCard gradient (#7C3AED → #5B21B6)
                  const wLabel = card.resolvedValue != null ? String(card.resolvedValue) : '★';
                  return (
                    <View key={card.id} style={{ width: MINI_W, height: MINI_H, borderRadius: MINI_R, backgroundColor: '#5B21B6', borderWidth: 2, borderColor: '#A78BFA', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#EDE9FE', fontSize: 14, fontWeight: '900' }}>{wLabel}</Text>
                    </View>
                  );
                }
                if (card.type === 'operation') {
                  // Color-per-operator — matches opColors in game
                  const op = card.operation ?? '+';
                  const cl = opColors[op] ?? opColors['+'];
                  const opGlyph = opDisplay[op] ?? op;
                  return (
                    <View key={card.id} style={{ width: MINI_W, height: MINI_H, borderRadius: MINI_R, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderColor: cl.face, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: cl.face, fontSize: 16, fontWeight: '900' }}>{opGlyph}</Text>
                    </View>
                  );
                }
                if (card.type === 'fraction') {
                  // Color-per-denominator — matches fracColors in game
                  const den = (card.fraction ?? '1/2').split('/')[1] ?? '2';
                  const fc = fracColors[den] ?? numRed;
                  const fracLabel = card.fraction === '1/2' ? '½' : card.fraction === '1/3' ? '⅓' : card.fraction === '1/4' ? '¼' : card.fraction === '1/5' ? '⅕' : card.fraction ?? '?';
                  return (
                    <View key={card.id} style={{ width: MINI_W, height: MINI_H, borderRadius: MINI_R, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderColor: fc.face, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: fc.face, fontSize: 16, fontWeight: '900' }}>{fracLabel}</Text>
                    </View>
                  );
                }
                if (card.type === 'joker') {
                  // Rainbow border feel — matches JokerCard multicolor
                  return (
                    <View key={card.id} style={{ width: MINI_W, height: MINI_H, borderRadius: MINI_R, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderColor: '#EA4335', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#EA4335', fontSize: 16, fontWeight: '900' }}>★</Text>
                    </View>
                  );
                }
                return null;
              })}
            </ScrollView>
          </View>
        )}

        {/* Card tooltip — צבעוני (מסגרת זהב).
            בקלף פרא: רק "0–25" בסגול, שאר הטקסט צהוב.
            בקלף שבר: "יעד X הופך ל-Y" בצבע לפי המכנה. */}
        {tooltipCard && tooltipCard.type !== 'joker' && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setTooltipCard(null)}
            style={{
              backgroundColor: 'rgba(30,41,59,0.98)',
              borderRadius: 16,
              paddingHorizontal: 22,
              paddingVertical: 18,
              borderWidth: 2,
              borderColor: '#FACC15',
              maxWidth: 340,
              width: '100%',
              marginBottom: 8,
            }}
          >
            {tooltipCard.type === 'wild' ? (
              // פרא: טווח 0–25 בסגול
              <Text
                style={{
                  color: '#FDE68A',
                  fontSize: 17,
                  fontWeight: '700',
                  textAlign: 'center',
                  lineHeight: 26,
                }}
              >
                {'קלף פרא — נספר ככל מספר '}
                <Text style={{ color: '#A855F7' }}>0–25</Text>
                {' . הנח בתרגיל או זהה לערימה כדי להיפטר ממנו.'}
              </Text>
            ) : tooltipCard.type === 'fraction' && tooltipCard.fraction ? (
              // שבר: צובע את "מחלק את היעד ב-X. לדוגמה יעד X הופך ל-Y" בצבע face של מכנה הקלף
              (() => {
                let denom = 0;
                let from = 0;
                let to = 0;
                let color = '#FDE68A';
                switch (tooltipCard.fraction) {
                  case '1/2':
                    denom = 2;
                    from = 10;
                    to = 5;
                    color = fracColors['2']?.face ?? '#22C55E';
                    break;
                  case '1/3':
                    denom = 3;
                    from = 9;
                    to = 3;
                    color = fracColors['3']?.face ?? '#34A853';
                    break;
                  case '1/4':
                    denom = 4;
                    from = 12;
                    to = 3;
                    color = fracColors['4']?.face ?? '#FBBC05';
                    break;
                  case '1/5':
                    denom = 5;
                    from = 10;
                    to = 2;
                    color = fracColors['5']?.face ?? '#EA4335';
                    break;
                }
                return (
                  <Text
                    style={{
                      color: '#FDE68A',
                      fontSize: 17,
                      fontWeight: '700',
                      textAlign: 'center',
                      lineHeight: 26,
                    }}
                  >
                    {'קלף שבר — '}
                    {/* הקטע המוסבר (מכנה + דוגמה יעד X→Y) בצבע של המכנה */}
                    <Text style={{ color }}>
                      {'מחלק את היעד ב-'}
                      {denom}
                      {'. לדוגמה יעד '}
                      {from}
                      {' הופך ל-'}
                      {to}
                    </Text>
                    {' . גם קלף התקפה: הנח על הערימה כדי לאתגר את השחקן הבא.'}
                  </Text>
                );
              })()
            ) : (
              <Text
                style={{
                  color: '#FDE68A',
                  fontSize: 17,
                  fontWeight: '700',
                  textAlign: 'center',
                  lineHeight: 26,
                }}
              >
                {getCardTooltip(tooltipCard)}
              </Text>
            )}
          </TouchableOpacity>
        )}
          </>
        ) : null}
      </View>
      </View>
      </View>

      {/* מניפה: AppShell ללא paddingBottom — התחתית היא כבר פיזית; בלי bottom שלילי (הוא היה מיועד לשילוב עם AppShell מרופד) */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: HAND_BOTTOM_OFFSET + HAND_STRIP_HEIGHT, zIndex: 5 }} pointerEvents="box-none">
        <View style={{ position: 'absolute', bottom: HAND_BOTTOM_OFFSET, left: 0, right: 0, height: HAND_STRIP_HEIGHT, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 12 }}>
          {isOnlineSpectator ? (
            <Text style={{ color: '#93C5FD', fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 24, paddingHorizontal: 16 }}>
              תור של {cp?.name ?? 'שחקן'} — בהמשך המשחק הקלפים מוצגים רק אצל השחקן בתור. מעבר לשלב הבא יתבצע אחרי שהשחקן יאשר.
            </Text>
          ) : (
            <>
              {!handHintDismissed && !state.isTutorial && (
                <Text style={{fontSize:28,textAlign:'center',marginBottom:4}}>
                  👇
                </Text>
              )}
              <View style={{ height: HAND_INNER_HEIGHT, width: '100%', alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' }}>
                <SimpleHand
                  cards={sorted}
                  stagedCardIds={emptySet}
                  equationHandPlacedIds={EMPTY_ID_SET}
                  equationHandPendingId={null}
                  defenseValidCardIds={null}
                  forwardCardId={null}
                  onTap={(card) => {
                    if (!handHintDismissed) setHandHintDismissed(true);
                    if (soundOn) playCardSelectSound();
                    setTooltipCard(prev => prev?.id === card.id ? null : card);
                  }}
                />
              </View>
            </>
          )}
        </View>
      </View>
      {/* בלי pointerEvents במצב ריק — השכבה הייתה בולעת מגעים מעל המניפה (zIndex נמוך יותר) */}
      <View
        pointerEvents={isOnlineSpectator ? 'auto' : 'none'}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: BTN_STRIP_H, paddingBottom: safe.bottom, alignItems: 'center', justifyContent: 'center', zIndex: 10, overflow: 'visible' as const }}
      >
        {isOnlineSpectator ? (
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>ממתין לאישור השחקן…</Text>
        ) : null}
      </View>

      {!isOnlineSpectator && !isLocalBotTurn && !state.isTutorial && (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: GOLD_ACTION_BUTTON_TOP,
            left: 0,
            right: 0,
            // Must sit above NotificationZone (zIndex 9999) so notifications
            // never block the "I'm ready" button.
            zIndex: 10001,
            ...(Platform.OS === 'android' ? { elevation: 10001 } : {}),
            alignItems: 'center',
          }}
        >
          <View style={{ position: 'relative', alignItems: 'center', paddingHorizontal: 12 }}>
            <Animated.View style={{ opacity: beginReadyBlinkOpacity, alignItems: 'center', justifyContent: 'center' }}>
              <CasinoButton
                text={t('game.imReady')}
                width={220}
                height={48}
                fontSize={17}
                disabled={false}
                leadingContent={
                  startTurnDeadlineAt != null && !state.isTutorial ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <StartTurnCountdownCircle
                        deadlineAt={startTurnDeadlineAt}
                        size={Math.round(48 * 0.62)}
                        soundEnabled={soundOn}
                        containerStyle={{ marginBottom: 0 }}
                        showLabel={false}
                      />
                      <Text style={{ color: '#FDE047', fontSize: 10, fontWeight: '900', marginTop: -2 }}>▼</Text>
                    </View>
                  ) : undefined
                }
                onPress={() => {
                  dispatch({ type: 'BEGIN_TURN' });
                  const pressedForPlayer = turnPlayerIdxRef.current;
                  setTimeout(() => {
                    if (turnPhaseRef.current === 'turn-transition' && turnPlayerIdxRef.current === pressedForPlayer) {
                      dispatch({ type: 'BEGIN_TURN' });
                    }
                  }, 220);
                }}
              />
            </Animated.View>
            {startTurnDeadlineAt != null && showSmallTurnTimerHint && (
              <Text style={{ color: '#FDE68A', fontSize: 10, fontWeight: '600', marginTop: 8, textAlign: 'center', paddingHorizontal: 12, opacity: 0.92 }}>
                {t('ui.turnTimerLabel')}
              </Text>
            )}
          </View>
        </View>
      )}

      <AppModal
        visible={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title={t('start.rulesModalTitle')}
        overlayOpacity={0.82}
        topAligned
        boxStyle={{
          width: '100%',
          height: SCREEN_H - 150,
          maxHeight: SCREEN_H - 150,
          marginTop: 150,
          borderRadius: 0,
          backgroundColor: 'rgba(15,23,42,0.94)',
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.45)',
          padding: 0,
        }}
      >
        <RulesContent state={state} />
      </AppModal>
      <AppModal visible={cardsCatalogOpen} onClose={() => setCardsCatalogOpen(false)} title={t('start.catalogTitle')}>
        <CardsCatalogContent
          numberRange={state.difficulty}
          fractions={state.showFractions}
          enabledOperators={state.enabledOperators}
          fractionKinds={state.fractionKinds}
        />
      </AppModal>

      <OnlineBotDifficultyModal
        visible={onlineBotDiffOpen}
        onClose={() => setOnlineBotDiffOpen(false)}
        current={state.hostBotDifficulty}
        isHost={!!mp?.isHost}
        onSelectLevel={(d) => {
          mp?.emit('set_bot_difficulty', { difficulty: d });
          setOnlineBotDiffOpen(false);
        }}
      />

      {/* Name modal suppressed in vs-bot AND online — users enter their name once
          in ChoiceScreen/Lobby. Pass-and-play still auto-prompts each player.
          The chip in the header still opens the modal manually via nameModalOpen. */}
      {cp && !state.isTutorial && (
        (!state.botConfig && !mp?.gameOverride) || nameModalOpen
      ) && (
        <PlayerNameModal
          initialName={(editingPlayerIndex != null ? state.players[editingPlayerIndex]?.name : cp.name) ?? cp.name}
          playerSlot={(editingPlayerIndex ?? currentIdx) + 1}
          onConfirm={handlePlayerNameConfirm}
          forceOpen={nameModalOpen}
          onClose={() => {
            setNameModalOpen(false);
            setEditingPlayerIndex(null);
          }}
        />
      )}
      {showPlayerWelcomeBubble && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.72)',
            zIndex: 120,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 18,
          }}
        >
          <View style={{ maxWidth: 360, width: '100%', alignItems: 'center' }}>
            <HappyBubble
              tone="welcome"
              title={t('ui.welcomeHowTitle')}
              text={t('ui.welcomeHowBody')}
              withTail={false}
              maxWidth={340}
            />
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={dismissPlayerWelcome}
              style={{ marginTop: 16, backgroundColor: 'rgba(255,215,0,0.25)', borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.5)', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFD700', fontSize: 15, fontWeight: '800' }}>{t('ui.gotIt')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GAME SCREEN
// ═══════════════════════════════════════════════════════════════

function PlayerSidebar({
  rulesOpen,
  setRulesOpen,
  cardsCatalogOpen,
  setCardsCatalogOpen,
  showRulesButtonInSidebar = true,
}: {
  rulesOpen: boolean;
  setRulesOpen: (v: boolean) => void;
  cardsCatalogOpen: boolean;
  setCardsCatalogOpen: (v: boolean) => void;
  showRulesButtonInSidebar?: boolean;
}) {
  const { t } = useLocale();
  const { state } = useGame();
  const [showAll, setShowAll] = useState(false);
  const [historyPlayerId, setHistoryPlayerId] = useState<number | null>(null);
  const cp = state.players[state.currentPlayerIndex];
  const visible = useMemo(
    () => getVisiblePlayerChips(state.players, state.currentPlayerIndex, showAll, COLLAPSED_PLAYER_CHIP_COUNT),
    [state.players, state.currentPlayerIndex, showAll]
  );
  const hasMore = state.players.length > COLLAPSED_PLAYER_CHIP_COUNT && !showAll;

  const historyPlayerIndex = historyPlayerId != null
    ? state.players.findIndex((p) => p.id === historyPlayerId)
    : -1;
  const historyPlayer = historyPlayerIndex >= 0 ? state.players[historyPlayerIndex] : null;
  const playerMoves = historyPlayerIndex >= 0 ? state.moveHistory.filter((e) => e.playerIndex === historyPlayerIndex) : [];
  const totalDiscarded = playerMoves.reduce((s, e) => s + e.cardsDiscarded, 0);

  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
      {/* שורה אחת: שבבי שחקנים + חוקים — כדי שלא ישתלבו כמה ילדים ב־space-between מול יציאה (בעיה שנראית במולטיפלייר) */}
      <View style={{ flexDirection: 'row', direction: 'ltr' as any, alignItems: 'flex-start', justifyContent: 'flex-end', minWidth: 0 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 0, flexWrap: 'nowrap', minWidth: 0 }}>
          {visible.map((p) => {
            const isCurrent = cp?.id === p.id;
            const shortName = p.name.length > 5 ? p.name.slice(0, 4) + '…' : p.name;
            const meterPct = Math.max(0, Math.min(100, p.courageMeterPercent ?? 0));
            const chip = (
              <View style={{ alignItems: 'center', gap: 2 }}>
                <LulosButton
                  text={`${shortName} ${p.hand.length}`}
                  color={isCurrent ? 'green' : 'blue'}
                  width={72}
                  height={32}
                  fontSize={10}
                  onPress={undefined}
                />
                {/* מד היצטיינות: בר אופקי + מטבע סלינדה */}
                <View style={{ width: 66, gap: 2 }}>
                  <View style={{ width: 66, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                    <View style={{ width: `${meterPct}%`, height: 4, borderRadius: 2, backgroundColor: meterPct >= 66 ? '#F59E0B' : meterPct >= 33 ? '#34D399' : '#60A5FA' }} />
                  </View>
                </View>
              </View>
            );
            if (isCurrent) {
              return <View key={p.id}>{chip}</View>;
            }
            return <View key={p.id} style={{ opacity: 0.45 }}>{chip}</View>;
          })}
          {hasMore && (
            <TouchableOpacity onPress={() => setShowAll(true)} style={{ marginRight: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>+</Text>
            </TouchableOpacity>
          )}
        </View>
        {showRulesButtonInSidebar ? (
          <View style={{ flexShrink: 0 }}>
            <LulosButton text={t('start.rulesButton')} color="blue" width={90} height={38} fontSize={13} onPress={() => setRulesOpen(true)} />
          </View>
        ) : null}
      </View>
      <AppModal
        visible={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title={t('start.rulesModalTitle')}
        overlayOpacity={0.82}
        topAligned
        boxStyle={{
          width: '100%',
          height: SCREEN_H - 150,
          maxHeight: SCREEN_H - 150,
          marginTop: 150,
          borderRadius: 0,
          backgroundColor: 'rgba(15,23,42,0.94)',
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.45)',
          padding: 0,
        }}
      >
        <RulesContent state={state} />
      </AppModal>
      <AppModal visible={cardsCatalogOpen} onClose={() => setCardsCatalogOpen(false)} title={t('start.catalogTitle')}>
        <CardsCatalogContent
          numberRange={state.difficulty}
          fractions={state.showFractions}
          enabledOperators={state.enabledOperators}
          fractionKinds={state.fractionKinds}
        />
      </AppModal>
    </View>
  );
}
const sbS = StyleSheet.create({
  wrap:{flexDirection:'row',flexWrap:'wrap',gap:3,flex:1},
  badge:{flexDirection:'row',alignItems:'center',gap:2,backgroundColor:'rgba(255,255,255,0.1)',paddingHorizontal:6,paddingVertical:2,borderRadius:5},
  badgeActive:{backgroundColor:'#2196F3'},
  badgeName:{color:'rgba(255,255,255,0.4)',fontSize:9,fontWeight:'700',maxWidth:48},
  badgeNameActive:{color:'#FFF'},
  badgeCount:{color:'rgba(255,255,255,0.3)',fontSize:9,fontWeight:'700'},
  badgeCountActive:{color:'#E3F2FD'},
});

// ═══ הודעות במסך המשחק (הצגה ב־NotificationZone) ═══
// מקור 1 — GameScreen showOnb (ONB): הדרכה לפי הקשר (נשמר ב־AsyncStorage לפי מפתח מ־ONB_KEYS)
// מקור 2 — GameScreen showGuidance (GUIDANCE): שלישיית קוביות וכו׳
// ברוכים הבאים — רק בבועה במסך מעבר התור (TurnTransition), לא כאן
// שליטה: "הדרכה והסברים" בהגדרות — כיבוי מונע הודעות onb + guidance (משתמש חוזר)
const ONB_KEYS = ['onb_game_start', 'onb_results', 'onb_first_discard', 'onb_welcome_screen', 'onb_choose_cards', 'onb_choose_cards_after_confirm', 'onb_build_equation'] as const;
type OnbKey = typeof ONB_KEYS[number];
/** חץ קטן חד־פעמי מעל מיני תוצאות — אחרי לחיצה ראשונה על «תוצאות אפשריות» */
const RESULTS_MINI_ARROW_SEEN_KEY = 'lulos_results_mini_arrow_seen';
const RESULTS_MINI_PULSE_SEEN_KEY = 'lulos_results_mini_pulse_seen';
/** חד־פעמי: האם המשתמש לחץ לפחות פעם אחת על מיני-קלף תוצאה? כל עוד לא — מיני-הקלפים פועמים בלולאה. */
const MINI_RESULT_TAPPED_KEY = 'lulos_mini_result_tapped';
/** הדרכה חד־פעמית — אחרי מעבר ל־building מהטלת קוביות */
const BUILDING_EQUATION_HINT_KEY = 'lulos_building_equation_hint_shown';
/** הודעת "אין לך קלף זהה" — מוצגת פעם אחת בלבד לאורך השימוש (עם איפוס onboarding) */
const NO_IDENTICAL_HINT_SEEN_KEY = 'lulos_no_identical_hint_seen';

const GUIDANCE_KEYS = ['guidance_op_challenge', 'guidance_identical', 'guidance_joker', 'guidance_triple', 'guidance_wild_results'] as const;
type GuidanceKey = typeof GUIDANCE_KEYS[number];

const CARD_HINT_JOKER_SEEN_KEY = 'lulos_card_hint_joker_seen';
const CARD_HINT_OP_SEEN_KEY = 'lulos_card_hint_op_seen';

/** מחיקת כל מפתחות ההדרכה והטיפים החד־פעמיים (מסך פתיחה / איפוס ידני) */
async function clearAllLulosOnboardingKeys(): Promise<void> {
  const keys: string[] = [
    ...ONB_KEYS,
    ...GUIDANCE_KEYS,
    'lulos_tutorial_done',
    'lulos_tip1_done',
    'lulos_tip2_done',
    'lulos_ident_arrow_seen',
    'lulos_find_cards_sum_alert_seen',
    NO_IDENTICAL_HINT_SEEN_KEY,
    RESULTS_MINI_ARROW_SEEN_KEY,
    RESULTS_MINI_PULSE_SEEN_KEY,
    BUILDING_EQUATION_HINT_KEY,
    WELCOME_PLAYER_SCREEN_KEY,
    'lulos_guidance_notifications',
    CARD_HINT_JOKER_SEEN_KEY,
    CARD_HINT_OP_SEEN_KEY,
    // NOTE: PLAYER_NAME_MODAL_SEEN_KEY and PLAYER_SAVED_NAME_KEY are
    // deliberately excluded — player's name is personal data, not guidance
    // state. Resetting guidance shouldn't erase the entered name.
  ];
  await AsyncStorage.multiRemove(keys);
}

function GameScreen() {
  const { state, dispatch } = useGame();
  const { t, isRTL } = useLocale();
  const { profile } = useAuth();
  const { table, background, activeTableSkin } = useActiveTheme();
  const safe = useGameSafeArea();
  const soundOn = state.soundsEnabled !== false;
  // Parens-right טוגל — מצב גלובלי לבנאי המשוואה (מוצג כטוגל חיצוני מעל השולחן)
  const [parensRight, setParensRight] = useState<boolean>(false);
  // אתחול בכל שלב building חדש
  useEffect(() => { if (state.phase === 'building') setParensRight(false); }, [state.diceRollSeq, state.phase]);
  // Sync parensRight to tutorialBus so InteractiveTutorialScreen can read it.
  useEffect(() => { tutorialBus.setParensRightValue(parensRight); }, [parensRight]);
  // Tutorial L7 stage-0: scale-pulse the parens button to draw the learner's eye.
  const parensTogglePulseAnim = useRef(new Animated.Value(1)).current;
  const parensButtonPulseActive = state.isTutorial && tutorialBus.getParensButtonPulse();
  useEffect(() => {
    if (!parensButtonPulseActive) {
      parensTogglePulseAnim.stopAnimation();
      parensTogglePulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(parensTogglePulseAnim, { toValue: 1.12, duration: 230, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(parensTogglePulseAnim, { toValue: 1.0, duration: 260, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => { loop.stop(); parensTogglePulseAnim.setValue(1); };
  }, [parensButtonPulseActive, parensTogglePulseAnim]);
  const toggleSoundsInGame = useCallback(() => {
    const next = !soundOn;
    dispatch({ type: 'SET_SOUNDS_ENABLED', enabled: next });
    AsyncStorage.setItem('lulos_sounds_enabled', next ? 'true' : 'false');
  }, [dispatch, soundOn]);
  useEffect(() => {
    setSfxMuted(!soundOn);
    void setSfxVolume(soundOn ? 0.33 : 0);
  }, [soundOn]);
  const cp = state.players[state.currentPlayerIndex];
  const mpOptional = useMultiplayerOptional();
  const gameScreenMyIndex = (state as { myPlayerIndex?: number }).myPlayerIndex;
  const isOnlineGame = !!mpOptional?.gameOverride;
  const myPerspIdx = typeof gameScreenMyIndex === 'number' ? gameScreenMyIndex : state.currentPlayerIndex;
  const isLocalBotTurn =
    !isOnlineGame &&
    !!(
      state.botConfig &&
      cp &&
      state.botConfig.playerIds.includes(cp.id) &&
      state.phase !== 'game-over'
    );
  const lockUiForBotTurn = isLocalBotTurn && !state.isTutorial;
  const onlineBotPlayer =
    isOnlineGame ? state.players.find((p: any) => p?.isBot) ?? null : null;
  // Is the ONLINE bot currently playing? Used for showing demo visuals
  // (mini cards strip, red chip) even though the server drives the bot logic.
  const isOnlineBotTurn =
    isOnlineGame && !!cp && (cp as any).isBot === true && state.phase !== 'game-over';
  // Unified flag: bot is playing (local or online)
  const isBotTurnAny = isLocalBotTurn || isOnlineBotTurn;
  // Mission mockups are disabled to keep equation autofill visible and uncluttered.
  const canRenderBotMissionStrip = false;
  const isOnlineWaiting =
    isOnlineGame && typeof gameScreenMyIndex === 'number' && state.currentPlayerIndex !== gameScreenMyIndex;
  const showOnlineBotDifficultyBtn = isOnlineGame && state.hostBotDifficulty != null;
  const [localGameTurnDeadlineAt, setLocalGameTurnDeadlineAt] = useState<number | null>(null);
  const [gameTurnNowMs, setGameTurnNowMs] = useState(() => Date.now());
  const gameTurnTimeoutFiredRef = useRef(false);
  const [gameRulesOpen, setGameRulesOpen] = useState(false);
  const [gameCardsCatalogOpen, setGameCardsCatalogOpen] = useState(false);
  const [onlineBotDiffOpen, setOnlineBotDiffOpen] = useState(false);
  const [tournamentInfoOpen, setTournamentInfoOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  /** רמזים בבועות (שבר, תוצאות, תרגיל, אין קלף זהה…) — רק אחרי הטלת קוביות ראשונה במשחק */
  const [midGameHintsUnlocked, setMidGameHintsUnlocked] = useState(false);
  const miniStripEverShownRef = useRef(false);
  useEffect(() => {
    if (state.phase === 'setup') {
      setMidGameHintsUnlocked(false);
      miniStripEverShownRef.current = false;
    }
  }, [state.phase]);
  useEffect(() => {
    if (isOnlineGame) return;
    if (state.moveHistory.length === 0 && state.roundsPlayed === 0 && (state.phase === 'pre-roll' || state.phase === 'turn-transition')) {
      setMidGameHintsUnlocked(false);
    }
  }, [isOnlineGame, state.phase, state.moveHistory.length, state.roundsPlayed]);
  useEffect(() => {
    if (state.phase === 'building' && state.dice != null) setMidGameHintsUnlocked(true);
  }, [state.phase, state.dice]);
  const lastPlayerIndex = (state.currentPlayerIndex - 1 + state.players.length) % Math.max(state.players.length, 1);
  const PLAYER_BUBBLE_COLORS = ['#14532d', '#1d4ed8', '#7c2d12', '#4b5563'] as const;
  const PLAYER_BUBBLE_BORDER_COLORS = ['rgba(74,222,128,0.7)', 'rgba(129,140,248,0.7)', 'rgba(248,113,113,0.7)', 'rgba(156,163,175,0.7)'] as const;
  const lastPlayerBubbleColor = PLAYER_BUBBLE_COLORS[lastPlayerIndex % PLAYER_BUBBLE_COLORS.length];
  const lastPlayerBorderColor = PLAYER_BUBBLE_BORDER_COLORS[lastPlayerIndex % PLAYER_BUBBLE_BORDER_COLORS.length];
  const [showCel,setShowCel] = useState(false);
  const [eqConfirm, setEqConfirm] = useState<{ onConfirm: () => void } | null>(null);
  const eqBuilderRef = useRef<EquationBuilderRef>(null);
  // Refs used only for the guided full-build sub-phase of lesson-4 step-3:
  // the tutorial draws an arrow at the "אשר את התרגיל" / "בחרתי" buttons,
  // so their wrappers must report their measured window position via bus.
  const confirmBtnWrapperRef = useRef<View>(null);
  const playCardsBtnWrapperRef = useRef<View>(null);
  /** Re-render when tutorialBus L5 UI flags change (module-level, not React state). */
  const [l5UiTick, setL5UiTick] = useState(0);
  useEffect(() => tutorialBus.subscribeL5Ui(() => setL5UiTick((n) => n + 1)), []);
  const l5GuidedTutorial = state.isTutorial && tutorialBus.getL5GuidedMode();
  const l5HideFanStrip = l5GuidedTutorial && tutorialBus.getL5HideFan();
  const [centerCard, setCenterCard] = useState<Card | null>(null);
  const [cardHintJokerSeen, setCardHintJokerSeen] = useState(false);
  const [cardHintOpSeen, setCardHintOpSeen] = useState(false);
  const [cardHintLoaded, setCardHintLoaded] = useState(false);
  // "No identical card" is shown via NotificationZone; no local visibility state needed.
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(CARD_HINT_JOKER_SEEN_KEY), AsyncStorage.getItem(CARD_HINT_OP_SEEN_KEY)]).then(([j, o]) => {
      setCardHintJokerSeen(j === 'true');
      setCardHintOpSeen(o === 'true');
      setCardHintLoaded(true);
    });
  }, []);
  useEffect(() => {
    const isTurnStartWindow =
      state.phase === 'pre-roll' &&
      !state.hasPlayedCards &&
      state.dice == null &&
      state.pendingFractionTarget === null;
    if (!isTurnStartWindow) {
      setLocalGameTurnDeadlineAt(null);
      gameTurnTimeoutFiredRef.current = false;
      return;
    }
    // Fallback UI deadline for turn-start only; once move starts, timer is cancelled.
    setLocalGameTurnDeadlineAt(Date.now() + START_TURN_TIMER_SECONDS * 1000);
    gameTurnTimeoutFiredRef.current = false;
  }, [state.phase, state.currentPlayerIndex, state.roundsPlayed, state.hasPlayedCards, state.dice, state.pendingFractionTarget]);
  const gameTurnDeadlineAt = state.turnDeadlineAt ?? localGameTurnDeadlineAt;
  useEffect(() => {
    if (gameTurnDeadlineAt == null) return;
    const id = setInterval(() => setGameTurnNowMs(Date.now()), 200);
    return () => clearInterval(id);
  }, [gameTurnDeadlineAt]);
  const gameTurnSecsLeft = gameTurnDeadlineAt == null
    ? null
    : Math.max(0, Math.ceil((gameTurnDeadlineAt - gameTurnNowMs) / 1000));
  useEffect(() => {
    if (isOnlineGame) return;
    if (gameTurnDeadlineAt == null) return;
    const isTurnStartWindow =
      state.phase === 'pre-roll' &&
      !state.hasPlayedCards &&
      state.dice == null &&
      state.pendingFractionTarget === null;
    if (!isTurnStartWindow) return;
    const id = setInterval(() => {
      if (gameTurnTimeoutFiredRef.current) return;
      if (Date.now() < gameTurnDeadlineAt) return;
      gameTurnTimeoutFiredRef.current = true;
      // DRAW_CARD already advances turn in reducer (draw + end-turn logic).
      dispatch({ type: 'DRAW_CARD' });
    }, 180);
    return () => clearInterval(id);
  }, [isOnlineGame, gameTurnDeadlineAt, state.phase, state.hasPlayedCards, state.dice, state.pendingFractionTarget, dispatch]);
  const dismissCardHintJoker = useCallback(() => {
    setCardHintJokerSeen(true);
    AsyncStorage.setItem(CARD_HINT_JOKER_SEEN_KEY, 'true');
  }, []);
  const dismissCardHintOp = useCallback(() => {
    setCardHintOpSeen(true);
    AsyncStorage.setItem(CARD_HINT_OP_SEEN_KEY, 'true');
  }, []);

  const prevJ = useRef(state.jokerModalOpen);
  useEffect(() => { if(prevJ.current&&!state.jokerModalOpen&&state.hasPlayedCards) setShowCel(true); prevJ.current=state.jokerModalOpen; }, [state.jokerModalOpen,state.hasPlayedCards]);

  // Background roaming dice
  const bgDiceRef = useRef<RoamingDiceRef>(null);
  const prevDice = useRef(state.dice);
  useEffect(() => {
    if (!prevDice.current && state.dice) bgDiceRef.current?.scatter();
    prevDice.current = state.dice;
  }, [state.dice]);

  // ── Timer countdown ──
  const [secsLeft, setSecsLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const gameTimerHintOpacity = useRef(new Animated.Value(1)).current;
  const gameTimerHintLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const TIMER_TOTAL = state.timerSetting === 'custom'
    ? state.timerCustomSeconds
    : state.timerSetting === '30'
      ? 30
      : state.timerSetting === '60'
        ? 60
        : 0;
  const timerTurnKeyRef = useRef<string | null>(null);
  const timerConfigKeyRef = useRef<string>('');
  const showSmallTurnTimerHint = state.roundsPlayed < TURN_TIMER_HINT_UNTIL_ROUNDS_PLAYED;
  const bubbleMidRef = useRef<Audio.Sound | null>(null);
  const bubbleEndRef = useRef<Audio.Sound | null>(null);
  const gameTimerFinal7Ref = useRef<Audio.Sound | null>(null);
  const bubbleTickLastSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.timerSetting === 'off') {
      setTimerRunning(false);
      timerTurnKeyRef.current = null;
      timerConfigKeyRef.current = '';
      return;
    }
    // Main turn fuse starts only after the start-turn mini countdown is done
    // (or cancelled because the player started an action).
    const isGameTurnPhase =
      state.phase === 'building' ||
      state.phase === 'solved';
    if (!isGameTurnPhase) {
      setTimerRunning(false);
      if (state.phase === 'setup' || state.phase === 'game-over') {
        timerTurnKeyRef.current = null;
        timerConfigKeyRef.current = '';
      }
      return;
    }
    if (state.hasPlayedCards) {
      setTimerRunning(false);
      return;
    }
    const turnKey = `${state.roundsPlayed}:${state.currentPlayerIndex}`;
    const configKey = `${state.timerSetting}:${TIMER_TOTAL}`;
    const shouldResetTimer =
      timerTurnKeyRef.current !== turnKey ||
      timerConfigKeyRef.current !== configKey;
    if (shouldResetTimer) {
      setSecsLeft(TIMER_TOTAL);
      bubbleTickLastSecondRef.current = null;
      timerTurnKeyRef.current = turnKey;
      timerConfigKeyRef.current = configKey;
    }
    setTimerRunning(true);
  }, [state.phase, state.hasPlayedCards, state.timerSetting, TIMER_TOTAL]);

  // כשהטיימר מגיע ל־0: מציגים הודעה חוסמת בתחתית, אחרי 2.5 שניות — שלוף קלף ומעבר לתור הבא
  const [timerExpiredOverlay, setTimerExpiredOverlay] = useState(false);
  const timerExpiredRef = useRef(false);
  useEffect(() => {
    if (!timerRunning || secsLeft <= 0) return;
    const id = setInterval(() => {
      setSecsLeft(prev => {
        if (prev <= 1 && !timerExpiredRef.current) {
          timerExpiredRef.current = true;
          setTimerRunning(false);
          setTimerExpiredOverlay(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, secsLeft <= 0]);
  useEffect(() => {
    if (!timerExpiredOverlay) return;
    const t = setTimeout(() => {
      dispatch({ type: 'DRAW_CARD' });
      setTimerExpiredOverlay(false);
      timerExpiredRef.current = false;
    }, 2500);
    return () => clearTimeout(t);
  }, [timerExpiredOverlay, dispatch]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: false, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const [midRes, endRes, final7Res] = await Promise.all([
          Audio.Sound.createAsync(require('./assets/sounds/bubble_mid.wav')),
          Audio.Sound.createAsync(require('./assets/sounds/bubble_end.wav')),
          Audio.Sound.createAsync(require('./assets/sounds/7.mp3')),
        ]);
        if (!mounted) {
          midRes.sound.unloadAsync().catch(() => {});
          endRes.sound.unloadAsync().catch(() => {});
          final7Res.sound.unloadAsync().catch(() => {});
          return;
        }
        bubbleMidRef.current = midRes.sound;
        bubbleEndRef.current = endRes.sound;
        gameTimerFinal7Ref.current = final7Res.sound;
      } catch (e) {
        if (__DEV__) console.warn('[bubble-sound] failed to load bubble sounds', e);
      }
    })();
    return () => {
      mounted = false;
      const mid = bubbleMidRef.current;
      const end = bubbleEndRef.current;
      const final7 = gameTimerFinal7Ref.current;
      if (mid) mid.unloadAsync().catch(() => {});
      if (end) end.unloadAsync().catch(() => {});
      if (final7) final7.unloadAsync().catch(() => {});
      bubbleMidRef.current = null;
      bubbleEndRef.current = null;
      gameTimerFinal7Ref.current = null;
    };
  }, []);

  useEffect(() => {
    if (!soundOn) {
      bubbleTickLastSecondRef.current = null;
      return;
    }
    if (!(timerRunning && state.phase === 'building')) {
      bubbleTickLastSecondRef.current = null;
      return;
    }
    if (secsLeft < 1 || secsLeft > 7) return;
    if (bubbleTickLastSecondRef.current === secsLeft) return;
    bubbleTickLastSecondRef.current = secsLeft;
    const soundToPlay = gameTimerFinal7Ref.current ?? (secsLeft === 1 ? bubbleEndRef.current : bubbleMidRef.current);
    if (!soundToPlay) return;
    soundToPlay.setPositionAsync(0).then(() => soundToPlay.playAsync()).catch(() => {});
  }, [timerRunning, state.phase, secsLeft, soundOn]);

  const equationTimerProgress = (timerRunning && TIMER_TOTAL > 0 && secsLeft > 0)
    ? Math.max(0, Math.min(1, 1 - (secsLeft / TIMER_TOTAL)))
    : null;
  const shouldBlinkGameTimerHint = timerRunning && secsLeft > 0 && secsLeft <= 5 && !state.hasPlayedCards;
  useEffect(() => {
    gameTimerHintLoopRef.current?.stop();
    gameTimerHintLoopRef.current = null;
    if (!shouldBlinkGameTimerHint) {
      gameTimerHintOpacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(gameTimerHintOpacity, { toValue: 0.35, duration: 260, useNativeDriver: true }),
        Animated.timing(gameTimerHintOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ])
    );
    gameTimerHintLoopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      gameTimerHintLoopRef.current = null;
      gameTimerHintOpacity.setValue(1);
    };
  }, [shouldBlinkGameTimerHint, gameTimerHintOpacity]);

  const resetTurnTimer = useCallback(() => {
    if (state.timerSetting === 'off' || TIMER_TOTAL <= 0) return;
    if (state.phase !== 'building' && state.phase !== 'solved') return;
    if (state.hasPlayedCards) return;
    timerExpiredRef.current = false;
    setTimerExpiredOverlay(false);
    setSecsLeft(TIMER_TOTAL);
    setTimerRunning(true);
    bubbleTickLastSecondRef.current = null;
  }, [state.timerSetting, state.phase, state.hasPlayedCards, TIMER_TOTAL]);

  // Operation challenge sheet dismiss state

  // Feedback notification moved to TurnTransition screen

  // צליל הטלת קוביות — קובץ: dice_roll.m4a ב־card/assets
  const diceSoundRef = useRef<Audio.Sound | null>(null);
  const diceSoundLoadingRef = useRef(false);
  useEffect(() => {
    (async () => {
      if (diceSoundRef.current) return;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(require('./assets/dice_roll.m4a'));
        diceSoundRef.current = sound;
      } catch (e) {
        if (__DEV__) console.warn('[dice_roll] preload failed', e);
      }
    })();
    return () => {
      const s = diceSoundRef.current;
      if (s) s.unloadAsync().catch(() => {});
      diceSoundRef.current = null;
    };
  }, []);
  // Latest-mute ref so the async lazy-load path can re-check muting at the
  // moment it's about to play (closures capture the old `soundOn`).
  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  const playDiceSound = useCallback(() => {
    if (!soundOn) return;
    const sound = diceSoundRef.current;
    if (sound) {
      sound.setPositionAsync(0)
        .then(() => {
          if (!soundOnRef.current) return;
          return sound.playAsync();
        })
        .catch((e) => { if (__DEV__) console.warn('[dice_roll] play failed', e); });
      return;
    }
    if (diceSoundLoadingRef.current) return;
    diceSoundLoadingRef.current = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound: s } = await Audio.Sound.createAsync(require('./assets/dice_roll.m4a'));
        diceSoundRef.current = s;
        // Re-check mute: the learner might have tapped mute while the sound
        // was loading. Without this guard it would leak through once.
        if (!soundOnRef.current) return;
        await s.playAsync();
      } catch (e) {
        if (__DEV__) console.warn('[dice_roll] lazy load/play failed', e);
      }
      diceSoundLoadingRef.current = false;
    })();
  }, [soundOn]);

  // Roll button logic
  const canRoll = state.phase === 'pre-roll' && !state.hasPlayedCards && state.pendingFractionTarget === null;
  const rollArrowAnim = useRef(new Animated.Value(0)).current;
  // Tutorial-only halo around the gold dice button. Driven by tutorialBus
  // pulseDiceBtn commands during a lesson; otherwise no-op.
  const [diceBtnPulseUntil, setDiceBtnPulseUntil] = useState<number>(0);
  const dicePulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    return tutorialBus.subscribeFanDemo((cmd) => {
      if (cmd.kind !== 'pulseDiceBtn') return;
      const dur = cmd.durationMs ?? 1800;
      setDiceBtnPulseUntil(Date.now() + dur);
      dicePulseAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(dicePulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(dicePulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
      const t = setTimeout(() => setDiceBtnPulseUntil(0), dur);
      return () => clearTimeout(t);
    });
  }, [dicePulseAnim]);

  // Lesson 6 helpers: handle bus commands to force-open the green chip and
  // to programmatically tap a mini-card by index. These keep the chip state
  // predictable when the learner skips/back-navigates into the lesson —
  // without these handlers the `resultsOpen` flag stays whatever it was in
  // the previous lesson, which breaks the step 6.2 mini-tap demo.
  useEffect(() => {
    return tutorialBus.subscribeFanDemo((cmd) => {
      if (cmd.kind === 'openResultsChip') {
        setResultsOpenState(true);
      } else if (cmd.kind === 'closeResultsChip') {
        setResultsOpenState(false);
        // Re-arm the strong pulse so the tutorial's L6 step 0 always gets
        // the pulsing chip, even on back-nav after the learner already
        // opened it once (which would have turned boostedPulse off).
        setResultsChipBoostedPulse(true);
      } else if (cmd.kind === 'disarmResultsChipPulse') {
        setResultsChipBoostedPulse(false);
      } else if (cmd.kind === 'clearSolveExerciseChip') {
        setSelectedEquationForDisplay(null);
      } else if (cmd.kind === 'setSolveChip') {
        setSelectedEquationForDisplay({ equation: cmd.equation, result: cmd.result });
        setSolveChipPulseKey((prev) => prev + 1);
      }
    });
  }, []);
  const showDicePulse = diceBtnPulseUntil > 0 && Date.now() < diceBtnPulseUntil;
  // Tutorial-only pulsing ▼ arrow above the confirm-equation button in
  // building phase. Loops continuously; the arrow is only rendered when
  // `state.isTutorial && state.phase === 'building' && eqConfirm`.
  const tutorialResultPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!state.isTutorial) {
      tutorialResultPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(tutorialResultPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(tutorialResultPulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state.isTutorial, tutorialResultPulse]);
  const noIdenticalHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRoll = useCallback(() => {
    if (noIdenticalHintTimerRef.current) {
      clearTimeout(noIdenticalHintTimerRef.current);
      noIdenticalHintTimerRef.current = null;
    }
    bgDiceRef.current?.summon();
    const d = rollDiceUtil();
    dispatch({ type: 'ROLL_DICE', values: d });
    tutorialBus.emitUserEvent({ kind: 'diceRolled' });
    if (guidanceEnabledRef.current && soundOn) {
      const mid = bubbleMidRef.current;
      if (mid) {
        setTimeout(() => {
          mid.setPositionAsync(0).then(() => mid.playAsync()).catch(() => {});
        }, 420);
      }
    }
  }, [dispatch, soundOn]);

  // Play the dice-roll sound on every roll — human pressing the button OR
  // the bot rolling on its turn. Driven by state.diceRollSeq so we don't
  // need a parallel handler in the bot action flow.
  const lastDiceRollSeqRef = useRef(state.diceRollSeq);
  useEffect(() => {
    if (state.diceRollSeq === lastDiceRollSeqRef.current) return;
    lastDiceRollSeqRef.current = state.diceRollSeq;
    playDiceSound();
  }, [state.diceRollSeq, playDiceSound]);

  // צליל כפתור "שלוף קלף - ויתור" — button_forfeit.mp3 (ברמת GameScreen כדי לא להפר hooks)
  const drawForfeitSoundRef = useRef<Audio.Sound | null>(null);
  const drawForfeitLoadingRef = useRef(false);
  const playDrawForfeitSound = useCallback(() => {
    if (!soundOn) return;
    const sound = drawForfeitSoundRef.current;
    if (sound) {
      sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => {});
      return;
    }
    if (drawForfeitLoadingRef.current) return;
    drawForfeitLoadingRef.current = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(require('./assets/button_forfeit.mp3'));
        drawForfeitSoundRef.current = sound;
        await sound.playAsync();
      } catch (e) {
        if (__DEV__) console.warn('[button_forfeit] טעינה נכשלה.', e);
      }
      drawForfeitLoadingRef.current = false;
    })();
  }, [soundOn]);

  /** צליל לחיצה על מיני קלף תוצאה — mini_result_button_red.mp3 */
  const miniResultTapSoundRef = useRef<Audio.Sound | null>(null);
  const miniResultTapLoadingRef = useRef(false);
  const playMiniResultTapSound = useCallback(() => {
    if (!soundOn) return;
    const s = miniResultTapSoundRef.current;
    if (s) {
      s.setPositionAsync(0).then(() => s.playAsync()).catch(() => {});
      return;
    }
    if (miniResultTapLoadingRef.current) return;
    miniResultTapLoadingRef.current = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(require('./assets/mini_result_button_red.mp3'));
        miniResultTapSoundRef.current = sound;
        await sound.playAsync();
      } catch (e) {
        if (__DEV__) console.warn('[mini_result] טעינה נכשלה — הוסף assets/mini_result_button_red.mp3', e);
      }
      miniResultTapLoadingRef.current = false;
    })();
  }, [soundOn]);
  // Mute pressed mid-playback must also silence any in-flight direct
  // Audio.Sound instance. setSfxMuted only affects the central sfx module;
  // these refs are their own Audio.Sound instances and keep playing until
  // their file finishes. Stop them all when soundOn flips to false.
  useEffect(() => {
    if (soundOn) return;
    for (const ref of [diceSoundRef, drawForfeitSoundRef, miniResultTapSoundRef]) {
      const s = ref.current;
      if (s) s.stopAsync().catch(() => {});
    }
  }, [soundOn]);
  const prevDiscardCountRef = useRef(state.lastDiscardCount);
  const prevPhaseRef = useRef(state.phase);
  useEffect(() => {
    if (!soundOn) {
      prevDiscardCountRef.current = state.lastDiscardCount;
      prevPhaseRef.current = state.phase;
      return;
    }
    if (state.lastDiscardCount > prevDiscardCountRef.current) {
      const key = state.lastDiscardCount >= 2 ? 'combo' : 'success';
      void playSfx(key, { cooldownMs: 140 });
    }
    if (prevPhaseRef.current !== 'building' && state.phase === 'building') {
      void playSfx('transition', { cooldownMs: 160, volumeOverride: 0.28 });
    }
    prevDiscardCountRef.current = state.lastDiscardCount;
    prevPhaseRef.current = state.phase;
  }, [state.lastDiscardCount, state.phase, soundOn]);

  // Detect if current player has an identical card they can play
  const td = state.discardPile[state.discardPile.length - 1];

  const [tutLoaded, setTutLoaded] = useState(false);

  // "אין לך קלף זהה" — פעם אחת בלבד (נשמר ב־AsyncStorage)
  const [noIdenticalHintSeen, setNoIdenticalHintSeen] = useState(true);

  // חץ חד־פעמי מעל מיני תוצאות — אחרי פתיחה ראשונה של «תוצאות אפשריות»
  const [resultsMiniArrowSeen, setResultsMiniArrowSeen] = useState(true);
  const [resultsMiniArrowPulse, setResultsMiniArrowPulse] = useState(false);
  const [resultsMiniPulseSeen, setResultsMiniPulseSeen] = useState(false);
  // Start true (no pulse loop) until we've confirmed from AsyncStorage that
  // the user hasn't tapped a mini card yet. Flipping to false turns the loop on.
  const [miniResultTapped, setMiniResultTapped] = useState(true);
  const [miniResultsPulseToken, setMiniResultsPulseToken] = useState(0);
  const [resultsChipBoostedPulse, setResultsChipBoostedPulse] = useState(true);
  const resultsStripArrowAnim = useRef(new Animated.Value(0)).current;
  const resultsStripArrowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Identical card arrow hint — only first time ever
  const [identArrowSeen, setIdentArrowSeen] = useState(true);
  const [identArrowVisible, setIdentArrowVisible] = useState(false);
  const identArrowX = useRef(new Animated.Value(0)).current;

  const identArrowLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Contextual onboarding system ──
  const onbSeen = useRef(new Set<string>());

  // ── Guidance notification system (first-time full, then short) ──
  const guidanceSeen = useRef(new Set<string>());

  const showOnb = useCallback((key: OnbKey, emoji: string, title: string, body: string) => {
    const hasOpenOnbAck = (state.notifications ?? []).some((n) => n.requireAck && n.id.startsWith('onb-'));
    if (__DEV__) console.log('[ONB] showOnb called:', key, 'alreadySeen:', onbSeen.current.has(key), 'hasOpenOnbAck:', hasOpenOnbAck);
    if (onbSeen.current.has(key) || hasOpenOnbAck) return;
    dispatch({ type: 'PUSH_NOTIFICATION', payload: {
      id: `onb-${key}`,
      message: '',
      emoji,
      title,
      body,
      style: 'info',
      requireAck: true,
    }});
  }, [dispatch, state.notifications]);

  useEffect(() => {
    (state.notifications ?? []).forEach((n) => {
      if (!n.id.startsWith('onb-')) return;
      onbSeen.current.add(n.id.slice(4));
    });
  }, [state.notifications]);

  const onFractionTapForOnb = useCallback(() => {
    // Fraction-specific onboarding notifications were replaced with the bottom curtain flow.
    return;
  }, []);

  const guidanceEnabledRef = useRef(true);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem('lulos_guidance_enabled'),
      AsyncStorage.getItem('lulos_tutorial_done'),
      AsyncStorage.getItem('lulos_tip1_done'),
      AsyncStorage.getItem('lulos_tip2_done'),
      AsyncStorage.getItem('lulos_ident_arrow_seen'),
      AsyncStorage.getItem(NO_IDENTICAL_HINT_SEEN_KEY),
      AsyncStorage.getItem(RESULTS_MINI_ARROW_SEEN_KEY),
      AsyncStorage.getItem(RESULTS_MINI_PULSE_SEEN_KEY),
      AsyncStorage.getItem(MINI_RESULT_TAPPED_KEY),
      ...ONB_KEYS.map(k => AsyncStorage.getItem(k)),
      ...GUIDANCE_KEYS.map(k => AsyncStorage.getItem(k)),
    ])
      .then(([guidance, tut, tip1, tip2, identArrow, noIdenticalHint, resultsMiniArrow, resultsMiniPulse, miniResultTappedStored, ...rest]) => {
        if (cancelled) return;
        const enabled = guidance !== 'false';
        guidanceEnabledRef.current = enabled;
        dispatch({ type: 'SET_GUIDANCE_ENABLED', enabled });
        const onbResults = rest.slice(0, ONB_KEYS.length);
        const guidanceResults = rest.slice(ONB_KEYS.length);
        void tut;
        void tip1;
        void tip2;
        setIdentArrowSeen(identArrow === 'true' || guidance === 'false');
        setNoIdenticalHintSeen(noIdenticalHint === 'true' || guidance === 'false');
        setResultsMiniArrowSeen(resultsMiniArrow === 'true' || guidance === 'false');
        setResultsMiniPulseSeen(resultsMiniPulse === 'true' || guidance === 'false');
        // Treat disabled guidance the same as "already tapped" — no pulse loop
        // for users who explicitly turned onboarding off.
        setMiniResultTapped(miniResultTappedStored === 'true' || guidance === 'false');
        if (guidance === 'false') {
          ONB_KEYS.forEach(k => onbSeen.current.add(k));
          GUIDANCE_KEYS.forEach(k => guidanceSeen.current.add(k));
        } else {
          ONB_KEYS.forEach((k, i) => { if (onbResults[i] === 'true') onbSeen.current.add(k); });
          GUIDANCE_KEYS.forEach((k, i) => { if (guidanceResults[i] === 'true') guidanceSeen.current.add(k); });
        }
        setTutLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setTutLoaded(true);
          setNoIdenticalHintSeen(false);
          setResultsMiniArrowSeen(true);
        }
      });
    const t = setTimeout(() => {
      if (!cancelled) setTutLoaded(prev => { if (!prev) return true; return prev; });
    }, 2500);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  // Possible results toggle (moved before first reference to avoid TDZ)
  const [resultsOpen, setResultsOpenState] = useState(false);
  // Auto-open "possible results" during every bot turn so the player can
  // follow along with what the bot can build.
  useEffect(() => {
    const currentPlayerId = state.players[state.currentPlayerIndex]?.id ?? -1;
    const isBotTurn = !!state.botConfig && state.botConfig.playerIds.includes(currentPlayerId);
    if (isBotTurn) setResultsOpenState(true);
  }, [state.currentPlayerIndex, state.botConfig, state.players]);
  useEffect(() => {
    if (state.phase === 'pre-roll') {
      Promise.all(ONB_KEYS.map(k => AsyncStorage.getItem(k))).then(results => {
        ONB_KEYS.forEach((k, i) => {
          if (results[i] === 'true') onbSeen.current.add(k);
          else onbSeen.current.delete(k);
        });
      });
    }
  }, [state.phase]);
  /** חץ לכפתור הקוביות — מופיע ב־5 השניות האחרונות של טיימר תחילת התור */
  const showRollArrow =
    canRoll &&
    (gameTurnSecsLeft != null && gameTurnSecsLeft > 0 && gameTurnSecsLeft <= 5);
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (showRollArrow) {
      rollArrowAnim.setValue(0);
      loop = Animated.loop(Animated.sequence([
        Animated.timing(rollArrowAnim, { toValue: 1, duration: 280, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.timing(rollArrowAnim, { toValue: 0, duration: 280, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
      ]));
      loop.start();
    } else {
      rollArrowAnim.stopAnimation();
      rollArrowAnim.setValue(0);
    }
    return () => { if (loop) loop.stop(); };
  }, [showRollArrow, rollArrowAnim]);
  // Fraction hint state — all declared together before effects that use them
  const fracHintShown = useRef(false);
  useEffect(() => { if (state.phase === 'pre-roll') { fracHintShown.current = false; } }, [state.phase]);

  // Fraction tap intercept: show hint if playable, toast if not, TIP 3 if tutorial active
  useEffect(() => {
    fracTapIntercept.fn = (card: Card) => {
      const topCard = state.discardPile[state.discardPile.length - 1];
      const playable = validateFractionPlay(card, topCard);

      if (!playable) {
        dispatch({ type: 'PUSH_NOTIFICATION', payload: {
          id: `frac-${Date.now()}`,
          title: t('fraction.challengeToastTitle'),
          message: '',
          body: t('fraction.cannotPlayHere'),
          emoji: '😊',
          style: 'warning',
          autoDismissMs: 5500,
        }});
        return true;
      }

      // Playable + hint not yet shown this turn -> show bubble hint once per turn
      if (guidanceEnabledRef.current && !fracHintShown.current) {
        fracHintShown.current = true;
        dispatch({
          type: 'PUSH_NOTIFICATION',
          payload: {
            id: `frac-hint-${Date.now()}`,
            title: t('fraction.firstTapHintTitle'),
            message: t('fraction.firstTapHintBody'),
            emoji: '💡',
            style: 'info',
            autoDismissMs: 7000,
          },
        });
        return true; // intercepted — don't play yet
      }

      // Hint already shown → let it through to dispatch PLAY_FRACTION
      return false;
    };
    return () => { fracTapIntercept.fn = null; };
  }, [state.discardPile, tutLoaded, dispatch, t]);

  // ── Guidance notification system ──
  // First time ever = full explanation, after that = short one-liner
  const showGuidance = useCallback((key: GuidanceKey, fullNotif: Omit<Notification, 'id'>, shortNotif: Omit<Notification, 'id'>) => {
    if (!guidanceEnabledRef.current) return;
    const isFirst = !guidanceSeen.current.has(key);
    if (isFirst) {
      guidanceSeen.current.add(key);
      AsyncStorage.setItem(key, 'true');
    }
    const n = isFirst ? fullNotif : shortNotif;
    dispatch({ type: 'PUSH_NOTIFICATION', payload: { id: `guidance-${key}-${Date.now()}`, ...n } });
  }, [dispatch]);

  const hasWildForResults = useMemo(() => cp?.hand.some(c => c.type === 'wild') ?? false, [cp?.hand]);
  const handNumberValuesForResults = useMemo(
    () =>
      new Set(
        cp?.hand.filter(c => c.type === 'number' && c.value != null).map(c => c.value as number) ?? [],
      ),
    [cp?.hand],
  );
  const filteredResultsForHand = useMemo(() => {
    if (state.isTutorial && tutorialBus.getL7GuidedMode()) {
      if (tutorialBus.getL7Step1Mode()) {
        // L7 step 1: show parens-right results directly from validTargets.
        // Equation builder is empty — no operators yet — so l7ParensResults is null.
        // We bypass that filter and show all parens-right equations instead.
        return state.validTargets.filter((t) => {
          const eq = t.equation.trimStart();
          return eq.includes('(') && !eq.startsWith('(');
        });
      }
      const pr = tutorialBus.getL7ParensResults();
      if (pr) {
        const allowed = new Set([pr.left, pr.right].filter((v): v is number => v !== null));
        return state.validTargets.filter(t => allowed.has(t.result));
      }
      return [];
    }
    return state.isTutorial
      ? state.validTargets
      : state.validTargets.filter(t => handNumberValuesForResults.has(t.result));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.validTargets, handNumberValuesForResults, state.isTutorial, l5UiTick]);
  const botDemoKind = state.botPresentation?.action?.kind ?? null;
  const isBotDemoBeat =
    botDemoKind === 'checkPossibleResults' || botDemoKind === 'useMiniCards';
  // During a bot demo beat, surface ALL valid targets (unfiltered) so the
  // player sees the same "possible results" strip the teaching narration is
  // pointing at — `cp` during the bot's turn is the bot, so the hand-filtered
  // list is usually empty and would render nothing.
  const resultsStripFeed = (isBotTurnAny || isBotDemoBeat) ? state.validTargets : filteredResultsForHand;
  // Fraction cards in hand that can be played on the current top of the
  // discard pile (e.g. 1/3 when the top is a number divisible by 3).
  const playableFractionCardsForResults = useMemo(() => {
    if (!cp) return [] as Card[];
    const topDiscard = state.discardPile[state.discardPile.length - 1];
    if (!topDiscard) return [] as Card[];
    return cp.hand.filter(c => c.type === 'fraction' && validateFractionPlay(c, topDiscard));
  }, [cp?.hand, state.discardPile]);

  // Possible results toggle: לחיצה ראשונה — הצגת מיני קלפים + ONB; לחיצה שנייה — הסתרה
  const toggleResultsBadges = useCallback(() => {
    playMiniResultTapSound();
    if (resultsOpen) {
      setResultsChipBoostedPulse(false);
      setResultsOpenState(false);
      if (state.isTutorial) tutorialBus.emitUserEvent({ kind: 'resultsChipTapped' });
      return;
    }
    // Tutorial (lesson 6 step 6.1) watches for this event as the outcome
    // predicate — without the emit the lesson never advances.
    if (state.isTutorial) tutorialBus.emitUserEvent({ kind: 'resultsChipTapped' });
    const shouldCountUseThisOpen = !state.possibleResultsInfoCountedThisTurn;
    const nextInfoUse = state.possibleResultsInfoUses + 1;
    if (shouldCountUseThisOpen) {
      dispatch({ type: 'USE_POSSIBLE_RESULTS_INFO' });
      if (nextInfoUse === 3) {
        dispatch({
          type: 'PUSH_NOTIFICATION',
          payload: {
            id: `guidance-results-info-fee-${Date.now()}`,
            title: 'תוצאות אפשריות',
            message: 'שימו לב: בפעם הבאה שתפעילו "תוצאות אפשריות" תשלפו קלף תשלום מהערימה.',
            emoji: '',
            style: 'warning',
            requireAck: true,
          },
        });
      }
    }
    setResultsChipBoostedPulse(false);
    setResultsOpenState(true);
    const shouldShowWildResultsGuidance =
      midGameHintsUnlocked &&
      tutLoaded &&
      guidanceEnabledRef.current &&
      state.guidanceEnabled !== false &&
      hasWildForResults &&
      wildResultsGuidanceCountRef.current < 2;
    if (shouldShowWildResultsGuidance) {
      wildResultsGuidanceCountRef.current += 1;
      showGuidance(
        'guidance_wild_results',
        {
          title: t('guidance.wildResultsTitle'),
          message: t('guidance.wildResultsBody'),
          emoji: '🟣',
          style: 'info',
          autoDismissMs: 9000,
        },
        {
          title: t('guidance.wildResultsTitle'),
          message: t('guidance.wildResultsBody'),
          emoji: '🟣',
          style: 'info',
          autoDismissMs: 9000,
        },
      );
    }
    if (!midGameHintsUnlocked || !guidanceEnabledRef.current || !tutLoaded) return;
    if (state.identicalAlert || state.pendingFractionTarget !== null) return;
    // בשימוש השלישי כבר יש הודעת תשלום עם requireAck — בלי גם onb_results (שני "הבנתי" ברצף)
    if (!shouldCountUseThisOpen || nextInfoUse !== 3) {
      showOnb('onb_results', '', '', 'לפניך מוצגות במיני קלפים את התוצאות האפשריות. אם תלחץ עליהם תוכל לגלות את התרגיל');
    }
  }, [resultsOpen, midGameHintsUnlocked, tutLoaded, showOnb, state.identicalAlert, state.pendingFractionTarget, state.possibleResultsInfoUses, state.possibleResultsInfoCountedThisTurn, state.guidanceEnabled, dispatch, hasWildForResults, showGuidance, t, playMiniResultTapSound]);

  useEffect(() => {
    if (!resultsOpen || resultsMiniPulseSeen || !tutLoaded) return;
    const isNewGuidedPlayer = guidanceEnabledRef.current && state.guidanceEnabled !== false;
    if (!isNewGuidedPlayer) return;
    if (!(state.showPossibleResults && state.validTargets.length > 0 && filteredResultsForHand.length > 0 && (state.phase === 'building' || state.phase === 'solved') && !state.hasPlayedCards)) return;
    setResultsMiniPulseSeen(true);
    setMiniResultsPulseToken(prev => prev + 1);
    void AsyncStorage.setItem(RESULTS_MINI_PULSE_SEEN_KEY, 'true');
  }, [resultsOpen, resultsMiniPulseSeen, tutLoaded, state.guidanceEnabled, state.showPossibleResults, state.validTargets.length, filteredResultsForHand.length, state.phase, state.hasPlayedCards]);

  // חץ קטן (קנה מידה כמו מיני קלפים) — פעם אחת אחרי פתיחה ראשונה של תוצאות אפשריות
  useEffect(() => {
    if (!resultsOpen || resultsMiniArrowSeen || !tutLoaded) return;
    if (!guidanceEnabledRef.current) return;
    if (!(state.showPossibleResults && state.validTargets.length > 0 && (state.phase === 'building' || state.phase === 'solved') && !state.hasPlayedCards)) return;

    setResultsMiniArrowSeen(true);
    void AsyncStorage.setItem(RESULTS_MINI_ARROW_SEEN_KEY, 'true');
    setResultsMiniArrowPulse(true);
    resultsStripArrowAnim.setValue(0);
    resultsStripArrowLoopRef.current?.stop();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(resultsStripArrowAnim, { toValue: 1, duration: 300, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.timing(resultsStripArrowAnim, { toValue: 0, duration: 300, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
      ]),
    );
    resultsStripArrowLoopRef.current = loop;
    loop.start();
    const t = setTimeout(() => {
      resultsStripArrowLoopRef.current?.stop();
      resultsStripArrowLoopRef.current = null;
      resultsStripArrowAnim.setValue(0);
      setResultsMiniArrowPulse(false);
    }, 3800);
    return () => {
      clearTimeout(t);
      resultsStripArrowLoopRef.current?.stop();
      resultsStripArrowLoopRef.current = null;
    };
  }, [
    resultsOpen,
    resultsMiniArrowSeen,
    tutLoaded,
    resultsStripArrowAnim,
    state.showPossibleResults,
    state.validTargets.length,
    state.phase,
    state.hasPlayedCards,
  ]);

  // ── Bot teaching demo: open "possible results" strip and highlight mini
  //    cards while the bot is walking through its teaching beats. The bot
  //    clock queues { checkPossibleResults, useMiniCards } right before a
  //    confirmEquation when guidance is on. Close the strip again once the
  //    demo clears, but only if we opened it (so we don't clobber a user open).
  const botDemoOpenedResultsRef = useRef(false);
  // Auto-open the strip when the bot enters building/solved so the player
  // always sees the possible results during the bot's equation phase.
  const botBuildingSolved = isBotTurnAny &&
    (state.phase === 'building' || state.phase === 'solved') &&
    !state.hasPlayedCards &&
    state.validTargets.length > 0;
  useEffect(() => {
    if (isBotDemoBeat || botBuildingSolved) {
      if (!resultsOpen) {
        botDemoOpenedResultsRef.current = true;
        setResultsOpenState(true);
      }
      if (botDemoKind === 'useMiniCards') {
        setResultsMiniArrowPulse(true);
        resultsStripArrowAnim.setValue(0);
        resultsStripArrowLoopRef.current?.stop();
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(resultsStripArrowAnim, { toValue: 1, duration: 300, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
            Animated.timing(resultsStripArrowAnim, { toValue: 0, duration: 300, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          ]),
        );
        resultsStripArrowLoopRef.current = loop;
        loop.start();
        // Always "tap" the mini card matching the bot's planned equation
        // and show the red solve-exercise chip with the equation.
        const nextPending = state.botPendingDemoActions?.[0];
        if (nextPending && nextPending.kind === 'confirmEquation') {
          const targetEq = state.validTargets.find((t) => t.result === nextPending.target);
          if (targetEq) {
            const tapDelay = setTimeout(() => {
              playMiniResultTapSound();
              setSelectedEquationForDisplay(targetEq);
              setSolveChipPulseKey((prev) => prev + 1);
            }, 500);
            return () => clearTimeout(tapDelay);
          }
        }
      }
    } else if (botDemoOpenedResultsRef.current && !state.isTutorial) {
      botDemoOpenedResultsRef.current = false;
      setResultsOpenState(false);
      setSelectedEquationForDisplay(null);
      resultsStripArrowLoopRef.current?.stop();
      resultsStripArrowLoopRef.current = null;
      resultsStripArrowAnim.setValue(0);
      setResultsMiniArrowPulse(false);
    }
  }, [isBotDemoBeat, botBuildingSolved, botDemoKind, resultsOpen, resultsStripArrowAnim, state.botPendingDemoActions, state.validTargets, state.isTutorial, playMiniResultTapSound]);

  // תרגיל נבחר להצגה באזור האפור (רק כש־showSolveExercise מופעל)
  const [selectedEquationForDisplay, setSelectedEquationForDisplay] = useState<EquationOption | null>(null);
  const [solveChipPulseKey, setSolveChipPulseKey] = useState(0);

  // ── Bot: always open the red "solve exercise" chip with the bot's
  //    equation when the bot reaches the solved phase. Built directly from
  //    state — no dependency on validTargets matching or demo-beat timing.
  const botEquationShownRef = useRef('');
  useEffect(() => {
    if (!isBotTurnAny) return;
    if (state.hasPlayedCards) return;
    // Open strip + red chip as early as possible during bot's turn:
    // - building phase: show first valid target as a preview
    // - solved phase: show the actual equation the bot confirmed
    if (state.phase === 'building' && state.validTargets.length > 0) {
      const buildKey = `build-${state.roundsPlayed}-${state.currentPlayerIndex}`;
      if (botEquationShownRef.current === buildKey) return;
      botEquationShownRef.current = buildKey;
      const first = state.validTargets[0];
      setSelectedEquationForDisplay({ result: first.result, equation: first.equation });
      setSolveChipPulseKey((prev) => prev + 1);
      if (!resultsOpen) {
        botDemoOpenedResultsRef.current = true;
        setResultsOpenState(true);
      }
    } else if (state.phase === 'solved' && state.lastEquationDisplay) {
      const solvedKey = `solved-${state.roundsPlayed}-${state.currentPlayerIndex}-${state.lastEquationDisplay}`;
      if (botEquationShownRef.current === solvedKey) return;
      botEquationShownRef.current = solvedKey;
      setSelectedEquationForDisplay({
        result: state.equationResult ?? 0,
        equation: state.lastEquationDisplay,
      });
      setSolveChipPulseKey((prev) => prev + 1);
    }
  }, [isBotTurnAny, state.phase, state.hasPlayedCards, state.lastEquationDisplay, state.equationResult, state.validTargets, state.roundsPlayed, state.currentPlayerIndex, resultsOpen]);

  const handleMiniResultSelect = useCallback((eq: EquationOption) => {
    playMiniResultTapSound();
    setSelectedEquationForDisplay(eq);
    setSolveChipPulseKey(prev => prev + 1);
    // Tutorial (lesson 6 step 6.2) watches for this event as the outcome
    // predicate — without the emit the lesson never advances.
    if (state.isTutorial) {
      tutorialBus.emitUserEvent({ kind: 'miniCardTapped', result: eq.result, equation: eq.equation });
      // Find the simplest 2-number dice combination that produces eq.result
      // so the bot demo in L6.3 can replicate it. Tries all ordered pairs
      // and all ops (+ first for clarity) until a match is found.
      const dv = state.dice ? [state.dice.die1, state.dice.die2, state.dice.die3] : [2, 3, 5];
      const pairs: [number, number][] = [[0,1],[0,2],[1,2],[1,0],[2,0],[2,1]];
      const ops: ('+' | '-' | 'x' | '÷')[] = ['+', '-', 'x', '÷'];
      let copyA = 0, copyB = 1, copyOp: '+' | '-' | 'x' | '÷' = '+';
      let found = false;
      for (const [pa, pb] of pairs) {
        if (found) break;
        for (const testOp of ops) {
          if (applyOperation(dv[pa], testOp, dv[pb]) === eq.result) {
            copyA = pa; copyB = pb; copyOp = testOp; found = true; break;
          }
        }
      }
      tutorialBus.setL6CopyConfig({ pickA: copyA, pickB: copyB, op: copyOp, target: eq.result, equation: eq.equation });
    }
    // First ever tap on any mini-result card — stop the first-time pulse
    // loop permanently and remember it across app launches.
    if (!miniResultTapped) {
      setMiniResultTapped(true);
      void AsyncStorage.setItem(MINI_RESULT_TAPPED_KEY, 'true');
    }
  }, [playMiniResultTapSound, miniResultTapped, state.isTutorial]);

  // The "אותגרת" / fraction-challenge bubble now lives on the TurnTransition
  // screen (see TurnTransition's fraction-challenge effect). GameScreen only
  // surfaces the follow-up "עכשיו נחפש פתרון" defender hint below.
  // After the challenged human dismisses the requireAck "you were challenged"
  // bubble, surface a one-time-ever guidance bubble on the defender's game
  // screen. Fires once per attack (not once-ever), only when guidance is on,
  // and only after the challenge bubble is gone. Card highlights already show
  // whether a solution exists, so the text stays the same regardless.
  const fracDefenseHintKeyRef = useRef<string>('');
  useEffect(() => {
    if (state.guidanceEnabled === false) return;
    if (state.pendingFractionTarget === null || state.fractionAttackResolved) return;
    const cpNow = state.players[state.currentPlayerIndex] ?? null;
    if (!cpNow) return;
    const challengedIsBot =
      state.botConfig?.playerIds.includes(cpNow.id) === true ||
      (cpNow as { isBot?: boolean }).isBot === true;
    const isChallengedMe = isOnlineGame ? myPerspIdx === state.currentPlayerIndex : !challengedIsBot;
    if (!isChallengedMe) return;
    const challengeStillOpen = (state.notifications ?? []).some((n) => n.id.startsWith('frac-challenge-'));
    if (challengeStillOpen) return;
    const dedupeKey = `frac-${state.roundsPlayed}-${state.currentPlayerIndex}-${state.pendingFractionTarget}-${state.fractionPenalty}`;
    if (fracDefenseHintKeyRef.current === dedupeKey) return;
    fracDefenseHintKeyRef.current = dedupeKey;
    dispatch({
      type: 'PUSH_NOTIFICATION',
      payload: {
        id: `frac-defense-hint-${Date.now()}`,
        title: t('fraction.defenseLookingForSolution'),
        message: '',
        body: '',
        emoji: '🔎',
        style: 'info',
        autoDismissMs: 6000,
      },
    });
  }, [state.guidanceEnabled, state.pendingFractionTarget, state.fractionAttackResolved, state.fractionPenalty, state.currentPlayerIndex, state.players, state.notifications, state.botConfig, state.roundsPlayed, isOnlineGame, myPerspIdx, dispatch, t]);
  const hasIdentical = state.phase === 'pre-roll' && !state.hasPlayedCards
    && state.consecutiveIdenticalPlays < 2 && cp && td
    && cp.hand.some(c => validateIdenticalPlay(c, td));
  const notificationTurnKey = `${state.roundsPlayed}-${state.currentPlayerIndex}`;
  const identArrowShownForTurn = useRef<string | null>(null);

  // Contract:
  // - hasIdentical: player can legally answer with a matching card now.
  // - no-identical hint: פעם אחת בלבד (NO_IDENTICAL_HINT_SEEN_KEY), רק כשאין קלף זהה ואפשר להטיל.
  const canShowNoIdenticalHint = canRoll
    && !hasIdentical
    && tutLoaded
    && guidanceEnabledRef.current
    && !noIdenticalHintSeen
    && midGameHintsUnlocked;

  // Identical card arrow hint — מוצג כשיש קלף זהה זמין, פעם אחת בכל תור.
  useEffect(() => {
    if (!guidanceEnabledRef.current || !tutLoaded || (identArrowSeen && identArrowShownForTurn.current === notificationTurnKey)) return;
    if (hasIdentical && !identArrowVisible && identArrowShownForTurn.current !== notificationTurnKey) {
      identArrowShownForTurn.current = notificationTurnKey;
      setIdentArrowVisible(true);
      identArrowX.setValue(0);
      identArrowLoop.current = Animated.loop(Animated.sequence([
        Animated.timing(identArrowX, { toValue: 10, duration: 500, useNativeDriver: true }),
        Animated.timing(identArrowX, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]));
      identArrowLoop.current.start();

      const t = setTimeout(() => {
        identArrowLoop.current?.stop();
        setIdentArrowVisible(false);
      }, 10000);
      return () => clearTimeout(t);
    }
    if (!hasIdentical && identArrowVisible) {
      identArrowLoop.current?.stop();
      setIdentArrowVisible(false);
    }
  }, [hasIdentical, tutLoaded, identArrowVisible, notificationTurnKey, identArrowSeen]);

  const NO_IDENTICAL_HINT_DELAY_MS = 1400;

  useEffect(() => {
    if (!canShowNoIdenticalHint) {
      if (noIdenticalHintTimerRef.current) {
        clearTimeout(noIdenticalHintTimerRef.current);
        noIdenticalHintTimerRef.current = null;
      }
      return;
    }
    noIdenticalHintTimerRef.current = setTimeout(() => {
      noIdenticalHintTimerRef.current = null;
      setNoIdenticalHintSeen(true);
      AsyncStorage.setItem(NO_IDENTICAL_HINT_SEEN_KEY, 'true');
    }, NO_IDENTICAL_HINT_DELAY_MS);
    return () => {
      if (noIdenticalHintTimerRef.current) {
        clearTimeout(noIdenticalHintTimerRef.current);
        noIdenticalHintTimerRef.current = null;
      }
    };
  }, [canShowNoIdenticalHint]);

  // ── Contextual onboarding triggers ──
  const onbBlocked = !!state.identicalAlert || state.pendingFractionTarget !== null;
  if (__DEV__) console.log('[ONB] onbBlocked:', onbBlocked, 'hasOnbNotif:', (state.notifications ?? []).some(n => n.id.startsWith('onb-')), 'identAlert:', !!state.identicalAlert, 'fracTarget:', state.pendingFractionTarget);

  // בנה תרגיל — רק אחרי הטלת קוביות (שלב building עם קוביות)
  useEffect(() => {
    if (!midGameHintsUnlocked) return;
    if (!guidanceEnabledRef.current || !tutLoaded || onbBlocked) return;
    if (state.phase !== 'building' || !state.dice) return;
    showOnb('onb_build_equation', '🧮', t('onb.buildEquation.title'), t('onb.buildEquation.body'));
  }, [midGameHintsUnlocked, tutLoaded, onbBlocked, state.phase, state.dice, showOnb, t]);

  // מיני קלפים — רק בפעם הראשונה שהרצועה זמינה (לפי הגדרות המשחק)
  useEffect(() => {
    if (!midGameHintsUnlocked) return;
    if (!guidanceEnabledRef.current || !tutLoaded || onbBlocked) return;
    if (!state.showPossibleResults || state.validTargets.length === 0) return;
    if (state.phase !== 'building' && state.phase !== 'solved') return;
    if (state.hasPlayedCards) return;
    if (miniStripEverShownRef.current) return;
    miniStripEverShownRef.current = true;
  }, [midGameHintsUnlocked, tutLoaded, onbBlocked, state.showPossibleResults, state.validTargets.length, state.phase, state.hasPlayedCards]);

  // 7. First discard — after cards are discarded
  useEffect(() => {
    if (!guidanceEnabledRef.current || !tutLoaded || onbBlocked) return;
    if (state.lastDiscardCount > 0) {
      showOnb('onb_first_discard', '💡', t('onb.firstDiscard.title'), t('onb.firstDiscard.body'));
    }
  }, [tutLoaded, onbBlocked, state.lastDiscardCount, t]);

  // 8. Choose cards — first time entering solved phase (בחר קלפים שסכומם שווה לתוצאה)
  useEffect(() => {
    if (!guidanceEnabledRef.current || !tutLoaded || onbBlocked) return;
    if (state.phase === 'solved' && state.equationResult !== null && !state.hasPlayedCards) {
      showOnb(
        'onb_choose_cards_after_confirm',
        '🎯',
        t('onb.chooseCardsAfterConfirm.title'),
        t('onb.chooseCardsAfterConfirm.body'),
      );
    }
  }, [tutLoaded, onbBlocked, state.phase, state.equationResult, state.hasPlayedCards, t]);

  // G1. Fraction attack — defender enters pre-roll with pendingFractionTarget
  // הודעות שבר מוצגות בבועות NotificationZone בלבד (ללא וילון תחתון).
  const prevFracTarget = useRef<number | null>(null);
  useEffect(() => {
    // נשמר רק את הערך האחרון כדי לזהות שינויים, אבל לא נדחוף התראה נוספת ל-NotificationZone.
    prevFracTarget.current = state.pendingFractionTarget;
  }, [state.pendingFractionTarget, state.phase]);

  // G3. קלף זהה — בועה במסך בלבד (ללא התראת NotificationZone כפולה)
  const lastIdenticalGuidanceKey = useRef<string | null>(null);
  useEffect(() => {
    if (!state.identicalAlert) {
      lastIdenticalGuidanceKey.current = null;
      return;
    }
    const { playerName, cardDisplay, consecutive } = state.identicalAlert;
    const key = `${state.roundsPlayed}|${state.currentPlayerIndex}|${consecutive}|${playerName}|${cardDisplay}`;
    if (lastIdenticalGuidanceKey.current === key) return;
    lastIdenticalGuidanceKey.current = key;
    const dismissTimer = setTimeout(() => dispatch({ type: 'DISMISS_IDENTICAL_ALERT' }), 2500);
    return () => clearTimeout(dismissTimer);
  }, [state.identicalAlert, state.roundsPlayed, state.currentPlayerIndex, dispatch]);

  const identicalSfxKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!state.identicalAlert) {
      identicalSfxKeyRef.current = null;
      return;
    }
    const { playerName, cardDisplay, consecutive } = state.identicalAlert;
    const key = `${state.roundsPlayed}|${state.currentPlayerIndex}|${consecutive}|${playerName}|${cardDisplay}`;
    if (identicalSfxKeyRef.current === key) return;
    identicalSfxKeyRef.current = key;
    if (soundOn) void playSfx('success', { cooldownMs: 80, volumeOverride: 0.4 });
  }, [state.identicalAlert, soundOn, state.roundsPlayed, state.currentPlayerIndex]);

  const prevTurnPlayerIdxRef = useRef<number | null>(null);
  useEffect(() => {
    const prevIdx = prevTurnPlayerIdxRef.current;
    if (prevIdx == null) {
      prevTurnPlayerIdxRef.current = state.currentPlayerIndex;
      return;
    }
    const playerChanged = prevIdx !== state.currentPlayerIndex;
    if (soundOn && playerChanged) {
      const prevPlayer = state.players[prevIdx] ?? null;
      const prevWasBot =
        !!prevPlayer &&
        (state.botConfig?.playerIds.includes(prevPlayer.id) === true ||
          (prevPlayer as { isBot?: boolean }).isBot === true);
      if (prevWasBot) {
        void playSfx('complete', { cooldownMs: 180, volumeOverride: 0.42 });
      }
    }
    prevTurnPlayerIdxRef.current = state.currentPlayerIndex;
  }, [state.currentPlayerIndex, state.players, state.botConfig, soundOn]);

  // G4. סלינדה/קלף סימן — ההודעה מוצגת רק כשעומדים על הקלף (מרכז המניפה), בחלק התחתון של המסך, חד־פעמי (ראה BottomCardHint)

  // G5. Triple dice — all 3 dice show the same number
  const prevDiceForTriple = useRef<typeof state.dice>(null);
  useEffect(() => {
    if (!state.dice || state.dice === prevDiceForTriple.current) { prevDiceForTriple.current = state.dice; return; }
    prevDiceForTriple.current = state.dice;
    if (state.dice.die1 === state.dice.die2 && state.dice.die2 === state.dice.die3) {
      const val = state.dice.die1;
      const tripleMsg = t('guidance.tripleDraw', { n: String(val) });
      showGuidance('guidance_triple', {
        message: tripleMsg,
        style: 'celebration',
        autoDismissMs: 5000,
      }, {
        message: tripleMsg,
        style: 'celebration',
        autoDismissMs: 5000,
      });
    }
  }, [state.dice, showGuidance, t]);

  const matchCountForHandRaw = useMemo(() => {
    const numCount = state.validTargets.filter(t => handNumberValuesForResults.has(t.result)).length;
    const fracCount = new Set(playableFractionCardsForResults.map(c => c.fraction)).size;
    return numCount + fracCount;
  }, [state.validTargets, handNumberValuesForResults, playableFractionCardsForResults]);
  // During bot's turn the strip shows ALL validTargets (unfiltered), so the
  // badge count must match that — not the hand-filtered count.
  const matchCountForHand = isBotTurnAny ? state.validTargets.length : matchCountForHandRaw;
  const wildResultsGuidanceCountRef = useRef(0);
  useEffect(() => {
    wildResultsGuidanceCountRef.current = 0;
  }, [state.openingDrawId]);
  const placeNowChipsDisplay = useMemo(
    () =>
      state.phase === 'solved' && state.stagedCards.length > 0
        ? stagedSelectionChipsDisplay(state.stagedCards, state.equationResult, state.mathRangeMax ?? 25)
        : [],
    [state.phase, state.stagedCards, state.equationResult, state.mathRangeMax],
  );
  const PLACE_NOW_BTN_W = 220;
  /** רוחב מינימלי סביב הכפתור — מונע anchor שלילי וחפיפה עם צ'יפים במסכים צרים */
  const PLACE_NOW_ORBIT_W = Math.max(PLACE_NOW_BTN_W + 32, Math.min(SCREEN_W - 16, 420));
  const placeNowAnchorLeft = (PLACE_NOW_ORBIT_W - PLACE_NOW_BTN_W) / 2;
  const placeOrbitH = Math.max(
    72,
    12 + Math.ceil(placeNowChipsDisplay.length / 2) * (STAGED_CHIP_ORBIT_H + STAGED_CHIP_ORBIT_GAP),
  );
  const placeNowChipPositions = useMemo(
    () =>
      layoutStagedChipOrbitPositions(
        placeNowChipsDisplay.map((c) => c.cardId),
        PLACE_NOW_ORBIT_W,
        placeNowAnchorLeft,
        PLACE_NOW_BTN_W,
        placeOrbitH,
      ),
    [placeNowChipsDisplay, PLACE_NOW_ORBIT_W, placeNowAnchorLeft, placeOrbitH],
  );
  // AppShell לא מוסיף safe-bottom במובייל — כאן שומרים רווח עבור המניפה + אזור המחוות
  const bottomPad = HAND_BOTTOM_OFFSET + HAND_STRIP_HEIGHT + safe.SAFE_BOTTOM_PAD;
  const topControlsTop = safe.insets.top || 6;
  const botOverlayTopOffset = topControlsTop + 86;
  useEffect(() => {
  }, [bottomPad, state.phase, state.players.length]);
  return (
    <View style={{ flex: 1, width: SCREEN_W, minHeight: 0, overflow: 'visible' }}>
      {/* רקע מסך — ערכת הנושא של האווירה הכללית. בטוטוריאל תמיד כהה אטום. */}
      {state.isTutorial ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a1628' }]} />
      ) : (
        <LinearGradient
          colors={[...background.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* שולחן — ניתן לשינוי דרך ערכות נושא. */}
      {!state.isTutorial && (
        table.image ? (
          <ImageBackground source={table.image} resizeMode="cover" style={[StyleSheet.absoluteFill, { backgroundColor: table.imageTint, opacity: 0.85 }]} />
        ) : (
          <LinearGradient colors={table.gradient!} style={[StyleSheet.absoluteFill, { opacity: 0.75 }]} />
        )
      )}
      {lockUiForBotTurn ? (
        <View
          pointerEvents="auto"
          style={[StyleSheet.absoluteFillObject, { zIndex: 300, backgroundColor: 'transparent' }]}
        />
      ) : null}

      {/* ── Background dice layers (decorative — hidden in tutorial mode) ── */}
      {!state.isTutorial ? (
        <>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <RoamingDice ref={bgDiceRef} />
          </View>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <WalkingDice />
          </View>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <RoamingCoins />
          </View>
        </>
      ) : null}
      {/* תוכן מעל הרקע ── */}
      <View style={{flex:1,paddingTop:0,paddingBottom:bottomPad,overflow:'visible'}}>
      {/* ── SLOT 1: שחקנים + שליטה בשורה העליונה (תמיד מעל שאר ה-UI) ──
           zIndex must sit above the bot-turn lock overlay (zIndex 300) so
           meta controls (mute / exit / tournament) stay tappable while
           the bot is playing. The lock still covers the rest of the board. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: topControlsTop,
          left: 10,
          right: 10,
          zIndex: 400,
          ...(Platform.OS === 'android' ? { elevation: 400 } : {}),
          flexDirection: 'row',
          direction: 'ltr' as any,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingBottom: 4,
        }}
      >
        <View style={{ flexShrink: 0, gap: 0, marginTop: -65 }}>
          <LulosButton text={t('ui.exitGame')} color="red" width={72} height={32} fontSize={11} onPress={()=>{ if (state.isTutorial) tutorialBus.emitRequestExit(); else dispatch({type:'RESET_GAME'}); }} style={{ marginBottom: -8 }} />
          {!state.isTutorial && (
            <LulosButton text={t('ui.tournament')} color="orange" width={72} height={32} fontSize={11} onPress={() => setTournamentInfoOpen(true)} style={{ marginBottom: -8 }} />
          )}
          {!state.isTutorial && state.timerSetting !== 'off' && (
            <LulosButton
              text={`⏱ ${secsLeft ?? 0}`}
              color={secsLeft <= 5 && timerRunning ? 'red' : 'blue'}
              width={72}
              height={32}
              fontSize={13}
              onPress={() => setTimerOpen(true)}
              style={{ marginBottom: -8 }}
            />
          )}
          <LulosButton text={soundOn ? '🔊' : '🔇'} color="blue" width={56} height={32} fontSize={14} onPress={toggleSoundsInGame} />
          {!state.isTutorial && (() => { const hp = state.players.find(p => !p.isBot) ?? (state.players.length === 1 ? state.players[0] : null); return hp ? (
            <View style={{ marginTop: 10, alignItems: 'center', gap: 4, marginLeft: -6 }}>
              <ExcellenceMeter
                value={hp.courageMeterPercent ?? 0}
                pulseKey={hp.courageRewardPulseId ?? 0}
                isCelebrating={state.lastCourageCoinsAwarded}
                compact
              />
            </View>
          ) : null; })()}
        </View>
        {!state.isTutorial && (
          <View pointerEvents="box-none" style={{ flex: 1, minWidth: 0, marginLeft: 8, marginTop: -65 }}>
            <PlayerSidebar
              rulesOpen={gameRulesOpen}
              setRulesOpen={setGameRulesOpen}
              cardsCatalogOpen={gameCardsCatalogOpen}
              setCardsCatalogOpen={setGameCardsCatalogOpen}
              showRulesButtonInSidebar={false}
            />
          </View>
        )}
      </View>
      {/* ── SLOT 2: תוצאות אפשריות (הערימה ממוקמת לפי Y מוחלט) ── */}
      <View style={{flexShrink:0,flexDirection:'row',direction:'ltr' as any,alignItems:'center',justifyContent:'flex-start',flexWrap:'wrap',gap:12,paddingHorizontal:12,paddingVertical:4,zIndex:1}} />

      {/* ערימה — מיקום מוחלט לפי צירים. מוסתרת בטוטוריאל חוץ משיעור השברים
          (שם המשתמש חייב לראות את הקלף שבראש הערימה כדי להבין מתי אפשר
          להניח קלף שבר). showFractions מסומן ל־true רק ב־TUTORIAL_FRACTION_SETUP. */}
      {(!state.isTutorial || state.showFractions) && (
      <View style={{ position:'absolute', top:50, right:12, zIndex:3, alignItems:'center', gap:4 }}>
        <View style={{ alignItems:'center', gap:4, position:'relative', minWidth:96 }}>
          <DiscardPile />
          {identArrowVisible && (
            <Animated.View
              style={{
                alignItems: 'center',
                marginTop: 4,
                maxWidth: 280,
                transform: [{ translateX: identArrowX }, { translateY: -56 }],
              }}
              pointerEvents="none"
            >
              <Animated.Text
                style={{
                  fontSize: 22,
                  color: '#FACC15',
                  fontWeight: '900',
                  marginBottom: 6,
                  textShadowColor: 'rgba(0,0,0,0.35)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }}
              >
                ▲
              </Animated.Text>
              <View style={[alertBubbleStyle.box, { maxWidth: 280, paddingVertical: 12, paddingHorizontal: 12 }]}>
                <Text style={alertBubbleStyle.title}>🎉 יש לך קלף זהה!</Text>
                <Text style={alertBubbleStyle.body}>הנח אותו על הערימה — דלג על קוביות והיפטר מקלף!</Text>
                <IdenticalWildStarHint compact />
              </View>
            </Animated.View>
          )}
        </View>
      </View>
      )}
      {/* כפתור תוצאות אפשריות + כפתור אדום — לצד הערימה */}
      {state.showPossibleResults && state.validTargets.length > 0 && (state.phase === 'building' || state.phase === 'solved') && !state.hasPlayedCards && (
        <View style={{ position: 'absolute', top: 84, right: 128, zIndex: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ResultsSlot
            onToggle={toggleResultsBadges}
            filteredResults={filteredResultsForHand}
            matchCount={matchCountForHand}
            boostedPulse={resultsChipBoostedPulse}
            noPulse={state.isTutorial && tutorialBus.getL7GuidedMode()}
          />
        </View>
      )}
      {/* טוגל סוגריים — מחוץ לשולחן, בין תוצאות אפשריות לבין השולחן הירוק */}
      {state.phase === 'building' && !state.hasPlayedCards && state.dice !== null && !tutorialBus.getFracGuidedMode() && (
        <Animated.View style={{ position: 'absolute', top: 170, left: 0, right: 0, zIndex: 100, flexDirection: 'row', justifyContent: 'center', transform: [{ scale: parensTogglePulseAnim }] }}>
          <TouchableOpacity
            onPress={() => {
              const next = !parensRight;
              setParensRight(next);
              tutorialBus.setParensRightValue(next);
              tutorialBus.emitUserEvent({ kind: 'parensToggled', parensRight: next });
            }}
            accessibilityLabel="שינוי מיקום הסוגריים"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: '#B45309',
              backgroundColor: '#F97316',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              ...Platform.select({
                ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
                android: { elevation: 5 },
              }),
            }}
          >
            {/* איקון מיקום הסוגריים */}
            <Text allowFontScaling={false} style={{ fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>
              {parensRight ? (
                <>
                  <Text style={{ color: '#FFF' }}>□ </Text>
                  <Text style={{ color: '#FED7AA', fontSize: 18 }}>(</Text>
                  <Text style={{ color: '#FFF' }}>□□</Text>
                  <Text style={{ color: '#FED7AA', fontSize: 18 }}>)</Text>
                </>
              ) : (
                <>
                  <Text style={{ color: '#FED7AA', fontSize: 18 }}>(</Text>
                  <Text style={{ color: '#FFF' }}>□□</Text>
                  <Text style={{ color: '#FED7AA', fontSize: 18 }}>)</Text>
                  <Text style={{ color: '#FFF' }}> □</Text>
                </>
              )}
            </Text>
            <Text allowFontScaling={false} style={{ fontSize: 11, fontWeight: '800', color: '#FFF' }}>
              {'שינוי מיקום הסוגריים'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── SLOT 3: שולחן ירוק + תרגיל + טיימר (מוקאפ תרגיל הועבר ליד תוצאות אפשריות) ── */}
      <View style={{position:'absolute',top:EQUATION_TABLE_TOP,left:17,right:7,zIndex:2,flexDirection:'row',alignItems:'stretch',gap:0,transform:[{translateX:EQUATION_TABLE_SHIFT_X}]}}>
        <View style={{flex:1,minWidth:0,justifyContent:'flex-end',paddingBottom:75}}>
          <ImageBackground
            source={resolveGameTableSurface(activeTableSkin?.image ?? null, pokerTableImg) as any}
            style={{
              alignSelf:'center',
              width:'100%',
              height:240,
              justifyContent:'center',
              alignItems:'center',
              paddingVertical:10,
              paddingHorizontal:8,
              overflow:'hidden',
            }}
            resizeMode="stretch"
          >
            <EquationBuilder ref={eqBuilderRef} onConfirmChange={setEqConfirm} timerProgress={equationTimerProgress} interactive={!isOnlineWaiting} parensRight={parensRight} onParensRightChange={setParensRight} />
          </ImageBackground>
          {!l5GuidedTutorial ? <StagingZone /> : null}
        </View>
      </View>

      {/* ── SLOT 4: רווח 100px ── */}
      <View style={{flexShrink:0,height:100}} />
      </View>

      {/* מניפה: מלא את המסך; ללא bottom שלילי — תואם AppShell בלי paddingBottom תחתון.
          ללא שכבת הכהיה במצב הדרכה כדי שהשחקן יראה תמיד את הקלפים במניפה. */}
      <View style={[StyleSheet.absoluteFillObject, { zIndex: isLocalBotTurn ? 52 : 4, opacity: 1 }]} pointerEvents="box-none">
        <View style={{ position: 'absolute', bottom: HAND_BOTTOM_OFFSET, left: 0, right: 0, height: HAND_STRIP_HEIGHT, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 12, width: '100%' }}>
          <View style={{ height: HAND_INNER_HEIGHT, width: '100%', alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' }}>
            {!l5HideFanStrip ? <PlayerHand onCenterCard={setCenterCard} onFractionTapForOnb={onFractionTapForOnb} /> : null}
          </View>
        </View>
      </View>

      {/* הודעה "אין לך קלף זהה" — מועברת ל־NotificationZone */}

      {/* טיימר פתיל — מוצג inline על המסך. FuseTimer מצייר את הפתיל ב-Y=40 פנימי,
          לכן container ב-top:400 נותן Y חזותי של ~440. */}
      {state.timerSetting !== 'off' && (
        <View
          style={{
            position: 'absolute',
            top: 400,
            left: 0,
            right: 0,
            zIndex: 4,
          }}
          pointerEvents="none"
        >
          <View style={{ alignItems: 'center', paddingHorizontal: 12 }}>
            <FuseTimer totalTime={TIMER_TOTAL} secsLeft={secsLeft} running={timerRunning} />
          </View>
        </View>
      )}

      {/* מודל טיימר פתיל — נפתח בלחיצה על כפתור ⏱ בעמודה השמאלית */}
      <RNModal visible={timerOpen} transparent animationType="fade" onRequestClose={() => setTimerOpen(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setTimerOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: 'rgba(15,23,42,0.97)', borderRadius: 20, padding: 24, borderWidth: 1.5, borderColor: 'rgba(250,204,21,0.45)', alignItems: 'center', gap: 10 }}>
              <FuseTimer totalTime={TIMER_TOTAL} secsLeft={secsLeft} running={timerRunning} />
              <Text style={{ color: '#FDE68A', fontSize: 22, fontWeight: '900', textAlign: 'center' }}>
                ⏱ {secsLeft ?? 0} {t('ui.seconds')}
              </Text>
              {showSmallTurnTimerHint ? (
                <Text style={{ color: '#FDE68A', fontSize: 12, fontWeight: '600', textAlign: 'center', opacity: 0.85, maxWidth: 280, lineHeight: 17 }}>
                  {t('ui.turnTimerLabel')}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </RNModal>

      {/* מיני תוצאות — מעט מתחת לטיימר פתיל, מעל קו המניפה.
          During the bot's teaching beat we force-render the strip even if the
          player hasn't enabled "possible results" — the demo is the whole
          point: it's how the player discovers the feature. */}
      {((isBotTurnAny || isBotDemoBeat || state.showPossibleResults) && (!state.isTutorial || state.showPossibleResults) && state.validTargets.length > 0 && (state.phase === 'building' || state.phase === 'solved') && !state.hasPlayedCards) ? (
        <View style={{ position: 'absolute', top: 455, left: 0, right: 0, minHeight: 50, zIndex: 30, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }} pointerEvents="box-none">
          {resultsMiniArrowPulse ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -34,
                alignItems: 'center',
                zIndex: 32,
                opacity: resultsStripArrowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                transform: [
                  { translateY: resultsStripArrowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, -5] }) },
                  { scale: resultsStripArrowAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1.06, 0.9] }) },
                ],
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  lineHeight: 20,
                  color: '#FDE047',
                  fontWeight: '900',
                  textShadowColor: 'rgba(0,0,0,0.88)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }}
              >
                ▼
              </Text>
            </Animated.View>
          ) : null}
          <ResultsStripBelowTable
            resultsOpen={resultsOpen}
            filteredResults={resultsStripFeed}
            fractionCards={isBotTurnAny ? [] : playableFractionCardsForResults}
            miniPulseToken={miniResultsPulseToken}
            loopPulse={(!miniResultTapped && !!state.showSolveExercise) || (state.isTutorial && state.showPossibleResults)}
            highlightAll={state.isTutorial && state.showPossibleResults}
            onSelectEquation={(state.showSolveExercise || state.showPossibleResults) ? handleMiniResultSelect : undefined}
            highlightResult={state.isTutorial && state.equationResult != null ? state.equationResult : undefined}
          />
        </View>
      ) : null}

      {/* בחר קלפים — מיקום קבוע שלא יסתיר את המניפה. בטוטוריאל: בדרך כלל
          אישור אוטומטי, אבל בשיעור 4 שלב 3 (guided full build) הכפתור חוזר
          כדי שהלומד ילחץ עליו בעצמו והטוטוריאל יצייר עליו חץ. */}
      {state.phase === 'building' && !state.hasPlayedCards && (!state.isTutorial || tutorialBus.getL4Step3Mode() || tutorialBus.getManualEqConfirm()) && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 500,
            zIndex: 30,
            alignItems: 'center',
          }}
          pointerEvents="auto"
        >
          <Animated.View
            ref={confirmBtnWrapperRef}
            onLayout={() => {
              if (!state.isTutorial || !tutorialBus.getL4Step3Mode()) return;
              confirmBtnWrapperRef.current?.measureInWindow?.((x, y, w, h) => {
                tutorialBus.setLayout('confirmEqBtn', { top: y, left: x, width: w, height: h });
              });
            }}
            style={[
              Platform.select({
                ios: {
                  shadowColor: '#FF6B00',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.75,
                  shadowRadius: 16,
                },
                android: { elevation: 14 },
              }),
              // Tutorial "breathing" pulse — a subtle scale loop that draws
              // the eye without hiding the button text. Driven by the shared
              // `tutorialResultPulse` so it stays in step with any sibling
              // tutorial animations.
              state.isTutorial && tutorialBus.getL4Step3Mode()
                ? {
                    transform: [
                      {
                        scale: tutorialResultPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.06],
                        }),
                      },
                    ],
                  }
                : null,
            ]}
          >
            {/* L4 step 3: pulsing ◀ arrow next to the confirm button */}
            {state.isTutorial && tutorialBus.getL4Step3Mode() && !!eqConfirm && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: -44,
                  top: -136,
                  opacity: tutorialResultPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                  transform: [
                    { translateX: tutorialResultPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) },
                    { scale: tutorialResultPulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1.2, 0.9] }) },
                  ],
                }}
              >
                <Text style={{ fontSize: 32, color: '#FDE047', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>{'◀'}</Text>
              </Animated.View>
            )}
            <LulosButton
              text={t('game.buildingEquationNext')}
              color="orange"
              width={220}
              height={48}
              fontSize={17}
              textColor="#FFFFFF"
              disabled={!eqConfirm}
              onPress={() => {
                if (!eqConfirm) return;
                if (state.isTutorial && tutorialBus.getL4Step3Mode()) {
                  tutorialBus.emitUserEvent({ kind: 'eqConfirmedByUser' });
                }
                eqConfirm.onConfirm();
              }}
            />
          </Animated.View>
        </View>
      )}
      {state.phase === 'solved' && !state.hasPlayedCards && state.stagedCards.length > 0 && !l5GuidedTutorial && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 460,
            zIndex: 30,
            alignItems: 'center',
          }}
          pointerEvents="box-none"
        >
          <View
            style={{
              width: PLACE_NOW_ORBIT_W,
              height: placeOrbitH,
              position: 'relative',
              alignSelf: 'center',
            }}
            pointerEvents="box-none"
          >
            <StagedChipOrbitLayer
              chips={placeNowChipsDisplay}
              positions={placeNowChipPositions}
              stagedCards={state.stagedCards}
              dispatch={dispatch}
              t={t}
            />
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: placeNowAnchorLeft,
                top: 9,
                width: PLACE_NOW_BTN_W,
                height: 54,
                zIndex: 2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.View
                ref={playCardsBtnWrapperRef}
                onLayout={() => {
                  if (!state.isTutorial || !tutorialBus.getL4Step3Mode()) return;
                  playCardsBtnWrapperRef.current?.measureInWindow?.((x, y, w, h) => {
                    tutorialBus.setLayout('playCardsBtn', { top: y, left: x, width: w, height: h });
                  });
                }}
                style={[
                  Platform.select({
                    ios: {
                      shadowColor: '#FF9100',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.92,
                      shadowRadius: 20,
                    },
                    android: { elevation: 18 },
                  }),
                  // Tutorial "breathing" pulse — subtle scale loop.
                  state.isTutorial && tutorialBus.getL4Step3Mode()
                    ? {
                        transform: [
                          {
                            scale: tutorialResultPulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.06],
                            }),
                          },
                        ],
                      }
                    : null,
                ]}
              >
                {/* Tutorial arrow for "בחרתי" is drawn from the side in
                    InteractiveTutorialScreen via the reported layout rect —
                    no inline ▼ here so the button stays at its normal spot. */}
                <LulosButton
                  text={t('game.placeCards')}
                  color="orange"
                  width={PLACE_NOW_BTN_W}
                  height={54}
                  fontSize={20}
                  textColor="#FFFFFF"
                  onPress={() => {
                    if (state.isTutorial && tutorialBus.getL4Step3Mode()) {
                      tutorialBus.emitUserEvent({ kind: 'userPlayedCards' });
                    }
                    dispatch({ type: 'CONFIRM_STAGED' });
                  }}
                />
              </Animated.View>
            </View>
          </View>
        </View>
      )}

      {/* כפתור פתרון תרגיל — ליד כפתור תוצאות אפשריות, ממורכז לגובה הערימה וברווח 20px */}
      {(state.phase === 'building' || state.phase === 'solved') && !state.hasPlayedCards && (!state.isTutorial || state.showPossibleResults) && (isBotTurnAny || isBotDemoBeat || state.showSolveExercise || state.showPossibleResults) && selectedEquationForDisplay !== null && (
        <View style={{ position: 'absolute', top: 84, right: 224, zIndex: 8 }} pointerEvents="box-none">
          <SolveExerciseChip
            equation={selectedEquationForDisplay.equation}
            pulseKey={solveChipPulseKey}
            loopPulse={state.isTutorial && tutorialBus.getL7SolveChipLoopPulse()}
            onPress={state.isTutorial ? () => {} : () => setSelectedEquationForDisplay(null)}
          />
        </View>
      )}

      {/* ── איזור תחתון מאוחד: כפתורי תור + שלוף קלף ויתור + חזרה לתרגיל (נסדר כפתורים אחר כך) ── */}
      {(() => {
        const pr=state.phase==='pre-roll', bl=state.phase==='building', so=state.phase==='solved';
        const fracMin = pr && state.pendingFractionTarget !== null;
        const showDraw = (bl||so)&&!state.hasPlayedCards&&state.pendingFractionTarget===null&&!state.isTutorial;
        const showFracDraw = fracMin && !state.hasPlayedCards;
        const btnCount = (canRoll?1:0)+(showDraw?1:0)+(showFracDraw?1:0);
        const abEndTurn = (pr||bl||so)&&state.hasPlayedCards;
        const totalBtns = btnCount + (abEndTurn?1:0);
        const showFallback = totalBtns === 0 && (pr||bl||so) && !state.isTutorial;
        const barPaddingBottom = Math.max(24, safe.insets.bottom + 20);
        const BOTTOM_BAR_HEIGHT = 180;
        const drawVisible = showDraw || showFracDraw || showFallback;
        const showSolvedRow = so && !state.hasPlayedCards;
        const hasStaged = showSolvedRow && state.stagedCards.length > 0;
        return (
          <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 30, left: 0, right: 0, minHeight: BOTTOM_BAR_HEIGHT + safe.insets.bottom, zIndex: 20, overflow: 'visible', backgroundColor: 'transparent', paddingHorizontal: 20, paddingTop: 12, paddingBottom: barPaddingBottom }}>
            <View pointerEvents="box-none" style={{flex:1,justifyContent:'flex-end'}}>
              <ScrollView style={{flexGrow:0, overflow:'visible'}} contentContainerStyle={{alignItems:'center',gap:8}} showsVerticalScrollIndicator={true} bounces={false}>
                <ActionBar />
              </ScrollView>
              {/* איפוס התרגיל — שורה קבועה מתחת ל-ScrollView */}
              <View style={{flexShrink:0,minHeight:52,alignItems:'center',justifyContent:'center',gap:8,paddingTop:6,flexDirection:'row',flexWrap:'wrap',transform:[{translateY:40}]}}>
                {/* איפוס התרגיל — רק ב-building */}
                {bl && !state.hasPlayedCards && state.dice && state.pendingFractionTarget === null && !state.isTutorial && (
                  <LulosButton text={t('game.resetEquation')} color="blue" width={120} height={38} fontSize={14} onPress={() => eqBuilderRef.current?.resetAll()} />
                )}
              </View>
              {/* שורה שנייה — שלוף קלף, מופרדת כדי למנוע חפיפה */}
              {drawVisible && (
                <Animated.View style={{flexShrink:0,marginTop:10,alignItems:'center',opacity: shouldBlinkGameTimerHint ? gameTimerHintOpacity : 1,transform:[{translateY:40}]}}>
                  <LulosButton
                    text={t('game.drawForfeit')}
                    color="red"
                    height={40}
                    fontSize={15}
                    onPress={()=>{
                      playDrawForfeitSound();
                      dispatch(showFracDraw ? {type:'DEFEND_FRACTION_PENALTY'} : {type:'DRAW_CARD'});
                    }}
                  />
                </Animated.View>
              )}
            </View>
          </View>
        );
      })()}

      {/* כפתור זהב במיקום אבסולוטי למסך: Y מדויק לפי רשת (עם clamp לגובה המסך כדי לא להיעלם) */}
      {canRoll && (!state.isTutorial || state.showFractions) && (
        <View style={{ position: 'absolute', top: GOLD_ACTION_BUTTON_TOP, left: 0, right: 0, zIndex: 25, alignItems: 'center' }} pointerEvents="box-none">
          <View style={{ position: 'relative', alignItems: 'center', overflow: 'visible' }}>
            {showDicePulse && (
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
                  opacity: dicePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
                  transform: [{ scale: dicePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
                  ...Platform.select({
                    ios: { shadowColor: '#FCD34D', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.95, shadowRadius: 18 },
                    android: { elevation: 16 },
                  }),
                }}
              />
            )}
            <GoldDiceButton onPress={handleRoll} width={160} size={58} />
            {!state.isTutorial && (
              <View
                style={{
                  position: 'absolute',
                  left: -70,
                  top: 0,
                }}
                pointerEvents="none"
              >
                <StartTurnCountdownCircle
                  deadlineAt={gameTurnDeadlineAt}
                  size={50}
                  soundEnabled={soundOn}
                  showLabel={false}
                />
              </View>
            )}
            {gameTurnDeadlineAt != null && showSmallTurnTimerHint && (
              <Text
                style={{
                  marginTop: 6,
                  color: '#FDE68A',
                  fontSize: 10,
                  fontWeight: '600',
                  textAlign: 'center',
                  paddingHorizontal: 12,
                  opacity: 0.92,
                  maxWidth: 300,
                  lineHeight: 14,
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
              >
                {t('ui.turnTimerLabel')}
              </Text>
            )}
            {state.timerSetting !== 'off' && timerRunning && secsLeft > 0 && (
              <View
                pointerEvents="none"
                style={{
                  marginTop: 6,
                  minWidth: 126,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: secsLeft <= 5 ? 'rgba(220,38,38,0.9)' : 'rgba(15,23,42,0.86)',
                  borderWidth: 1,
                  borderColor: secsLeft <= 5 ? 'rgba(254,202,202,0.9)' : 'rgba(147,197,253,0.7)',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '900' }}>
                  ⏱ {secsLeft}ש׳
                </Text>
              </View>
            )}
            {showRollArrow && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: -88,
                  top: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 72,
                  zIndex: 26,
                  opacity: rollArrowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                  transform: [
                    { translateX: rollArrowAnim.interpolate({ inputRange: [0, 1], outputRange: [14, -10] }) },
                    { scale: rollArrowAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.94, 1.22, 0.94] }) },
                  ],
                }}
              >
                <Text style={{ fontSize: 44, lineHeight: 48, color: '#FDE047', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6, transform: [{ rotate: '180deg' }] }}>➜</Text>
              </Animated.View>
            )}
          </View>
        </View>
      )}

      {showCel && <CelebrationFlash onDone={()=>setShowCel(false)} />}

      

      


      {/* ── נגמר הזמן: חסימת מסך + הודעה בתחתית 2.5 שניות, אחר כך שלוף קלף ומעבר לתור הבא ── */}
      {timerExpiredOverlay && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 70,
            backgroundColor: 'rgba(0,0,0,0.58)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingBottom: 0,
          }}
        >
          <View style={[alertBubbleStyle.box, { width: '100%', maxWidth: 360, paddingVertical: 18, paddingHorizontal: 18, transform: [{ translateY: -150 }] }]}>
            <Text style={[alertBubbleStyle.title, { fontSize: 22 }]}>⏱ נגמר הזמן — שלוף קלף</Text>
            <Text style={[alertBubbleStyle.body, { marginTop: 6 }]}>מעבר לתור הבא בעוד רגע...</Text>
          </View>
        </View>
      )}

      {/* בחר קלפים / ערוך תרגיל — הנחיה לשחקן בשלב הסטייג׳ */}
      {state.phase === 'solved' && !state.hasPlayedCards && state.stagedCards.length === 0 && !l5GuidedTutorial && (!state.isTutorial || tutorialBus.getL9ParensFilter()) && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { zIndex: 95 },
            Platform.OS === 'android' ? { elevation: 95 } : null,
          ]}
          pointerEvents="box-none"
        >
          <View
            style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', gap: 10 }}
            pointerEvents="box-none"
          >
            <LulosButton
              text={state.isTutorial ? t('game.pickCards') : t('game.pickCards_revert')}
              color={state.isTutorial ? 'orange' : 'blue'}
              textColor="#FFFFFF"
              width={160}
              height={44}
              fontSize={17}
              onPress={() => { if (!state.isTutorial) dispatch({ type: 'REVERT_TO_BUILDING' }); }}
            />
          </View>
        </View>
      )}

      {canRenderBotMissionStrip ? null : null}

      <OnlineBotDifficultyModal
        visible={onlineBotDiffOpen}
        onClose={() => setOnlineBotDiffOpen(false)}
        current={state.hostBotDifficulty}
        isHost={!!mpOptional?.isHost}
        onSelectLevel={(d) => {
          mpOptional?.emit('set_bot_difficulty', { difficulty: d });
          setOnlineBotDiffOpen(false);
        }}
      />

      <TournamentInfoModal
        visible={tournamentInfoOpen}
        onClose={() => setTournamentInfoOpen(false)}
        rows={getTournamentRowsForModal(state)}
        gameInfo={{
          modeLabel: state.mode === 'vs-bot' ? 'נגד בוט' : 'מסירה בין שחקנים',
          difficultyLabel: state.difficulty === 'easy' ? 'קל' : 'מלא',
          playersCount: state.players.length,
          diceModeLabel: state.diceMode === '2' ? '2 קוביות' : '3 קוביות',
        }}
        onOpenRules={() => setGameRulesOpen(true)}
        settings={{
          mathRangeMax: state.mathRangeMax,
          showFractions: state.showFractions,
          fractionKinds: state.fractionKinds,
          enabledOperators: state.enabledOperators,
          allowNegativeTargets: state.allowNegativeTargets,
          showPossibleResults: state.showPossibleResults,
          showSolveExercise: state.showSolveExercise,
          timerSetting: state.timerSetting,
          timerCustomSeconds: state.timerCustomSeconds,
        }}
      />

      {null}

    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GAME OVER + CONFETTI
// ═══════════════════════════════════════════════════════════════

const CC = ['#EAB308','#3B82F6','#EF4444','#22C55E','#8B5CF6','#F97316'];
function Confetti() {
  const an = useRef(Array.from({length:30},()=>({x:new Animated.Value(Math.random()*SCREEN_W),y:new Animated.Value(-20),r:new Animated.Value(0),c:CC[Math.floor(Math.random()*CC.length)]}))).current;
  useEffect(()=>{an.forEach(a=>{const d=2000+Math.random()*2000,dl=Math.random()*1500;Animated.parallel([Animated.timing(a.y,{toValue:SCREEN_H+20,duration:d,delay:dl,useNativeDriver:true}),Animated.timing(a.r,{toValue:Math.random()*720-360,duration:d,delay:dl,useNativeDriver:true})]).start();});}, []);
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">{an.map((a,i)=><Animated.View key={i} style={{position:'absolute',width:10,height:10,borderRadius:2,backgroundColor:a.c,transform:[{translateX:a.x as any},{translateY:a.y as any},{rotateZ:a.r.interpolate({inputRange:[-360,360],outputRange:['-360deg','360deg']}) as any}]}} />)}</View>;
}

function GameOver() {
  const { t } = useLocale();
  const { state } = useGame();
  const { dispatch } = useGame();
  const sorted = [...state.players].sort((a,b)=>a.hand.length-b.hand.length);
  return (
    <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:24}}>
      <Confetti />
      <Text style={{fontSize:56,marginBottom:8}}>🏆</Text>
      <View style={{ marginBottom: 24, alignItems: 'center' }}>
        <HappyBubble
          tone="celebrate"
          title="!המשחק נגמר"
          text={`${state.winner?.name ?? ''} ניצח/ה!`}
          withTail={false}
        />
      </View>
      <ScrollView style={{width:'100%',maxHeight:220}} contentContainerStyle={{paddingHorizontal:8,alignItems:'center'}} showsVerticalScrollIndicator={false}>
        <View style={{backgroundColor:'rgba(55,65,81,0.5)',borderRadius:12,padding:16,width:'100%'}}>
          <Text style={{color:'#9CA3AF',fontSize:11,fontWeight:'700',letterSpacing:1,marginBottom:10,textAlign:'center'}}>תוצאות סופיות</Text>
          {sorted.map((p,i)=><View key={p.id} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:3}}><Text style={{color:'#D1D5DB',fontSize:14}} numberOfLines={1}>{i+1}. {p.name}{p.hand.length===2?' ★':''}</Text><Text style={{color:'#9CA3AF',fontSize:14}}>{p.hand.length} קלפים נותרו</Text></View>)}
        </View>
      </ScrollView>
      <LulosButton text={t('game.playAgain')} color="green" width={280} height={64} onPress={()=>dispatch({type:'PLAY_AGAIN'})} style={{marginTop:20}} />
      <LulosButton text={t('tutorial.exit')} color="red" width={280} height={56} onPress={()=>dispatch({type:'RESET_GAME'})} style={{marginTop:12}} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BOT TURN UI — משימה בראש המסך + עמעום מעל השולחן בלבד (המניפה נשארת בולטת)
// ═══════════════════════════════════════════════════════════════
const botOverlayStyles = StyleSheet.create({
  botThinkingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 34,
  },
  botThinkingText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(17,24,39,0.64)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 4,
  },
  coachCard: {
    marginTop: 8,
    width: '92%',
    maxWidth: 430,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.5)',
    backgroundColor: 'rgba(15,23,42,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  coachTitle: {
    color: '#C7D2FE',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  coachBody: {
    marginTop: 6,
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  stepsRow: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  stepChip: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    alignItems: 'center',
  },
  stepChipDone: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderColor: 'rgba(52,211,153,0.5)',
  },
  stepChipNow: {
    backgroundColor: 'rgba(59,130,246,0.24)',
    borderColor: 'rgba(147,197,253,0.75)',
  },
  stepChipLater: {
    backgroundColor: 'rgba(51,65,85,0.45)',
    borderColor: 'rgba(148,163,184,0.35)',
  },
  stepChipTextDone: { color: '#A7F3D0', fontSize: 10, fontWeight: '800' },
  stepChipTextNow: { color: '#DBEAFE', fontSize: 10, fontWeight: '900' },
  stepChipTextLater: { color: '#CBD5E1', fontSize: 10, fontWeight: '700' },
});

function getBotTurnTeachingState(state: GameState): {
  currentStep: 0 | 1 | 2 | 3;
  titleKey: string;
  bodyKey: string;
} {
  if (state.botNoSolutionDrawPending) {
    return {
      currentStep: 2,
      titleKey: 'botOffline.step.noSolutionTitle',
      bodyKey: 'botOffline.step.noSolutionBody',
    };
  }
  if (state.phase === 'turn-transition') {
    return {
      currentStep: 0,
      titleKey: 'botOffline.step.startTitle',
      bodyKey: 'botOffline.step.startBody',
    };
  }
  if (state.pendingFractionTarget !== null) {
    return {
      currentStep: 1,
      titleKey: 'botOffline.step.defenseTitle',
      bodyKey: 'botOffline.step.defenseBody',
    };
  }
  if (state.phase === 'pre-roll' || state.phase === 'roll-dice') {
    return {
      currentStep: 1,
      titleKey: 'botOffline.step.rollTitle',
      bodyKey: 'botOffline.step.rollBody',
    };
  }
  if (state.phase === 'building') {
    if (state.botDicePausePending && state.dice) {
      return {
        currentStep: 2,
        titleKey: 'botOffline.step.diceResultTitle',
        bodyKey: 'botOffline.step.diceResultBody',
      };
    }
    return {
      currentStep: 2,
      titleKey: 'botOffline.step.buildTitle',
      bodyKey: 'botOffline.step.buildBody',
    };
  }
  if (state.phase === 'solved' && !state.hasPlayedCards) {
    if (state.stagedCards.length === 0) {
      return {
        currentStep: 3,
        titleKey: 'botOffline.step.equationTitle',
        bodyKey: 'botOffline.step.equationBody',
      };
    }
    return {
      currentStep: 3,
      titleKey: 'botOffline.step.fillTitle',
      bodyKey: 'botOffline.step.fillBody',
    };
  }
  return {
    currentStep: 3,
    titleKey: 'botOffline.step.playTitle',
    bodyKey: 'botOffline.step.playBody',
  };
}

type BotTeachingPhase = 'preview' | 'consider' | 'pick' | 'place' | 'confirm' | 'done';

function getBotTeachingPhase(state: GameState): BotTeachingPhase {
  if (state.phase === 'turn-transition') return 'preview';
  if (state.phase === 'pre-roll' || state.phase === 'roll-dice' || state.phase === 'building') return 'consider';
  if (state.phase === 'solved' && !state.hasPlayedCards) {
    const pending = state.botPendingStagedIds ?? [];
    if (pending.length > 0) return state.stagedCards.length === 0 ? 'pick' : 'place';
    return 'confirm';
  }
  return 'done';
}

function botTeachingDelayRange(state: GameState, difficulty: BotDifficulty): { min: number; max: number } {
  // All delays shortened by ≈⅓ for a snappier feel.
  if (state.botPresentation?.action != null) {
    if (state.botPresentation.ticks > 0) {
      return { min: 470, max: 570 };
    }
    return { min: 150, max: 220 };
  }
  if (state.botPostEquationPauseTicks > 0) {
    // Pause after equation so the player can read the result (~1s total).
    return { min: 330, max: 380 };
  }
  if (state.botDicePausePending) {
    return { min: 1000, max: 1000 };
  }
  if (state.pendingFractionTarget !== null && state.botFractionDefenseTicks > 0) {
    return { min: 1130, max: 1370 };
  }
  if (state.botNoSolutionDrawPending) {
    if (difficulty === 'easy') return { min: 1600, max: 1900 };
    if (difficulty === 'medium') return { min: 1450, max: 1750 };
    return { min: 1400, max: 1700 };
  }
  if (state.phase === 'solved' && !state.hasPlayedCards) {
    if ((state.botPendingStagedIds?.length ?? 0) > 0) {
      return { min: 150, max: 220 };
    }
    return { min: 250, max: 350 };
  }
  if (state.phase === 'building') {
    if (difficulty === 'easy') return { min: 1350, max: 1700 };
    if (difficulty === 'medium') return { min: 1170, max: 1470 };
    return { min: 1070, max: 1370 };
  }
  return botStepDelayRange(difficulty);
}

function BotMissionStrip(
  { display, result, botName, teachLine = null }:
  { display: string; result: number; botName: string; teachLine?: string | null }
) {
  const { t, isRTL } = useLocale();
  const insets = useSafeAreaInsets();
  const learnLines = [
    t('game.botLearn.step1', { name: botName }),
    t('game.botLearn.step2', { eq: display }),
    t('game.botLearn.step3', { n: String(result) }),
  ];
  return (
    <View
      style={{
        position: 'absolute',
        left: 10,
        right: 10,
        top: (insets.top || 12) + 4,
        zIndex: 100,
        alignItems: 'center',
      }}
      pointerEvents="none"
    >
      <View
        style={[
          alertBubbleStyle.box,
          {
            maxWidth: 420,
            width: '100%',
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderColor: 'rgba(129,140,248,0.6)',
            backgroundColor: 'rgba(30,27,75,0.96)',
          },
        ]}
      >
        <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '800', textAlign: 'center', marginBottom: 4 }}>
          {t('botOffline.thinking')}
        </Text>
        <Text
          style={[
            alertBubbleStyle.title,
            { textAlign: 'center', fontSize: 14, color: '#C7D2FE', writingDirection: isRTL ? 'rtl' : 'ltr' },
          ]}
        >
          {t('game.botEquationRevealTitle', { name: botName })}
        </Text>
        <Text
          style={{
            marginTop: 6,
            fontSize: 20,
            fontWeight: '900',
            color: '#FECACA',
            textAlign: 'center',
            writingDirection: 'ltr',
            direction: 'ltr',
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 2,
          }}
        >
          {'\u2066'}
          {formatEquationForDisplay(display)}
          {'\u2069'}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontSize: 18,
            fontWeight: '800',
            color: '#FCA5A5',
            textAlign: 'center',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {t('game.botEquationRevealResult', { n: String(result) })}
        </Text>
        {!!teachLine && (
          <Text
            style={{
              marginTop: 8,
              fontSize: 12,
              fontWeight: '700',
              color: '#BFDBFE',
              textAlign: 'center',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {teachLine}
          </Text>
        )}
        <View style={{ marginTop: 10, gap: 3 }}>
          {learnLines.map((line, idx) => (
            <Text
              key={`bot-learn-${idx}`}
              style={{
                color: '#DBEAFE',
                fontSize: 11,
                fontWeight: '700',
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {`${idx + 1}. ${line}`}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function BotThinkingOverlay({ topOffset }: { topOffset: number }) {
  const { state, dispatch } = useGame();
  const { t, isRTL } = useLocale();
  const insets = useSafeAreaInsets();
  if (!state.botConfig) return null;
  // In the tutorial, the lesson speech bubble already narrates the bot's
  // actions in learner-friendly copy. The "thinking / coach" overlay is
  // game-mode noise that distracts from what the learner is being taught.
  if (state.isTutorial) return null;
  const current = state.players[state.currentPlayerIndex];
  if (!current || !state.botConfig.playerIds.includes(current.id)) return null;
  if (state.phase === 'game-over') return null;
  /** כפתור זירוז — מדלג על ההמתנה של שעון הבוט ומפעיל מיידית את הצעד הבא */
  const onSpeedUp = () => dispatch({ type: 'BOT_STEP' });
  const handReserve =
    HAND_BOTTOM_OFFSET + HAND_STRIP_HEIGHT + Math.max(insets.bottom, 12);
  // Hide mission mockup so the actual EquationBuilder remains the only focus.
  const showMission = false;
  const teaching = getBotTurnTeachingState(state);
  const teachingPhase = getBotTeachingPhase(state);
  const overlayFade = useRef(new Animated.Value(1)).current;
  const overlayLift = useRef(new Animated.Value(0)).current;
  const prevPhaseRef = useRef<BotTeachingPhase | null>(null);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev === null || prev === teachingPhase) {
      prevPhaseRef.current = teachingPhase;
      return;
    }
    prevPhaseRef.current = teachingPhase;
    overlayFade.setValue(0.55);
    overlayLift.setValue(8);
    Animated.parallel([
      Animated.timing(overlayFade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(overlayLift, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start();
  }, [teachingPhase, overlayFade, overlayLift]);
  const teachingLabel = t(teaching.titleKey, {
    name: current.name,
    d1: String(state.dice?.die1 ?? ''),
    d2: String(state.dice?.die2 ?? ''),
    d3: String(state.dice?.die3 ?? ''),
  });
  const teachingBody = t(teaching.bodyKey, {
    name: current.name,
    d1: String(state.dice?.die1 ?? ''),
    d2: String(state.dice?.die2 ?? ''),
    d3: String(state.dice?.die3 ?? ''),
  });
  const showDiceSummary =
    state.phase === 'building' &&
    state.dice != null &&
    state.botDicePausePending &&
    !state.botNoSolutionDrawPending;
  const parseEqNumbers = (display: string): number[] => {
    const lhs = display.split('=')[0] ?? display;
    const nums = lhs.match(/\d+/g);
    if (!nums) return [];
    return nums.map((n) => Number(n));
  };
  const missionNumbers = showMission ? parseEqNumbers(state.lastEquationDisplay!) : [];
  const stagedNums = state.stagedCards.filter((card) => card.type === 'number').map((card) => card.value ?? 0);
  const stagedWildCount = state.stagedCards.filter((card) => card.type === 'wild').length;
  const matchedCounts = new Map<number, number>();
  for (const val of stagedNums) matchedCounts.set(val, (matchedCounts.get(val) ?? 0) + 1);
  let consumedWild = 0;
  const missionMatch = missionNumbers.map((num) => {
    const have = matchedCounts.get(num) ?? 0;
    if (have > 0) {
      matchedCounts.set(num, have - 1);
      return true;
    }
    if (consumedWild < stagedWildCount) {
      consumedWild += 1;
      return true;
    }
    return false;
  });
  const progress = missionNumbers.length === 0
    ? 0
    : Math.min(
      missionNumbers.length,
      missionMatch.filter(Boolean).length + Math.max(0, stagedWildCount - consumedWild),
    );
  const progressText = showMission
    ? `${progress}/${missionNumbers.length}`
    : null;
  const missionPopRef = useRef<Record<string, Animated.Value>>({});
  const missionPrevRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!showMission) {
      missionPrevRef.current = {};
      missionPopRef.current = {};
      return;
    }
    for (let idx = 0; idx < missionMatch.length; idx++) {
      const key = `mission-${idx}`;
      if (!missionPopRef.current[key]) missionPopRef.current[key] = new Animated.Value(1);
      const now = missionMatch[idx] === true;
      const prev = missionPrevRef.current[key] === true;
      if (now && !prev) {
        missionPopRef.current[key]!.setValue(0.88);
        Animated.sequence([
          Animated.timing(missionPopRef.current[key]!, {
            toValue: 1.12,
            duration: 130,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(missionPopRef.current[key]!, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
        ]).start();
      }
      missionPrevRef.current[key] = now;
    }
  }, [showMission, missionMatch]);
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        botOverlayStyles.botThinkingOverlay,
        {
          top: topOffset,
          bottom: handReserve,
          opacity: overlayFade,
          transform: [{ translateY: overlayLift }],
        },
      ]}
    >
      <Text style={[botOverlayStyles.botThinkingText, { writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
        {teachingLabel}
      </Text>
      <Text
        style={{
          marginTop: 4,
          color: 'rgba(226,232,240,0.96)',
          fontSize: 11,
          fontWeight: '700',
          textAlign: 'center',
          backgroundColor: 'rgba(15,23,42,0.62)',
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 5,
          maxWidth: 430,
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {teachingBody}
      </Text>
      <TouchableOpacity
        onPress={onSpeedUp}
        activeOpacity={0.72}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        style={{
          marginTop: 8,
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: 'rgba(250,204,21,0.95)',
          borderWidth: 1.5,
          borderColor: 'rgba(161,98,7,0.9)',
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '900', color: '#111827' }}>
          {isRTL ? '⏩ זרז תור' : '⏩ Speed up'}
        </Text>
      </TouchableOpacity>
      {showDiceSummary ? (
        <View
          style={{
            marginTop: 6,
            width: '92%',
            maxWidth: 420,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(147,197,253,0.55)',
            backgroundColor: 'rgba(15,23,42,0.82)',
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              color: '#DBEAFE',
              fontSize: 11,
              fontWeight: '800',
              textAlign: 'center',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {t('previewDemo.dicePoolLabel')}
          </Text>
          <Text
            style={{
              marginTop: 2,
              color: '#F8FAFC',
              fontSize: 18,
              fontWeight: '900',
              textAlign: 'center',
              writingDirection: 'ltr',
              direction: 'ltr',
            }}
          >
            {`\u2066${state.dice!.die1} · ${state.dice!.die2} · ${state.dice!.die3}\u2069`}
          </Text>
        </View>
      ) : null}
      {showMission ? (
        <View
          style={{
            marginTop: 6,
            width: '92%',
            maxWidth: 420,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(248,113,113,0.7)',
            backgroundColor: 'rgba(60,12,12,0.9)',
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              color: '#DBEAFE',
              fontSize: 11,
              fontWeight: '800',
              textAlign: 'center',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {t('game.botEquationRevealTitle', { name: current.name })}
          </Text>
          <Text
            style={{
              marginTop: 3,
              color: '#FECACA',
              fontSize: 17,
              fontWeight: '900',
              textAlign: 'center',
              writingDirection: 'ltr',
              direction: 'ltr',
              textShadowColor: 'rgba(0,0,0,0.8)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
          >
            {'\u2066'}
            {formatEquationForDisplay(state.lastEquationDisplay ?? '')}
            {'\u2069'}
          </Text>
          <Text
            style={{
              marginTop: 2,
              color: '#BFDBFE',
              fontSize: 12,
              fontWeight: '800',
              textAlign: 'center',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {`${t('game.botEquationRevealResult', { n: String(state.equationResult) })}  •  ${progressText}`}
          </Text>
          <View style={{ marginTop: 7, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
            {missionNumbers.map((num, idx) => (
              <Animated.View
                key={`mission-${idx}-${num}`}
                style={{
                  minWidth: 30,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 9,
                  borderWidth: 1,
                  borderColor: missionMatch[idx] ? 'rgba(52,211,153,0.8)' : 'rgba(148,163,184,0.6)',
                  backgroundColor: missionMatch[idx] ? 'rgba(16,185,129,0.24)' : 'rgba(51,65,85,0.5)',
                  transform: [{ scale: missionPopRef.current[`mission-${idx}`] ?? 1 }],
                }}
              >
                <Text style={{ color: '#E2E8F0', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>
                  {num}
                </Text>
              </Animated.View>
            ))}
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ALERT BUBBLE — צורה ושפה מאומצים (קלף זהה): קופסה חומה מעוגלת, כותרת צהובה, גוף אפור
// ═══════════════════════════════════════════════════════════════
const alertBubbleStyle = StyleSheet.create({
  box: {
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(251,191,36,0.55)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    maxWidth: 280,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },
  title: {
    color: '#FFD700',
    fontWeight: '900',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
});

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATION ZONE — always mounted at App level (אימוץ צורה ושפה של ההתראה)
// ═══════════════════════════════════════════════════════════════

/** ברוכים הבאים מוצגים רק בבועת מסך מעבר התור — לא בהתראה צפה. */
function isWelcomeNotification(_n: Notification): boolean {
  return false;
}

function NotificationZone() {
  const { state, dispatch } = useGame();
  const insets = useSafeAreaInsets();
  if (__DEV__) console.log('[NZ] render, phase:', state.phase, 'queue length:', state.notifications?.length, 'notifications:', JSON.stringify(state.notifications?.map(n => ({id:n.id,title:n.title,msg:n.message?.slice(0,30)}))));
  const gamePhasesForToasts = new Set<GamePhase>(['pre-roll', 'building', 'solved', 'roll-dice']);
  const fracChallengeVisiblePhase: GamePhase = 'turn-transition';
  const hasBlockingSheet = !!state.identicalAlert;
  // In tutorial mode, suppress every regular game toast — the lesson
  // controls what the learner sees. Anything not currently being taught
  // is noise that distracts from the active step.
  const suppressForTutorial = state.isTutorial;
  // Queue: welcome first if present; else oldest requireAck; else newest non-ack.
  const rawList = state.notifications ?? [];
  const list = rawList.filter((n) => {
    if (hasBlockingSheet) return false;
    if (n.id.startsWith('discard-')) return false;
    if (n.id.startsWith('card-hint-')) return gamePhasesForToasts.has(state.phase);
    if (n.id.startsWith('opening-draw-')) return state.phase === 'turn-transition';
    if (n.id.startsWith('frac-challenge-')) {
      return state.phase === fracChallengeVisiblePhase;
    }
    return gamePhasesForToasts.has(state.phase);
  });
  const eligible = list;
  const welcomeInQueue = eligible.find(isWelcomeNotification);
  const fracChallengeInQueue = state.phase === fracChallengeVisiblePhase && state.pendingFractionTarget !== null
    ? [...eligible].reverse().find((n) => n.id.startsWith('frac-challenge-')) ?? null
    : null;
  const ackInQueue = eligible.find((n) => !!n.requireAck);
  const newestNonAck = [...eligible].reverse().find((n) => !n.requireAck) ?? null;
  const notif = fracChallengeInQueue ?? welcomeInQueue ?? ackInQueue ?? newestNonAck;
  const needsAck = notif ? isWelcomeNotification(notif) || !!notif.requireAck : false;
  /** AppShell כבר מוסיף paddingBottom: insets.bottom — לא מחסרים שוב; ack מרימים מעט כדי שלא ייחתך כפתור "הבנתי!". */
  const ACK_BOTTOM_EXTRA = 36;
  const baseAboveHand = HAND_BOTTOM_OFFSET + HAND_STRIP_HEIGHT + 12;
  const notifBottom = Math.max(20, baseAboveHand + (needsAck ? ACK_BOTTOM_EXTRA : 0));
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const entryTranslateY = useRef(new Animated.Value(0)).current;
  const prevId = useRef<string | null>(null);
  // מיקום הודעות "מתחת/סביב כפתורים" צריך להתבסס על גובה אזור היד (מניפה),
  // ולא להיצמד לתחתית הפיזית של המסך (אחרת זה יורד על המניפה).
  const isBottomNotif = notif && notif.id.startsWith('discard-');
  // בתוך AppShell ה-safe area כבר בריפוד — מרווח מינימלי מעל הקצה הפנימי
  const bottomPos = isBottomNotif ? 12 : notifBottom;

  useEffect(() => {
    if (!notif) {
      prevId.current = null;
      return;
    }
    if (notif.id === prevId.current) return;
    prevId.current = notif.id;
    entryTranslateY.setValue(-18);
    fadeOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(entryTranslateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.timing(fadeOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    // הודעות שדורשות אישור — בלי סגירה אוטומטית
    if (notif.autoDismissMs && !needsAck) {
      const t = setTimeout(() => {
        Animated.timing(fadeOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
          dispatch({ type: 'DISMISS_NOTIFICATION', id: notif.id });
        });
      }, notif.autoDismissMs);
      return () => clearTimeout(t);
    }
  }, [notif?.id, needsAck]);

  if (!notif) return null;
  if (suppressForTutorial) return null;

  const displayTitle = notif.title || notif.message;
  const displayBody = notif.body || (notif.title ? notif.message : '');
  /** כל הודעות "תוצאות אפשריות" (הדרכה + תזכורת תשלום) — בועה ירוקה כמו כפתור "תוצאות אפשריות" */
  const isResultsNotifGreen =
    notif.id === 'onb-onb_results' ||
    notif.id.startsWith('guidance-results-info-fee') ||
    (notif.title != null && RESULTS_POSSIBLE_TITLES.has(String(notif.title)));
  const isWildResultsPurple = notif.id.includes('wild_results');
  const isFractionChallengeNotif = notif.id.startsWith('frac-challenge-');
  const isOpeningDrawNotif = notif.id.startsWith('opening-draw-');
  const isNewUserNotif =
    notif.id.startsWith('onb-') ||
    notif.id.startsWith('guidance-') ||
    (notif.title != null && WELCOME_NOTIFICATION_TITLES.has(String(notif.title)));
  const shouldDimScreen = needsAck && isNewUserNotif;

  const dismiss = () => dispatch({ type: 'DISMISS_NOTIFICATION', id: notif.id });
  const winH = Dimensions.get('window').height;
  const notifBodyMaxH = notif.id.startsWith('frac-challenge-')
    ? Math.min(320, Math.round(winH * 0.48))
    : Math.min(200, Math.round(winH * 0.38));
  return (
    <>
      {shouldDimScreen && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.68)',
            zIndex: 9998,
            elevation: 9998,
          }}
          pointerEvents="none"
        />
      )}
      <Animated.View style={{
        position:'absolute',
        bottom: isOpeningDrawNotif ? undefined : bottomPos,
        left:16,
        right:16,
        top: isOpeningDrawNotif ? '36%' : undefined,
        zIndex:9999,
        elevation:9999,
        opacity: fadeOpacity,
        transform:[{translateY: entryTranslateY}],
      }} pointerEvents="box-none">
        <View style={[alertBubbleStyle.box, {
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          maxWidth: '100%',
          backgroundColor: isWildResultsPurple
            ? 'rgba(109,40,217,0.94)'
            : isOpeningDrawNotif
              ? 'rgba(120,53,15,0.96)'
            : isFractionChallengeNotif
              ? 'rgba(15,23,42,0.95)'
            : isResultsNotifGreen
              ? 'rgba(22,163,74,0.92)'
              : alertBubbleStyle.box.backgroundColor,
          borderColor: isWildResultsPurple
            ? 'rgba(216,180,254,0.95)'
            : isOpeningDrawNotif
              ? 'rgba(253,224,71,0.98)'
            : isFractionChallengeNotif
              ? 'rgba(125,211,252,0.95)'
            : isResultsNotifGreen
              ? 'rgba(74,222,128,0.95)'
              : alertBubbleStyle.box.borderColor,
          borderWidth: isWildResultsPurple || isResultsNotifGreen || isFractionChallengeNotif || isOpeningDrawNotif ? 3 : alertBubbleStyle.box.borderWidth,
          shadowColor: isWildResultsPurple ? '#4C1D95' : isResultsNotifGreen ? '#14532D' : isFractionChallengeNotif ? '#0C4A6E' : isOpeningDrawNotif ? '#B45309' : '#000',
          shadowOpacity: isWildResultsPurple || isResultsNotifGreen || isFractionChallengeNotif || isOpeningDrawNotif ? 0.5 : 0.4,
          shadowRadius: isWildResultsPurple || isResultsNotifGreen || isFractionChallengeNotif || isOpeningDrawNotif ? 14 : 12,
        }]}>
          {isOpeningDrawNotif && (
            <>
              <View style={{ position: 'absolute', top: 6, left: 14, width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.5)' }} />
              <View style={{ position: 'absolute', top: 10, right: 18, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(253,230,138,0.65)' }} />
              <View style={{ position: 'absolute', bottom: 8, left: 24, width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(251,191,36,0.6)' }} />
              <View style={{ position: 'absolute', bottom: 14, right: 14, width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,215,0,0.5)' }} />
              <View style={{ position: 'absolute', top: '50%', left: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' }} />
              <View style={{ position: 'absolute', top: 4, left: '45%', width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(253,224,71,0.55)' }} />
            </>
          )}
          {isResultsNotifGreen && (
            <>
              <View style={{ position: 'absolute', top: 8, left: 12, width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' }} />
              <View style={{ position: 'absolute', top: 18, right: 18, width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
              <View style={{ position: 'absolute', bottom: 10, left: 28, width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            </>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {notif.emoji && !needsAck ? <Text style={{ fontSize: isOpeningDrawNotif ? 42 : 26 }}>{notif.emoji}</Text> : null}
            <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
              <Text style={[alertBubbleStyle.title, { marginBottom: displayBody ? 4 : 0, fontSize: isOpeningDrawNotif ? 22 : undefined, color: (isResultsNotifGreen || isWildResultsPurple) ? '#F0FDF4' : isOpeningDrawNotif ? '#FEF3C7' : alertBubbleStyle.title.color, textShadowColor: (isResultsNotifGreen || isWildResultsPurple || isOpeningDrawNotif) ? 'rgba(0,0,0,0.35)' : 'transparent', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: (isResultsNotifGreen || isWildResultsPurple || isOpeningDrawNotif) ? 2 : 0 }]}>{displayTitle}</Text>

              {!!displayBody && (
                <ScrollView
                  style={{ maxHeight: notifBodyMaxH, alignSelf: 'stretch' }}
                  contentContainerStyle={{ flexGrow: 1 }}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  <Text style={[alertBubbleStyle.body, { fontSize: isOpeningDrawNotif ? 18 : undefined, color: (isResultsNotifGreen || isWildResultsPurple) ? '#F0FDF4' : isOpeningDrawNotif ? '#FEF9C3' : alertBubbleStyle.body.color, fontWeight: (isResultsNotifGreen || isWildResultsPurple || isOpeningDrawNotif) ? '700' : alertBubbleStyle.body.fontWeight }]}>{displayBody}</Text>
                </ScrollView>
              )}
            </View>
            {!needsAck && (
              <TouchableOpacity activeOpacity={0.9} onPress={dismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,215,0,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFD700', fontSize: 14, fontWeight: '900' }}>✓</Text>
              </TouchableOpacity>
            )}
          </View>
          {needsAck && (
            <TouchableOpacity activeOpacity={0.9} onPress={dismiss} style={{ alignSelf: 'flex-end', backgroundColor: 'rgba(255,215,0,0.25)', borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.5)', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {notif.emoji ? <Text style={{ color: '#FFD700', fontSize: 15 }}>{notif.emoji}</Text> : null}
                <Text style={{ color: '#FFD700', fontSize: 15, fontWeight: '800' }}>הבנתי!</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  משחק ברשת — מסך שחקן (היד שלי) + מעבר אוטומטי כשמגיע תורי
// ═══════════════════════════════════════════════════════════════

/** מסך "המסך שלי" — מציג את היד שלי בלבד; רקע כמו מסך מעבר התור, לא כמו שולחן המשחק */
function PlayerWaitingScreen({
  myHand,
  currentTurnName,
  waitingStatusText,
  onBack,
  lastMoveMessage,
  pendingFractionTarget,
  lastMoveBubbleBg,
  lastMoveBubbleBorder,
}: {
  myHand: Card[];
  currentTurnName: string;
  waitingStatusText: string;
  onBack: () => void;
  lastMoveMessage: string | null;
  pendingFractionTarget: number | null;
  lastMoveBubbleBg: string;
  lastMoveBubbleBorder: string;
}) {
  const safe = useGameSafeArea();
  const bottomPad = HAND_BOTTOM_OFFSET + HAND_STRIP_HEIGHT + safe.insets.bottom;
  const sorted = useMemo(() => sortHandCards(myHand), [myHand]);
  const emptySet = useMemo(() => new Set<string>(), []);
  return (
    <View style={{ flex: 1, width: SCREEN_W, minHeight: 0, overflow: 'hidden' }}>
      <LinearGradient colors={[...playerScreensGradientColors]} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, paddingTop: 8, paddingBottom: bottomPad }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 4, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <Text style={{ color: '#F59E0B', fontSize: 18, fontWeight: '800' }}>המסך שלי</Text>
            <Text style={{ color: '#93C5FD', fontSize: 12, textAlign: 'right' }}>{waitingStatusText}</Text>
            <View style={{ backgroundColor: 'rgba(59,130,246,0.25)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#93C5FD', alignSelf: 'flex-end' }}>
              <Text style={{ color: '#BFDBFE', fontSize: 11, fontWeight: '700' }}>{myHand.length} קלפים</Text>
            </View>
          </View>
          <LulosButton text="חזרה לצפייה" color="blue" width={120} height={32} fontSize={11} onPress={onBack} />
        </View>
        {!!lastMoveMessage && pendingFractionTarget === null && (
          <View style={{ paddingHorizontal: 16, marginBottom: 8, alignItems: 'center' }}>
            <View style={[alertBubbleStyle.box, { maxWidth: 340, width: '100%', backgroundColor: lastMoveBubbleBg, borderColor: lastMoveBubbleBorder }]}>
              <Text style={[alertBubbleStyle.title, { textAlign: 'center', writingDirection: 'rtl' }]}>{lastMoveMessage}</Text>
            </View>
          </View>
        )}
        <View style={{ flex: 1, minHeight: 60, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: 'rgba(122,140,165,0.2)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(147,197,253,0.45)', paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: '#DBEAFE', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>מניפה במצב המתנה</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', marginTop: 10 }}>כשמגיע תורך — תעבור אוטומטית למסך המשחק</Text>
        </View>
      </View>
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 5 }]} pointerEvents="box-none">
        <View style={{ position: 'absolute', bottom: HAND_BOTTOM_OFFSET, left: 0, right: 0, height: HAND_STRIP_HEIGHT, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 12, width: '100%' }}>
          <View style={{ height: HAND_INNER_HEIGHT, width: '100%', alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' }}>
            <SimpleHand
              cards={sorted}
              stagedCardIds={emptySet}
              equationHandPlacedIds={EMPTY_ID_SET}
              equationHandPendingId={null}
              defenseValidCardIds={null}
              forwardCardId={null}
              onTap={() => {}}
              onCenterCard={() => {}}
              waitingMode
            />
          </View>
        </View>
      </View>
    </View>
  );
}

/** עטיפה למשחק ברשת: מצב צפייה אחרי סיום תור, מעבר ל"מסך שלי", ופתיחה אוטומטית כשמגיע תורי */
function OnlineGameWrapper() {
  const { state } = useGame();
  const mp = useMultiplayerOptional();
  const { t } = useLocale();
  const safe = useGameSafeArea();
  const myPlayerIndex = (state as any).myPlayerIndex ?? 0;
  const myPlayerState = state.players[myPlayerIndex] as any;
  const isEliminatedSpectator = !!myPlayerState?.isEliminated || !!myPlayerState?.isSpectator;
  const isMyTurn = state.currentPlayerIndex === myPlayerIndex;
  const currentTurnName = state.players[state.currentPlayerIndex]?.name ?? 'שחקן';
  const [viewMode, setViewMode] = useState<'game' | 'player'>('game');
  const prevMyTurn = useRef(isMyTurn);

  useEffect(() => {
    if (isMyTurn && !prevMyTurn.current) {
      setViewMode('game');
      mp?.clearToast?.();
    }
    prevMyTurn.current = isMyTurn;
  }, [isMyTurn, mp]);

  useEffect(() => {
    if (!mp?.toast) return;
    const t = setTimeout(() => mp.clearToast?.(), 6000);
    return () => clearTimeout(t);
  }, [mp?.toast, mp]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!mp?.disconnectChoice) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [mp?.disconnectChoice]);

  const myHand = state.players[myPlayerIndex]?.hand ?? [];
  const currentTurnLobbyPlayer = mp?.players?.find((p) => p.name === currentTurnName);
  const waitingStatusText = !mp?.connected
    ? `מחכים ל-${currentTurnName} (החיבור שלך לא יציב)`
    : currentTurnLobbyPlayer && !currentTurnLobbyPlayer.isConnected
      ? `מחכים ל-${currentTurnName} (חיבור איטי)`
      : `מחכים ל-${currentTurnName}...`;

  const lastPlayerIndex =
    (state.currentPlayerIndex - 1 + state.players.length) % Math.max(state.players.length, 1);
  const ONLINE_WAIT_BUBBLE_COLORS = ['#14532d', '#1d4ed8', '#7c2d12', '#4b5563'] as const;
  const ONLINE_WAIT_BUBBLE_BORDERS = [
    'rgba(74,222,128,0.7)',
    'rgba(129,140,248,0.7)',
    'rgba(248,113,113,0.7)',
    'rgba(156,163,175,0.7)',
  ] as const;
  const lastMoveBubbleBg = ONLINE_WAIT_BUBBLE_COLORS[lastPlayerIndex % ONLINE_WAIT_BUBBLE_COLORS.length];
  const lastMoveBubbleBorder = ONLINE_WAIT_BUBBLE_BORDERS[lastPlayerIndex % ONLINE_WAIT_BUBBLE_BORDERS.length];
  const lastMoveForWaiting = state.lastMoveMessage;

  const toastOverlay =
    mp?.toast != null && mp.toast !== '' ? (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: (safe.insets.top ?? 0) + 52,
          zIndex: 150,
          alignItems: 'center',
        }}
      >
        <View style={{ backgroundColor: 'rgba(15,23,42,0.92)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(56,189,248,0.45)', maxWidth: 400 }}>
          <Text style={{ color: '#E0F2FE', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{mp.toast}</Text>
        </View>
      </View>
    ) : null;

  const reconnectOverlay =
    mp?.reconnectNotice != null && mp.reconnectNotice !== '' ? (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: (safe.insets.top ?? 0) + 8,
          zIndex: 151,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            backgroundColor: 'rgba(15,23,42,0.94)',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(251,191,36,0.55)',
            maxWidth: 420,
          }}
        >
          <Text style={{ color: '#FEF3C7', fontSize: 13, fontWeight: '800', textAlign: 'center' }}>{mp.reconnectNotice}</Text>
        </View>
      </View>
    ) : null;

  const eliminatedBanner = isEliminatedSpectator ? (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        top: (safe.insets.top ?? 0) + 104,
        zIndex: 149,
        alignItems: 'center',
      }}
    >
      <View style={{ backgroundColor: 'rgba(127,29,29,0.92)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(248,113,113,0.6)', maxWidth: 420 }}>
        <Text style={{ color: '#FECACA', fontSize: 13, fontWeight: '800', textAlign: 'center' }}>הודחת אחרי 3 אי-תגובות. מצב צפייה בלבד עד סוף המשחק.</Text>
      </View>
    </View>
  ) : null;

  const disconnectChoice = mp?.disconnectChoice ?? null;
  const remainingMs = disconnectChoice ? disconnectChoice.deadlineAt - nowMs : 0;
  const waitingReconnect = disconnectChoice != null && remainingMs > 0;
  const countdownSec = waitingReconnect ? Math.ceil(remainingMs / 1000) : 0;
  const disconnectChoiceModal =
    disconnectChoice ? (
      <AppModal
        visible
        onClose={() => {
          if (!waitingReconnect) mp?.clearDisconnectChoice?.();
        }}
        title={waitingReconnect ? 'שחקן התנתק' : 'שחקן עזב'}
      >
        <View style={{ gap: 14 }}>
          <Text style={{ color: '#E5E7EB', fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 22 }}>
            {waitingReconnect
              ? `${disconnectChoice.playerName} מנותק כרגע. ממתינים לחזרה (${countdownSec} שניות).`
              : `${disconnectChoice.playerName} לא חזר בזמן. רוצים להמשיך מול בוט?`}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <LulosButton
              text={t('lobby.startBotGame')}
              color="green"
              width={160}
              height={44}
              onPress={() => {
                void mp?.continueVsBot?.();
              }}
            />
            <LulosButton
              text={t('lobby.leaveRoom')}
              color="yellow"
              width={160}
              height={44}
              onPress={() => mp?.leaveRoom?.()}
            />
          </View>
        </View>
      </AppModal>
    ) : null;

  return (
    <View style={{ flex: 1 }}>
      {viewMode === 'player' ? (
        <PlayerWaitingScreen
          myHand={myHand}
          currentTurnName={currentTurnName}
          waitingStatusText={waitingStatusText}
          onBack={() => setViewMode('game')}
          lastMoveMessage={lastMoveForWaiting}
          pendingFractionTarget={state.pendingFractionTarget}
          lastMoveBubbleBg={lastMoveBubbleBg}
          lastMoveBubbleBorder={lastMoveBubbleBorder}
        />
      ) : (
        <GameScreen />
      )}
      {reconnectOverlay}
      {toastOverlay}
      {eliminatedBanner}
      {disconnectChoiceModal}
      {!isMyTurn && viewMode === 'game' && (
        <TouchableOpacity
          onPress={() => setViewMode('player')}
          style={{
            position: 'absolute',
            bottom: 100,
            left: 16,
            backgroundColor: 'rgba(37,99,235,0.9)',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            zIndex: 100,
          }}
        >
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>למסך שלי</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  בחירת אופן משחק — במכשיר אחד (כמה שחקנים) או ברשת
// ═══════════════════════════════════════════════════════════════

function PlayModeChoiceScreen({
  onLocal,
  onOnline,
  onHowToPlay,
  onShop,
  onMyThemes,
  preferredName,
  onPreferredNameChange,
}: {
  onLocal: () => void;
  onOnline: () => void;
  onHowToPlay: () => void;
  onShop: () => void;
  onMyThemes: () => void;
  preferredName: string;
  onPreferredNameChange: (name: string) => void;
}) {
  const { t, locale, setLocale } = useLocale();
  const { profile, user } = useAuth();
  const shortUserId = user?.id ? user.id.slice(0, 3).toUpperCase() : null;
  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>שפה</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => void setLocale('he')} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: locale === 'he' ? '#D97706' : '#1F2937' }}>
            <Text style={{ color: locale === 'he' ? '#111827' : '#fff', fontWeight: '700', fontSize: 13 }}>עברית</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void setLocale('en')} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: locale === 'en' ? '#D97706' : '#1F2937' }}>
            <Text style={{ color: locale === 'en' ? '#111827' : '#fff', fontWeight: '700', fontSize: 13 }}>English</Text>
          </TouchableOpacity>
        </View>
      </View>
      {profile && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          <SlindaCoin size={18} />
          <Text style={{ color: '#FDE68A', fontSize: 14, fontWeight: '700' }}>{profile.total_coins}</Text>
        </View>
      )}
      <Text style={{ alignSelf: 'stretch', color: '#D1D5DB', fontSize: 13, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>{t('lobby.yourName')}</Text>
      <Text style={{ alignSelf: 'stretch', color: '#93C5FD', fontSize: 12, marginBottom: 6, textAlign: 'center' }}>
        {locale === 'he'
          ? `מזהה משתמש: ${shortUserId ?? 'לא זמין עדיין'}${profile?.username ? ` • ${profile.username}` : ''}`
          : `User ID: ${shortUserId ?? 'Not available yet'}${profile?.username ? ` • ${profile.username}` : ''}`}
      </Text>
      <TextInput
        style={{
          width: 280,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          borderColor: '#4B5563',
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          color: '#FFF',
          fontSize: 15,
          marginBottom: 16,
          textAlign: 'center',
        }}
        value={preferredName}
        onChangeText={(name) => onPreferredNameChange(name.slice(0, 7))}
        placeholder={t('lobby.namePlaceholder')}
        placeholderTextColor="#6B7280"
        maxLength={7}
      />
      <LulosButton text={t('mode.local')} color="green" width={280} height={52} fontSize={15} onPress={onLocal} style={{ marginBottom: 16 }} />
      <LulosButton text={t('mode.online')} color="blue" width={280} height={52} fontSize={15} onPress={onOnline} style={{ marginBottom: 16 }} />
      <LulosButton
        text={t('tutorial.howToPlay')}
        color="orange"
        textColor="#FFFFFF"
        width={280}
        height={56}
        fontSize={16}
        onPress={onHowToPlay}
        style={{
          marginTop: 2,
          shadowColor: '#FF4FD8',
          shadowOpacity: 0.9,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
          elevation: 14,
          borderRadius: 999,
          backgroundColor: 'rgba(255,90,180,0.16)',
        }}
      />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <LulosButton text={t('shop.openShop')} color="yellow" width={136} height={48} fontSize={14} onPress={onShop} />
        <LulosButton text={t('themes.openMyThemes')} color="yellow" width={136} height={48} fontSize={14} onPress={onMyThemes} />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROUTER + APP + REGISTER
// ═══════════════════════════════════════════════════════════════

function GameRouter() {
  const mp = useMultiplayerOptional();
  const { state, dispatch } = useGame();
  const insets = useSafeAreaInsets();
  const [playMode, setPlayMode] = useState<'choose' | 'local' | 'online' | 'tutorial'>('choose');
  const [showShop, setShowShop] = useState(false);
  const [showMyThemes, setShowMyThemes] = useState(false);
  // showTutorial removed — replaced by playMode === 'tutorial'
  const welcomeMusicRef = useRef<Audio.Sound | null>(null);
  const soundOn = state.soundsEnabled !== false;
  const [salindaVolume, setSalindaVolume] = useState(0.14);
  const salindaVolumeRef = useRef(0.14);
  const [showSalindaPanel, setShowSalindaPanel] = useState(false);
  const [preferredName, setPreferredName] = useState('');
  const salindaTrackRef = useRef<View | null>(null);
  const trackWindowRef = useRef<{ y: number; h: number }>({ y: 0, h: 140 });
  const SALINDA_PANEL_H = 160;
  const SALINDA_TRACK_H = 140;
  const SALINDA_VOLUME_KEY = 'lulos_salinda_volume';
  const PREFERRED_NAME_KEY = 'lolos_preferred_name';

  // ── Keep sfx loaded for the lifetime of the router (StartScreen's dispose
  //    clears sounds when it unmounts; re-init here ensures they reload).
  useEffect(() => {
    void initializeSfx();
  }, []);

  // ── Game win sound — phase transition to game-over
  const prevPhaseRef = useRef(state.phase);
  useEffect(() => {
    if (state.phase === 'game-over' && prevPhaseRef.current !== 'game-over' && soundOn) {
      void playSfx('gameWin', { cooldownMs: 0, volumeOverride: 0.9 });
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase, soundOn]);

  useEffect(() => {
    sendDebugLog('H4', 'index.tsx:GameRouter.useEffect', 'GameRouter state snapshot', {
      phase: state.phase,
      playMode,
      hasMultiplayer: Boolean(mp),
      soundsEnabled: state.soundsEnabled !== false,
    });
  }, [state.phase, playMode, mp, state.soundsEnabled]);

  useEffect(() => {
    if (Platform.OS !== 'web' || playMode !== 'choose') return;
    const { roomCode } = parseJoinParamsFromUrl();
    if (roomCode) setPlayMode('online');
  }, [playMode]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const volumeRaw = await AsyncStorage.getItem(SALINDA_VOLUME_KEY);
        if (!mounted) return;
        if (volumeRaw != null) {
          const parsed = Number(volumeRaw);
          if (Number.isFinite(parsed)) {
            const normalized = Math.max(0, Math.min(0.4, parsed));
            salindaVolumeRef.current = normalized;
            setSalindaVolume(normalized);
          }
        }
      } catch {
        // ignore persisted salinda settings errors
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(PREFERRED_NAME_KEY)
      .then((saved) => {
        if (!mounted || !saved) return;
        setPreferredName(saved.slice(0, 7));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const clean = preferredName.trim();
    const id = setTimeout(() => {
      if (clean.length > 0) void AsyncStorage.setItem(PREFERRED_NAME_KEY, clean);
      else void AsyncStorage.removeItem(PREFERRED_NAME_KEY);
    }, 150);
    return () => clearTimeout(id);
  }, [preferredName]);

  useEffect(() => {
    if (!showSalindaPanel) return;
    const id = requestAnimationFrame(() => {
      salindaTrackRef.current?.measureInWindow((_, winY, __, winH) => {
        const h = winH > 1 ? winH : SALINDA_TRACK_H;
        trackWindowRef.current = { y: winY, h };
      });
    });
    return () => cancelAnimationFrame(id);
  }, [showSalindaPanel, SALINDA_TRACK_H]);

  useEffect(() => {
    let disposed = false;
    const isGameScreenPhase =
      state.phase === 'pre-roll' ||
      state.phase === 'building' ||
      state.phase === 'solved';
    // Salinda background music must stay silent during the tutorial —
    // the lessons own the soundscape and the song distracts from guidance.
    const shouldPlayWelcomeMusic =
      state.soundsEnabled !== false &&
      !isGameScreenPhase &&
      !state.isTutorial &&
      playMode !== 'tutorial';

    const stopWelcomeMusic = async (opts?: { fadeOutMs?: number }) => {
      const sound = welcomeMusicRef.current;
      welcomeMusicRef.current = null;
      if (!sound) return;
      try {
        const fadeOutMs = opts?.fadeOutMs ?? 0;
        if (fadeOutMs > 0) {
          const steps = 8;
          const stepMs = Math.max(16, Math.floor(fadeOutMs / steps));
          const maxVol = Math.max(0, Math.min(0.4, salindaVolumeRef.current));
          for (let i = steps - 1; i >= 0; i -= 1) {
            if (disposed) return;
            await sound.setVolumeAsync((maxVol * i) / steps);
            await new Promise<void>((resolve) => setTimeout(resolve, stepMs));
          }
        }
        await sound.stopAsync();
      } catch (_) {
        // ignore stop failures
      }
      try {
        await sound.unloadAsync();
      } catch (_) {
        // ignore unload failures
      }
    };

    const syncWelcomeMusic = async () => {
      if (!shouldPlayWelcomeMusic) {
        await stopWelcomeMusic({ fadeOutMs: isGameScreenPhase ? 420 : 0 });
        return;
      }
      if (welcomeMusicRef.current) {
        return;
      }
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          require('./assets/sounds/salinda_song.mp3'),
          { isLooping: true, volume: 0, shouldPlay: true }
        );
        if (disposed) {
          await sound.unloadAsync();
          return;
        }
        welcomeMusicRef.current = sound;
        const fadeInSteps = 8;
        const fadeInStepMs = 25;
        for (let i = 1; i <= fadeInSteps; i += 1) {
          if (disposed) return;
          const target = Math.max(0, Math.min(0.4, salindaVolumeRef.current));
          await sound.setVolumeAsync((target * i) / fadeInSteps);
          await new Promise<void>((resolve) => setTimeout(resolve, fadeInStepMs));
        }
      } catch (_) {
        // ignore background music failures
      }
    };

    void syncWelcomeMusic();
    return () => {
      disposed = true;
    };
  }, [playMode, state.phase, state.soundsEnabled, state.isTutorial]);

  const welcomeVolRafRef = useRef<number | null>(null);
  useEffect(() => {
    const sound = welcomeMusicRef.current;
    if (!sound) return;
    const v = Math.max(0, Math.min(0.4, salindaVolume));
    if (welcomeVolRafRef.current != null) {
      cancelAnimationFrame(welcomeVolRafRef.current);
    }
    welcomeVolRafRef.current = requestAnimationFrame(() => {
      welcomeVolRafRef.current = null;
      const s = welcomeMusicRef.current;
      if (!s) return;
      s.setVolumeAsync(v).catch(() => {});
    });
    return () => {
      if (welcomeVolRafRef.current != null) {
        cancelAnimationFrame(welcomeVolRafRef.current);
        welcomeVolRafRef.current = null;
      }
    };
  }, [salindaVolume]);

  useEffect(() => {
    return () => {
      const sound = welcomeMusicRef.current;
      welcomeMusicRef.current = null;
      if (!sound) return;
      sound.stopAsync().catch(() => {});
      sound.unloadAsync().catch(() => {});
    };
  }, []);

  const toggleSounds = useCallback(() => {
    const next = !soundOn;
    dispatch({ type: 'SET_SOUNDS_ENABLED', enabled: next });
    AsyncStorage.setItem('lulos_sounds_enabled', next ? 'true' : 'false');
  }, [dispatch, soundOn]);
  const applySalindaRatio = useCallback((ratio: number) => {
    const normalized = Math.max(0, Math.min(1, ratio));
    const next = Math.round((0.4 * normalized) * 100) / 100;
    salindaVolumeRef.current = next;
    setSalindaVolume(next);
  }, []);

  const persistSalindaVolume = useCallback(() => {
    void AsyncStorage.setItem(SALINDA_VOLUME_KEY, String(salindaVolumeRef.current));
  }, []);

  let screen: React.ReactNode;
  if (playMode === 'choose') {
    screen = (
      <PlayModeChoiceScreen
        onLocal={() => setPlayMode('local')}
        onOnline={() => setPlayMode('online')}
        onHowToPlay={() => setPlayMode('tutorial')}
        onShop={() => setShowShop(true)}
        onMyThemes={() => setShowMyThemes(true)}
        preferredName={preferredName}
        onPreferredNameChange={setPreferredName}
      />
    );
  } else if (playMode === 'local') {
    if (state.phase === 'setup') screen = <StartScreen onBackToChoice={() => setPlayMode('choose')} onHowToPlay={() => setPlayMode('tutorial')} onShop={() => setShowShop(true)} onMyThemes={() => setShowMyThemes(true)} preferredName={preferredName} />;
    else {
      switch (state.phase) {
        case 'turn-transition': screen = <TurnTransition />; break;
        case 'pre-roll':
        case 'roll-dice':
        case 'building':
        case 'solved':
          screen = <GameScreen />;
          break;
        case 'game-over':
          screen = <GameOver />;
          break;
        default:
          screen = <StartScreen onBackToChoice={() => setPlayMode('choose')} onHowToPlay={() => setPlayMode('tutorial')} onShop={() => setShowShop(true)} onMyThemes={() => setShowMyThemes(true)} preferredName={preferredName} />;
      }
    }
  } else if (playMode === 'tutorial') {
    // Tutorial mode: render the same game screens as local mode but with tutorial overlay.
    // On exit, return to the mode picker (home) — never auto-continue into a game.
    const tutorialExit = () => { dispatch({ type: 'RESET_GAME' }); setPlayMode('choose'); };
    if (state.phase === 'setup') {
      // Auto-start a vs-bot game for the tutorial
      screen = (
        <InteractiveTutorialScreen
          onExit={tutorialExit}
          gameDispatch={dispatch}
          gameState={state}
        />
      );
    } else {
      // Render the real game screens with tutorial overlay on top
      let gameScreen: React.ReactNode;
      switch (state.phase) {
        // Tutorial: TurnTransition hides "I'm ready" for isTutorial, so learners
        // could never reach pre-roll / GameScreen. Use the real game screen and
        // let InteractiveTutorialScreen auto-dispatch BEGIN_TURN (see there).
        case 'turn-transition': gameScreen = state.isTutorial ? <GameScreen /> : <TurnTransition />; break;
        case 'pre-roll':
        case 'roll-dice':
        case 'building':
        case 'solved':
          gameScreen = <GameScreen />;
          break;
        case 'game-over': gameScreen = <GameOver />; break;
        default: gameScreen = null;
      }
      screen = (
        <View style={{ flex: 1, backgroundColor: '#0a1628' }}>
          {gameScreen}
          <InteractiveTutorialScreen
            onExit={tutorialExit}
            gameDispatch={dispatch}
            gameState={state}
          />
        </View>
      );
    }
  } else {
    // playMode === 'online' — משחק ברשת (צפייה + מסך שחקן, מעבר אוטומטי בתורי)
    if (!mp?.inRoom) screen = <LobbyEntry onBackToChoice={() => setPlayMode('choose')} defaultPlayerName={preferredName} />;
    else if (!mp.serverState) screen = <LobbyScreen />;
    else {
      switch (state.phase) {
        case 'setup': screen = <LobbyEntry onBackToChoice={() => setPlayMode('choose')} defaultPlayerName={preferredName} />; break;
        case 'turn-transition': screen = <TurnTransition />; break;
        case 'pre-roll':
        case 'roll-dice':
        case 'building':
        case 'solved':
          screen = state.players.some((p) => !!p.isBot) ? <GameScreen /> : <OnlineGameWrapper />;
          break;
        case 'game-over':
          screen = <GameOver />;
          break;
        default:
          screen = <LobbyEntry onBackToChoice={() => setPlayMode('choose')} defaultPlayerName={preferredName} />;
      }
    }
  }

  const showGlobalMute = !(playMode === 'local' && (state.phase === 'pre-roll' || state.phase === 'roll-dice' || state.phase === 'building' || state.phase === 'solved'));
  const salindaRatio = Math.max(0, Math.min(1, salindaVolume / 0.4));
  const salindaFillPx = Math.round(SALINDA_TRACK_H * salindaRatio);
  const salindaThumbBottom = Math.round(Math.max(0, Math.min(SALINDA_TRACK_H - 9, SALINDA_TRACK_H * salindaRatio - 9)));
  const globalCtrlBtnH = SCREEN_W < 380 ? 36 : 40;
  const globalCtrlRight = 14;
  /** אייקון מוזיקה 🎵 למעלה, מיוט 🔊/🔇 מתחת — אותה עמודה */
  const soundExtrasBottom = Math.max(14, (insets.bottom || 0) + 12);
  const globalMuteBottom = soundExtrasBottom;
  const salindaMusicBottom = globalMuteBottom + globalCtrlBtnH + 8;

  return (
    <View style={{ flex: 1, backgroundColor: playMode === 'tutorial' ? '#0a1628' : undefined }}>
      {screen}
      <ShopScreen visible={showShop} onClose={() => setShowShop(false)} />
      <MyThemesScreen visible={showMyThemes} onClose={() => setShowMyThemes(false)} />
      {showGlobalMute && (
        <>
          {showSalindaPanel && (
            <View
              style={{
                position: 'absolute',
                bottom: salindaMusicBottom + globalCtrlBtnH + 10,
                right: globalCtrlRight,
                width: 44,
                height: SALINDA_PANEL_H,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
              }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                const pageY = e.nativeEvent.pageY;
                salindaTrackRef.current?.measureInWindow((_, winY, __, winH) => {
                  const h = winH > 1 ? winH : SALINDA_TRACK_H;
                  trackWindowRef.current = { y: winY, h };
                  const rel = pageY - winY;
                  applySalindaRatio(1 - Math.max(0, Math.min(1, rel / h)));
                });
              }}
              onResponderMove={(e) => {
                const pageY = e.nativeEvent.pageY;
                const { y: winY, h: winH } = trackWindowRef.current;
                const h = winH > 1 ? winH : SALINDA_TRACK_H;
                const rel = pageY - winY;
                applySalindaRatio(1 - Math.max(0, Math.min(1, rel / h)));
              }}
              onResponderRelease={() => {
                persistSalindaVolume();
                setShowSalindaPanel(false);
              }}
              onResponderTerminate={() => {
                persistSalindaVolume();
                setShowSalindaPanel(false);
              }}
            >
              <View
                ref={salindaTrackRef}
                collapsable={false}
                style={{
                  width: 6,
                  height: SALINDA_TRACK_H,
                  borderRadius: 3,
                  backgroundColor: 'rgba(255,255,255,0.28)',
                }}
              >
                {salindaFillPx > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: salindaFillPx,
                      borderRadius: 3,
                      backgroundColor: '#60A5FA',
                    }}
                  />
                ) : null}
                <View
                  style={{
                    position: 'absolute',
                    bottom: salindaThumbBottom,
                    left: -6,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: salindaVolume > 0 ? '#BFDBFE' : 'rgba(191,219,254,0.35)',
                    borderWidth: 2,
                    borderColor: salindaVolume > 0 ? '#2563EB' : 'rgba(37,99,235,0.45)',
                  }}
                />
              </View>
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={toggleSounds}
            style={{
              position: 'absolute',
              bottom: globalMuteBottom,
              right: globalCtrlRight,
              width: globalCtrlBtnH,
              height: globalCtrlBtnH,
              borderRadius: globalCtrlBtnH / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.35)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              zIndex: 9999,
            }}
          >
            <Text style={{ fontSize: SCREEN_W < 380 ? 20 : 22 }}>{soundOn ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => setShowSalindaPanel((v) => !v)}
            style={{
              position: 'absolute',
              bottom: salindaMusicBottom,
              right: globalCtrlRight,
              width: globalCtrlBtnH,
              height: globalCtrlBtnH,
              borderRadius: globalCtrlBtnH / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.35)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              zIndex: 9999,
              opacity: salindaVolume > 0 ? 1 : 0.48,
            }}
          >
            <Text style={{ fontSize: SCREEN_W < 380 ? 18 : 20 }}>🎵</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SPLASH SCREEN — animated loading with jester + math operators
// ═══════════════════════════════════════════════════════════════

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const jokerScale = useRef(new Animated.Value(0)).current;
  const jokerBounce = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const splashScale = useRef(new Animated.Value(1)).current;
  const loadingWidth = useRef(new Animated.Value(0)).current;
  const loadingTextOpacity = useRef(new Animated.Value(0.3)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const opScales = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const opFloats = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    // Joker spring entry
    Animated.spring(jokerScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start();

    // Continuous bounce (4s loop, 8px)
    Animated.loop(
      Animated.sequence([
        Animated.timing(jokerBounce, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(jokerBounce, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Operator pop-ins with staggered delays
    const delays = [800, 1000, 1200, 1400];
    const timers: ReturnType<typeof setTimeout>[] = [];
    delays.forEach((delay, i) => {
      timers.push(setTimeout(() => {
        Animated.spring(opScales[i], { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }).start();
        Animated.loop(
          Animated.sequence([
            Animated.timing(opFloats[i], { toValue: -6, duration: 1800 + i * 200, useNativeDriver: true }),
            Animated.timing(opFloats[i], { toValue: 6, duration: 1800 + i * 200, useNativeDriver: true }),
          ])
        ).start();
      }, delay));
    });

    // Subtitle fade in
    Animated.timing(subtitleOpacity, { toValue: 1, duration: 800, delay: 500, useNativeDriver: true }).start();

    // Loading bar (0 to 100% over 3s)
    Animated.timing(loadingWidth, { toValue: 1, duration: 3000, useNativeDriver: false }).start();

    // Loading text pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(loadingTextOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(loadingTextOpacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    // After 3 seconds: fade out + slight scale up
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(splashOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(splashScale, { toValue: 1.05, duration: 500, useNativeDriver: true }),
      ]).start(() => onFinish());
    }, 3000);

    // Safety fallback: if animation callback never fires, force dismiss after 4.5s
    const fallback = setTimeout(() => onFinish(), 4500);

    return () => { timers.forEach(clearTimeout); clearTimeout(exitTimer); clearTimeout(fallback); };
  }, []);

  const operators = [
    { sym: '✚', color: '#E53935', style: { top: '22%', left: '10%' } as any },
    { sym: '÷', color: '#1E88E5', style: { top: '18%', right: '10%' } as any },
    { sym: '✖', color: '#43A047', style: { bottom: '38%', left: '12%' } as any },
    { sym: '━', color: '#FFA000', style: { bottom: '35%', right: '12%' } as any },
  ];

  return (
    <Animated.View style={{
      ...StyleSheet.absoluteFillObject,
      opacity: splashOpacity,
      transform: [{ scale: splashScale }],
      zIndex: 999,
    }}>
      <LinearGradient
        colors={['#0a1628', '#0f1d32']}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <StatusBar style="light" />

        {/* Floating math operators */}
        {operators.map((op, i) => (
          <Animated.View key={i} style={{
            position: 'absolute', ...op.style,
            opacity: opScales[i],
            transform: [{ scale: opScales[i] }, { translateY: opFloats[i] }],
          }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: op.color }}>{op.sym}</Text>
          </Animated.View>
        ))}

        <Text
          style={{
            color: '#F59E0B',
            fontSize: 24,
            fontWeight: '800',
            letterSpacing: 0.6,
            marginBottom: 12,
            writingDirection: 'rtl',
          }}
        >
          משחק מחשבה
        </Text>

        {/* Joker image with golden glow — מסך טעינה (גודל מלא) */}
        <Animated.View style={{
          width: 220, height: 220, alignItems: 'center', justifyContent: 'center',
          borderRadius: 24, overflow: 'hidden',
          transform: [{ scale: jokerScale }, { translateY: jokerBounce }],
          ...Platform.select({
            ios: { shadowColor: '#FFB300', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 24 },
            android: { elevation: 16 },
          }),
        }}>
          <Image source={require('./assets/joker.jpg')} style={{ width: 220, height: 220 }} resizeMode="contain" />
        </Animated.View>

        {/* Brand wordmark */}
        <Animated.View style={{ opacity: subtitleOpacity, marginTop: 24, alignItems: 'center' }}>
          <Text style={{ color: '#F59E0B', fontSize: 22, fontWeight: '900', letterSpacing: 2, textAlign: 'center' }}>
            Salinda
          </Text>
          <Text
            style={{ color: '#F59E0B', fontSize: 16, fontWeight: '800', marginTop: 2, textAlign: 'center', writingDirection: 'rtl' }}
          >
            סלינדה
          </Text>
        </Animated.View>

        {/* Loading bar */}
        <View style={{ marginTop: 48, alignItems: 'center' }}>
          <View style={{ width: 160, height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <Animated.View style={{
              width: loadingWidth.interpolate({ inputRange: [0, 1], outputRange: [0, 160] }),
              height: 3,
            }}>
              <LinearGradient
                colors={['#FFB300', '#FF8F00']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ flex: 1, borderRadius: 2 }}
              />
            </Animated.View>
          </View>
          <Animated.Text style={{ color: 'rgba(245,158,11,0.8)', fontSize: 12, marginTop: 12, opacity: loadingTextOpacity }}>
            ...טוען
          </Animated.Text>
        </View>

        {/* Version */}
        <View style={{ position: 'absolute', bottom: 32 }}>
          <Text style={{ color: 'rgba(245,158,11,0.55)', fontSize: 10, textAlign: 'center' }}>v1.0.0</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function AppShell({ showSplash, setShowSplash }: { showSplash: boolean; setShowSplash: (v: boolean) => void }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    sendDebugLog('H3', 'index.tsx:AppShell.useEffect', 'AppShell mounted', {
      insetTop: insets.top,
      insetBottom: insets.bottom,
      showSplash,
    });
  }, []);
  // הסתרת פס "Downloading" של Metro — שכבת native שמצוירת מעל האפליקציה
  useEffect(() => {
    if (!__DEV__) return;
    const hideDevBar = () => {
      const DevLoadingView = NativeModules.NativeDevLoadingView ?? NativeModules.DevLoadingView;
      if (DevLoadingView && typeof DevLoadingView.hide === 'function') {
        DevLoadingView.hide();
      }
    };
    hideDevBar();
    const t = setTimeout(hideDevBar, 150);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const applyNavBarTheme = () => {
      // ב-SDK 54 מצב edge-to-edge גורם ל-isEdgeToEdge() === true; setBackgroundColorAsync של סרגל הניווט לא רץ.
      // setBackgroundColorAsync של SystemUI צובע את רקע חלון האפליקציה מאחורי סרגלי המערכת (פותר פס לבן בתחתית).
      void SystemUI.setBackgroundColorAsync('#0a1628');
      NavigationBar.setBackgroundColorAsync('#0a1628').catch(() => {});
      NavigationBar.setButtonStyleAsync('light').catch(() => {});
      NavigationBar.setBorderColorAsync('#0a1628').catch(() => {});
    };
    applyNavBarTheme();
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') applyNavBarTheme();
    });
    const t1 = setTimeout(applyNavBarTheme, 250);
    const t2 = setTimeout(applyNavBarTheme, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      appStateSub.remove();
    };
  }, []);
  // מובייל: אין paddingBottom כאן — הרקע והמניפה עד קצה המסך; ה-safe התחתון מטופל במסכי המשחק (מניפה + כפתורים)
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0a1628',
        paddingTop: insets.top,
        paddingBottom: 0,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <StatusBar style="light" />
      <ConditionalWalkingDice />
      <ConditionalFloatingBg />
      <ConditionalRoamingCoins />
      <GameRouter />
      <NotificationZone />
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
    </View>
  );
}

function App() {
  const [fontsLoaded] = useFonts({ Fredoka_700Bold });
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    sendDebugLog('H2', 'index.tsx:App.useEffect', 'App lifecycle', { fontsLoaded });
  }, [fontsLoaded]);
  if (!fontsLoaded) return null;
  sendDebugLog('H2', 'index.tsx:App.render', 'App render after fonts loaded', { showSplash });
  return (
    <AuthProvider>
      <LocaleProvider>
        <ThemeProvider>
          <MultiplayerProvider>
            <GameProvider>
              <AppShell showSplash={showSplash} setShowSplash={setShowSplash} />
            </GameProvider>
          </MultiplayerProvider>
        </ThemeProvider>
      </LocaleProvider>
    </AuthProvider>
  );
}

// SafeAreaProvider ברמת השורש — חובה לפני כל שימוש ב-useSafeAreaInsets
// key מאלץ רענון מלא אחרי Reload (מניעת "נתקע" כשהמשחק כבר עלה)
registerRootComponent(function Root() {
  const [rootKey] = useState(() => `${Date.now()}-${Math.random()}`);
  useEffect(() => {
    sendDebugLog('H2', 'index.tsx:Root.useEffect', 'Root mounted', { rootKey });
  }, [rootKey]);
  return (
    <SafeAreaProvider key={rootKey}>
      <App />
    </SafeAreaProvider>
  );
});
