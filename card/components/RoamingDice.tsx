// RoamingDice.tsx — Pure React Native animated dice characters
// No WebView, no Canvas, no Three.js — just Animated API + Views
// ~33 view elements total, all animations on native thread

import React, { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { View, Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW, height: SH } = Dimensions.get('window');
const BODY = 40;
const PAD = 40;
const ROAM_MAX_Y = SH * 0.45;
const PIP_R = 3.5;

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.7], [0.7, 0.3]],
  3: [[0.3, 0.7], [0.5, 0.5], [0.7, 0.3]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.3, 0.26], [0.7, 0.26], [0.3, 0.5], [0.7, 0.5], [0.3, 0.74], [0.7, 0.74]],
};

const CONFIGS = [
  { face: 4, driftBase: 5000, startX: SW * 0.2, startY: SH * 0.12 },
  { face: 2, driftBase: 6500, startX: SW * 0.5, startY: SH * 0.28 },
  { face: 6, driftBase: 4500, startX: SW * 0.75, startY: SH * 0.18 },
];

// ── Single dice character with its own animations ──
interface DiceCharacterRef {
  summon: () => void;
  scatter: () => void;
}

const DiceCharacter = forwardRef<DiceCharacterRef, { config: typeof CONFIGS[0] }>(({ config }, ref) => {
  const mounted = useRef(true);
  const drifting = useRef(true);

  const driftX = useRef(new Animated.Value(config.startX)).current;
  const driftY = useRef(new Animated.Value(config.startY)).current;
  const walk = useRef(new Animated.Value(0)).current;
  const bobY = useRef(new Animated.Value(0)).current;
  const eyeX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const pips = PIPS[config.face] || PIPS[1];

  // Drift to random waypoints
  const startDrift = useCallback(() => {
    drifting.current = true;
    const drift = () => {
      if (!mounted.current || !drifting.current) return;
      const tx = PAD + Math.random() * (SW - PAD * 2);
      const ty = PAD + Math.random() * (ROAM_MAX_Y - PAD);
      const dur = config.driftBase + (Math.random() - 0.5) * 3000;
      Animated.parallel([
        Animated.timing(driftX, { toValue: tx, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(driftY, { toValue: ty, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) drift(); });
    };
    drift();
  }, []);

  useEffect(() => {
    startDrift();
    // Walk cycle
    Animated.loop(
      Animated.timing(walk, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true })
    ).start();
    // Bob
    Animated.loop(Animated.sequence([
      Animated.timing(bobY, { toValue: -4, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bobY, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    // Eyes
    Animated.loop(Animated.sequence([
      Animated.timing(eyeX, { toValue: -1.5, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(eyeX, { toValue: 1.5, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(400),
    ])).start();
    return () => { mounted.current = false; };
  }, []);

  useImperativeHandle(ref, () => ({
    summon: () => {
      drifting.current = false;
      driftX.stopAnimation();
      driftY.stopAnimation();
      Animated.parallel([
        Animated.timing(driftX, { toValue: SW / 2 - BODY / 2, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(driftY, { toValue: SH * 0.3, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 350, delay: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.4, duration: 500, useNativeDriver: true }),
      ]).start();
    },
    scatter: () => {
      const edge = Math.floor(Math.random() * 4);
      let sx: number, sy: number;
      if (edge === 0) { sx = -BODY; sy = Math.random() * ROAM_MAX_Y; }
      else if (edge === 1) { sx = SW + BODY; sy = Math.random() * ROAM_MAX_Y; }
      else if (edge === 2) { sx = Math.random() * SW; sy = -BODY; }
      else { sx = Math.random() * SW; sy = ROAM_MAX_Y + BODY; }
      driftX.setValue(sx);
      driftY.setValue(sy);
      scale.setValue(1);
      Animated.timing(opacity, { toValue: 0.55, duration: 400, useNativeDriver: true }).start(() => startDrift());
    },
  }));

  // Interpolated limb rotations
  const leftLegRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['-12deg', '0deg', '12deg', '0deg', '-12deg'] });
  const rightLegRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['12deg', '0deg', '-12deg', '0deg', '12deg'] });
  const leftArmRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['10deg', '0deg', '-15deg', '0deg', '10deg'] });
  const rightArmRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['-10deg', '0deg', '15deg', '0deg', '-10deg'] });

  const combinedY = Animated.add(driftY, bobY);

  return (
    <Animated.View style={{
      position: 'absolute',
      opacity,
      transform: [{ translateX: driftX }, { translateY: combinedY as any }, { scale }],
    }}>
      {/* Shadow */}
      <View style={st.shadow} />

      {/* Left leg (pivot at top) */}
      <Animated.View style={[st.legPivotL, { transform: [{ rotate: leftLegRot as any }] }]}>
        <View style={st.leg} />
      </Animated.View>
      {/* Right leg */}
      <Animated.View style={[st.legPivotR, { transform: [{ rotate: rightLegRot as any }] }]}>
        <View style={st.leg} />
      </Animated.View>

      {/* Left arm (pivot at top) */}
      <Animated.View style={[st.armPivotL, { transform: [{ rotate: leftArmRot as any }] }]}>
        <View style={st.arm} />
      </Animated.View>
      {/* Right arm */}
      <Animated.View style={[st.armPivotR, { transform: [{ rotate: rightArmRot as any }] }]}>
        <View style={st.arm} />
      </Animated.View>

      {/* Body — golden rounded rect */}
      <View style={st.body}>
        <LinearGradient
          colors={['#FFD54F', '#F5C842', '#D4A520']}
          style={{ width: BODY, height: BODY }}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          {/* Shine highlight */}
          <View style={st.shine} />
          {/* Pips */}
          {pips.map(([px, py], i) => (
            <View key={i} style={[st.pip, { left: px * BODY - PIP_R, top: py * BODY - PIP_R }]} />
          ))}
        </LinearGradient>
      </View>

      {/* Eyes — googly with animated pupils */}
      <View style={st.eyeRow}>
        <View style={st.eyeWhite}>
          <Animated.View style={[st.pupil, { transform: [{ translateX: eyeX }] }]} />
        </View>
        <View style={st.eyeWhite}>
          <Animated.View style={[st.pupil, { transform: [{ translateX: eyeX }] }]} />
        </View>
      </View>
    </Animated.View>
  );
});
DiceCharacter.displayName = 'DiceCharacter';

// ── Parent component managing all 3 dice ──
export interface RoamingDiceRef {
  summon: () => void;
  scatter: () => void;
}

const RoamingDiceComponent = forwardRef<RoamingDiceRef, {}>((_, ref) => {
  const d0 = useRef<DiceCharacterRef>(null);
  const d1 = useRef<DiceCharacterRef>(null);
  const d2 = useRef<DiceCharacterRef>(null);

  useImperativeHandle(ref, () => ({
    summon: () => { d0.current?.summon(); d1.current?.summon(); d2.current?.summon(); },
    scatter: () => { d0.current?.scatter(); d1.current?.scatter(); d2.current?.scatter(); },
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <DiceCharacter ref={d0} config={CONFIGS[0]} />
      <DiceCharacter ref={d1} config={CONFIGS[1]} />
      <DiceCharacter ref={d2} config={CONFIGS[2]} />
    </View>
  );
});
RoamingDiceComponent.displayName = 'RoamingDice';
export const RoamingDice = RoamingDiceComponent;

// ── Styles ──
const st = StyleSheet.create({
  shadow: {
    position: 'absolute', top: BODY + 14, left: BODY * 0.15,
    width: BODY * 0.7, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  // Leg pivots — 3px wide, 0 height so transform origin is at the joint
  legPivotL: {
    position: 'absolute', top: BODY - 2, left: BODY * 0.25 - 1.5,
    width: 3, height: 0, overflow: 'visible',
  },
  legPivotR: {
    position: 'absolute', top: BODY - 2, left: BODY * 0.65 - 1.5,
    width: 3, height: 0, overflow: 'visible',
  },
  leg: {
    width: 3, height: 18, backgroundColor: '#444', borderRadius: 1.5,
  },
  // Arm pivots
  armPivotL: {
    position: 'absolute', top: BODY * 0.35, left: -1.25,
    width: 2.5, height: 0, overflow: 'visible',
  },
  armPivotR: {
    position: 'absolute', top: BODY * 0.35, left: BODY - 1.25,
    width: 2.5, height: 0, overflow: 'visible',
  },
  arm: {
    width: 2.5, height: 14, backgroundColor: '#444', borderRadius: 1.25,
  },
  body: {
    width: BODY, height: BODY, borderRadius: 8,
    overflow: 'hidden', borderWidth: 2, borderColor: '#B8860B',
  },
  shine: {
    position: 'absolute', top: 2, left: 2,
    width: BODY - 4, height: BODY * 0.4,
    borderRadius: 6, backgroundColor: 'rgba(255,245,200,0.35)',
  },
  pip: {
    position: 'absolute',
    width: PIP_R * 2, height: PIP_R * 2, borderRadius: PIP_R,
    backgroundColor: '#333', opacity: 0.8,
  },
  eyeRow: {
    position: 'absolute', top: -10, left: 0, width: BODY,
    flexDirection: 'row', justifyContent: 'center', gap: BODY * 0.12,
  },
  eyeWhite: {
    width: 9, height: 10, borderRadius: 5,
    backgroundColor: '#fff', borderWidth: 0.6, borderColor: '#bbb',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  pupil: {
    width: 4.4, height: 4.4, borderRadius: 2.2, backgroundColor: '#333',
  },
});
