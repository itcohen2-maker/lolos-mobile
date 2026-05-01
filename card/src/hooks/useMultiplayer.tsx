// ============================================================
// useMultiplayer — Socket.io connection, room, and game state
// Connects to Lolos server; provides lobby + game override for client
// ============================================================

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { io, type Socket } from 'socket.io-client';
import { supabase } from '../lib/supabase';
import type {
  BotDifficulty,
  ContinueVsBotAck,
  Fraction,
  LobbyStatus,
  LobbyTableSummary,
  LobbyTableVisibility,
  Operation,
  PlayerView,
  HostGameSettings,
  StartBotGameAck,
} from '../../shared/types';
import { DIFFICULTY_STAGE_CONFIG, migrateDifficultyStage } from '../../shared/difficultyStages';
import { normalizeOperationToken } from '../../shared/equationOpCycle';
import { t } from '../../shared/i18n';
import { useLocale } from '../i18n/LocaleContext';
import { playSfx } from '../audio/sfx';

const DEFAULT_SOCKET_PORT = 3001;

const DEFAULT_FRACTION_KINDS: Fraction[] = ['1/2', '1/3', '1/4', '1/5'];

/** hostUri של Expo במצב Tunnel — לא מעביר TCP לפורט 3001 על המחשב; חיבור ל-socket ייתקע ב-timeout */
function isLikelyExpoTunnelRelayHost(host: string): boolean {
  const h = host.toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (h.includes('exp.direct')) return true;
  if (h.includes('ngrok')) return true;
  if (h.includes('trycloudflare.com')) return true;
  if (h.includes('loca.lt')) return true;
  if (h.endsWith('.exp.host')) return true;
  return false;
}

function hostFromHostPort(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const host = raw.split(':')[0]?.trim();
  return host && host.length > 0 ? host : null;
}

/**
 * בפיתוח עם Expo: כתובת LAN של המחשב לפורט המשחק.
 * - hostUri מטעין Metro — במצב Tunnel זה relay בענן, לא מתאים ל־:3001
 * - expoGoConfig.debuggerHost לרוב מכיל את ה־IP האמיתי (למשל 192.168.x.x:8081)
 */
function inferDevMachineSocketUrl(): string | null {
  try {
    const go = Constants.expoGoConfig as { debuggerHost?: string } | null | undefined;
    const dbgHost = hostFromHostPort(go?.debuggerHost);

    const hostUri = Constants.expoConfig?.hostUri;
    if (!hostUri || typeof hostUri !== 'string') {
      if (dbgHost && !isLikelyExpoTunnelRelayHost(dbgHost)) {
        return `http://${dbgHost}:${DEFAULT_SOCKET_PORT}`;
      }
      return null;
    }
    const fromUri = hostFromHostPort(hostUri);
    if (!fromUri) {
      if (dbgHost && !isLikelyExpoTunnelRelayHost(dbgHost)) {
        return `http://${dbgHost}:${DEFAULT_SOCKET_PORT}`;
      }
      return null;
    }
    if (!isLikelyExpoTunnelRelayHost(fromUri)) {
      return `http://${fromUri}:${DEFAULT_SOCKET_PORT}`;
    }
    if (dbgHost && !isLikelyExpoTunnelRelayHost(dbgHost)) {
      return `http://${dbgHost}:${DEFAULT_SOCKET_PORT}`;
    }
    return null;
  } catch {
    return null;
  }
}

/** כתובת ?server= מהדפדפן — רק במצב פיתוח כדי למנוע הזרקת שרת זדוני */
function readServerFromWebQuery(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  // Only allow server override in development mode
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  try {
    const raw = new URLSearchParams(window.location.search).get('server');
    const u = raw?.trim();
    return u && u.length > 0 ? u : null;
  } catch {
    return null;
  }
}

function inferLocalWebSocketUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const host = window.location.hostname?.trim().toLowerCase();
  if (!host) return null;
  if (host === 'localhost' || host === '127.0.0.1') return `http://${host}:${DEFAULT_SOCKET_PORT}`;
  return null;
}

function normalizeServerUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

function envFlagTrue(name: string): boolean {
  const v =
    typeof process !== 'undefined' && process.env?.[name]
      ? String(process.env[name]).trim().toLowerCase()
      : '';
  return v === '1' || v === 'true' || v === 'yes';
}

function isTransportDisconnect(reason: string): boolean {
  return reason === 'ping timeout' || reason === 'transport close' || reason === 'transport error';
}

