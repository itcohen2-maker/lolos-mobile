import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playSfx } from '../src/audio/sfx';

// Drop positions matching the HTML (dx/dy in px, from bottom-center of fill)
const DROP_CONFIGS = [
  { dx: -22, dy: -50 },
  { dx: -8,  dy: -65 },
  { dx: 14,  dy: -55 },
  { dx: 25,  dy: -44 },
  { dx: 0,   dy: -72 },
] as const;

type Props = {
  value: number;       // 0 | 33 | 66 — percent (100 resets to 0 in reducer)
  compact?: boolean;
  pulseKey?: number;   // increments every time the meter advances one step
  isCelebrating?: boolean; // true on the turn the meter filled and gave coins
  onPress?: () => void;
  title?: string;
  height?: number;
};

export default function ExcellenceMeter({
  value,
  compact = false,
  pulseKey,
  isCelebrating = false,
  onPress,
}: Props) {
  const W = compact ? 45 : 55;
  const H = compact ? 80 : 110;

  // ── fill (non-native, height in px) ──────────────────────────────
  const fillPx  = useRef(new Animated.Value((value / 100) * H)).current;

  // ── squash / stretch / jump ───────────────────────────────────────
  const scaleX   = useRef(new Animated.Value(1)).current;
  const scaleY   = useRef(new Animated.Value(1)).current;
  const transY   = useRef(new Animated.Value(0)).current;
  const rot      = useRef(new Animated.Value(0)).current;   // degrees × 10 (mapped below)
  const glow     = useRef(new Animated.Value(0)).current;

  // ── party overlay (celebration color flash) ───────────────────────
  const party    = useRef(new Animated.Value(0)).current;

  // ── splash drops ─────────────────────────────────────────────────
  const drops = useRef(
    DROP_CONFIGS.map(() => ({
      x:   new Animated.Value(0),
      y:   new Animated.Value(0),
      op:  new Animated.Value(0),
    }))
  ).current;

  const prevPulse = useRef<number | undefined>(undefined);
  const prevValue = useRef(value);

  // ── helpers ───────────────────────────────────────────────────────
  const t = (toValue: number, duration: number) =>
    (anim: Animated.Value) =>
      Animated.timing(anim, { toValue, duration, useNativeDriver: true, easing: Easing.linear });

  const animFill = useCallback((toPct: number, dur = 420) => {
    Animated.timing(fillPx, {
      toValue: (toPct / 100) * H,
      duration: dur,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fillPx, H]);

  const fireSplash = useCallback((extraDelay: number) => {
    drops.forEach((d, i) => {
      const { dx, dy } = DROP_CONFIGS[i];
      d.op.setValue(0); d.x.setValue(0); d.y.setValue(0);
      const delay = extraDelay + 200 + i * 30;
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(d.op, { toValue: 1,        duration: 225, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(d.x,  { toValue: dx * 0.4, duration: 225, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(d.y,  { toValue: dy * 0.4, duration: 225, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        ]),
        Animated.parallel([
          Animated.timing(d.op, { toValue: 0,        duration: 675, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
          Animated.timing(d.x,  { toValue: dx,       duration: 675, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
          Animated.timing(d.y,  { toValue: dy * 0.1, duration: 675, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        ]),
      ]).start();
    });
  }, [drops]);

  // ── Regular bounce (one step up) ─────────────────────────────────
  const playBounce = useCallback(() => {
    [scaleX, scaleY, transY, glow].forEach(a => a.stopAnimation());
    scaleX.setValue(1); scaleY.setValue(1); transY.setValue(0); glow.setValue(0);

    fireSplash(0);
    Animated.sequence([
      Animated.parallel([t(1.12, 170)(scaleX), t(0.78, 170)(scaleY)]),                              // squash
      Animated.parallel([t(0.92, 250)(scaleX), t(1.18, 250)(scaleY), t(-18, 250)(transY), t(1, 250)(glow)]), // jump
      Animated.parallel([t(1.06, 280)(scaleX), t(0.94, 280)(scaleY), t(0,   280)(transY), t(0, 280)(glow)]), // land
      Animated.parallel([t(1,    250)(scaleX), t(1,    250)(scaleY)]),                               // settle
    ]).start();
  }, [scaleX, scaleY, transY, glow, fireSplash]);

  // ── Celebration (meter filled → double-jump + party) ─────────────
  const playCelebrate = useCallback(() => {
    void playSfx('meterCelebrate', { cooldownMs: 500, volumeOverride: 0.85 });
    [scaleX, scaleY, transY, rot, glow, party].forEach(a => a.stopAnimation());
    scaleX.setValue(1); scaleY.setValue(1); transY.setValue(0); rot.setValue(0); glow.setValue(0); party.setValue(0);

    fireSplash(220);
    fireSplash(900);

    Animated.parallel([
      // squash/stretch sequence
      Animated.sequence([
        Animated.parallel([t(1.22, 136)(scaleX), t(0.62, 136)(scaleY)]),                                          // deep squash
        Animated.parallel([t(0.86, 238)(scaleX), t(1.28, 238)(scaleY), t(-28, 238)(transY), t(-3, 238)(rot)]),    // jump 1
        Animated.parallel([t(1.14, 204)(scaleX), t(0.78, 204)(scaleY), t(0,   204)(transY), t(2,  204)(rot)]),    // land
        Animated.parallel([t(1.18, 170)(scaleX), t(0.70, 170)(scaleY), t(0,   170)(transY), t(-2, 170)(rot)]),    // re-squash
        Animated.parallel([t(0.90, 238)(scaleX), t(1.22, 238)(scaleY), t(-22, 238)(transY), t(3,  238)(rot)]),    // jump 2
        Animated.parallel([t(1.08, 238)(scaleX), t(0.92, 238)(scaleY), t(0,   238)(transY), t(-1, 238)(rot)]),    // land
        Animated.parallel([t(1.04, 170)(scaleX), t(0.96, 170)(scaleY), t(0,   170)(transY), t(1,  170)(rot)]),    // tiny shake
        Animated.parallel([t(1,    136)(scaleX), t(1,    136)(scaleY), t(0,   136)(transY), t(0,  136)(rot)]),    // settle
      ]),
      // party color overlay: fade in → out
      Animated.sequence([
        Animated.timing(party, { toValue: 1, duration: 850, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(party, { toValue: 0, duration: 850, useNativeDriver: true, easing: Easing.linear }),
      ]),
    ]).start(() => {
      // After celebration settle fill back to 0
      animFill(0, 600);
    });

    // Fill to 100% on first apex
    setTimeout(() => animFill(100, 300), 280);
  }, [scaleX, scaleY, transY, rot, glow, party, fireSplash, animFill]);

  // ── Trigger on pulseKey change ────────────────────────────────────
  useEffect(() => {
    if (pulseKey === undefined || pulseKey === prevPulse.current) {
      prevValue.current = value;
      return;
    }
    prevPulse.current = pulseKey;

    // Detect celebration: meter stepped from 66 → reset to 0 (isCelebrating flag)
    const celebrate = isCelebrating || (prevValue.current === 66 && value === 0);
    prevValue.current = value;

    if (celebrate) {
      playCelebrate();
    } else {
      animFill(value, 420);
      playBounce();
    }
  }, [pulseKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync fill on plain value change (no bounce) ───────────────────
  useEffect(() => {
    if (pulseKey === prevPulse.current) {
      animFill(value, 520);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const rotDeg = rot.interpolate({ inputRange: [-5, 5], outputRange: ['-5deg', '5deg'] });
  const glowOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

  const tapScale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    void playSfx('meterCelebrate', { cooldownMs: 0, volumeOverride: 0.85 });
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 0.82, duration: 90, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(tapScale, { toValue: 1.08, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(tapScale, { toValue: 1, duration: 160, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
    ]).start();
    onPress?.();
  }, [onPress, tapScale]);

  return (
    <TouchableOpacity activeOpacity={1} onPress={handlePress} style={{ alignItems: 'center' }}>
    <Animated.View style={{ transform: [{ scale: tapScale }], alignItems: 'center' }}>
      <Animated.View
        style={{
          width: W,
          height: H,
          // transform-origin: 50% 100% (bottom-center) emulation:
          // shift up by H/2 so transforms apply from bottom, then shift back
          transform: [
            { translateY: H / 2 },
            { scaleX },
            { scaleY },
            { translateY: Animated.add(new Animated.Value(-H / 2), transY) as any },
            { rotate: rotDeg },
          ],
        }}
      >
        {/* Glass */}
        <View style={[styles.glass, { width: W, height: H }]}>
          {/* Pulse glow */}
          <Animated.View style={[styles.pulseGlow, { opacity: glowOp }]} />

          {/* Fill */}
          <Animated.View style={[styles.fillWrap, { height: fillPx }]}>
            <LinearGradient
              colors={['#16A34A', '#22C55E', '#7CFC00']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0.65, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.wave} />
            <View style={styles.fillShine} />
            {/* Party flash overlay */}
            <Animated.View
              style={[StyleSheet.absoluteFillObject, { opacity: party, backgroundColor: 'rgba(255,190,80,0.45)' }]}
            />
          </Animated.View>

          <View style={styles.gloss} />
        </View>

        {/* Splash drops — absolutely outside glass, inside Animated.View */}
        {drops.map((d, i) => (
          <Animated.View
            key={i}
            style={[
              styles.drop,
              {
                bottom: H * 0.35,
                left: W / 2 - 3,
                opacity: d.op,
                transform: [{ translateX: d.x }, { translateY: d.y }],
              },
            ]}
          />
        ))}
      </Animated.View>
    </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(203,213,225,0.9)',
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
  },
  pulseGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'rgba(134,239,172,0.25)',
  },
  fillWrap: {
    width: '100%',
    justifyContent: 'flex-end',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'visible',
  },
  wave: {
    position: 'absolute',
    top: -4,
    left: 0,
    right: 0,
    height: 8,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    backgroundColor: 'rgba(187,247,208,0.45)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(240,253,244,0.8)',
  },
  fillShine: {
    position: 'absolute',
    right: 5,
    top: 6,
    width: 7,
    height: 26,
    borderRadius: 4,
    backgroundColor: 'rgba(240,253,244,0.32)',
  },
  gloss: {
    position: 'absolute',
    left: 6,
    top: 8,
    width: 6,
    height: '72%',
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  drop: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#BBF7D0',
  },
});
