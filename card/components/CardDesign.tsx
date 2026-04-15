// ═══════════════════════════════════════════════════════════════
// CardDesign.tsx — עיצוב הקלפים (הוצא מ-index.tsx)
// LinearGradient, צללים 3D, טקסט 3D, קלף בסיס, קלפי מספר/שבר/פעולה/ג'וקר/פרא
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle as SvgCircle, Rect as SvgRect, Path as SvgPath, Polygon as SvgPolygon } from 'react-native-svg';
import { displayFontFamily } from '../src/theme/fonts';

// ─── טיפוס קלף לתצוגה ─────────────────────────────────────────
export type CardType = 'number' | 'fraction' | 'operation' | 'joker' | 'wild';
export type Operation = '+' | '-' | 'x' | '÷';
export type Fraction = '1/2' | '1/3' | '1/4' | '1/5';

export interface Card {
  id: string;
  type: CardType;
  value?: number;
  fraction?: Fraction;
  operation?: Operation;
  resolvedValue?: number;
  resolvedTarget?: number;
}

// ─── עזרי צל 3D ו־glow ────────────────────────────────────────

export const shadow3D = (color = '#000', elev = 10) =>
  Platform.select({
    ios: { shadowColor: color, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 8 },
    android: { elevation: elev },
  }) as any;

export const glowActive = () =>
  Platform.select({
    ios: { shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
    android: { elevation: 14 },
  }) as any;

// ─── עזרי טקסט 3D ──────────────────────────────────────────────

function interpolateColor(hex1: string, hex2: string, steps: number): string[] {
  const parse = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  return Array.from({ length: steps }, (_, i) => {
    const t = steps <= 1 ? 0 : i / (steps - 1);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
  });
}

export function Text3D({
  text,
  fontSize,
  faceColor,
  darkColor,
  lightColor,
  maxOffset = 10,
}: {
  text: string;
  fontSize: number;
  faceColor: string;
  darkColor: string;
  lightColor: string;
  maxOffset?: number;
}) {
  const colors = interpolateColor(darkColor, lightColor, maxOffset);
  const fontFamily = displayFontFamily(text);
  return (
    <View>
      {colors.map((color, i) => (
        <Text
          key={i}
          style={{
            position: 'absolute',
            top: maxOffset - i,
            left: maxOffset - i,
            color,
            fontSize,
            fontFamily,
          }}
        >
          {text}
        </Text>
      ))}
      <Text style={{ color: faceColor, fontSize, fontFamily }}>{text}</Text>
    </View>
  );
}

export function Line3D({
  width,
  height,
  faceColor,
  darkColor,
  lightColor,
  layers = 3,
}: {
  width: number;
  height: number;
  faceColor: string;
  darkColor: string;
  lightColor: string;
  layers?: number;
}) {
  const colors = interpolateColor(darkColor, lightColor, layers);
  return (
    <View style={{ width: width + layers, height: height + layers }}>
      {colors.map((color, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: layers - i,
            left: layers - i,
            width,
            height,
            backgroundColor: color,
            borderRadius: height / 2,
          }}
        />
      ))}
      <View style={{ width, height, backgroundColor: faceColor, borderRadius: height / 2 }} />
    </View>
  );
}

// ─── Jester SVG (ג'וקר) ────────────────────────────────────────

