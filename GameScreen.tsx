// ============================================================
// GameScreen.tsx — TakiMaster Edition
// Full 3D Toy Aesthetic · Google Palette · Black Outlines
// Fixed layout (no ScrollView) · Vortex Dice · Plastic Sockets
// ============================================================
//
// WIRING: In index.tsx, export { useGame, GameContext } and types.
// Then in GameRouter, replace: case 'pre-roll': ... return <GameScreen />;
// with: import { GameScreen } from './GameScreen';
// ============================================================

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
  createContext, useContext,
} from 'react';
import type { ReactNode } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  Dimensions, Platform, Modal as RNModal, ScrollView, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DiceWebView, DiceWebViewRef } from './components/DiceWebView';
import { LulosButton } from './components/LulosButton';
import { GoldDieFace } from './AnimatedDice';
import Svg, {
  Circle as SvgCircle, Rect as SvgRect, Path as SvgPath, Polygon as SvgPolygon,
} from 'react-native-svg';

// ═══════════════════════════════════════════════════════════════
//  TYPES (inline — mirrors index.tsx)
// ═══════════════════════════════════════════════════════════════

type CardType = 'number' | 'fraction' | 'operation' | 'joker';
type Operation = '+' | '-' | 'x' | '÷';
type Fraction = '1/2' | '1/3' | '1/4' | '1/5';

interface Card {
  id: string;
  type: CardType;
  value?: number;
  fraction?: Fraction;
  operation?: Operation;
}

interface Player {
  id: number;
  name: string;
  hand: Card[];
  calledLolos: boolean;
}

interface DiceResult { die1: number; die2: number; die3: number; }
interface EquationOption { equation: string; result: number; }

type GamePhase = 'setup' | 'turn-transition' | 'pre-roll' | 'building' | 'solved' | 'game-over';

interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  drawPile: Card[];
  discardPile: Card[];
  dice: DiceResult | null;
  selectedCards: Card[];
  stagedCards: Card[];
  validTargets: EquationOption[];
  equationResult: number | null;
  activeOperation: Operation | null;
  activeFraction: Fraction | null;
  pendingFractionTarget: number | null;
  fractionPenalty: number;
  fractionAttackResolved: boolean;
  hasPlayedCards: boolean;
  hasDrawnCard: boolean;
  lastCardValue: number | null;
  consecutiveIdenticalPlays: number;
  identicalAlert: { playerName: string; cardDisplay: string; consecutive: number } | null;
  jokerModalOpen: boolean;
  equationOpCard: Card | null;
  equationOpPosition: number | null;
  lastMoveMessage: string | null;
  lastEquationDisplay: string | null;
  difficulty: 'easy' | 'full';
  showFractions: boolean;
  showPossibleResults: boolean;
  winner: Player | null;
  message: string;
  roundsPlayed: number;
}

type GameAction =
  | { type: 'START_GAME'; players: { name: string }[]; difficulty: 'easy' | 'full'; fractions: boolean; showPossibleResults: boolean }
  | { type: 'NEXT_TURN' }
  | { type: 'BEGIN_TURN' }
  | { type: 'ROLL_DICE'; values?: DiceResult }
  | { type: 'CONFIRM_EQUATION'; result: number; equationDisplay: string }
  | { type: 'REVERT_TO_BUILDING' }
  | { type: 'STAGE_CARD'; card: Card }
  | { type: 'UNSTAGE_CARD'; card: Card }
  | { type: 'CONFIRM_STAGED' }
  | { type: 'PLAY_IDENTICAL'; card: Card }
  | { type: 'PLAY_OPERATION'; card: Card }
  | { type: 'SELECT_EQ_OP'; card: Card }
  | { type: 'PLACE_EQ_OP'; position: number }
  | { type: 'REMOVE_EQ_OP' }
  | { type: 'PLAY_FRACTION'; card: Card }
  | { type: 'DEFEND_FRACTION_SOLVE'; card: Card }
  | { type: 'DEFEND_FRACTION_PENALTY' }
  | { type: 'PLAY_JOKER'; card: Card; chosenOperation: Operation }
  | { type: 'DRAW_CARD' }
  | { type: 'CALL_LOLOS' }
  | { type: 'END_TURN' }
  | { type: 'SET_MESSAGE'; message: string }
  | { type: 'OPEN_JOKER_MODAL'; card: Card }
  | { type: 'CLOSE_JOKER_MODAL' }
  | { type: 'DISMISS_IDENTICAL_ALERT' }
  | { type: 'CLEAR_TOAST' }
  | { type: 'RESET_GAME' };

// ═══════════════════════════════════════════════════════════════
//  CONTEXT — Import from your app or use this shim
// ═══════════════════════════════════════════════════════════════

// If you've exported GameContext from index.tsx, replace this:
const GameContext = createContext<{ state: GameState; dispatch: React.Dispatch<GameAction> }>({} as any);
function useGame() { return useContext(GameContext); }
// With: import { useGame } from './index';

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS — Google Palette & TakiMaster DNA
// ═══════════════════════════════════════════════════════════════

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const GOOG = {
  RED: '#EA4335',
  BLUE: '#4285F4',
  YELLOW: '#FBBC05',
  GREEN: '#34A853',
} as const;

const OUTLINE_W = 3; // visual outline thickness (12px is extreme for mobile, 3px looks solid)
const CARD_W = 100;
const CARD_H = 140;
const SOCKET_SIZE = 56;

// ═══════════════════════════════════════════════════════════════
//  ARITHMETIC HELPERS (inlined from index.tsx)
// ═══════════════════════════════════════════════════════════════