/**
 * כתובת שרת Socket — **אותו סדר כמו origin/main** (היסטוריה שעבדה):
 * - EXPO_PUBLIC_LOCAL_SOCKET_SERVER=1 → מחשב מקומי
 * - Web: ?server=
 * - EXPO_PUBLIC_SERVER_URL אם מוגדר — בכבוד מוחלט (אם רוצים מקומי, השתמש בדגל LOCAL_SOCKET_SERVER)
 * - __DEV__: גילוי LAN (תיקון Tunnel דרך debuggerHost)
 * - אמולטור / localhost
 */
function getServerUrl(): string {
  const forceLocalPc =
    typeof __DEV__ !== 'undefined' && __DEV__ && envFlagTrue('EXPO_PUBLIC_LOCAL_SOCKET_SERVER');
  if (forceLocalPc) {
    const inferred = inferDevMachineSocketUrl();
    if (inferred) return inferred;
    if (Platform.OS === 'android') return `http://10.0.2.2:${DEFAULT_SOCKET_PORT}`;
    return `http://localhost:${DEFAULT_SOCKET_PORT}`;
  }

  const fromWeb = readServerFromWebQuery();
  if (fromWeb) return normalizeServerUrl(fromWeb);

  const localWeb = inferLocalWebSocketUrl();
  if (localWeb) return normalizeServerUrl(localWeb);

  const fromEnv =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SERVER_URL
      ? String(process.env.EXPO_PUBLIC_SERVER_URL).trim()
      : '';
  if (fromEnv) return normalizeServerUrl(fromEnv);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const inferred = inferDevMachineSocketUrl();
    if (inferred) return inferred;
  }
  if (Platform.OS === 'android') return `http://10.0.2.2:${DEFAULT_SOCKET_PORT}`;
  return `http://localhost:${DEFAULT_SOCKET_PORT}`;
}

export type PlayMode = 'choose' | 'local' | 'online';

export interface LobbyPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  isBot: boolean;
}

export interface LobbyStatusState {
  status: LobbyStatus;
  botOfferAt: number | null;
}

export interface DisconnectChoiceState {
  playerId: string;
  playerName: string;
  deadlineAt: number;
}

