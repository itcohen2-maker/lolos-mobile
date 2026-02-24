// AnimatedDice.tsx — קוביות זהב מונפשות לולוס
// Golden dice matching 3D HTML style
// Phases: Shake → Toss & Settle → Reveal

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════
const DICE_SIZE = 58;
const FINAL_X = [-68, 0, 68];

// Gold palette matching the HTML 3D dice
const C = {
  diceGrad: ['#FFF3B0', '#FFE566', '#FFD700', '#D4A800'] as const,
  diceShadow: '#B8860B',
  diceStroke: 'rgba(184,134,11,0.4)',
  dotColor: '#2a1500',
  dotShadow: 'rgba(0,0,0,0.25)',
  dotHighlight: 'rgba(255,255,255,0.12)',
  gloss: 'rgba(255,255,255,0.3)',
  haloColor: 'rgba(255,215,0,0.35)',
  sumGrad: ['#FFE566', '#FFD700'] as const,
  sumShadow: '#C49B00',
  sumText: '#3D2800',
  btnGrad: ['#FFE566', '#FFD700', '#DAA520'] as const,
  btnText: '#3D2800',
  btnShadow: '#9e7200',
  btnGlow: 'rgba(255,215,0,0.4)',
};

// Dot positions for each face (% of die size) — matching HTML layout
const DOT_POS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 70], [70, 30]],
  3: [[30, 70], [50, 50], [70, 30]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
};

// ═══════════════════════════════════════
// GOLD DIE FACE — exported for static display
// ═══════════════════════════════════════
export function GoldDieFace({ value, size = DICE_SIZE }: { value: number; size?: number }) {
  const dots = DOT_POS[value] || DOT_POS[1];
  const dotR = size * 0.075;

  return (
    <View style={[{
      width: size, borderRadius: size * 0.18,
      borderBottomWidth: 4, borderBottomColor: C.diceShadow,
      overflow: 'hidden',
    }, Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 5 },
      android: { elevation: 8 },
    }) as any]}>
      <LinearGradient
        colors={[...C.diceGrad]}
        style={{ width: size, height: size, borderRadius: size * 0.18, position: 'relative' }}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
      >
        {/* Gloss highlight */}
        <View style={{
          position: 'absolute', top: size * 0.06, left: size * 0.08,
          width: size * 0.42, height: size * 0.2,
          backgroundColor: C.gloss, borderRadius: 50,
          transform: [{ rotate: '-12deg' }], zIndex: 2,
        }} />
        {/* Inner border */}
        <View style={{
          position: 'absolute', top: 2, left: 2, right: 2, bottom: 2,
          borderRadius: size * 0.16, borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.25)',
        }} />
        {/* Outer stroke */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: size * 0.18, borderWidth: 1.5,
          borderColor: C.diceStroke,
        }} />
        {/* Dots */}
        {dots.map(([x, y], i) => {
          const cx = (x / 100) * size - dotR;
          const cy = (y / 100) * size - dotR;
          return (
            <View key={i} style={{ position: 'absolute', left: cx, top: cy }}>
              {/* Dot shadow */}
              <View style={{
                position: 'absolute', top: 1.5, left: 1.5,
                width: dotR * 2 + 1, height: dotR * 2 + 1,
                borderRadius: dotR + 0.5,
                backgroundColor: C.dotShadow,
              }} />
              {/* Dot body */}
              <View style={{
                width: dotR * 2, height: dotR * 2,
                borderRadius: dotR,
                backgroundColor: C.dotColor,
              }}>
                {/* Dot highlight */}
                <View style={{
                  position: 'absolute',
                  left: dotR * 0.25, top: dotR * 0.2,
                  width: dotR * 0.7, height: dotR * 0.55,
                  borderRadius: dotR * 0.35,
                  backgroundColor: C.dotHighlight,
                }} />
              </View>
            </View>
          );
        })}
      </LinearGradient>
    </View>
  );
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
const randVal = (): number => Math.floor(Math.random() * 6) + 1;

const runAnim = (anim: Animated.CompositeAnimation): Promise<void> =>
  new Promise(resolve => anim.start(() => resolve()));

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
interface AnimatedDiceProps {
  onRollComplete?: (values: [number, number, number]) => void;
  size?: number;
  disabled?: boolean;
}

