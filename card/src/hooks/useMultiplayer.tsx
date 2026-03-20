// ============================================================
// useMultiplayer — Socket.io connection, room, and game state
// Connects to Lolos server; provides lobby + game override for client
// ============================================================

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { PlayerView, HostGameSettings } from '../../shared/types';

// Default server URL — same machine. For device use your computer's LAN IP (e.g. 192.168.1.x:3001)
const getServerUrl = () => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SERVER_URL) {
    return process.env.EXPO_PUBLIC_SERVER_URL;
  }
  // Web / Expo: localhost. For Android emulator use 10.0.2.2, for real device use your PC's IP
  return 'http://localhost:3001';
};

export type PlayMode = 'choose' | 'local' | 'online';

export interface LobbyPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
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
  isHost: boolean;
  inRoom: boolean;
  createRoom: (playerName: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  leaveRoom: () => void;
  startGame: (difficulty: 'easy' | 'full', gameSettings?: Partial<HostGameSettings>) => void;
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
  const players = view.players.map((p, i) => ({
    id: i,
    name: p.name,
    hand: p.id === view.myPlayerId ? view.myHand : [],
    calledLolos: p.calledLolos,
  }));
  const drawPileFake = Array.from({ length: view.deckCount }, (_, i) => ({ id: `deck-${i}`, type: 'number' as const, value: 0 }));
  const gs = view.gameSettings ?? {
    diceMode: '3' as const,
    showFractions: true,
    showPossibleResults: true,
    showSolveExercise: true,
    timerSetting: 'off' as const,
    timerCustomSeconds: 60,
  };
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
    activeOperation: view.activeOperation,
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
    identicalAlert: null,
    jokerModalOpen: false,
    equationOpCard: null,
    equationOpPosition: null,
    equationOpJokerOp: null,
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
    roundsPlayed: 0,
    notifications: [],
    moveHistory: [],
  };
}

/** Map client dispatch actions to socket events (for online mode) */
function actionToSocketEvent(action: any): { event: string; data?: any } | null {
  switch (action.type) {
    case 'BEGIN_TURN': return { event: 'begin_turn' };
    case 'ROLL_DICE': return { event: 'roll_dice' };
    case 'CONFIRM_EQUATION':
      return { event: 'confirm_equation', data: { result: action.result, equationDisplay: action.equationDisplay || '' } };
    case 'STAGE_CARD': return { event: 'stage_card', data: { cardId: action.card?.id } };
    case 'UNSTAGE_CARD': return { event: 'unstage_card', data: { cardId: action.card?.id } };
    case 'CONFIRM_STAGED': return { event: 'confirm_staged' };
    case 'PLAY_IDENTICAL': return { event: 'place_identical', data: { cardId: action.card?.id } };
    case 'PLAY_FRACTION': return { event: 'play_fraction', data: { cardId: action.card?.id } };
    case 'DEFEND_FRACTION_SOLVE': return { event: 'defend_fraction_solve', data: { cardId: action.card?.id } };
    case 'DEFEND_FRACTION_PENALTY': return { event: 'defend_fraction_penalty' };
    case 'PLAY_OPERATION': return { event: 'play_operation', data: { cardId: action.card?.id } };
    case 'FORWARD_CHALLENGE': return { event: 'play_operation', data: { cardId: action.card?.id } };
    case 'PLAY_JOKER':
      return { event: 'play_joker', data: { cardId: action.card?.id, chosenOperation: action.chosenOperation } };
    case 'DRAW_CARD': return { event: 'draw_card' };
    case 'CALL_LOLOS': return { event: 'call_lulos' };
    case 'END_TURN': return { event: 'end_turn' };
    default: return null;
  }
}

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  // #region agent log
  if (typeof __DEV__ !== 'undefined' && __DEV__) { fetch('http://127.0.0.1:7639/ingest/c8839a92-328d-4866-8346-19418994ade4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'68d4b6'},body:JSON.stringify({sessionId:'68d4b6',location:'useMultiplayer.tsx:MultiplayerProvider',message:'MultiplayerProvider render',data:{hypothesisId:'H3'},timestamp:Date.now()})}).catch(()=>{}); }
  // #endregion
  const [playMode, setPlayMode] = useState<PlayMode>('choose');
  const [serverUrl, setServerUrlState] = useState(getServerUrl);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [serverState, setServerState] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

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
      setPlayers([]);
      setServerState(null);
    });
    socket.on('room_created', ({ roomCode: code, playerId: pid }) => {
      setRoomCode(code);
      setPlayerId(pid);
    });
    socket.on('player_joined', ({ players: p }) => {
      setPlayers(p.map((x: any) => ({
        id: x.id,
        name: x.name,
        isHost: x.isHost,
        isConnected: x.isConnected,
      })));
    });
    socket.on('player_left', () => {
      // List will be updated by next player_joined or we could request state
    });
    socket.on('game_started', (view: PlayerView) => {
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
    setTimeout(() => {
      socketRef.current?.emit('create_room', { playerName });
      setIsHost(true);
    }, 500);
  }, [connect]);

  const joinRoom = useCallback((code: string, playerName: string) => {
    connect();
    setTimeout(() => {
      socketRef.current?.emit('join_room', { roomCode: code.trim(), playerName });
    }, 500);
  }, [connect]);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('leave_room');
    setRoomCode(null);
    setPlayerId(null);
    setPlayers([]);
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
    isHost,
    inRoom,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
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