export interface MultiplayerContextValue {
  playMode: PlayMode;
  setPlayMode: (m: PlayMode) => void;
  serverUrl: string;
  setServerUrl: (url: string) => void;
  // Connection
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  // Room (when connected)
  roomCode: string | null;
  playerId: string | null;
  currentInviteCode: string | null;
  currentTableVisibility: LobbyTableVisibility | null;
  players: LobbyPlayer[];
  tables: LobbyTableSummary[];
  lobbyStatus: LobbyStatusState | null;
  isHost: boolean;
  inRoom: boolean;
  refreshTables: () => void;
  createTable: (playerName: string) => void;
  configureTable: (config: {
    visibility: LobbyTableVisibility;
    maxParticipants: number;
    difficulty: 'easy' | 'full';
    gameSettings?: Partial<HostGameSettings>;
  }) => void;
  joinTable: (roomCode: string, playerName: string) => void;
  joinPrivateTable: (roomCode: string, inviteCode: string, playerName: string) => void;
  startTableCountdown: () => void;
  createRoom: (playerName: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  leaveRoom: () => void;
  startGame: (difficulty: 'easy' | 'full', gameSettings?: Partial<HostGameSettings>) => void;
  startBotGame: (difficulty: 'easy' | 'full', gameSettings?: Partial<HostGameSettings>) => Promise<boolean>;
  // Game state from server (when game has started)
  serverState: PlayerView | null;
  // Emit game actions (only valid when serverState is set)
  emit: (event: string, data?: any) => void;
  // UI feedback
  error: string | null;
  toast: string | null;
  clearError: () => void;
  clearToast: () => void;
  /** ניתוק רשת זמני במהלך משחק — מנסים להתחבר מחדש לשרת */
  reconnectNotice: string | null;
  clearReconnectNotice: () => void;
  disconnectChoice: DisconnectChoiceState | null;
  clearDisconnectChoice: () => void;
  continueVsBot: () => Promise<boolean>;
  // Override for GameProvider: when serverState is set, provide { state, dispatch } so game UI uses server
  gameOverride: { state: any; dispatch: (action: any) => void } | null;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

export function useMultiplayer(): MultiplayerContextValue {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error('useMultiplayer must be used inside MultiplayerProvider');
  return ctx;
}

export function useMultiplayerOptional(): MultiplayerContextValue | null {
  return useContext(MultiplayerContext);
}

/** Adapt server PlayerView to client GameState shape (index.tsx) so existing GameScreen works */
function playerViewToGameState(view: PlayerView): any {
  const myPlayerIndex = view.players.findIndex((p) => p.id === view.myPlayerId);
  const safeMyIndex = myPlayerIndex >= 0 ? myPlayerIndex : 0;
  const normalizeCardOperation = <T extends { type: string; operation?: unknown }>(card: T): T => {
    if (card.type !== 'operation') return card;
    const normalized = normalizeOperationToken(typeof card.operation === 'string' ? card.operation : null);
    return normalized ? ({ ...card, operation: normalized } as T) : card;
  };
  const normalizedMyHand = view.myHand.map((card) => normalizeCardOperation(card));
  const normalizedStagedCards = (view.stagedCards ?? []).map((card) => normalizeCardOperation(card));
  const players = view.players.map((p, i) => {
    const count = p.cardCount ?? 0;
    const hand =
      p.id === view.myPlayerId
        ? normalizedMyHand
        : Array.from({ length: count }, (_, j) => ({
            id: `hidden-${p.id}-${j}`,
            type: 'number' as const,
            value: 0,
          }));
    return {
      id: i,
      name: p.name,
      hand,
      isBot: p.isBot ?? false,
      calledLolos: p.calledLolos,
      afkWarnings: p.afkWarnings ?? 0,
      isEliminated: p.isEliminated ?? false,
      isSpectator: p.isSpectator ?? false,
    };
  });
  const drawPileFake = Array.from({ length: view.deckCount }, (_, i) => ({ id: `deck-${i}`, type: 'number' as const, value: 0 }));
  const gs = view.gameSettings ?? {
    diceMode: '3' as const,
    showFractions: true,
    showPossibleResults: true,
    showSolveExercise: true,
    timerSetting: 'off' as const,
    timerCustomSeconds: 60,
  };
  const hasBotPlayer = view.players.some((p) => p.isBot);
  const botPlayerIds = view.players.filter((p) => p.isBot).map((p) => p.id);
  const rawDiff = gs.botDifficulty as string | undefined;
  const difficultyStage = migrateDifficultyStage(
    gs.difficultyStage != null ? String(gs.difficultyStage) : view.difficulty === 'full' ? 'H' : 'A',
  );
  const stageCfg = DIFFICULTY_STAGE_CONFIG[difficultyStage];
  const hostBotDifficulty: BotDifficulty | null = hasBotPlayer
    ? rawDiff === 'easy' || rawDiff === 'medium' || rawDiff === 'hard'
      ? rawDiff
      : rawDiff === 'beginner'
        ? 'easy'
        : 'medium'
    : null;
  const equationHandSlots: [any, any] = [null, null];
  const commits = view.equationCommits?.length ? view.equationCommits : view.equationCommit ? [view.equationCommit] : [];
  for (const ec of commits) {
    const c = normalizedMyHand.find((x) => x.id === ec.cardId);
    if (c && (ec.position === 0 || ec.position === 1)) {
      equationHandSlots[ec.position] = { card: c, jokerAs: normalizeOperationToken(ec.jokerAs) };
    }
  }
  const normalizedEnabledOperators = (gs.enabledOperators ?? [])
    .map((op) => normalizeOperationToken(op))
    .filter((op): op is Operation => op != null);
  const wireTournament = view.tournamentTable;
  const tournamentTable =
    Array.isArray(wireTournament) && wireTournament.length > 0
      ? wireTournament.map((row) => ({
          playerId: row.playerIndex,
          playerName: row.playerName,
          wins: row.wins,
          losses: row.losses,
        }))
      : players.map((p) => ({
          playerId: p.id,
          playerName: p.name,
          wins: 0,
          losses: 0,
        }));
  return {
    phase: view.phase,
    players,
    myPlayerIndex: safeMyIndex,
    currentPlayerIndex: view.currentPlayerIndex,
    drawPile: drawPileFake,
    discardPile: view.pileTop ? [view.pileTop] : [],
    dice: view.dice,
    diceRollSeq: view.diceRollSeq ?? 0,
    selectedCards: normalizedStagedCards,
    stagedCards: normalizedStagedCards,
    validTargets: view.validTargets || [],
    equationResult: view.equationResult,
    lastEquationDisplay: view.lastEquationDisplay ?? null,
    activeOperation: null,
    challengeSource: null,
    equationOpsUsed: [],
    activeFraction: null,
    pendingFractionTarget: view.pendingFractionTarget,
    fractionPenalty: view.fractionPenalty,
    fractionAttackResolved: view.fractionAttackResolved ?? true,
    hasPlayedCards: view.hasPlayedCards,
    hasDrawnCard: view.hasDrawnCard,
    lastCardValue: view.lastCardValue,
    consecutiveIdenticalPlays: view.consecutiveIdenticalPlays ?? 0,
    courageMeterPercent: view.courageMeterPercent ?? 0,
    courageMeterStep: view.courageMeterStep ?? 0,
    courageDiscardSuccessStreak: view.courageDiscardSuccessStreak ?? 0,
    courageRewardPulseId: view.courageRewardPulseId ?? 0,
    courageCoins: view.courageCoins ?? 0,
    lastCourageRewardReason: view.lastCourageRewardReason ?? null,
    identicalAlert: view.identicalCelebration ?? null,
    jokerModalOpen: false,
    equationHandSlots,
    equationHandPick: null,
    lastMoveMessage: view.lastMoveMessage,
    lastDiscardCount: view.lastDiscardCount ?? 0,
    difficulty: view.difficulty,
    diceMode: gs.diceMode,
    showFractions: gs.showFractions,
    showPossibleResults: gs.showPossibleResults,
    showSolveExercise: gs.showSolveExercise,
    difficultyStage,
    fractionKinds: gs.fractionKinds?.length ? gs.fractionKinds : [...DEFAULT_FRACTION_KINDS],
    mathRangeMax: gs.mathRangeMax ?? stageCfg.rangeMax,
    enabledOperators: (normalizedEnabledOperators.length ? normalizedEnabledOperators : stageCfg.enabledOperators) as Operation[],
    allowNegativeTargets: gs.allowNegativeTargets ?? stageCfg.allowNegativeTargets,
    abVariant: gs.abVariant ?? (view.difficulty === 'full' ? 'variant_0_15_plus' : 'control_0_12_plus'),
    timerSetting: gs.timerSetting,
    timerCustomSeconds: gs.timerCustomSeconds,
    winner: view.winner ? { id: 0, name: view.winner.name, hand: [], calledLolos: false } : null,
    message: view.message,
    openingDrawId: view.openingDrawId,
    turnDeadlineAt: view.turnDeadlineAt,
    roundsPlayed: view.roundsPlayed ?? 0,
    notifications: [],
    moveHistory: [],
    suppressIdenticalOverlayOnline: false,
    hostBotDifficulty,
    tournamentTable,
    botConfig: hasBotPlayer
      ? { difficulty: hostBotDifficulty ?? 'medium', playerIds: botPlayerIds }
      : null,
    botPendingStagedIds: null,
    botPendingDemoActions: null,
    botNoSolutionTicks: 0,
    botNoSolutionDrawPending: false,
    botDicePausePending: false,
    botFractionDefenseTicks: 0,
    botPresentation: { action: null, candidateCardId: null, ticks: 0, notification: null },
    botPostEquationPauseTicks: 0,
    botTickSeq: 0,
  };
}

/** Map client dispatch actions to socket events (for online mode) */
function actionToSocketEvent(action: any): { event: string; data?: any } | null {
  switch (action.type) {
    case 'BEGIN_TURN': return { event: 'begin_turn' };
    case 'ROLL_DICE': return { event: 'roll_dice' };
    case 'CONFIRM_EQUATION':
      return {
        event: 'confirm_equation',
        data: {
          result: action.result,
          equationDisplay: action.equationDisplay || '',
          equationCommits: action.equationCommits ?? [],
        },
      };
    case 'STAGE_CARD': return { event: 'stage_card', data: { cardId: action.card?.id } };
    case 'UNSTAGE_CARD': return { event: 'unstage_card', data: { cardId: action.card?.id } };
    case 'CONFIRM_STAGED': return { event: 'confirm_staged' };
    case 'PLAY_IDENTICAL': return { event: 'place_identical', data: { cardId: action.card?.id } };
    case 'PLAY_FRACTION': return { event: 'play_fraction', data: { cardId: action.card?.id } };
    case 'DEFEND_FRACTION_SOLVE':
      return { event: 'defend_fraction_solve', data: { cardId: action.card?.id, wildResolve: action.wildResolve } };
    case 'DEFEND_FRACTION_PENALTY': return { event: 'defend_fraction_penalty' };
    case 'PLAY_OPERATION': return { event: 'play_operation', data: { cardId: action.card?.id } };
    case 'FORWARD_CHALLENGE': return null;
    case 'PLAY_JOKER':
      return { event: 'play_joker', data: { cardId: action.card?.id, chosenOperation: action.chosenOperation } };
    case 'DRAW_CARD': return { event: 'draw_card' };
    case 'CALL_LOLOS': return null;
    case 'END_TURN': return { event: 'end_turn' };
    default: return null;
  }
}

/** Basic sanity check on server PlayerView to guard against malformed data */
function isValidPlayerView(view: unknown): view is PlayerView {
  if (!view || typeof view !== 'object') return false;
  const v = view as Record<string, unknown>;
  return (
    typeof v.roomCode === 'string' &&
    typeof v.phase === 'string' &&
    typeof v.myPlayerId === 'string' &&
    Array.isArray(v.myHand) &&
    Array.isArray(v.players)
  );
}

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const [playMode, setPlayMode] = useState<PlayMode>('choose');
  const [serverUrl, setServerUrlState] = useState(getServerUrl);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [currentInviteCode, setCurrentInviteCode] = useState<string | null>(null);
  const [currentTableVisibility, setCurrentTableVisibility] = useState<LobbyTableVisibility | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [tables, setTables] = useState<LobbyTableSummary[]>([]);
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatusState | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [serverState, setServerState] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reconnectNotice, setReconnectNotice] = useState<string | null>(null);
  const [disconnectChoice, setDisconnectChoice] = useState<DisconnectChoiceState | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  /** כתובת ה-io האחרונה — לזיהוי החלפת שרת מול socket ישן */
  const lastSocketUrlRef = useRef<string | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const roomCodeSessionRef = useRef<string | null>(null);
  const serverStateRef = useRef<PlayerView | null>(null);
  const awaitingReconnectSyncRef = useRef(false);
  const startBotGameReqRef = useRef(0);
  /** עוקב אחרי מספר השחקנים הקודם כדי לזהות הצטרפות חדשה ולהשמיע צליל + התראה */
  const prevPlayerCountRef = useRef(0);