export function JesterSvg({ size = 45 }: { size?: number }) {
  const h = size * 1.4;
  return (
    <Svg width={size} height={h} viewBox="0 0 60 84">
      <SvgPolygon points="30,28 8,4 25,26" fill="#EA4335" />
      <SvgPolygon points="30,28 30,0 35,26" fill="#4285F4" />
      <SvgPolygon points="30,28 52,4 35,26" fill="#34A853" />
      <SvgCircle cx={8} cy={4} r={3.5} fill="#FBBC05" />
      <SvgCircle cx={30} cy={0} r={3.5} fill="#FBBC05" />
      <SvgCircle cx={52} cy={4} r={3.5} fill="#FBBC05" />
      <SvgCircle cx={30} cy={38} r={11} fill="#FFE0B2" />
      <SvgPath d="M 23 34 L 28 32" stroke="#333" strokeWidth={2} strokeLinecap="round" />
      <SvgPath d="M 37 34 L 32 32" stroke="#333" strokeWidth={2} strokeLinecap="round" />
      <SvgCircle cx={26} cy={37} r={2} fill="#333" />
      <SvgCircle cx={34} cy={37} r={2} fill="#333" />
      <SvgPath d="M 23 43 Q 26 49 30 46 Q 34 49 37 43" stroke="#333" strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <SvgPath d="M 17 50 Q 21 46 25 50 Q 29 46 33 50 Q 37 46 41 50 L 41 53 L 17 53 Z" fill="#FBBC05" />
      <SvgRect x={19} y={53} width={11} height={16} fill="#EA4335" />
      <SvgRect x={30} y={53} width={11} height={16} fill="#34A853" />
      <SvgPolygon points="25,58 27,55 29,58 27,61" fill="#FBBC05" />
      <SvgPolygon points="31,58 33,55 35,58 33,61" fill="#FBBC05" />
      <SvgPolygon points="25,65 27,62 29,65 27,68" fill="#FBBC05" />
      <SvgPolygon points="31,65 33,62 35,65 33,68" fill="#FBBC05" />
      <SvgRect x={20} y={69} width={9} height={11} rx={2} fill="#4285F4" />
      <SvgRect x={31} y={69} width={9} height={11} rx={2} fill="#F97316" />
      <SvgPath d="M 16 80 L 29 80 L 25 77" fill="#4285F4" />
      <SvgPath d="M 44 80 L 31 80 L 35 77" fill="#F97316" />
    </Svg>
  );
}

// ─── קלף בסיס — גרדיאנט לבן, ברק, מסגרת צבעונית ─────────────────

