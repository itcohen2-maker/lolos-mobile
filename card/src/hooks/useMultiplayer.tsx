// ============================================================
// useMultiplayer — Socket.io connection, room, and game state
// Connects to Lolos server; provides lobby + game override for client
// ============================================================

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { io, type Socket } from 'socket.io-client';
import type { LobbyStatus, PlayerView, HostGameSettings, StartBotGameAck } from '../../shared/types';
import { useLocale } from '../i18n/LocaleContext';

const DEFAULT_SOCKET_PORT = 3001;

/**
 * בפיתוח עם Expo: אותה כתובת שממנה נטען ה-JS (hostUri) — בדרך כלל IP המחשב ברשת המקומית.
 * כך טלפון עם Expo Go מתחבר לשרת שרץ על המחשב (`npm run server:dev`) בלי להקליד IP ידנית.
 */
function inferDevMachineSocketUrl(): string | null {
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (!hostUri || typeof hostUri !== 'string') return null;
    const host = hostUri.split(':')[0]?.trim();
    if (!host) return null;
    return `http://${host}:${DEFAULT_SOCKET_PORT}`;
  } catch {
    return null;
  }
}

function envFlagTrue(name: string): boolean {
  const v =
    typeof process !== 'undefined' && process.env?.[name]
      ? String(process.env[name]).trim().toLowerCase()
      : '';
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * כתובת שרת Socket:
 * - בפיתוח + EXPO_PUBLIC_LOCAL_SOCKET_SERVER=1 → תמיד מחשב מקומי (מתעלם מ-Render ב-.env)
 * - אחרת: EXPO_PUBLIC_SERVER_URL אם מוגדר → גילוי hostUri בפיתוח → localhost / אמולטור
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

  const fromEnv =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SERVER_URL
      ? String(process.env.EXPO_PUBLIC_SERVER_URL).trim()
      : '';
  if (fromEnv) return fromEnv;
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
  players: LobbyPlayer[];
  lobbyStatus: LobbyStatusState | null;
  isHost: boolean;
  inRoom: boolean;
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
  const players = view.players.map((p, i) => {
    const count = p.cardCount ?? 0;
    const hand =
      p.id === view.myPlayerId
        ? view.myHand
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
  const equationHandSlots: [any, any] = [null, null];
  const commits = view.equationCommits?.length ? view.equationCommits : view.equationCommit ? [view.equationCommit] : [];
  for (const ec of commits) {
    const c = view.myHand.find((x) => x.id === ec.cardId);
    if (c && (ec.position === 0 || ec.position === 1)) {
      equationHandSlots[ec.position] = { card: c, jokerAs: ec.jokerAs };
    }
  }
  return {
    phase: view.phase,
    players,
    myPlayerIndex: safeMyIndex,
    currentPlayerIndex: view.currentPlayerIndex,
    drawPile: drawPileFake,
    discardPile: view.pileTop ? [view.pileTop] : [],
    dice: view.dice,
    selectedCards: view.stagedCards || [],
    stagedCards: view.stagedCards || [],
    validTargets: view.validTargets || [],
    equationResult: view.equationResult,
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
    identicalAlert: view.identicalCelebration ?? null,
    jokerModalOpen: false,
    equationHandSlots,
    equationHandPick: null,
    lastMoveMessage: view.lastMoveMessage,
    lastDiscardCount: 0,
    lastEquationDisplay: null,
    difficulty: view.difficulty,
    diceMode: gs.diceMode,
    showFractions: gs.showFractions,
    showPossibleResults: gs.showPossibleResults,
    showSolveExercise: gs.showSolveExercise,
    timerSetting: gs.timerSetting,
    timerCustomSeconds: gs.timerCustomSeconds,
    winner: view.winner ? { id: 0, name: view.winner.name, hand: [], calledLolos: false } : null,
    message: view.message,
    openingDrawId: view.openingDrawId,
    turnDeadlineAt: view.turnDeadlineAt,
    roundsPlayed: 0,
    notifications: [],
    moveHistory: [],
    suppressIdenticalOverlayOnline: false,
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
    case 'PLAY_OPERATION': return null;
    case 'FORWARD_CHALLENGE': return null;
    case 'PLAY_JOKER':
      return { event: 'play_joker', data: { cardId: action.card?.id, chosenOperation: action.chosenOperation } };
    case 'DRAW_CARD': return { event: 'draw_card' };
    case 'CALL_LOLOS': return null;
    case 'END_TURN': return { event: 'end_turn' };
    default: return null;
  }
}

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const [playMode, setPlayMode] = useState<PlayMode>('choose');
  const [serverUrl, setServerUrlState] = useState(getServerUrl);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatusState | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [serverState, setServerState] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const startBotGameReqRef = useRef(0);

  const setServerUrl = useCallback((url: string) => {
    setServerUrlState(url);
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
    setRoomCode(null);
    setPlayerId(null);
    setPlayers([]);
    setLobbyStatus(null);
    setServerState(null);
    setIsHost(false);
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current) return;
    const url = serverUrl.trim() || getServerUrl();
    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => {
      setConnected(false);
      setRoomCode(null);
      setPlayerId(null);
      playerIdRef.current = null;
      setPlayers([]);
      setLobbyStatus(null);
      setServerState(null);
    });
    socket.on('room_created', ({ roomCode: code, playerId: pid }) => {
      setRoomCode(code);
      setPlayerId(pid);
      playerIdRef.current = pid;
    });
    socket.on('player_joined', ({ players: p }) => {
      setPlayers(p.map((x: any) => ({
        id: x.id,
        name: x.name,
        isHost: x.isHost,
        isConnected: x.isConnected,
        isBot: x.isBot ?? false,
      })));
      const pid = playerIdRef.current;
      if (pid) {
        const me = p.find((x: { id: string }) => x.id === pid);
        if (me) setIsHost(!!me.isHost);
      }
    });
    socket.on('lobby_status', (data: LobbyStatusState) => {
      setLobbyStatus(data);
    });
    socket.on('player_left', () => {
      // List will be updated by next player_joined or we could request state
    });
    socket.on('game_started', (view: PlayerView) => {
      setLobbyStatus({ status: 'bot_game_started', botOfferAt: null });
      setServerState(view);
    });
    socket.on('state_update', (view: PlayerView) => {
      setServerState(view);
    });
    socket.on('toast', ({ message }: { message: string }) => setToast(message));
    socket.on('error', ({ message }: { message: string }) => setError(message));
  }, [serverUrl]);

  const createRoom = useCallback((playerName: string) => {
    connect();
    setIsHost(true);
    // Socket.io מנהל תור עד ל־connect — בלי השהיה קבועה (היה גורם למרוצים)
    socketRef.current?.emit('create_room', { playerName, locale });
  }, [connect, locale]);

  const joinRoom = useCallback((code: string, playerName: string) => {
    connect();
    socketRef.current?.emit('join_room', { roomCode: code.trim(), playerName, locale });
  }, [connect, locale]);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('leave_room');
    setRoomCode(null);
    setPlayerId(null);
    playerIdRef.current = null;
    setPlayers([]);
    setLobbyStatus(null);
    setServerState(null);
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
    players,
    lobbyStatus,
    isHost,
    inRoom,
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
    gameOverride,
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}