  useEffect(() => {
    // Keep sessionTokenRef up-to-date so connect() can pass it to the socket
    supabase.auth.getSession().then(({ data: { session } }) => {
      sessionTokenRef.current = session?.access_token ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionTokenRef.current = session?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    serverStateRef.current = serverState;
  }, [serverState]);

  useEffect(() => {
    roomCodeSessionRef.current = roomCode;
  }, [roomCode]);

  const setServerUrl = useCallback((url: string) => {
    setServerUrlState(url);
  }, []);

  const clearSessionAfterDisconnect = useCallback(() => {
    awaitingReconnectSyncRef.current = false;
    setReconnectNotice(null);
    setRoomCode(null);
    setPlayerId(null);
    setCurrentInviteCode(null);
    setCurrentTableVisibility(null);
    playerIdRef.current = null;
    roomCodeSessionRef.current = null;
    setPlayers([]);
    setTables([]);
    setLobbyStatus(null);
    setServerState(null);
    setDisconnectChoice(null);
    setIsHost(false);
    prevPlayerCountRef.current = 0;
  }, []);

  const disconnect = useCallback(() => {
    awaitingReconnectSyncRef.current = false;
    setReconnectNotice(null);
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    lastSocketUrlRef.current = null;
    setConnected(false);
    clearSessionAfterDisconnect();
  }, [clearSessionAfterDisconnect]);

  const connect = useCallback(() => {
    const want = normalizeServerUrl(serverUrl.trim() || getServerUrl());
    if (socketRef.current) {
      if (lastSocketUrlRef.current === want && (socketRef.current.connected || socketRef.current.active)) return;
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      lastSocketUrlRef.current = null;
      setConnected(false);
      clearSessionAfterDisconnect();
    }
    lastSocketUrlRef.current = want;
    const socket = io(want, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      auth: { token: sessionTokenRef.current },
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      console.log('[MP][debug] socket connected →', want);
      setConnected(true);
      socket.emit('list_tables');
      if (awaitingReconnectSyncRef.current) {
        const rc = roomCodeSessionRef.current;
        const pid = playerIdRef.current;
        if (rc && pid && serverStateRef.current) {
          socket.emit('reconnect', { roomCode: rc, playerId: pid, locale: localeRef.current });
        } else {
          awaitingReconnectSyncRef.current = false;
          setReconnectNotice(null);
        }
      }
    });
    socket.on('disconnect', (reason: string) => {
      setConnected(false);
      const inGame = serverStateRef.current != null;
      const recoverable = inGame && isTransportDisconnect(reason);
      if (recoverable) {
        awaitingReconnectSyncRef.current = true;
        setReconnectNotice(t(localeRef.current, 'mp.reconnecting'));
        return;
      }
      clearSessionAfterDisconnect();
    });
    socket.on('room_created', ({ roomCode: code, playerId: pid, inviteCode, visibility }) => {
      console.log('[MP][debug] room_created received, code=', code, 'pid=', pid);
      roomCodeSessionRef.current = code;
      setRoomCode(code);
      setPlayerId(pid);
      playerIdRef.current = pid;
      setCurrentInviteCode(inviteCode ?? null);
      setCurrentTableVisibility(visibility ?? null);
    });
    socket.on('tables_updated', ({ tables: nextTables }: { tables: LobbyTableSummary[] }) => {
      setTables(nextTables);
    });
    socket.on('table_countdown_started', ({ roomCode: code, countdownEndsAt }) => {
      setTables((current) =>
        current.map((table) =>
          table.roomCode === code
            ? { ...table, status: 'countdown', countdownEndsAt }
            : table,
        ),
      );
    });
    socket.on('table_status_changed', ({ roomCode: code, status, countdownEndsAt }) => {
      setTables((current) =>
        current
          .map((table) =>
            table.roomCode === code
              ? { ...table, status, countdownEndsAt }
              : table,
          )
          .filter((table) => table.status !== 'in_game'),
      );
    });
    socket.on('player_joined', ({ players: p }) => {
      const mapped = p.map((x: any) => ({
        id: x.id,
        name: x.name,
        isHost: x.isHost,
        isConnected: x.isConnected,
        isBot: x.isBot ?? false,
      }));
      setPlayers(mapped);
      const pid = playerIdRef.current;
      const me = pid ? p.find((x: { id: string }) => x.id === pid) : null;
      if (me) setIsHost(!!me.isHost);
      const prev = prevPlayerCountRef.current;
      const curr = mapped.length;
      // הצטרפות שחקן חדש (לא הבוט, לא אנחנו): מנגן צליל ומציג התראה למארח וליתר השחקנים הקיימים.
      if (curr > prev && prev >= 1) {
        const newcomer = pid
          ? mapped.find((x: typeof mapped[number]) => x.id !== pid && !x.isBot)
          : mapped.find((x: typeof mapped[number]) => !x.isBot);
        const display = newcomer?.name ?? (localeRef.current === 'he' ? 'שחקן חדש' : 'A new player');
        setToast(
          localeRef.current === 'he'
            ? `🎉 ${display} הצטרף/ה לחדר!`
            : `🎉 ${display} joined the room!`,
        );
        void playSfx('complete', { cooldownMs: 400, volumeOverride: 0.55 });
      }
      prevPlayerCountRef.current = curr;
    });
    socket.on('lobby_status', (data: LobbyStatusState) => {
      setLobbyStatus(data);
    });
    socket.on('player_left', () => {
      // List will be updated by next player_joined or we could request state
    });
    socket.on('opponent_disconnect_grace', ({ playerId: disconnectedId, playerName, deadlineAt }) => {
      setDisconnectChoice({ playerId: disconnectedId, playerName, deadlineAt });
      setToast(
        localeRef.current === 'he'
          ? `${playerName} התנתק. מחכים לחזרה עד הטיימר.`
          : `${playerName} disconnected. Waiting until the timer expires.`,
      );
    });
    socket.on('opponent_reconnected', ({ playerId: reconnectedId }) => {
      setDisconnectChoice((current) => (current?.playerId === reconnectedId ? null : current));
    });
    socket.on('opponent_disconnect_expired', ({ playerId: disconnectedId, playerName }) => {
      setDisconnectChoice((current) => ({
        playerId: disconnectedId,
        playerName,
        deadlineAt: current?.deadlineAt ?? Date.now(),
      }));
      setToast(
        localeRef.current === 'he'
          ? `${playerName} לא חזר בזמן. אפשר להמשיך מול בוט או לצאת ללובי.`
          : `${playerName} did not return in time. Continue vs bot or return to lobby.`,
      );
    });
    socket.on('game_started', (view: PlayerView) => {
      if (!isValidPlayerView(view)) {
        if (__DEV__) console.warn('[MP] Invalid PlayerView in game_started');
        return;
      }
      awaitingReconnectSyncRef.current = false;
      setReconnectNotice(null);
      setLobbyStatus({ status: 'bot_game_started', botOfferAt: null });
      setDisconnectChoice(null);
      setServerState(view);
    });
    socket.on('state_update', (view: PlayerView) => {
      if (!isValidPlayerView(view)) {
        if (__DEV__) console.warn('[MP] Invalid PlayerView in state_update');
        return;
      }
      awaitingReconnectSyncRef.current = false;
      setReconnectNotice(null);
      setDisconnectChoice((current) => {
        if (!current) return null;
        const reconnectNow = view.players.some((p) => p.id === current.playerId && p.isConnected && !p.isBot);
        return reconnectNow ? null : current;
      });
      setServerState(view);
    });
    socket.on('toast', ({ message }: { message: string }) => setToast(message));
    socket.on('error', ({ message }: { message: string }) => {
      setError(message);
      if (awaitingReconnectSyncRef.current) {
        awaitingReconnectSyncRef.current = false;
        setReconnectNotice(null);
        clearSessionAfterDisconnect();
      }
    });
    socket.on('connect_error', (err: Error) => {
      console.warn('[MP] connect_error:', err.message, '→', want);
      setError(`${t(localeRef.current, 'mp.connectError')}\n(${want})`);
    });
  }, [serverUrl, clearSessionAfterDisconnect]);

  // Cleanup socket on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const createRoom = useCallback(
    (playerName: string) => {
      console.log('[MP][debug] createRoom called, name=', playerName);
      connect();
      console.log('[MP][debug] after connect(), url=', lastSocketUrlRef.current, 'socket?', !!socketRef.current);
      setIsHost(true);
      // Socket.io תור אירועים לפני connect — לא תלויים ב-once('connect')
      socketRef.current?.emit('create_room', { playerName, locale });
      console.log('[MP][debug] emitted create_room');
    },
    [connect, locale],
  );