export default function AnimatedDice({ onRollComplete, size = DICE_SIZE, disabled = false }: AnimatedDiceProps) {
  const [displayVals, setDisplayVals] = useState<[number, number, number]>([4, 2, 5]);
  const [rolling, setRolling] = useState(false);
  const [showSum, setShowSum] = useState(false);
  const [sumCountVal, setSumCountVal] = useState(0);
  const rollingRef = useRef(false);

  // Per-die animations (stable refs)
  const posX = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const posY = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const rot  = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const sc   = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;
  const shOp = useRef([new Animated.Value(0.4), new Animated.Value(0.4), new Animated.Value(0.4)]).current;

  // Global fx
  const sumScale = useRef(new Animated.Value(0.3)).current;
  const sumOpacity = useRef(new Animated.Value(0)).current;
  const stageShake = useRef(new Animated.Value(0)).current;
  const glowOp = useRef(new Animated.Value(0)).current;

  // Idle breathing
  const breathY = useRef(new Animated.Value(0)).current;
  const idleAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    startIdle();
    return () => { idleAnimRef.current?.stop(); };
  }, []);

  const startIdle = () => {
    breathY.setValue(0);
    idleAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(breathY, { toValue: -4, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathY, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    idleAnimRef.current.start();
  };

  // ═══════════════════════════════════════
  // ROLL ANIMATION — 3 phases, promise-based
  // ═══════════════════════════════════════
  const rollDice = useCallback(async () => {
    if (rollingRef.current || disabled) return;
    rollingRef.current = true;
    setRolling(true);
    setShowSum(false);
    setSumCountVal(0);
    idleAnimRef.current?.stop();
    breathY.setValue(0);
    glowOp.setValue(0);
    sumOpacity.setValue(0);
    sumScale.setValue(0.3);

    [0,1,2].forEach(i => {
      posX[i].setValue(0); posY[i].setValue(0);
      rot[i].setValue(0); sc[i].setValue(1); shOp[i].setValue(0.4);
    });

    const v1 = randVal(), v2 = randVal(), v3 = randVal();
    const finalVals: [number, number, number] = [v1, v2, v3];

    // ═══ PHASE 1: SHAKE (550ms) ═══
    const flickerRef = { current: true };
    const runFlicker = async () => {
      for (let j = 0; j < 8 && flickerRef.current; j++) {
        setDisplayVals([randVal(), randVal(), randVal()]);
        await new Promise(r => setTimeout(r, 40));
      }
      for (let j = 0; j < 4 && flickerRef.current; j++) {
        setDisplayVals([randVal(), randVal(), randVal()]);
        await new Promise(r => setTimeout(r, 70));
      }
      for (let j = 0; j < 2 && flickerRef.current; j++) {
        setDisplayVals([randVal(), randVal(), randVal()]);
        await new Promise(r => setTimeout(r, 110));
      }
    };

    const shakeAnims = [0,1,2].map(i => {
      const amp = 7 + i * 2;
      return Animated.parallel([
        Animated.loop(
          Animated.sequence([
            Animated.timing(posX[i], { toValue: amp * (i % 2 === 0 ? 1 : -1), duration: 32, useNativeDriver: true }),
            Animated.timing(posX[i], { toValue: -amp * (i % 2 === 0 ? 1 : -1), duration: 32, useNativeDriver: true }),
          ]),
          { iterations: 8 }
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(posY[i], { toValue: -(5 + i * 2), duration: 38, useNativeDriver: true }),
            Animated.timing(posY[i], { toValue: (5 + i * 2), duration: 38, useNativeDriver: true }),
          ]),
          { iterations: 7 }
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(rot[i], { toValue: 15 * (i % 2 === 0 ? 1 : -1), duration: 38, useNativeDriver: true }),
            Animated.timing(rot[i], { toValue: -15 * (i % 2 === 0 ? 1 : -1), duration: 38, useNativeDriver: true }),
          ]),
          { iterations: 7 }
        ),
      ]);
    });

    await Promise.all([
      runAnim(Animated.parallel(shakeAnims)),
      runFlicker(),
    ]);
    flickerRef.current = false;

    // ═══ PHASE 2: TOSS & SETTLE (900ms) ═══
    [0,1,2].forEach(i => {
      posX[i].setValue(0); posY[i].setValue(0); rot[i].setValue(0);
    });

    const tossAnims = [0,1,2].map(i => {
      const jumpHeight = -(30 + i * 6);
      return Animated.parallel([
        Animated.timing(posX[i], { toValue: FINAL_X[i], duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(posY[i], { toValue: jumpHeight, duration: 270, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(posY[i], { toValue: 7, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(posY[i], { toValue: -12, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(posY[i], { toValue: 4, duration: 90, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(posY[i], { toValue: -5, duration: 75, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(posY[i], { toValue: 0, friction: 10, tension: 250, useNativeDriver: true }),
        ]),
        Animated.timing(rot[i], { toValue: 360 * (i % 2 === 0 ? 1 : -1), duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(sc[i], { toValue: 0.82, duration: 270, useNativeDriver: true }),
          Animated.timing(sc[i], { toValue: 1.1, duration: 110, useNativeDriver: true }),
          Animated.spring(sc[i], { toValue: 1, friction: 6, tension: 200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(shOp[i], { toValue: 0.08, duration: 270, useNativeDriver: true }),
          Animated.timing(shOp[i], { toValue: 0.5, duration: 320, useNativeDriver: true }),
        ]),
      ]);
    });

    const cameraShake = Animated.sequence([
      Animated.delay(320),
      Animated.timing(stageShake, { toValue: 5, duration: 30, useNativeDriver: true }),
      Animated.timing(stageShake, { toValue: -4, duration: 30, useNativeDriver: true }),
      Animated.timing(stageShake, { toValue: 3, duration: 25, useNativeDriver: true }),
      Animated.timing(stageShake, { toValue: -1, duration: 25, useNativeDriver: true }),
      Animated.timing(stageShake, { toValue: 0, duration: 20, useNativeDriver: true }),
    ]);

    setDisplayVals(finalVals);

    await runAnim(Animated.parallel([
      Animated.stagger(50, tossAnims),
      cameraShake,
    ]));

    // ═══ PHASE 3: REVEAL ═══
    Animated.sequence([
      Animated.timing(glowOp, { toValue: 0.9, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();

    setShowSum(true);
    Animated.parallel([
      Animated.spring(sumScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
      Animated.timing(sumOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const total = v1 + v2 + v3;
    const steps = Math.min(total, 10);
    for (let step = 1; step <= steps; step++) {
      await new Promise(r => setTimeout(r, 35));
      setSumCountVal(Math.round((step / steps) * total));
    }
    setSumCountVal(total);

    await new Promise(r => setTimeout(r, 300));
    rollingRef.current = false;
    setRolling(false);
    startIdle();
    onRollComplete?.(finalVals);
  }, [disabled]);

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <View style={styles.container}>
      {/* Sum display — gold badge */}
      {showSum && (
        <Animated.View style={[styles.sumBox, {
          opacity: sumOpacity,
          transform: [{ scale: sumScale }],
        }]}>
          <LinearGradient colors={[...C.sumGrad]} style={styles.sumCard}>
            <View style={styles.sumGloss} />
            <Text style={styles.sumText}>{sumCountVal}</Text>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Dice area with camera shake */}
      <Animated.View style={[styles.diceArea, {
        transform: [{ translateX: stageShake }],
      }]}>
        {[0, 1, 2].map(i => {
          const rotInterp = rot[i].interpolate({
            inputRange: [-360, 0, 360],
            outputRange: ['-360deg', '0deg', '360deg'],
          });
          const yVal = rollingRef.current ? posY[i] : Animated.add(posY[i], breathY);

          return (
            <Animated.View key={i} style={[styles.dieWrap, {
              transform: [
                { translateX: posX[i] },
                { translateY: yVal as any },
                { rotate: rotInterp as any },
                { scale: sc[i] },
              ],
            }]}>
              {/* Gold glow halo */}
              <Animated.View style={[styles.halo, { opacity: glowOp }]} />
              {/* Die face */}
              <GoldDieFace value={displayVals[i]} size={size} />
              {/* Ground shadow */}
              <Animated.View style={[styles.dieShadow, {
                opacity: shOp[i], width: size * 0.8,
              }]} />
            </Animated.View>
          );
        })}
      </Animated.View>

      {/* Roll button — gold gradient matching HTML */}
      <TouchableOpacity
        style={[(rolling || disabled) && styles.rollBtnDisabled]}
        onPress={rollDice}
        disabled={rolling || disabled}
        activeOpacity={0.8}
      >
        <View style={styles.rollBtnOuter}>
          <LinearGradient
            colors={[...C.btnGrad]}
            style={styles.rollBtn}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={styles.rollBtnText}>
              {rolling ? '🎲 מגלגל...' : '🎲 הטל קוביות'}
            </Text>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════════════════════════════
// STYLES
// ═══════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 14,
  },
  sumBox: {
    marginBottom: 4,
  },
  sumCard: {
    minWidth: 70,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
    borderBottomWidth: 4,
    borderBottomColor: C.sumShadow,
    ...Platform.select({
      ios: { shadowColor: C.sumShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  sumGloss: {
    position: 'absolute',
    top: 4, left: 8,
    width: 28, height: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 50,
    transform: [{ rotate: '-10deg' }],
  },
  sumText: {
    fontSize: 30,
    fontWeight: '900',
    color: C.sumText,
  },
  diceArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    gap: 12,
  },
  dieWrap: {
    alignItems: 'center',
  },
  halo: {
    position: 'absolute',
    top: -14, left: -14, right: -14, bottom: -14,
    borderRadius: 100,
    backgroundColor: C.haloColor,
  },
  dieShadow: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 50,
    marginTop: 4,
  },
  rollBtnOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    borderBottomWidth: 4,
    borderBottomColor: C.btnShadow,
    ...Platform.select({
      ios: { shadowColor: C.btnGlow, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  rollBtnDisabled: {
    opacity: 0.4,
  },
  rollBtn: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rollBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: C.btnText,
    letterSpacing: 2,
  },
});
