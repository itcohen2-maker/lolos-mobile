// ============================================================
// shared/types.ts — Lolos Card Game — Shared Types
// Used by both server and client
// ============================================================

import type { AppLocale, GameStatusMessage, LastMovePayload, LocalizedMessage } from './i18n';

// Re-export for consumers that share only types
export type { AppLocale, LocalizedMessage, LastMovePayload, GameStatusMessage };

// ── Card Types ──

export type CardType = 'number' | 'fraction' | 'operation' | 'joker' | 'wild';
export type Operation = '+' | '-' | 'x' | '÷';
export type Fraction = '1/2' | '1/3' | '1/4' | '1/5';

export interface Card {
  id: string;
  type: CardType;
  value?: number;
  /** כש־type === 'wild' והקלף על הערימה — הערך שהוא מייצג (0–25). */
  resolvedValue?: number;
  fraction?: Fraction;
  operation?: Operation;
}

// ── Player Types ──

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  calledLolos: boolean;
  isConnected: boolean;
  isHost: boolean;
  isBot: boolean;
  afkWarnings: number;
  isEliminated: boolean;
  isSpectator: boolean;
  /** UI + server message language */
  locale: AppLocale;
}

/** What opponents see about a player (no hand details) */
export interface OpponentView {
  id: string;
  name: string;
  cardCount: number;
  isConnected: boolean;
  isHost: boolean;
  isBot: boolean;
  calledLolos: boolean;
  afkWarnings: number;
  isEliminated: boolean;
  isSpectator: boolean;
}

export type LobbyStatus = 'waiting_for_player' | 'bot_offer' | 'bot_game_started';

/** עמודה בטבלת טורניר — אינדקס שחקן במערך `players` של המשחק */
export interface TournamentStanding {
  playerIndex: number;
  playerName: string;
  wins: number;
  losses: number;
}

/** רמות בוט — מקומי (vs-bot) ושרת */
export type BotDifficulty = 'easy' | 'medium' | 'hard';
/** playerView ב־ok (שרת מעודכן) — גיבוי אם game_started נאבד; אופציונלי לתאימות לשרת ישן */
export type StartBotGameAck =
  | { ok: true; playerView?: PlayerView }
  | { ok: false; message: string };
export type ContinueVsBotAck =
  | { ok: true; playerView?: PlayerView }
  | { ok: false; message: string };

// ── Dice ──

export interface DiceResult {
  die1: number;
  die2: number;
  die3: number;
}

// ── Equation ──

export interface EquationOption {
  equation: string;
  result: number;
}

/** קלף פעולה/ג'וקר שהושם במשבצת בתרגיל הקוביות — מסונכרן לשרת במשחק מקוון */
export interface EquationCommitPayload {
  cardId: string;
  position: 0 | 1;
  /** כשהקלף ג'וקר — איזו פעולה נבחרה; אחרת null */
  jokerAs: Operation | null;
}

// ── Game Phase ──

export type GamePhase =
  | 'lobby'
  | 'turn-transition'
  | 'pre-roll'
  | 'building'
  | 'solved'
  | 'game-over';

/** הגדרות שמשתמש המארח קובע בתחילת משחק — משודרות לכל לקוח ב־PlayerView */
export interface HostGameSettings {
  /** תמיד 3 קוביות — אפשרות 2 הוסרה מהמוצר */
  diceMode: '3';
  showFractions: boolean;
  showPossibleResults: boolean;
  showSolveExercise: boolean;
  mathRangeMax?: 12 | 25;
  enabledOperators?: Operation[];
  allowNegativeTargets?: boolean;
  /** שלבי תרגול A–H (מיגרציה מ־C–J / מאותיות ישנות בלקוח/שרת) */
  difficultyStage?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  /** מכנים לשברים בחבילה — רלוונטי כש־showFractions */
  fractionKinds?: Fraction[];
  abVariant?: 'control_0_12_plus' | 'variant_0_15_plus';
  timerSetting: '30' | '60' | 'off' | 'custom';
  timerCustomSeconds: number;
  /** רמת בוט — משחק מול בוט בלובי / התאמה למנוע; אופציונלי */
  botDifficulty?: BotDifficulty;
  /** שם תצוגה לבוט (מול בוט בלובי); אופציונלי — ריק משתמש בשם המתורגם */
  botDisplayName?: string;
}