  const refreshTables = useCallback(() => {
    connect();
    socketRef.current?.emit('list_tables');
  }, [connect]);

  const createTable = useCallback((playerName: string) => {
    connect();
    setIsHost(true);
    socketRef.current?.emit('create_table', { playerName, locale });
  }, [connect, locale]);

  const configureTable = useCallback((config: {
    visibility: LobbyTableVisibility;
    maxParticipants: number;
    difficulty: 'easy' | 'full';
    gameSettings?: Partial<HostGameSettings>;
  }) => {
    socketRef.current?.emit('configure_table', config);
  }, []);

  const joinTable = useCallback((code: string, playerName: string) => {
    connect();
    socketRef.current?.emit('join_table', { roomCode: code.trim(), playerName, locale });
  }, [connect, locale]);

  const joinPrivateTable = useCallback((code: string, inviteCode: string, playerName: string) => {
    connect();
    socketRef.current?.emit('join_private_table_with_code', {
      roomCode: code.trim(),
      inviteCode: inviteCode.trim(),
      playerName,
      locale,
    });
  }, [connect, locale]);

  const startTableCountdown = useCallback(() => {
    socketRef.current?.emit('start_table_countdown');
  }, []);

  const joinRoom = useCallback(
    (code: string, playerName: string) => {
      connect();
      socketRef.current?.emit('join_room', { roomCode: code.trim(), playerName, locale });
    },
    [connect, locale],
  );