function applyOperation(a: number, op: string, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case 'x': case '*': case '×': return a * b;
    case '÷': case '/': return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

function fractionDenominator(f: Fraction): number {
  switch (f) { case '1/2': return 2; case '1/3': return 3; case '1/4': return 4; case '1/5': return 5; }
}

function isDivisibleByFraction(value: number, f: Fraction): boolean {
  return value % fractionDenominator(f) === 0 && value > 0;
}

function validateFractionPlay(card: Card, topDiscard: Card | undefined): boolean {
  if (!card.fraction || !topDiscard) return false;
  if (topDiscard.type !== 'number' || topDiscard.value === undefined) return false;
  return isDivisibleByFraction(topDiscard.value, card.fraction as Fraction);
}

function validateIdenticalPlay(card: Card, topDiscard: Card | undefined): boolean {
  if (!topDiscard || card.type !== topDiscard.type) return false;
  switch (card.type) {
    case 'number': return card.value === topDiscard.value;
    case 'fraction': return card.fraction === topDiscard.fraction;
    case 'operation': return card.operation === topDiscard.operation;
    case 'joker': return topDiscard.type === 'joker';
    default: return false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  OUTLINED TEXT — 12px Black Outline on all card values
// ═══════════════════════════════════════════════════════════════

const OUTLINE_ANGLES = Array.from({ length: 16 }, (_, i) => (i * 360) / 16);

function OutlinedText({ text, fontSize, color, outlineColor = '#000', outlineWidth = OUTLINE_W, style }: {
  text: string; fontSize: number; color: string; outlineColor?: string; outlineWidth?: number; style?: any;
}) {
  const offsets = useMemo(() =>
    OUTLINE_ANGLES.map(deg => {
      const rad = (deg * Math.PI) / 180;
      return { x: Math.cos(rad) * outlineWidth, y: Math.sin(rad) * outlineWidth };
    }),
    [outlineWidth]
  );

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      {/* Black outline copies */}
      {offsets.map((off, i) => (
        <Text key={i} style={{
          position: 'absolute',
          left: off.x,
          top: off.y,
          fontSize,
          fontFamily: 'Fredoka_700Bold',
          fontWeight: '900',
          color: outlineColor,
          includeFontPadding: false,
        }}>{text}</Text>
      ))}
      {/* Foreground face */}
      <Text style={{
        fontSize,
        fontFamily: 'Fredoka_700Bold',
        fontWeight: '900',
        color,
        includeFontPadding: false,
      }}>{text}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  3D SHADOW HELPERS
// ═══════════════════════════════════════════════════════════════

const shadow3D = (color = '#000', elev = 10) => Platform.select({
  ios: { shadowColor: color, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 10 },
  android: { elevation: elev },
}) as any;

const toyGlow = (color: string) => Platform.select({
  ios: { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14 },
  android: { elevation: 16 },
}) as any;

// ═══════════════════════════════════════════════════════════════
//  PLASTIC SOCKET — Beveled inset slot for dice
// ═══════════════════════════════════════════════════════════════

function PlasticSocket({ value, filled, color = GOOG.YELLOW, size = SOCKET_SIZE, onPress }: {
  value?: number | null; filled?: boolean; color?: string; size?: number; onPress?: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(filled ? 1 : 0.8)).current;

  useEffect(() => {
    if (filled) {
      scaleAnim.setValue(0.3);
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }).start();
    } else {
      scaleAnim.setValue(0.8);
    }
  }, [filled]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
      <View style={[socketStyles.outer, { width: size, height: size }]}>
        {/* Beveled inset */}
        <LinearGradient
          colors={['#1a1a2e', '#2d2d4a', '#1a1a2e']}
          style={[socketStyles.bevel, { width: size - 4, height: size - 4 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Inner depression */}
          <View style={[socketStyles.inner, { width: size - 10, height: size - 10 }]}>
            {filled && value != null ? (
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <OutlinedText
                  text={String(value)}
                  fontSize={size * 0.5}
                  color={color}
                  outlineWidth={OUTLINE_W}
                />
              </Animated.View>
            ) : (
              <Text style={socketStyles.placeholder}>?</Text>
            )}
          </View>
        </LinearGradient>
        {/* Top highlight rim */}
        <View style={[socketStyles.rimTop, { width: size - 6 }]} />
      </View>
    </TouchableOpacity>
  );
}

const socketStyles = StyleSheet.create({
  outer: {
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0d0d1a',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 6 },
      android: { elevation: 6 },
    }),
  },
  bevel: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.5)',
    borderLeftColor: 'rgba(0,0,0,0.3)',
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderRightColor: 'rgba(255,255,255,0.05)',
  },
  rimTop: {
    position: 'absolute',
    top: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'center',
  },
  placeholder: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.12)',
    fontFamily: 'Fredoka_700Bold',
  },
});

// ═══════════════════════════════════════════════════════════════
//  JESTER SVG (for Joker cards)
// ═══════════════════════════════════════════════════════════════

function JesterSvg({ size = 40 }: { size?: number }) {
  const h = size * 1.4;
  return (
    <Svg width={size} height={h} viewBox="0 0 60 84">
      <SvgPolygon points="30,28 8,4 25,26" fill={GOOG.RED} />
      <SvgPolygon points="30,28 30,0 35,26" fill={GOOG.BLUE} />
      <SvgPolygon points="30,28 52,4 35,26" fill={GOOG.GREEN} />
      <SvgCircle cx={8} cy={4} r={3.5} fill={GOOG.YELLOW} />
      <SvgCircle cx={30} cy={0} r={3.5} fill={GOOG.YELLOW} />
      <SvgCircle cx={52} cy={4} r={3.5} fill={GOOG.YELLOW} />
      <SvgCircle cx={30} cy={38} r={11} fill="#FFE0B2" />
      <SvgPath d="M 23 34 L 28 32" stroke="#333" strokeWidth={2} strokeLinecap="round" />
      <SvgPath d="M 37 34 L 32 32" stroke="#333" strokeWidth={2} strokeLinecap="round" />
      <SvgCircle cx={26} cy={37} r={2} fill="#333" />
      <SvgCircle cx={34} cy={37} r={2} fill="#333" />
      <SvgPath d="M 23 43 Q 26 49 30 46 Q 34 49 37 43" stroke="#333" strokeWidth={1.8} fill="none" />
      <SvgPath d="M 17 50 Q 21 46 25 50 Q 29 46 33 50 Q 37 46 41 50 L 41 53 L 17 53 Z" fill={GOOG.YELLOW} />
      <SvgRect x={19} y={53} width={11} height={16} fill={GOOG.RED} />
      <SvgRect x={30} y={53} width={11} height={16} fill={GOOG.GREEN} />
      <SvgPolygon points="25,58 27,55 29,58 27,61" fill={GOOG.YELLOW} />
      <SvgPolygon points="31,58 33,55 35,58 33,61" fill={GOOG.YELLOW} />
      <SvgRect x={20} y={69} width={9} height={11} rx={2} fill={GOOG.BLUE} />
      <SvgRect x={31} y={69} width={9} height={11} rx={2} fill="#F97316" />
      <SvgPath d="M 16 80 L 29 80 L 25 77" fill={GOOG.BLUE} />
      <SvgPath d="M 44 80 L 31 80 L 35 77" fill="#F97316" />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TOY CARD — 3D glossy card base with rounded corners
// ═══════════════════════════════════════════════════════════════

function ToyCard({ children, borderColor = '#9CA3AF', selected = false, active = false, onPress, faceDown = false }: {
  children: ReactNode; borderColor?: string; selected?: boolean; active?: boolean; onPress?: () => void; faceDown?: boolean;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }, []);

  if (faceDown) return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[{ width: CARD_W, borderRadius: 16, borderBottomWidth: 6, borderBottomColor: '#1E1B4B' }, shadow3D('#000')]}>
        <LinearGradient colors={['#4338CA', '#312E81']} style={{
          width: CARD_W, height: CARD_H, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: 'rgba(129,140,248,0.3)',
        }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: 'rgba(165,180,252,0.5)' }} />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  const bottomEdge = selected ? '#B45309' : (active ? '#15803D' : borderColor);
  const shadowStyle = active ? toyGlow(GOOG.GREEN) : (selected ? shadow3D(GOOG.YELLOW, 14) : shadow3D('#000', 10));

  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View style={[{
          width: CARD_W, height: CARD_H, borderRadius: 16,
          borderBottomWidth: 5, borderBottomColor: bottomEdge,
          transform: [{ translateY: selected ? -6 : (active ? -3 : 0) }],
        }, shadowStyle]}>
          <View style={{
            width: CARD_W, height: CARD_H, borderRadius: 16, overflow: 'hidden',
            borderWidth: selected ? 3 : 2.5,
            borderColor: selected ? GOOG.YELLOW : borderColor,
          }}>
            <LinearGradient
              colors={['#FFFFFF', '#F8F8F8', '#EBEBEB']}
              locations={[0, 0.6, 1]}
              start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Gloss sheen */}
            <View style={{
              position: 'absolute', top: -(CARD_H * 0.15), left: CARD_W * 0.05,
              width: CARD_W * 0.9, height: CARD_H * 0.5, borderRadius: CARD_W,
              backgroundColor: 'rgba(255,255,255,0.5)',
            }} />
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {children}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CARD TYPE COMPONENTS — TakiMaster style with black outlines
// ═══════════════════════════════════════════════════════════════

function getNumColor(v: number) {
  if (v <= 9) return GOOG.BLUE;
  if (v <= 19) return GOOG.YELLOW;
  return GOOG.GREEN;
}