// ── Server Game State (full, only on server) ──

export interface ServerGameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  drawPile: Card[];
  discardPile: Card[];
  dice: DiceResult | null;
  /** מונה מונוטוני אחרי כל ROLL_DICE — לאיפוס בונה משוואות גם כשחוזרת אותה שלישיית קוביות */
  diceRollSeq: number;
  validTargets: EquationOption[];
  equationResult: number | null;
  stagedCards: Card[];
  pendingFractionTarget: number | null;
  fractionPenalty: number;
  fractionAttackResolved: boolean;
  hasPlayedCards: boolean;
  hasDrawnCard: boolean;
  lastCardValue: number | null;
  consecutiveIdenticalPlays: number;
  /** מד אומץ: אחוז מילוי נוכחי (0-100) */
  courageMeterPercent: number;
  /** מד אומץ: אבן דרך נוכחית (0-3) */
  courageMeterStep: number;
  /** @deprecated נשמר לתאימות; חוק רצף השלכות בוטל */
  courageDiscardSuccessStreak: number;
  /** מזהה פולס מונוטוני לטריגר אנימציית תגמול בלקוח */
  courageRewardPulseId: number;
  /** מטבעות לרקורד המשחק הנוכחי */
  courageCoins: number;
  /** סיבה מילולית לתוספת האחרונה במד ההצטיינות; מוצגת פעם אחת במסך מעבר התור. */
  lastCourageRewardReason: string | null;
  /** לרוב null; מוגדר רק ב־state_update מיד אחרי playIdentical (מקוון) */
  identicalCelebration?: { playerName: string; cardDisplay: string; consecutive: number } | null;
  lastMoveMessage: LastMovePayload;
  /** כמה קלפים הושלכו במהלך האחרון (ל־UI מסונכרן עם מצב מקומי) */
  lastDiscardCount: number;
  lastEquationDisplay: string | null;
  difficulty: 'easy' | 'full';
  hostGameSettings: HostGameSettings;
  winner: Player | null;
  message: GameStatusMessage;
  /** מזהה ייחודי למשחק מקוון — הגרלת פותח; לדה-דופליקציה של הודעה בלקוח */
  openingDrawId: string;
  /** מועד יעד (epoch ms) לפעולת התור הנוכחית — מקוון בלבד; null כשלא במצב המתנה */
  turnDeadlineAt: number | null;
  /** מונה סיומי תור (מעבר לשחקן הבא דרך endTurnLogic) */
  roundsPlayed: number;
  /** אחרי אישור תרגיל קוביות: עד 2 קלפי פעולה/ג'וקר במשבצות 0 ו־1; יוסרו עם קלפי ההנחה */
  equationCommits: EquationCommitPayload[];
  /** תור מזהי קלפים ל־stage אחרי confirmEquation (בוט); null/undefined = אין */
  botPendingStagedIds?: string[] | null;
  /** ניצחונות/הפסדים למשחק הנוכחי — מתעדכן בסיום משחק */
  tournamentTable: TournamentStanding[];
}

// ── Client Player View (what each player sees) ──