  const leaveRoom = useCallback(() => {
    awaitingReconnectSyncRef.current = false;
    setReconnectNotice(null);
    socketRef.current?.emit('leave_room');
    setRoomCode(null);
    setPlayerId(null);
    setCurrentInviteCode(null);
    setCurrentTableVisibility(null);
    playerIdRef.current = null;
    roomCodeSessionRef.current = null;
    setPlayers([]);
    setLobbyStatus(null);
    setServerState(null);
    setDisconnectChoice(null);
    setIsHost(false);
  }, []);

  const startGame = useCallback((difficulty: 'easy' | 'full', gameSettings?: Partial<HostGameSettings>) => {
    if (gameSettings && Object.keys(gameSettings).length > 0) {
      socketRef.current?.emit('start_game', { difficulty, gameSettings });
    } else {
      socketRef.current?.emit('start_game', { difficulty });
    }
  }, []);

  const startBotGame = useCallback((difficulty: 'easy' | 'full', gameSettings?: Partial<HostGameSettings>) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      const message = locale === 'he'
        ? 'אין חיבור לשרת. בדקו כתובת שרת ונסו שוב.'
        : 'No server connection. Check server URL and try again.';
      setError(message);
      return Promise.resolve(false);
    }

    startBotGameReqRef.current += 1;
    const requestId = startBotGameReqRef.current;
    const payload = gameSettings && Object.keys(gameSettings).length > 0
      ? { difficulty, gameSettings }
      : { difficulty };

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled || requestId !== startBotGameReqRef.current) return;
        settled = true;
        const message = locale === 'he'
          ? 'השרת לא הגיב לבקשה להתחלת משחק מול בוט. נסו שוב.'
          : 'Server did not respond to start-vs-bot request. Please try again.';
        setError(message);
        resolve(false);
      }, 7000);

      socket.emit('start_bot_game', payload, (ack: StartBotGameAck) => {
        if (settled || requestId !== startBotGameReqRef.current) return;
        settled = true;
        clearTimeout(timeout);
        if (!ack?.ok) {
          setError(ack?.message || (locale === 'he' ? 'לא ניתן להתחיל משחק מול בוט.' : 'Unable to start vs bot game.'));
          resolve(false);
          return;
        }
        if (ack.playerView) {
          setServerState(ack.playerView);
          setLobbyStatus({ status: 'bot_game_started', botOfferAt: null });
        }
        resolve(true);
      });
    });
  }, [locale]);

  const continueVsBot = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      const message = locale === 'he'
        ? 'אין חיבור לשרת. בדקו כתובת שרת ונסו שוב.'
        : 'No server connection. Check server URL and try again.';
      setError(message);
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      socket.emit('continue_vs_bot', (ack: ContinueVsBotAck) => {
        if (!ack?.ok) {
          setError(ack?.message || (locale === 'he' ? 'לא ניתן להמשיך מול בוט.' : 'Unable to continue vs bot.'));
          resolve(false);
          return;
        }
        if (ack.playerView) {
          setServerState(ack.playerView);
        }
        setDisconnectChoice(null);
        resolve(true);
      });
    });
  }, [locale]);

  const emit = useCallback((event: string, data?: any) => {
    if (data !== undefined) socketRef.current?.emit(event as any, data);
    else socketRef.current?.emit(event as any);
  }, []);

  const inRoom = !!(roomCode && playerId);

  // Build game override when we have server state: adapted state + dispatch that emits to socket
  const gameOverride = React.useMemo(() => {
    if (!serverState) return null;
    const state = playerViewToGameState(serverState);
    const dispatch = (action: any) => {
      if (action?.type === 'RESET_GAME') {
        leaveRoom();
        setServerState(null);
        return;
      }
      const me = serverState.players.find((p) => p.id === serverState.myPlayerId);
      if (me && (me.isEliminated || me.isSpectator)) {
        return;
      }
      const ev = actionToSocketEvent(action);
      if (ev) {
        if (ev.data !== undefined) emit(ev.event, ev.data);
        else emit(ev.event);
      }
    };
    return { state, dispatch };
  }, [serverState, emit, leaveRoom]);

  const value: MultiplayerContextValue = {
    playMode,
    setPlayMode,
    serverUrl,
    setServerUrl,
    connected,
    connect,
    disconnect,
    roomCode,
    playerId,
    currentInviteCode,
    currentTableVisibility,
    players,
    tables,
    lobbyStatus,
    isHost,
    inRoom,
    refreshTables,
    createTable,
    configureTable,
    joinTable,
    joinPrivateTable,
    startTableCountdown,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    startBotGame,
    serverState,
    emit,
    error: error ?? null,
    toast: toast ?? null,
    clearError: () => setError(null),
    clearToast: () => setToast(null),
    reconnectNotice: reconnectNotice ?? null,
    clearReconnectNotice: () => setReconnectNotice(null),
    disconnectChoice,
    clearDisconnectChoice: () => setDisconnectChoice(null),
    continueVsBot,
    gameOverride,
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}