export function BaseCard({
  children,
  borderColor = '#9CA3AF',
  selected = false,
  active = false,
  onPress,
  faceDown = false,
  small = false,
}: {
  children: React.ReactNode;
  borderColor?: string;
  selected?: boolean;
  active?: boolean;
  onPress?: () => void;
  faceDown?: boolean;
  small?: boolean;
}) {
  const w = small ? 100 : 110;
  const h = small ? 140 : 158;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);

  if (faceDown)
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={[{ width: w, borderRadius: 12, borderBottomWidth: 6, borderBottomColor: '#1E1B4B' }, shadow3D('#000')]}>
          <LinearGradient
            colors={['#4338CA', '#312E81']}
            style={{
              width: w,
              height: h,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: 'rgba(129,140,248,0.3)',
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'rgba(165,180,252,0.5)' }} />
            <View style={{ position: 'absolute', top: 8, left: 8, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(165,180,252,0.15)' }} />
            <View style={{ position: 'absolute', bottom: 8, right: 8, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(165,180,252,0.15)' }} />
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );

  const bottomEdge = selected ? '#B45309' : active ? '#15803D' : borderColor;
  const shadowStyle = active ? glowActive() : selected ? shadow3D('#FACC15', 14) : shadow3D('#000', 10);

  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View
          style={[
            {
              width: w,
              height: h,
              borderRadius: 12,
              borderBottomWidth: small ? 2 : 6,
              borderBottomColor: bottomEdge,
              transform: [{ translateY: selected ? (small ? -4 : -8) : active ? -4 : 0 }],
            },
            small
              ? Platform.select({
                  ios: {
                    shadowColor: selected ? '#FACC15' : '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 3,
                  },
                  android: { elevation: selected ? 6 : 3 },
                })
              : shadowStyle,
          ]}
        >
          <View
            style={{
              width: w,
              height: h,
              borderRadius: 12,
              overflow: 'hidden',
              borderWidth: selected ? 3 : 2,
              borderColor: selected ? '#FACC15' : borderColor,
            }}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F5F5F5', '#E8E8E8']}
              locations={[0, 0.7, 1]}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <View
              style={{
                position: 'absolute',
                top: -(h * 0.15),
                left: w * 0.05,
                width: w * 0.9,
                height: h * 0.5,
                borderRadius: w,
                backgroundColor: 'rgba(255,255,255,0.45)',
              }}
            />
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── צבעים לפי ערך מספר ───────────────────────────────────────

export function getNumColors(v: number) {
  if (v <= 9) return { face: '#2196F3', border: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9' };
  if (v <= 19) return { face: '#FBBC05', border: '#FBBC05', dark: '#8B6800', light: '#DC9E00' };
  return { face: '#34A853', border: '#34A853', dark: '#1B5E2B', light: '#36944F' };
}

// ─── קלף מספר ───────────────────────────────────────────────────

export function NumberCard({
  card,
  selected,
  active,
  onPress,
  small,
}: {
  card: Card;
  selected?: boolean;
  active?: boolean;
  onPress?: () => void;
  small?: boolean;
}) {
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

// ─── קלף מיני לתוצאה ────────────────────────────────────────────

const MINI_W = 36;
const MINI_H = 48;
const MINI_R = 8;

export function MiniResultCard({
  value,
  index = 0,
  onPress,
}: {
  value: number;
  index?: number;
  onPress?: () => void;
}) {
  const cl = getNumColors(value);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const stagger = index * 120;
    Animated.sequence([
      Animated.delay(stagger),
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(flipAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  }, [index]);
  const rotateY = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] });
  const scale = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.85, 1.05, 1] });
  const cardContent = (
    <View
      style={{
        width: MINI_W,
        height: MINI_H,
        borderRadius: MINI_R,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: cl.border,
        backgroundColor: 'rgba(255,255,255,0.95)',
      }}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.9)', 'rgba(248,248,248,0.85)', 'rgba(240,240,240,0.9)']}
        locations={[0, 0.6, 1]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '900',
            color: cl.face,
            textShadowColor: 'rgba(0,0,0,0.15)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 1,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
  return (
    <Animated.View style={{ opacity: opacityAnim, transform: [{ perspective: 800 }, { rotateY }, { scale }] }}>
      {onPress ? <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{cardContent}</TouchableOpacity> : cardContent}
    </Animated.View>
  );
}

// ─── קלף שבר ───────────────────────────────────────────────────

const fracColors: Record<string, { face: string; dark: string; light: string }> = {
  '2': { face: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9' },
  '3': { face: '#34A853', dark: '#1B5E2B', light: '#36944F' },
  '4': { face: '#FBBC05', dark: '#8B6800', light: '#DC9E00' },
  '5': { face: '#EA4335', dark: '#8B1A12', light: '#DC4736' },
};
const numRed = { face: '#EA4335', dark: '#8B1A12', light: '#DC4736' };

export function FractionCard({
  card,
  selected,
  onPress,
  small,
}: {
  card: Card;
  selected?: boolean;
  onPress?: () => void;
  small?: boolean;
}) {
  const f = card.fraction ?? '1/2';
  const [num, den] = f.split('/');
  const denCl = fracColors[den] ?? numRed;
  const fs = small ? 36 : 42;
  const maxOff = small ? 6 : 8;
  const lineW = small ? 38 : 44;
  const lineH = small ? 5 : 6;
  const resolved = card.resolvedTarget != null;
  return (
    <BaseCard borderColor={denCl.face} selected={selected} onPress={onPress} small={small}>
      <View style={{ alignItems: 'center' }}>
        <Text3D text={num} fontSize={fs} faceColor={numRed.face} darkColor={numRed.dark} lightColor={numRed.light} maxOffset={maxOff} />
        <View style={{ marginVertical: small ? 2 : 3 }}>
          <Line3D width={lineW} height={lineH} faceColor={denCl.face} darkColor={denCl.dark} lightColor={denCl.light} layers={3} />
        </View>
        <Text3D text={den} fontSize={fs} faceColor={denCl.face} darkColor={denCl.dark} lightColor={denCl.light} maxOffset={maxOff} />
        {resolved && (
          <Text style={{ fontSize: small ? 11 : 13, fontWeight: '700', color: denCl.face, marginTop: small ? 2 : 3 }}>
            → {card.resolvedTarget}
          </Text>
        )}
      </View>
    </BaseCard>
  );
}

// ─── קלף פעולה ─────────────────────────────────────────────────

const opColors: Record<string, { face: string; dark: string; light: string }> = {
  '+': { face: '#EA4335', dark: '#8B1A12', light: '#DC4736' },
  '/': { face: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9' },
  'x': { face: '#34A853', dark: '#1B5E2B', light: '#36944F' },
  '-': { face: '#FBBC05', dark: '#8B6800', light: '#DC9E00' },
};
// Android: Fredoka_700Bold doesn't ship the Unicode math glyphs (× − ÷).
// iOS + web render them fine; Android falls back to ASCII to stay visible.
const opDisplay: Record<string, string> = Platform.OS === 'android'
  ? { 'x': 'x', '-': '-', '/': '÷', '+': '+', '×': 'x', '−': '-' }
  : { 'x': '×', '-': '−', '/': '÷', '+': '+' };

export function OperationCardComp({
  card,
  selected,
  onPress,
  small,
}: {
  card: Card;
  selected?: boolean;
  onPress?: () => void;
  small?: boolean;
}) {
  const op = card.operation ?? '+';
  const cl = opColors[op] ?? opColors['+'];
  const display = opDisplay[op] ?? op;
  const fs = small ? 46 : 52;
  const maxOff = small ? 10 : 12;
  return (
    <BaseCard borderColor={cl.face} selected={selected} onPress={onPress} small={small}>
      <Text3D text={display} fontSize={fs} faceColor={cl.face} darkColor={cl.dark} lightColor={cl.light} maxOffset={maxOff} />
    </BaseCard>
  );
}

// ─── קלף ג'וקר ─────────────────────────────────────────────────

export function JokerCard({
  card: _c,
  selected,
  onPress,
  small,
}: {
  card: Card;
  selected?: boolean;
  onPress?: () => void;
  small?: boolean;
}) {
  const w = small ? 100 : 110;
  const h = small ? 140 : 158;
  const bw = 3;
  const maxOff = small ? 5 : 6;
  const cornerFs = small ? 15 : 18;
  const svgSize = small ? 50 : 60;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);

  const isAndroid = Platform.OS === 'android';
  const corners = [
    { sym: '+', face: '#EA4335', dark: '#8B1A12', light: '#DC4736', pos: { top: 3, left: 3 } as any, rot: '-12deg' },
    { sym: isAndroid ? '/' : '÷', face: '#2196F3', dark: '#0D5FA3', light: '#1F8CD9', pos: { top: 3, right: 3 } as any, rot: '10deg' },
    { sym: isAndroid ? 'x' : '×', face: '#34A853', dark: '#1B5E2B', light: '#36944F', pos: { bottom: 10, left: 3 } as any, rot: '10deg' },
    { sym: isAndroid ? '-' : '−', face: '#FBBC05', dark: '#8B6800', light: '#DC9E00', pos: { bottom: 10, right: 3 } as any, rot: '-10deg' },
  ];

  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View
          style={[
            {
              width: w,
              height: h,
              borderRadius: 12,
              transform: [{ translateY: selected ? -8 : 0 }],
            },
            selected ? shadow3D('#FACC15', 14) : shadow3D('#000', 10),
          ]}
        >
          <LinearGradient
            colors={['#EA4335', '#4285F4', '#34A853', '#FBBC05', '#EA4335']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: w, height: h, borderRadius: 12, padding: bw }}
          >
            <View style={{ flex: 1, borderRadius: 12 - bw, overflow: 'hidden' }}>
              <LinearGradient
                colors={['#FFFFFF', '#F5F5F5', '#E8E8E8']}
                locations={[0, 0.7, 1]}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: -(h * 0.15),
                  left: w * 0.05,
                  width: w * 0.9,
                  height: h * 0.5,
                  borderRadius: w,
                  backgroundColor: 'rgba(255,255,255,0.4)',
                }}
              />
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <JesterSvg size={svgSize} />
              </View>
              {corners.map((c, i) => (
                <View key={i} style={[{ position: 'absolute', transform: [{ rotate: c.rot }] }, c.pos]}>
                  <Text3D text={c.sym} fontSize={cornerFs} faceColor={c.face} darkColor={c.dark} lightColor={c.light} maxOffset={maxOff} />
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// הערה: ב־index.tsx הג'וקר משתמש ב־Image של joker.jpg. כאן השארנו JesterSvg.
// אם תרצה תמונה, החלף את ה־View עם JesterSvg ב־:
// <Image source={require('../assets/joker.jpg')} style={{ width: svgSize, height: svgSize, borderRadius: 6 }} resizeMode="contain" />

// ─── קלף פרא ───────────────────────────────────────────────────

export function WildCard({
  card,
  selected,
  onPress,
  small,
}: {
  card: Card;
  selected?: boolean;
  onPress?: () => void;
  small?: boolean;
}) {
  const w = small ? 100 : 110;
  const h = small ? 140 : 158;
  const fs = small ? 22 : 26;
  const resolved = card.resolvedValue != null;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View
          style={[
            {
              width: w,
              height: h,
              borderRadius: 12,
              transform: [{ translateY: selected ? -8 : 0 }],
            },
            selected ? shadow3D('#FACC15', 14) : shadow3D('#000', 10),
          ]}
        >
          <LinearGradient
            colors={['#7C3AED', '#5B21B6', '#4C1D95', '#6D28D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: w, height: h, borderRadius: 12, padding: 3 }}
          >
            <View style={{ flex: 1, borderRadius: 9, overflow: 'hidden' }}>
              <LinearGradient
                colors={['#EDE9FE', '#DDD6FE', '#C4B5FD']}
                locations={[0, 0.5, 1]}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <View
                style={{
                  position: 'absolute',
                  top: -(h * 0.12),
                  left: w * 0.1,
                  width: w * 0.8,
                  height: h * 0.4,
                  borderRadius: w,
                  backgroundColor: 'rgba(255,255,255,0.5)',
                }}
              />
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                {resolved ? (
                  <>
                    <Text style={{ fontSize: small ? 12 : 14, fontWeight: '700', color: '#6D28D9' }}>★</Text>
                    <Text style={{ fontSize: fs, fontWeight: '900', color: '#5B21B6', textAlign: 'center' }}>{card.resolvedValue}</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: fs, fontWeight: '900', color: '#5B21B6', textAlign: 'center' }}>★</Text>
                    <Text style={{ fontSize: small ? 10 : 11, fontWeight: '700', color: '#6D28D9', marginTop: 2 }}>0–25</Text>
                  </>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── רכיב קלף משחק (מפנה לפי סוג) ─────────────────────────────

export function GameCard({
  card,
  selected,
  active,
  onPress,
  small,
}: {
  card: Card;
  selected?: boolean;
  active?: boolean;
  onPress?: () => void;
  small?: boolean;
}) {
  switch (card.type) {
    case 'number':
      return <NumberCard card={card} selected={selected} active={active} onPress={onPress} small={small} />;
    case 'fraction':
      return <FractionCard card={card} selected={selected} onPress={onPress} small={small} />;
    case 'operation':
      return <OperationCardComp card={card} selected={selected} onPress={onPress} small={small} />;
    case 'joker':
      return <JokerCard card={card} selected={selected} onPress={onPress} small={small} />;
    case 'wild':
      return <WildCard card={card} selected={selected} onPress={onPress} small={small} />;
  }
}