function NumberCardTM({ card, selected, active, onPress }: {
  card: Card; selected?: boolean; active?: boolean; onPress?: () => void;
}) {
  const v = card.value ?? 0;
  const color = getNumColor(v);
  return (
    <ToyCard borderColor={color} selected={selected} active={active} onPress={onPress}>
      <OutlinedText text={String(v)} fontSize={48} color={color} />
    </ToyCard>
  );
}

const fracColorMap: Record<string, string> = {
  '2': GOOG.BLUE, '3': GOOG.GREEN, '4': GOOG.YELLOW, '5': GOOG.RED,
};

function FractionCardTM({ card, selected, onPress }: {
  card: Card; selected?: boolean; onPress?: () => void;
}) {
  const f = card.fraction ?? '1/2';
  const [num, den] = f.split('/');
  const color = fracColorMap[den] ?? GOOG.RED;
  return (
    <ToyCard borderColor={color} selected={selected} onPress={onPress}>
      <View style={{ alignItems: 'center' }}>
        <OutlinedText text={num} fontSize={34} color={GOOG.RED} />
        <View style={{ width: 38, height: 5, backgroundColor: '#000', borderRadius: 3, marginVertical: 2 }}>
          <View style={{ width: 36, height: 3, backgroundColor: color, borderRadius: 2, alignSelf: 'center', marginTop: 1 }} />
        </View>
        <OutlinedText text={den} fontSize={34} color={color} />
      </View>
    </ToyCard>
  );
}

const opColorMap: Record<string, string> = {
  '+': GOOG.RED, '-': GOOG.YELLOW, 'x': GOOG.GREEN, '÷': GOOG.BLUE,
};
const opDisplayMap: Record<string, string> = { 'x': '×', '-': '−', '÷': '÷', '+': '+' };

function OperationCardTM({ card, selected, onPress }: {
  card: Card; selected?: boolean; onPress?: () => void;
}) {
  const op = card.operation ?? '+';
  const color = opColorMap[op] ?? GOOG.RED;
  const display = opDisplayMap[op] ?? op;
  return (
    <ToyCard borderColor={color} selected={selected} onPress={onPress}>
      <OutlinedText text={display} fontSize={44} color={color} />
    </ToyCard>
  );
}

