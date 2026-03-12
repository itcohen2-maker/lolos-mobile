// WalkingDice.tsx — Dice characters that spawn at one edge, walk across, and despawn
// Pure React Native Animated API — no WebView, no Canvas
// Spawns every 20-40s, max 2 on screen, pauses when app is backgrounded

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, Animated, Easing, Dimensions, StyleSheet, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW, height: SH } = Dimensions.get('window');
const BODY = 36;
const PIP_R = 3;

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.7], [0.7, 0.3]],
  3: [[0.3, 0.7], [0.5, 0.5], [0.7, 0.3]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.3, 0.26], [0.7, 0.26], [0.3, 0.5], [0.7, 0.5], [0.3, 0.74], [0.7, 0.74]],
};

const FACES = [1, 2, 3, 4, 5, 6];

// ── Single walking dice that crosses the screen ──
interface WalkerProps {
  id: number;
  onDone: (id: number) => void;
}

function Walker({ id, onDone }: WalkerProps) {
  const mounted = useRef(true);
  const face = useRef(FACES[Math.floor(Math.random() * FACES.length)]).current;
  const goingRight = useRef(Math.random() > 0.5).current;
  const yPos = useRef(80 + Math.random() * (SH - 200)).current;
  const pips = PIPS[face];

  // הליכה איטית יותר — 28–38 שניות לחצייה, פחות "נעלמים פתאום"
  const walkDuration = useRef(28000 + Math.random() * 10000).current;

  const posX = useRef(new Animated.Value(goingRight ? -BODY - 20 : SW + 20)).current;
  const walk = useRef(new Animated.Value(0)).current;
  const bobY = useRef(new Animated.Value(0)).current;
  const eyeX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // סיבוב גוף מתמשך — הקובייה מסתובבת תוך כדי הליכה
  const spin = useRef(new Animated.Value(0)).current;

  // Behavior state
  const behaviorRot = useRef(new Animated.Value(0)).current;
  const behaviorY = useRef(new Animated.Value(0)).current;
  const waveRot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(opacity, { toValue: 0.6, duration: 400, useNativeDriver: true }).start();

    // Walk cycle (legs)
    Animated.loop(
      Animated.timing(walk, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // סיבוב מתמשך — לופ ארוך (כ־4 שניות סיבוב אחד) כדי שלא ייעלמו פתאום
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Bob up and down
    Animated.loop(Animated.sequence([
      Animated.timing(bobY, { toValue: -3, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bobY, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Eyes look around
    Animated.loop(Animated.sequence([
      Animated.timing(eyeX, { toValue: goingRight ? 1.5 : -1.5, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(800),
      Animated.timing(eyeX, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(600),
    ])).start();

    // Main walk across screen — איטי יותר
    const targetX = goingRight ? SW + 20 : -BODY - 20;
    Animated.timing(posX, {
      toValue: targetX,
      duration: walkDuration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && mounted.current) onDone(id);
    });

    // Random behavior: trip or wave (30% chance each, triggered once mid-walk)
    const behaviorDelay = 2000 + Math.random() * (walkDuration - 4000);
    const roll = Math.random();
    const behaviorTimer = setTimeout(() => {
      if (!mounted.current) return;
      if (roll < 0.3) triggerTrip();
      else if (roll < 0.6) triggerWave();
    }, behaviorDelay);

    return () => {
      mounted.current = false;
      clearTimeout(behaviorTimer);
    };
  }, []);

  const triggerTrip = useCallback(() => {
    // Tilt forward, pause, recover
    Animated.sequence([
      Animated.timing(behaviorRot, { toValue: 25, duration: 150, useNativeDriver: true }),
      Animated.timing(behaviorY, { toValue: 8, duration: 100, useNativeDriver: true }),
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(behaviorRot, { toValue: 0, duration: 300, easing: Easing.bounce, useNativeDriver: true }),
        Animated.timing(behaviorY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const triggerWave = useCallback(() => {
    // Wave one arm
    Animated.sequence([
      Animated.timing(waveRot, { toValue: -45, duration: 200, useNativeDriver: true }),
      Animated.timing(waveRot, { toValue: -30, duration: 150, useNativeDriver: true }),
      Animated.timing(waveRot, { toValue: -50, duration: 150, useNativeDriver: true }),
      Animated.timing(waveRot, { toValue: -30, duration: 150, useNativeDriver: true }),
      Animated.timing(waveRot, { toValue: -50, duration: 150, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(waveRot, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  // Limb interpolations
  const leftLegRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['-14deg', '0deg', '14deg', '0deg', '-14deg'] });
  const rightLegRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['14deg', '0deg', '-14deg', '0deg', '14deg'] });
  const leftArmRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['12deg', '0deg', '-18deg', '0deg', '12deg'] });
  const rightArmRot = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['-12deg', '0deg', '18deg', '0deg', '-12deg'] });

  const bodyRotDeg = behaviorRot.interpolate({ inputRange: [0, 25], outputRange: ['0deg', '25deg'] });
  // סיבוב קובייה: 0→360deg בלופ
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Wave arm: walk rotation (numeric) + wave offset combined
  const rightArmNumeric = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [-12, 0, 18, 0, -12] });
  const leftArmNumeric = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [12, 0, -18, 0, 12] });
  const rightWaveArm = Animated.add(rightArmNumeric, waveRot);
  const leftWaveArm = Animated.add(leftArmNumeric, waveRot);
  // Convert combined numeric to degree string
  const rightWaveArmDeg = (rightWaveArm as any).interpolate({ inputRange: [-70, 70], outputRange: ['-70deg', '70deg'] });
  const leftWaveArmDeg = (leftWaveArm as any).interpolate({ inputRange: [-70, 70], outputRange: ['-70deg', '70deg'] });

  const combinedY = Animated.add(bobY, behaviorY);
  const flipX = goingRight ? 1 : -1;

  return (
    <Animated.View style={{
      position: 'absolute',
      top: yPos,
      opacity,
      transform: [
        { translateX: posX },
        { translateY: combinedY as any },
        { scaleX: flipX },
      ],
    }}>
      <Animated.View style={{ transform: [{ rotate: spinDeg as any }, { rotate: bodyRotDeg as any }] }}>
        {/* Shadow */}
        <View style={ws.shadow} />

        {/* Left leg */}
        <Animated.View style={[ws.legPivotL, { transform: [{ rotate: leftLegRot as any }] }]}>
          <View style={ws.leg} />
        </Animated.View>
        {/* Right leg */}
        <Animated.View style={[ws.legPivotR, { transform: [{ rotate: rightLegRot as any }] }]}>
          <View style={ws.leg} />
        </Animated.View>

        {/* Left arm — wave combined when going left */}
        <Animated.View style={[ws.armPivotL, { transform: [{ rotate: goingRight ? (leftArmRot as any) : (leftWaveArmDeg as any) }] }]}>
          <View style={ws.arm} />
        </Animated.View>
        {/* Right arm — wave combined when going right */}
        <Animated.View style={[ws.armPivotR, { transform: [{ rotate: goingRight ? (rightWaveArmDeg as any) : (rightArmRot as any) }] }]}>
          <View style={ws.arm} />
        </Animated.View>

        {/* Body */}
        <View style={ws.body}>
          <LinearGradient
            colors={['#FFD54F', '#F5C842', '#D4A520']}
            style={{ width: BODY, height: BODY }}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <View style={ws.shine} />
            {pips.map(([px, py], i) => (
              <View key={i} style={[ws.pip, { left: px * BODY - PIP_R, top: py * BODY - PIP_R }]} />
            ))}
          </LinearGradient>
        </View>

        {/* Eyes */}
        <View style={ws.eyeRow}>
          <View style={ws.eyeWhite}>
            <Animated.View style={[ws.pupil, { transform: [{ translateX: eyeX }] }]} />
          </View>
          <View style={ws.eyeWhite}>
            <Animated.View style={[ws.pupil, { transform: [{ translateX: eyeX }] }]} />
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ── Spawner: manages walker lifecycle ──
export function WalkingDice() {
  const [walkers, setWalkers] = useState<number[]>([]);
  const nextId = useRef(0);
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);
  const mountedRef = useRef(true);

  const removeWalker = useCallback((id: number) => {
    if (!mountedRef.current) return;
    setWalkers(prev => prev.filter(w => w !== id));
  }, []);

  const spawnOne = useCallback(() => {
    if (!mountedRef.current || !activeRef.current) return;
    setWalkers(prev => {
      if (prev.length >= 4) return prev; // עד 4 קוביות על המסך
      const id = nextId.current++;
      return [...prev, id];
    });
  }, []);

  const scheduleNext = useCallback(() => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    if (!activeRef.current || !mountedRef.current) return;
    const delay = 3000 + Math.random() * 4000; // 3-7s — לופ תכוף יותר שלא ייעלמו
    spawnTimer.current = setTimeout(() => {
      spawnOne();
      scheduleNext();
    }, delay);
  }, [spawnOne]);

  useEffect(() => {
    // הופעה ראשונה מהר יותר, ואז לופ רציף
    const initial = setTimeout(() => {
      spawnOne();
      spawnOne(); // שניים בהתחלה
      scheduleNext();
    }, 1500);

    // Pause/resume on app state change
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        activeRef.current = true;
        scheduleNext();
      } else {
        activeRef.current = false;
        if (spawnTimer.current) clearTimeout(spawnTimer.current);
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(initial);
      if (spawnTimer.current) clearTimeout(spawnTimer.current);
      sub.remove();
    };
  }, [spawnOne, scheduleNext]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {walkers.map(id => (
        <Walker key={id} id={id} onDone={removeWalker} />
      ))}
    </View>
  );
}

// ── Styles ──
const ws = StyleSheet.create({
  shadow: {
    position: 'absolute', top: BODY + 12, left: BODY * 0.15,
    width: BODY * 0.7, height: 7, borderRadius: 3.5,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  legPivotL: {
    position: 'absolute', top: BODY - 2, left: BODY * 0.25 - 1.5,
    width: 3, height: 0, overflow: 'visible',
  },
  legPivotR: {
    position: 'absolute', top: BODY - 2, left: BODY * 0.65 - 1.5,
    width: 3, height: 0, overflow: 'visible',
  },
  leg: {
    width: 3, height: 16, backgroundColor: '#444', borderRadius: 1.5,
  },
  armPivotL: {
    position: 'absolute', top: BODY * 0.35, left: -1.25,
    width: 2.5, height: 0, overflow: 'visible',
  },
  armPivotR: {
    position: 'absolute', top: BODY * 0.35, left: BODY - 1.25,
    width: 2.5, height: 0, overflow: 'visible',
  },
  arm: {
    width: 2.5, height: 12, backgroundColor: '#444', borderRadius: 1.25,
  },
  body: {
    width: BODY, height: BODY, borderRadius: 7,
    overflow: 'hidden', borderWidth: 1.5, borderColor: '#B8860B',
  },
  shine: {
    position: 'absolute', top: 2, left: 2,
    width: BODY - 4, height: BODY * 0.4,
    borderRadius: 5, backgroundColor: 'rgba(255,245,200,0.35)',
  },
  pip: {
    position: 'absolute',
    width: PIP_R * 2, height: PIP_R * 2, borderRadius: PIP_R,
    backgroundColor: '#333', opacity: 0.8,
  },
  eyeRow: {
    position: 'absolute', top: -9, left: 0, width: BODY,
    flexDirection: 'row', justifyContent: 'center', gap: BODY * 0.12,
  },
  eyeWhite: {
    width: 8, height: 9, borderRadius: 4.5,
    backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#bbb',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  pupil: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: '#333',
  },
});