export interface PlayerView {
  roomCode: string;
  phase: GamePhase;
  myHand: Card[];
  myPlayerId: string;
  opponents: OpponentView[];
  currentPlayerIndex: number;
  players: { id: string; name: string; cardCount: number; isConnected: boolean; isHost: boolean; isBot: boolean; calledLolos: boolean; afkWarnings: number; isEliminated: boolean; isSpectator: boolean }[];
  pileTop: Card | null;
  deckCount: number;
  dice: DiceResult | null;
  /** מסונכן עם השרת — לאיפוס מצב קוביות בבונה אחרי כל הטלה */
  diceRollSeq?: number;
  validTargets: EquationOption[];
  equationResult: number | null;
  /** תצוגת המשוואה שאושרה (לחשיפת מהלך בוט/שחקן ב־UI) */
  lastEquationDisplay?: string | null;
  stagedCards: Card[];
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
  /** סיבה מילולית לתוספת האחרונה במד ההצטיינות; מוצגת פעם אחת במסך מעבר התור. */
  lastCourageRewardReason: string | null;
  /** מגיע מהשרת רק בפריים אחרי קלף זהה מקוון — ממופה ל־identicalAlert בלקוח */
  identicalCelebration: { playerName: string; cardDisplay: string; consecutive: number } | null;
  lastMoveMessage: string | null;
  /** סיכום השלכה אחרונה ל־UI (למשל "פחות קלף אחד") */
  lastDiscardCount?: number;
  difficulty: 'easy' | 'full';
  gameSettings: HostGameSettings;
  winner: { id: string; name: string } | null;
  message: string;
  openingDrawId: string;
  turnDeadlineAt: number | null;
  /** סיומי תור ל־UI (רמז טיימר); לקוח ישן בלי שדה — מתייחסים כ־0 */
  roundsPlayed?: number;
  /** נתון רק אחרי אישור תרגיל עם קלף/י פעולה או ג'וקר מהיד */
  equationCommits?: EquationCommitPayload[];
  /** @deprecated השרת שולח equationCommits */
  equationCommit?: EquationCommitPayload | null;
  /** טבלת טורניר למשחק הנוכחי; לקוח ישן בלי שדה — יבנה מאפס לפי שמות שחקנים */
  tournamentTable?: TournamentStanding[];
}

// ── Socket Events: Client → Server ──

export interface ClientToServerEvents {
  create_room: (data: { playerName: string; locale?: AppLocale }) => void;
  join_room: (data: { roomCode: string; playerName: string; locale?: AppLocale }) => void;
  leave_room: () => void;
  start_game: (data: { difficulty: 'easy' | 'full'; gameSettings?: Partial<HostGameSettings> }) => void;
  start_bot_game: (
    data: { difficulty: 'easy' | 'full'; gameSettings?: Partial<HostGameSettings> },
    ack?: (result: StartBotGameAck) => void,
  ) => void;
  roll_dice: () => void;
  set_operator: (data: { position: number; operator: string }) => void;
  confirm_equation: (data: {
    result: number;
    equationDisplay: string;
    equationCommits?: EquationCommitPayload[];
    /** @deprecated normalized server-side to equationCommits */
    equationCommit?: EquationCommitPayload | null;
  }) => void;
  stage_card: (data: { cardId: string }) => void;
  unstage_card: (data: { cardId: string }) => void;
  confirm_staged: () => void;
  place_identical: (data: { cardId: string }) => void;
  play_fraction: (data: { cardId: string }) => void;
  defend_fraction_solve: (data: { cardId: string; wildResolve?: number }) => void;
  defend_fraction_penalty: () => void;
  play_operation: (data: { cardId: string }) => void;
  play_joker: (data: { cardId: string; chosenOperation: Operation }) => void;
  draw_card: () => void;
  call_lulos: () => void;
  end_turn: () => void;
  begin_turn: () => void;
  /** מארח בלבד — חדר עם בוט; מעדכן hostGameSettings.botDifficulty */
  set_bot_difficulty: (data: { difficulty: BotDifficulty }) => void;
  reconnect: (data: { roomCode: string; playerId: string; locale?: AppLocale }) => void;
  continue_vs_bot: (ack?: (result: ContinueVsBotAck) => void) => void;
}

// ── Socket Events: Server → Client ──

export interface ServerToClientEvents {
  room_created: (data: { roomCode: string; playerId: string }) => void;
  player_joined: (data: { players: { id: string; name: string; isHost: boolean; isConnected: boolean; isBot: boolean }[] }) => void;
  player_left: (data: { playerId: string; playerName: string }) => void;
  lobby_status: (data: { status: LobbyStatus; botOfferAt: number | null }) => void;
  game_started: (data: PlayerView) => void;
  state_update: (data: PlayerView) => void;
  toast: (data: { message: string }) => void;
  opponent_disconnect_grace: (data: { playerId: string; playerName: string; deadlineAt: number }) => void;
  opponent_reconnected: (data: { playerId: string; playerName: string }) => void;
  opponent_disconnect_expired: (data: { playerId: string; playerName: string }) => void;
  error: (data: { message: string }) => void;
}