function JokerCardTM({ card, selected, onPress }: {
  card: Card; selected?: boolean; onPress?: () => void;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View style={[{
          width: CARD_W, height: CARD_H, borderRadius: 16,
          transform: [{ translateY: selected ? -6 : 0 }],
        }, selected ? shadow3D(GOOG.YELLOW, 14) : shadow3D('#000', 10)]}>
          <LinearGradient
            colors={[GOOG.RED, GOOG.BLUE, GOOG.GREEN, GOOG.YELLOW, GOOG.RED]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: CARD_W, height: CARD_H, borderRadius: 16, padding: 3.5 }}
          >
            <View style={{ flex: 1, borderRadius: 13, overflow: 'hidden' }}>
              <LinearGradient colors={['#FFF', '#F5F5F5', '#E8E8E8']} style={StyleSheet.absoluteFill} />
              <View style={{
                position: 'absolute', top: -(CARD_H * 0.15), left: CARD_W * 0.05,
                width: CARD_W * 0.9, height: CARD_H * 0.5, borderRadius: CARD_W,
                backgroundColor: 'rgba(255,255,255,0.4)',
              }} />
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <JesterSvg size={44} />
              </View>
              {/* Corner outlined symbols */}
              {[
                { sym: '+', color: GOOG.RED, pos: { top: 4, left: 4 } as any, rot: '-12deg' },
                { sym: '÷', color: GOOG.BLUE, pos: { top: 4, right: 4 } as any, rot: '10deg' },
                { sym: '×', color: GOOG.GREEN, pos: { bottom: 8, left: 4 } as any, rot: '10deg' },
                { sym: '−', color: GOOG.YELLOW, pos: { bottom: 8, right: 4 } as any, rot: '-10deg' },
              ].map((c, i) => (
                <View key={i} style={[{ position: 'absolute', transform: [{ rotate: c.rot }] }, c.pos]}>
                  <OutlinedText text={c.sym} fontSize={14} color={c.color} outlineWidth={2} />
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function GameCardTM({ card, selected, active, onPress }: {
  card: Card; selected?: boolean; active?: boolean; onPress?: () => void;
}) {
  switch (card.type) {
    case 'number': return <NumberCardTM card={card} selected={selected} active={active} onPress={onPress} />;
    case 'fraction': return <FractionCardTM card={card} selected={selected} onPress={onPress} />;
    case 'operation': return <OperationCardTM card={card} selected={selected} onPress={onPress} />;
    case 'joker': return <JokerCardTM card={card} selected={selected} onPress={onPress} />;
  }
}

// ═══════════════════════════════════════════════════════════════
//  ZONE A — HEADER (Exit + Player Sidebar)
// ═══════════════════════════════════════════════════════════════

function ZoneAHeader() {
  const { state, dispatch } = useGame();
  return (
    <View style={zoneA.container}>
      <LulosButton text="יציאה" color="red" width={72} height={34} fontSize={12} onPress={() => dispatch({ type: 'RESET_GAME' })} />
      <View style={zoneA.badges}>
        {state.players.map((p, i) => (
          <View key={p.id} style={[zoneA.badge, i === state.currentPlayerIndex && zoneA.badgeActive]}>
            <Text style={[zoneA.badgeName, i === state.currentPlayerIndex && { color: '#FFF' }]} numberOfLines={1}>{p.name}</Text>
            <View style={[zoneA.countBubble, i === state.currentPlayerIndex && { backgroundColor: GOOG.YELLOW }]}>
              <Text style={[zoneA.countTxt, i === state.currentPlayerIndex && { color: '#1a1a2e' }]}>{p.hand.length}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const zoneA = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 6,
    gap: 8,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  badgeActive: {
    backgroundColor: GOOG.BLUE,
    borderColor: 'rgba(66,133,244,0.6)',
    ...Platform.select({
      ios: { shadowColor: GOOG.BLUE, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6 },
      android: { elevation: 6 },
    }),
  },
  badgeName: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', maxWidth: 60 },
  countBubble: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  countTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800' },
});

// ═══════════════════════════════════════════════════════════════
//  ZONE C — PILE (Discard + Draw info)
// ═══════════════════════════════════════════════════════════════

const pileRotations = [
  { rotate: '-3deg', translateX: -2, translateY: 3 },
  { rotate: '2deg', translateX: 2, translateY: 1 },
  { rotate: '0deg', translateX: 0, translateY: 0 },
];

function ZoneCPile() {
  const { state, dispatch } = useGame();
  const top = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : null;
  const layers = Math.min(state.discardPile.length, 3);
  const canDraw = (state.phase === 'pre-roll' || state.phase === 'building') && !state.hasPlayedCards && state.pendingFractionTarget === null;

  return (
    <View style={zoneC.container}>
      {/* 3D Discard Pile */}
      <View style={zoneC.pileWrap}>
        {layers > 0 ? pileRotations.slice(3 - layers).map((r, i) => {
          const isTop = i === layers - 1;
          return (
            <View key={i} style={{
              position: 'absolute',
              transform: [{ rotate: r.rotate }, { translateX: r.translateX }, { translateY: r.translateY }],
            }}>
              {isTop && top
                ? <GameCardTM card={top} active />
                : <ToyCard faceDown><></></ToyCard>}
            </View>
          );
        }) : (
          <View style={zoneC.emptyPile}>
            <Text style={{ color: '#4B5563', fontSize: 11 }}>ריק</Text>
          </View>
        )}
      </View>

      {/* Pile info */}
      <View style={zoneC.info}>
        <OutlinedText text="ערימה" fontSize={18} color={GOOG.YELLOW} outlineWidth={2} />
        <View style={zoneC.countRow}>
          <OutlinedText text={String(state.drawPile.length)} fontSize={22} color="#FFF" outlineWidth={2} />
          <Text style={zoneC.inPackText}> בחבילה</Text>
        </View>
        {canDraw && (
          <TouchableOpacity onPress={() => dispatch({ type: 'DRAW_CARD' })} style={zoneC.drawBtn}>
            <Text style={zoneC.drawBtnText}>שלוף</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const zoneC = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 16,
    height: 160,
    backgroundColor: 'transparent',
  },
  pileWrap: {
    width: CARD_W + 10, height: CARD_H + 10,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyPile: {
    width: CARD_W - 4, height: CARD_H - 4,
    borderRadius: 16, borderWidth: 2.5, borderStyle: 'dashed',
    borderColor: '#4B5563', alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, gap: 4 },
  countRow: { flexDirection: 'row', alignItems: 'baseline' },
  inPackText: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '600' },
  drawBtn: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  drawBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
});

// ═══════════════════════════════════════════════════════════════
//  ZONE D — EQUATION HUB with Vortex Dice & Plastic Sockets
// ═══════════════════════════════════════════════════════════════

const EQ_OPS: (string | null)[] = [null, '+', '-', '×', '÷'];

function ZoneDEquationHub({ onConfirmReady }: { onConfirmReady?: (data: { onConfirm: () => void } | null) => void }) {
  const { state, dispatch } = useGame();
  const diceRef = useRef<DiceWebViewRef>(null);

  // ── Dice socket state ──
  const [socket1, setSocket1] = useState<number | null>(null);
  const [socket2, setSocket2] = useState<number | null>(null);
  const [socket3, setSocket3] = useState<number | null>(null);
  const [op1, setOp1] = useState<string | null>(null);
  const [op2, setOp2] = useState<string | null>(null);

  // ── Vortex animation ──
  const vortexAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const [vortexActive, setVortexActive] = useState(false);
  const [vortexValues, setVortexValues] = useState<number[]>([]);
  const [vortexLanded, setVortexLanded] = useState([false, false, false]);
  const [socketsReady, setSocketsReady] = useState(false);

  // Layout measurements for targeting sockets
  const [socketsRowY, setSocketsRowY] = useState(0);
  const [diceAreaCenterY, setDiceAreaCenterY] = useState(200);
  // Socket X offsets from container center: (Socket + gap + OpLabel + gap) × position
  // Row: Socket(56) gap(10) Op(24) gap(10) Socket(56) gap(10) Op(24) gap(10) Socket(56) = ~256 wide
  const SOCKET_TARGET_X = [-100, 0, 100];

  // Reset on new dice
  const diceKey = state.dice ? `${state.dice.die1}-${state.dice.die2}-${state.dice.die3}` : '';
  useEffect(() => {
    setSocket1(null); setSocket2(null); setSocket3(null);
    setOp1(null); setOp2(null);
    setSocketsReady(false);
  }, [diceKey]);

  const canRoll = state.phase === 'pre-roll' && !state.hasPlayedCards && state.pendingFractionTarget === null && !state.activeOperation;
  const showBuilder = (state.phase === 'building' || state.phase === 'solved') && state.dice;
  const isSolved = state.phase === 'solved';
  const diceValues = state.dice ? [state.dice.die1, state.dice.die2, state.dice.die3] : [0, 0, 0];

  // ── VORTEX SPIN: dice spiral from DiceWebView area UP into Zone D sockets ──
  const handleDiceResult = useCallback((results: number[], _total: number) => {
    setVortexValues(results);
    setVortexActive(true);
    setSocketsReady(false);
    setVortexLanded([false, false, false]);
    vortexAnims.forEach(a => a.setValue(0));

    // Stagger: each die spirals individually into its socket
    const STAGGER_DELAY = 300;
    const FLIGHT_DURATION = 1000;

    vortexAnims.forEach((anim, i) => {
      const delay = i * STAGGER_DELAY;
      setTimeout(() => {
        Animated.timing(anim, {
          toValue: 1,
          duration: FLIGHT_DURATION,
          easing: Easing.bezier(0.22, 0.68, 0.35, 1),
          useNativeDriver: true,
        }).start(() => {
          // Mark this die as landed in its socket
          setVortexLanded(prev => {
            const next = [...prev];
            next[i] = true;
            return next;
          });

          // After the LAST die lands, finish the vortex
          if (i === 2) {
            setTimeout(() => {
              setSocketsReady(true);
              setVortexActive(false);
              dispatch({ type: 'ROLL_DICE', values: { die1: results[0], die2: results[1], die3: results[2] } });
            }, 150);
          }
        });
      }, delay);
    });
  }, [dispatch]);

  // ── Dice pool tap logic ──
  const usedDice = new Set([socket1, socket2, socket3].filter(d => d !== null) as number[]);

  const tapDice = (dIdx: number) => {
    if (isSolved) return;
    if (usedDice.has(dIdx)) {
      if (socket1 === dIdx) setSocket1(null);
      else if (socket2 === dIdx) setSocket2(null);
      else if (socket3 === dIdx) setSocket3(null);
      return;
    }
    if (socket1 === null) setSocket1(dIdx);
    else if (socket2 === null) setSocket2(dIdx);
    else if (socket3 === null) setSocket3(dIdx);
  };

  const removeSocket = (slot: 1 | 2 | 3) => {
    if (isSolved) return;
    if (slot === 1) setSocket1(null);
    else if (slot === 2) setSocket2(null);
    else setSocket3(null);
  };

  const cycleOp = (which: 1 | 2) => {
    if (isSolved) return;
    const cur = which === 1 ? op1 : op2;
    const idx = EQ_OPS.indexOf(cur);
    const next = EQ_OPS[(idx + 1) % EQ_OPS.length];
    if (which === 1) setOp1(next); else setOp2(next);
  };

  const resetAll = () => {
    if (isSolved) return;
    setSocket1(null); setSocket2(null); setSocket3(null);
    setOp1(null); setOp2(null);
  };

  // ── Compute result (L2R) ──
  const d1v = socket1 !== null ? diceValues[socket1] : null;
  const d2v = socket2 !== null ? diceValues[socket2] : null;
  const d3v = socket3 !== null ? diceValues[socket3] : null;

  let subResult: number | null = null;
  if (d1v !== null && d2v !== null && op1 !== null) {
    subResult = applyOperation(d1v, op1, d2v);
  }

  let finalResult: number | null = null;
  if (subResult !== null) {
    if (d3v !== null && op2 !== null) {
      finalResult = applyOperation(subResult, op2, d3v);
    } else if (d3v === null && op2 === null) {
      finalResult = subResult;
    }
  }
  if (finalResult !== null && (!Number.isFinite(finalResult) || finalResult < 0 || !Number.isInteger(finalResult))) finalResult = null;

  const hasError = (d1v !== null && d2v !== null && op1 !== null && subResult === null) ||
    (subResult !== null && d3v !== null && op2 !== null && finalResult === null);

  const filledCount = [socket1, socket2, socket3].filter(d => d !== null).length;
  const ok = finalResult !== null && filledCount >= 2 && state.validTargets.some(t => t.result === finalResult);
  const show3rd = subResult !== null;

  // ── Confirm handler ──
  const confirmRef = useRef<() => void>(() => {});
  confirmRef.current = () => {
    if (!ok || finalResult === null || d1v === null || d2v === null || op1 === null) return;
    let display: string;
    if (d3v !== null && op2 !== null) {
      display = `(${d1v} ${op1} ${d2v}) ${op2} ${d3v} = ${finalResult}`;
    } else {
      display = `${d1v} ${op1} ${d2v} = ${finalResult}`;
    }
    dispatch({ type: 'CONFIRM_EQUATION', result: finalResult, equationDisplay: display });
  };

  const stableConfirm = useCallback(() => confirmRef.current(), []);
  useEffect(() => {
    if (onConfirmReady) {
      onConfirmReady(ok && !isSolved ? { onConfirm: stableConfirm } : null);
    }
  }, [ok, isSolved]);
  useEffect(() => () => onConfirmReady?.(null), []);

  // ── Operator button ──
  const renderOpBtn = (which: 1 | 2, currentOp: string | null, enabled: boolean) => (
    <TouchableOpacity
      onPress={() => enabled && cycleOp(which)}
      activeOpacity={0.7}
      style={[eqHub.opBtn, currentOp ? eqHub.opBtnFilled : eqHub.opBtnEmpty, !enabled && { opacity: 0.3 }]}
      disabled={isSolved || !enabled}
    >
      {currentOp ? (
        <OutlinedText text={currentOp} fontSize={18} color="#1a1510" outlineWidth={0} />
      ) : (
        <Text style={eqHub.opPlaceholder}>⬦</Text>
      )}
    </TouchableOpacity>
  );

  // ═══ PRE-ROLL: Show DiceWebView + Roll button ═══
  if (state.phase === 'pre-roll' && !state.dice) {
    return (
      <View style={eqHub.container}>
        {/* ── Socket row: ALWAYS visible, fills when dice land ── */}
        <View
          style={eqHub.socketsRow}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            setSocketsRowY(y + height / 2);
          }}
        >
          <PlasticSocket value={vortexLanded[0] ? vortexValues[0] : undefined} filled={vortexLanded[0]} />
          <Text style={eqHub.opLabel}>+</Text>
          <PlasticSocket value={vortexLanded[1] ? vortexValues[1] : undefined} filled={vortexLanded[1]} />
          <Text style={eqHub.opLabel}>+</Text>
          <PlasticSocket value={vortexLanded[2] ? vortexValues[2] : undefined} filled={vortexLanded[2]} />
        </View>

        {/* ── 3D Dice WebView ── */}
        <View
          style={{ alignSelf: 'stretch', height: 200, backgroundColor: 'transparent' }}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            setDiceAreaCenterY(y + height / 2);
          }}
        >
          <DiceWebView ref={diceRef} onResult={handleDiceResult} height={200} />
        </View>

        {/* ── Vortex overlay: dice spiral FROM DiceWebView UP INTO sockets ── */}
        {vortexActive && vortexValues.length === 3 && (
          <View style={eqHub.vortexAbsolute} pointerEvents="none">
            {vortexValues.map((val, i) => {
              // Already landed in its socket — hide the flying die
              if (vortexLanded[i]) return null;

              // Start: center of DiceWebView area
              const startY = diceAreaCenterY;
              // End: center of sockets row
              const endY = socketsRowY;
              // Vertical travel distance (upward = negative)
              const deltaY = endY - startY;

              // X: start clustered near center, spiral out to socket target
              const targetX = SOCKET_TARGET_X[i];
              const startX = (i - 1) * 30; // slight offset so dice don't stack

              const translateX = vortexAnims[i].interpolate({
                inputRange:  [0,    0.15,           0.35,          0.55,           0.8,           1],
                outputRange: [startX, startX + 40,  startX - 25,   targetX + 20,  targetX - 8,   targetX],
              });
              const translateY = vortexAnims[i].interpolate({
                inputRange:  [0,    0.2,             0.5,             0.75,           1],
                outputRange: [startY, startY + deltaY * 0.15, startY + deltaY * 0.55, startY + deltaY * 0.85, endY],
              });
              const rotate = vortexAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', `${720 + i * 120}deg`],
              });
              const scale = vortexAnims[i].interpolate({
                inputRange:  [0,   0.3,   0.7,  0.9,  1],
                outputRange: [1.5, 1.2,   1.0,  0.88, 1],
              });
              const opacity = vortexAnims[i].interpolate({
                inputRange: [0, 0.1, 0.9, 1],
                outputRange: [0, 1, 1, 0],
              });

              return (
                <Animated.View key={i} style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  marginLeft: -25,
                  transform: [{ translateX }, { translateY }, { rotate }, { scale }],
                  opacity,
                }}>
                  <View style={eqHub.vortexDie}>
                    <OutlinedText text={String(val)} fontSize={28} color={GOOG.YELLOW} />
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}

        {/* Roll button — disappears immediately on press */}
        {canRoll && !vortexActive && (
          <LulosButton
            text={state.roundsPlayed === 0 ? '🎲 בוא נשחק' : '🎲 לסיבוב הבא'}
            color="yellow"
            width={220}
            height={56}
            onPress={() => diceRef.current?.throwDice()}
          />
        )}
      </View>
    );
  }

  // ═══ POST-ROLL: Static dice in sockets + equation builder ═══
  if (!showBuilder) return null;

  return (
    <View style={[eqHub.container, isSolved && { opacity: 0.5 }]}>
      {/* Title + Reset */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 8 }}>
        <OutlinedText text="בנה/י משוואה" fontSize={14} color="rgba(255,255,255,0.5)" outlineWidth={0} />
        {!isSolved && (
          <TouchableOpacity onPress={resetAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: '#6B7280', fontSize: 18 }}>🔄</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dice pool — tappable dice bubbles */}
      {!isSolved && (
        <View style={eqHub.dicePool}>
          {diceValues.map((dv, dIdx) => {
            const isUsed = usedDice.has(dIdx);
            return (
              <TouchableOpacity key={dIdx} onPress={() => tapDice(dIdx)} activeOpacity={0.7}
                style={[eqHub.diceBubble, isUsed && { opacity: 0.25 }]}>
                <OutlinedText text={String(dv)} fontSize={20} color={GOOG.YELLOW} outlineWidth={2} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ═══ 2-ROW STEP-BY-STEP EQUATION LAYOUT ═══ */}
      <View style={eqHub.eqWrap}>
        {/* Row 1: ( Socket1 OP1 Socket2 ) = sub-result */}
        <View style={eqHub.eqRow}>
          <Text style={eqHub.bracket}>(</Text>
          <PlasticSocket
            value={socket1 !== null ? diceValues[socket1] : null}
            filled={socket1 !== null}
            onPress={socket1 !== null ? () => removeSocket(1) : undefined}
          />
          {renderOpBtn(1, op1, socket1 !== null)}
          <PlasticSocket
            value={socket2 !== null ? diceValues[socket2] : null}
            filled={socket2 !== null}
            onPress={socket2 !== null ? () => removeSocket(2) : undefined}
          />
          <Text style={eqHub.bracket}>)</Text>
          {subResult !== null && (
            <>
              <Text style={eqHub.equalsSmall}>=</Text>
              <View style={eqHub.subResultBox}>
                <OutlinedText text={String(subResult)} fontSize={18} color="#FFF" outlineWidth={1} />
              </View>
            </>
          )}
        </View>

        {/* Row 2: OP2 Socket3 = final result */}
        <View style={[eqHub.eqRow, !show3rd && { opacity: 0.25 }]}>
          {renderOpBtn(2, op2, show3rd)}
          <PlasticSocket
            value={socket3 !== null ? diceValues[socket3] : null}
            filled={socket3 !== null}
            color={GOOG.GREEN}
            onPress={socket3 !== null ? () => removeSocket(3) : undefined}
          />
          <Text style={eqHub.equalsBig}>=</Text>
          <View style={[eqHub.resultBox, hasError && { borderColor: 'rgba(234,67,53,0.3)', backgroundColor: 'rgba(234,67,53,0.05)' }]}>
            {hasError ? (
              <OutlinedText text="✕" fontSize={22} color={GOOG.RED} outlineWidth={1} />
            ) : finalResult !== null ? (
              <OutlinedText
                text={String(finalResult)}
                fontSize={28}
                color={ok ? GOOG.GREEN : GOOG.YELLOW}
                outlineWidth={2}
              />
            ) : (
              <Text style={{ fontSize: 22, fontWeight: '700', color: 'rgba(255,215,0,0.2)' }}>?</Text>
            )}
          </View>
        </View>
      </View>

      {/* Error */}
      {hasError && (
        <Text style={{ color: GOOG.RED, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>חלוקה לא חוקית</Text>
      )}

      {/* 2-dice hint */}
      {subResult !== null && socket3 === null && op2 === null && !isSolved && (
        <Text style={{ color: '#6B7280', fontSize: 10, fontStyle: 'italic', textAlign: 'center' }}>אפשר לסיים עם 2 קוביות</Text>
      )}

      {/* Solved instruction */}
      {isSolved && state.equationResult !== null && !state.hasPlayedCards && (
        <View style={eqHub.solvedBanner}>
          <OutlinedText text={`✅ בחר קלפים שסכומם ${state.equationResult}`} fontSize={14} color={GOOG.GREEN} outlineWidth={1} />
        </View>
      )}

      {/* Possible results */}
      {!isSolved && state.showPossibleResults && state.validTargets.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8 }}>
          {state.validTargets.map(t => {
            const cp = state.players[state.currentPlayerIndex];
            const hasCard = cp?.hand.some(c => c.type === 'number' && c.value === t.result);
            return (
              <Text key={t.result} style={{
                color: hasCard ? GOOG.GREEN : '#6B7280',
                fontSize: 11, fontWeight: hasCard ? '700' : '400',
              }}>{t.result}</Text>
            );
          })}
        </View>
      )}
    </View>
  );
}

const eqHub = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
  },
  socketsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    direction: 'ltr' as any,
  },
  opLabel: { color: 'rgba(255,255,255,0.15)', fontSize: 20, fontWeight: '700' },
  vortexOverlay: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vortexAbsolute: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    overflow: 'visible',
  },
  vortexDie: {
    width: 50, height: 50, borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 2, borderColor: 'rgba(255,215,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12 },
      android: { elevation: 10 },
    }),
  },
  dicePool: {
    flexDirection: 'row', gap: 10, justifyContent: 'center', direction: 'ltr' as any,
  },
  diceBubble: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,200,60,0.1)',
    borderWidth: 2, borderColor: 'rgba(255,200,60,0.25)',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  eqWrap: {
    gap: 8, alignItems: 'center', width: '100%',
    backgroundColor: 'transparent',
  },
  eqRow: {
    flexDirection: 'row', direction: 'ltr' as any, alignItems: 'center', gap: 6,
    justifyContent: 'center',
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  bracket: { fontSize: 34, fontWeight: '300', color: 'rgba(255,200,60,0.3)' },
  opBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  opBtnEmpty: {
    borderWidth: 2, borderStyle: 'dashed' as any,
    borderColor: GOOG.YELLOW, backgroundColor: 'transparent',
  },
  opBtnFilled: {
    backgroundColor: GOOG.YELLOW,
    ...Platform.select({
      ios: { shadowColor: GOOG.YELLOW, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  opPlaceholder: { fontSize: 14, fontWeight: '800', color: GOOG.YELLOW },
  equalsSmall: { fontSize: 18, fontWeight: '800', color: 'rgba(255,215,0,0.4)', marginHorizontal: 2 },
  equalsBig: { fontSize: 24, fontWeight: '900', color: '#FFD700', marginHorizontal: 4 },
  subResultBox: {
    minWidth: 36, height: 36, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  resultBox: {
    minWidth: 50, height: SOCKET_SIZE, borderRadius: 14,
    borderWidth: 2, borderColor: 'rgba(255,215,0,0.2)',
    backgroundColor: 'rgba(255,215,0,0.06)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10,
    ...Platform.select({
      ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  solvedBanner: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(52,168,83,0.1)',
    borderWidth: 1, borderColor: 'rgba(52,168,83,0.2)',
  },
});

// ═══════════════════════════════════════════════════════════════
//  ZONE I — CARD FAN (bottom: 140, card size 100×140)
// ═══════════════════════════════════════════════════════════════

const FAN_MAX_ANGLE = 28;
const FAN_CENTER_SCALE = 1.12;
const FAN_EDGE_SCALE = 0.82;
const FAN_DECEL = 0.92;

function ZoneIHand() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex]; if (!cp) return null;
  const pr = state.phase === 'pre-roll', bl = state.phase === 'building', so = state.phase === 'solved';
  const td = state.discardPile[state.discardPile.length - 1];
  const opCh = pr && !!state.activeOperation && !state.hasPlayedCards;
  const hasFracDefense = state.pendingFractionTarget !== null;

  const sorted = useMemo(() => [...cp.hand].sort((a, b) => {
    const o = { number: 0, fraction: 1, operation: 2, joker: 3 } as const;
    if (o[a.type] !== o[b.type]) return o[a.type] - o[b.type];
    if (a.type === 'number' && b.type === 'number') return (a.value ?? 0) - (b.value ?? 0);
    return 0;
  }), [cp.hand]);

  const count = sorted.length;
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(0);
  const dragStartVal = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const maxIdxRef = useRef(0);
  maxIdxRef.current = Math.max(0, count - 1);

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => { scrollRef.current = value; });
    return () => scrollX.removeListener(id);
  }, [scrollX]);

  useEffect(() => { scrollX.setValue(0); scrollRef.current = 0; }, [count]);

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
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10,
      onPanResponderGrant: () => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        scrollX.stopAnimation();
        dragStartVal.current = scrollRef.current;
        velocityRef.current = 0;
      },
      onPanResponderMove: (_, gs) => {
        const cardsDragged = gs.dx / (CARD_W * 0.8);
        let next = dragStartVal.current + cardsDragged;
        const mx = maxIdxRef.current;
        if (next < 0) next *= 0.3;
        else if (next > mx) next = mx + (next - mx) * 0.3;
        scrollX.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        velocityRef.current = gs.vx * 0.25;
        if (Math.abs(velocityRef.current) > 0.02) momentumRef.current();
        else snapRef.current();
      },
      onPanResponderTerminate: () => { snapRef.current(); },
    })
  ).current;

  // ── Card tap handler ──
  const tap = useCallback((card: Card) => {
    if (state.hasPlayedCards) return;

    if (hasFracDefense) {
      if (card.type === 'number' && card.value === state.pendingFractionTarget) {
        dispatch({ type: 'DEFEND_FRACTION_SOLVE', card });
      } else if (card.type === 'fraction') {
        dispatch({ type: 'PLAY_FRACTION', card });
      }
      return;
    }

    if (pr) {
      if (opCh) {
        if (card.type === 'operation' && card.operation === state.activeOperation) dispatch({ type: 'PLAY_OPERATION', card });
        else if (card.type === 'joker') dispatch({ type: 'OPEN_JOKER_MODAL', card });
        return;
      }
      if (state.consecutiveIdenticalPlays < 2 && validateIdenticalPlay(card, td)) dispatch({ type: 'PLAY_IDENTICAL', card });
      return;
    }
    if (bl) {
      if (card.type === 'fraction') dispatch({ type: 'PLAY_FRACTION', card });
      else if (card.type === 'joker') dispatch({ type: 'OPEN_JOKER_MODAL', card });
      return;
    }
    if (so) {
      if (card.type === 'number' || card.type === 'operation') {
        const isStaged = state.stagedCards.some(c => c.id === card.id);
        if (isStaged) dispatch({ type: 'UNSTAGE_CARD', card });
        else dispatch({ type: 'STAGE_CARD', card });
      } else if (card.type === 'fraction') dispatch({ type: 'PLAY_FRACTION', card });
      else if (card.type === 'joker') dispatch({ type: 'OPEN_JOKER_MODAL', card });
    }
  }, [state, dispatch, pr, bl, so, opCh, hasFracDefense, td]);

  const stagedIds = new Set(state.stagedCards.map(c => c.id));
  const identicalIds = useMemo(() => new Set<string>(
    pr && !state.hasPlayedCards && state.consecutiveIdenticalPlays < 2 && td
      ? sorted.filter(card => validateIdenticalPlay(card, td)).map(c => c.id) : []
  ), [pr, state.hasPlayedCards, state.consecutiveIdenticalPlays, td, sorted]);

  if (count === 0) return <View style={{ height: 200 }} />;

  const fanH = CARD_H * FAN_CENTER_SCALE + 50;

  return (
    <View style={{ width: SCREEN_W, height: fanH, overflow: 'visible' }} {...panResponder.panHandlers}>
      {sorted.map((card, i) => {
        const isStaged = stagedIds.has(card.id);
        const isIdent = identicalIds.has(card.id);
        const ir = [i - 5, i - 3, i - 2, i - 1, i, i + 1, i + 2, i + 3, i + 5];
        const maxA = FAN_MAX_ANGLE;

        const rotateStr = scrollX.interpolate({
          inputRange: ir,
          outputRange: [
            `${-maxA}deg`, `${-maxA}deg`, `${-maxA * 0.75}deg`, `${-maxA * 0.35}deg`,
            '0deg',
            `${maxA * 0.35}deg`, `${maxA * 0.75}deg`, `${maxA}deg`, `${maxA}deg`,
          ],
        });

        const scale = scrollX.interpolate({
          inputRange: [i - 3, i - 1, i, i + 1, i + 3],
          outputRange: [FAN_EDGE_SCALE, FAN_EDGE_SCALE + 0.04, FAN_CENTER_SCALE, FAN_EDGE_SCALE + 0.04, FAN_EDGE_SCALE],
          extrapolate: 'clamp',
        });

        const translateX = scrollX.interpolate({
          inputRange: ir,
          outputRange: [-240, -175, -120, -62, 0, 62, 120, 175, 240],
        });

        const arcY = scrollX.interpolate({
          inputRange: [i - 3, i - 2, i - 1, i, i + 1, i + 2, i + 3],
          outputRange: [45, 25, 8, 0, 8, 25, 45],
          extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
          inputRange: [i - 4, i - 3, i, i + 3, i + 4],
          outputRange: [0.2, 0.55, 1, 0.55, 0.2],
          extrapolate: 'clamp',
        });

        const glowOpacity = scrollX.interpolate({
          inputRange: [i - 0.8, i - 0.25, i, i + 0.25, i + 0.8],
          outputRange: [0, 0, 1, 0, 0],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View key={card.id} style={{
            position: 'absolute',
            left: SCREEN_W / 2 - CARD_W / 2,
            top: isStaged ? -5 : 16,
            width: CARD_W, height: CARD_H,
            transform: [{ translateX }, { translateY: arcY }, { rotate: rotateStr }, { scale }],
            opacity, zIndex: i,
          }}>
            {/* Golden glow */}
            <Animated.View style={{
              position: 'absolute', top: -10, left: -10, right: -10, bottom: -10,
              borderRadius: 22, backgroundColor: 'rgba(255,215,0,0.3)',
              opacity: glowOpacity,
              ...Platform.select({
                ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 20 },
                android: { elevation: 14 },
              }),
            }} />
            <TouchableOpacity activeOpacity={0.8} onPress={() => tap(card)}>
              <View style={[
                isIdent && { borderWidth: 2, borderColor: '#F59E0B', borderRadius: 16, ...Platform.select({ ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 10 }, android: { elevation: 10 } }) },
                isStaged && { borderWidth: 3, borderColor: '#FFD700', borderRadius: 16 },
              ]}>
                <GameCardTM card={card} selected={isStaged} onPress={() => tap(card)} />
              </View>
            </TouchableOpacity>
            {isStaged && (
              <View style={{
                position: 'absolute', top: -6, right: -6,
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: GOOG.YELLOW,
                alignItems: 'center', justifyContent: 'center', zIndex: 10,
                ...Platform.select({ ios: { shadowColor: GOOG.YELLOW, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 }, android: { elevation: 8 } }),
              }}>
                <Text style={{ color: '#3D2800', fontSize: 13, fontWeight: '900' }}>✓</Text>
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ZONE F — ACTION BUTTONS (bottom-fixed)
// ═══════════════════════════════════════════════════════════════

function ZoneFActions({ eqConfirm }: { eqConfirm: { onConfirm: () => void } | null }) {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex]; if (!cp) return null;
  const pr = state.phase === 'pre-roll', bl = state.phase === 'building', so = state.phase === 'solved';
  const hp = state.hasPlayedCards;
  const opCh = pr && !!state.activeOperation && !hp;
  const hasFracDefense = state.pendingFractionTarget !== null;
  const canLol = (pr || bl || so) && cp.hand.length <= 2 && !cp.calledLolos && !opCh && !hasFracDefense;

  // Staging summary
  const stagedSum = so ? state.stagedCards.filter(c => c.type === 'number').reduce((s, c) => s + (c.value ?? 0), 0) : 0;
  const target = state.equationResult;
  const sumMatches = so && target !== null && stagedSum === target && state.stagedCards.length > 0;

  return (
    <View style={zoneF.container} pointerEvents="box-none">
      {/* Fraction defense */}
      {hasFracDefense && (
        <View style={zoneF.fracBanner} pointerEvents="auto">
          <Text style={{ color: '#FDBA74', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
            ⚠️ אותגרת! הנח קלף {state.pendingFractionTarget} או חסום עם שבר
          </Text>
          <LulosButton
            text={`שלוף ${state.fractionPenalty} קלפי עונשין`}
            color="red" width={240} height={48}
            onPress={() => dispatch({ type: 'DEFEND_FRACTION_PENALTY' })}
          />
        </View>
      )}

      {/* Operation challenge */}
      {opCh && !hasFracDefense && (
        <View style={zoneF.opBanner} pointerEvents="auto">
          <Text style={{ color: '#FDBA74', fontSize: 13, fontWeight: '700' }}>אתגר פעולה: {state.activeOperation}</Text>
          <LulosButton text="קבל/י עונש" color="red" width={160} height={44} onPress={() => dispatch({ type: 'END_TURN' })} />
        </View>
      )}

      {/* Staging confirm */}
      {so && !hp && state.stagedCards.length > 0 && !hasFracDefense && (
        <View pointerEvents="auto" style={{ alignItems: 'center', gap: 4 }}>
          {/* Sum indicator */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, direction: 'ltr' as any }}>
            <Text style={{ color: '#9CA3AF', fontSize: 12 }}>נבחר:</Text>
            <OutlinedText text={String(stagedSum)} fontSize={18} color={sumMatches ? GOOG.GREEN : GOOG.RED} outlineWidth={1} />
            <Text style={{ color: GOOG.YELLOW, fontSize: 14, fontWeight: '900' }}>/</Text>
            <OutlinedText text={String(target)} fontSize={18} color="#FFF" outlineWidth={1} />
            {sumMatches && <Text style={{ color: GOOG.GREEN }}>✓</Text>}
          </View>
          <LulosButton text="הנח קלפים" color="green" width={SCREEN_W - 60} height={48} onPress={() => dispatch({ type: 'CONFIRM_STAGED' })} />
        </View>
      )}

      {/* Revert to building */}
      {so && !hp && !hasFracDefense && (
        <TouchableOpacity onPress={() => dispatch({ type: 'REVERT_TO_BUILDING' })} activeOpacity={0.7} style={{ alignItems: 'center' }}>
          <Text style={{ color: '#93C5FD', fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' }}>חזרה לתרגיל</Text>
        </TouchableOpacity>
      )}

      {/* Main action buttons row */}
      <View style={zoneF.buttonsRow} pointerEvents="auto">
        {/* Confirm equation (building phase) */}
        {bl && eqConfirm && (
          <LulosButton text="▶ בחר קלפים" color="green" width={180} height={44} onPress={eqConfirm.onConfirm} />
        )}

        {/* Draw card */}
        {(bl || so) && !hp && !hasFracDefense && (
          <LulosButton text="שלוף (ויתור)" color="yellow" width={160} height={44} onPress={() => dispatch({ type: 'DRAW_CARD' })} />
        )}

        {/* End turn */}
        {(pr || bl || so) && hp && !hasFracDefense && (
          <LulosButton text="סיים תור" color="blue" width={150} height={48} onPress={() => dispatch({ type: 'END_TURN' })} />
        )}

        {/* Lolos! */}
        {canLol && (
          <LulosButton text="לולוס!" color="yellow" width={140} height={52} fontSize={22} onPress={() => dispatch({ type: 'CALL_LOLOS' })} />
        )}
      </View>

      {/* Joker modal */}
      <RNModal visible={state.jokerModalOpen} transparent animationType="fade" onRequestClose={() => dispatch({ type: 'CLOSE_JOKER_MODAL' })}>
        <View style={zoneF.modalOverlay}>
          <View style={zoneF.modalBox}>
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 16 }}>בחר/י פעולה לג'וקר</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {(['+', '-', 'x', '÷'] as Operation[]).map(op => (
                <LulosButton key={op} text={op} color="blue" width={90} height={60} fontSize={28}
                  onPress={() => { const j = state.selectedCards[0]; if (j) dispatch({ type: 'PLAY_JOKER', card: j, chosenOperation: op }); }} />
              ))}
            </View>
            <TouchableOpacity onPress={() => dispatch({ type: 'CLOSE_JOKER_MODAL' })} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: '#9CA3AF', fontSize: 14 }}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>

      {/* Identical alert modal */}
      {state.identicalAlert && (
        <RNModal visible={true} transparent animationType="fade">
          <View style={zoneF.modalOverlay}>
            <View style={zoneF.modalBox}>
              <Text style={{ fontSize: 44, textAlign: 'center' }}>🔄</Text>
              <Text style={{ color: GOOG.RED, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 8 }}>קלף זהה!</Text>
              <Text style={{ color: '#FCA5A5', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 6 }}>
                {state.identicalAlert.playerName} הניח ({state.identicalAlert.cardDisplay})
              </Text>
              <LulosButton text="הבנתי!" color="red" width={160} height={48}
                onPress={() => dispatch({ type: 'DISMISS_IDENTICAL_ALERT' })}
                style={{ marginTop: 16 }} />
            </View>
          </View>
        </RNModal>
      )}
    </View>
  );
}

const zoneF = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 34,
    alignItems: 'center', gap: 8,
    backgroundColor: 'transparent',
    zIndex: 200,
  },
  buttonsRow: {
    flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center',
  },
  fracBanner: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
    borderRadius: 14, padding: 12, gap: 8, alignItems: 'center', width: '100%',
  },
  opBanner: {
    gap: 6, alignItems: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalBox: {
    backgroundColor: '#1F2937', borderRadius: 20, padding: 24, width: '100%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20 },
      android: { elevation: 24 },
    }),
  },
});

// ═══════════════════════════════════════════════════════════════
//  CELEBRATION FLASH (Joker play)
// ═══════════════════════════════════════════════════════════════

const RAINBOW = [GOOG.RED, '#F97316', GOOG.YELLOW, GOOG.GREEN, GOOG.BLUE, '#8B5CF6'];

function CelebrationFlash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const colorIdx = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(colorIdx, { toValue: RAINBOW.length - 1, duration: 800, useNativeDriver: false }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start(() => onDone());
  }, []);
  const bg = colorIdx.interpolate({ inputRange: RAINBOW.map((_, i) => i), outputRange: RAINBOW });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bg as any, opacity: opacity as any, zIndex: 999 }]} pointerEvents="none">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <OutlinedText text="★ ג'וקר! ★" fontSize={48} color="#FFF" outlineWidth={4} />
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATION TOAST (message bar)
// ═══════════════════════════════════════════════════════════════

function NotificationToast() {
  const { state, dispatch } = useGame();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [text, setText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMsg = useRef<string | null>(null);

  useEffect(() => {
    const msg = state.lastMoveMessage || state.message || '';
    if (msg && msg !== prevMsg.current) {
      setText(msg);
      prevMsg.current = msg;
      fadeAnim.setValue(1);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          setText('');
          if (state.lastMoveMessage) dispatch({ type: 'CLEAR_TOAST' });
        });
      }, 3500);
    }
    if (!state.lastMoveMessage && !state.message) prevMsg.current = null;
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.lastMoveMessage, state.message]);

  if (!text) return null;

  const color = text.startsWith('✅') ? GOOG.GREEN :
    (text.startsWith('⚔️') || text.startsWith('⚠️')) ? '#FDBA74' : '#FFF';

  return (
    <Animated.View style={{
      position: 'absolute', top: Platform.OS === 'ios' ? 100 : 80, left: 20, right: 20,
      opacity: fadeAnim, zIndex: 300,
      backgroundColor: 'rgba(0,0,0,0.75)',
      borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
        android: { elevation: 8 },
      }),
    }}>
      <Text style={{ color, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{text}</Text>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN GAME SCREEN — Fixed layout, no ScrollView
// ═══════════════════════════════════════════════════════════════

export function GameScreen() {
  const { state, dispatch } = useGame();
  const [showCel, setShowCel] = useState(false);
  const [eqConfirm, setEqConfirm] = useState<{ onConfirm: () => void } | null>(null);
  const prevJ = useRef(state.jokerModalOpen);

  useEffect(() => {
    if (prevJ.current && !state.jokerModalOpen && state.hasPlayedCards) setShowCel(true);
    prevJ.current = state.jokerModalOpen;
  }, [state.jokerModalOpen, state.hasPlayedCards]);

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={mainS.root}>

      {/* ═══ Zone A: Header ═══ */}
      <ZoneAHeader />

      {/* ═══ Zone C: Pile Row ═══ */}
      <ZoneCPile />

      {/* ═══ Zone D: Equation Hub (flex: 1, fills middle) ═══ */}
      <ZoneDEquationHub onConfirmReady={setEqConfirm} />

      {/* ═══ Zone I: Card Fan (absolute, bottom: 140) ═══ */}
      <View style={mainS.handLayer} pointerEvents="box-none">
        <ZoneIHand />
      </View>

      {/* ═══ Zone F: Action Buttons (absolute bottom) ═══ */}
      <ZoneFActions eqConfirm={eqConfirm} />

      {/* ═══ Overlays ═══ */}
      {showCel && <CelebrationFlash onDone={() => setShowCel(false)} />}
      <NotificationToast />
    </LinearGradient>
  );
}

const mainS = StyleSheet.create({
  root: {
    flex: 1,
  },
  handLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 60,
    overflow: 'visible',
    zIndex: 100,
  },
});

export default GameScreen;
