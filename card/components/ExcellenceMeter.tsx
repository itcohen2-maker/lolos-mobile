import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playSfx } from '../src/audio/sfx';

const COIN_IMG = require('../assets/slinda_coin_nobg.png');

const COIN_BURST_CONFIGS = [
  { dx: -34, dy: -40, size: 12, spin: -18 },
  { dx: -18, dy: -58, size: 10, spin: 12 },
  { dx: 0, dy: -70, size: 14, spin: -10 },
  { dx: 20, dy: -54, size: 10, spin: 16 },
  { dx: 36, dy: -34, size: 12, spin: -14 },
  { dx: -8, dy: -84, size: 9, spin: 9 },
] as const;

type Props = {
  value: number;
  compact?: boolean;
  pulseKey?: number;
  isCelebrating?: boolean;
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

  const fillPx = useRef(new Animated.Value((value / 100) * H)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;
  const transY = useRef(new Animated.Value(0)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const party = useRef(new Animated.Value(0)).current;

  const burstCoins = useRef(
    COIN_BURST_CONFIGS.map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      op: new Animated.Value(0),
      s: new Animated.Value(0.45),
      r: new Animated.Value(0),
    }))
  ).current;

  const prevPulse = useRef<number | undefined>(undefined);
  const prevValue = useRef(value);
  const tapScale = useRef(new Animated.Value(1)).current;

  const t = (toValue: number, duration: number) =>
    (anim: Animated.Value) =>
      Animated.timing(anim, {
        toValue,
        duration,
        useNativeDriver: true,
        easing: Easing.linear,
      });

  const animFill = useCallback((toPct: number, dur = 420) => {
    Animated.timing(fillPx, {
      toValue: (toPct / 100) * H,
      duration: dur,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fillPx, H]);

  const fireCoinBurst = useCallback((extraDelay: number) => {
    burstCoins.forEach((coin, i) => {
      const { dx, dy, spin } = COIN_BURST_CONFIGS[i];
      coin.op.setValue(0);
      coin.x.setValue(0);
      coin.y.setValue(8);
      coin.s.setValue(0.45);
      coin.r.setValue(0);

      Animated.sequence([
        Animated.delay(extraDelay + 60 + i * 35),
        Animated.parallel([
          Animated.timing(coin.op, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(coin.x, {
            toValue: dx * 0.38,
            duration: 220,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(coin.y, {
            toValue: dy * 0.52,
            duration: 220,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(coin.s, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
            easing: Easing.out(Easing.back(1.6)),
          }),
          Animated.timing(coin.r, {
            toValue: spin * 0.5,
            duration: 220,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]),
        Animated.parallel([
          Animated.timing(coin.op, {
            toValue: 0,
            duration: 460,
            useNativeDriver: true,
            easing: Easing.in(Easing.quad),
          }),
          Animated.timing(coin.x, {
            toValue: dx,
            duration: 460,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
          Animated.timing(coin.y, {
            toValue: dy * 0.1,
            duration: 460,
            useNativeDriver: true,
            easing: Easing.in(Easing.quad),
          }),
          Animated.timing(coin.s, {
            toValue: 0.74,
            duration: 460,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
          Animated.timing(coin.r, {
            toValue: spin,
            duration: 460,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
        ]),
      ]).start();
    });
  }, [burstCoins]);

  const playBounce = useCallback(() => {
    void playSfx('meterBounce', { cooldownMs: 0, volumeOverride: 0.5 });
    [scaleX, scaleY, transY, glow].forEach((a) => a.stopAnimation());
    scaleX.setValue(1);
    scaleY.setValue(1);
    transY.setValue(0);
    glow.setValue(0);

    Animated.sequence([
      Animated.parallel([t(1.08, 150)(scaleX), t(0.84, 150)(scaleY)]),
      Animated.parallel([t(0.96, 220)(scaleX), t(1.1, 220)(scaleY), t(-14, 220)(transY), t(1, 220)(glow)]),
      Animated.parallel([t(1.03, 220)(scaleX), t(0.97, 220)(scaleY), t(0, 220)(transY), t(0, 220)(glow)]),
      Animated.parallel([t(1, 180)(scaleX), t(1, 180)(scaleY)]),
    ]).start();
  }, [glow, scaleX, scaleY, transY]);

  const playCelebrate = useCallback(() => {
    void playSfx('meterCelebrate', { cooldownMs: 0, volumeOverride: 1.0 });
    [scaleX, scaleY, transY, rot, glow, party].forEach((a) => a.stopAnimation());
    scaleX.setValue(1);
    scaleY.setValue(1);
    transY.setValue(0);
    rot.setValue(0);
    glow.setValue(0);
    party.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.parallel([t(1.24, 140)(scaleX), t(0.58, 140)(scaleY)]),
        Animated.parallel([t(0.9, 240)(scaleX), t(1.22, 240)(scaleY), t(-16, 240)(transY), t(-2, 240)(rot), t(1, 240)(glow)]),
        Animated.parallel([t(1.02, 180)(scaleX), t(0.98, 180)(scaleY), t(0, 180)(transY), t(0, 180)(rot), t(0.45, 180)(glow)]),
        Animated.parallel([t(0.96, 150)(scaleX), t(1.06, 150)(scaleY), t(-8, 150)(transY), t(1, 150)(rot)]),
        Animated.parallel([t(1, 210)(scaleX), t(1, 210)(scaleY), t(0, 210)(transY), t(0, 210)(rot), t(0, 210)(glow)]),
      ]),
      Animated.sequence([
        Animated.timing(party, { toValue: 1, duration: 520, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(party, { toValue: 0, duration: 420, useNativeDriver: true, easing: Easing.linear }),
      ]),
    ]).start(() => {
      animFill(0, 600);
    });

    setTimeout(() => animFill(100, 360), 140);
    setTimeout(() => fireCoinBurst(0), 760);
  }, [animFill, fireCoinBurst, glow, party, rot, scaleX, scaleY, transY]);

  useEffect(() => {
    if (pulseKey === undefined || pulseKey === prevPulse.current) {
      prevValue.current = value;
      return;
    }
    prevPulse.current = pulseKey;
    const celebrate = isCelebrating || (prevValue.current === 66 && value === 0);
    prevValue.current = value;
    if (celebrate) {
      playCelebrate();
    } else {
      animFill(value, 420);
      playBounce();
    }
  }, [pulseKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pulseKey === prevPulse.current) {
      animFill(value, 520);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const rotDeg = rot.interpolate({ inputRange: [-5, 5], outputRange: ['-5deg', '5deg'] });
  const glowOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

  const handlePress = useCallback(() => {
    void playSfx('meterBounce', { cooldownMs: 0, volumeOverride: 0.85 });
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
            transform: [
              { translateY: H / 2 },
              { scaleX },
              { scaleY },
              { translateY: Animated.add(new Animated.Value(-H / 2), transY) as any },
              { rotate: rotDeg },
            ],
          }}
        >
          <View style={[styles.glass, { width: W, height: H }]}>
            <Animated.View style={[styles.pulseGlow, { opacity: glowOp }]} />

            <Animated.View style={[styles.fillWrap, { height: fillPx }]}>
              <LinearGradient
                colors={['#16A34A', '#22C55E', '#7CFC00']}
                start={{ x: 0, y: 1 }}
                end={{ x: 0.65, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.wave} />
              <View style={styles.fillShine} />
              <Animated.View
                style={[StyleSheet.absoluteFillObject, { opacity: party, backgroundColor: 'rgba(255,190,80,0.45)' }]}
              />
            </Animated.View>

            <View style={styles.gloss} />
          </View>

          {burstCoins.map((coin, i) => {
            const size = COIN_BURST_CONFIGS[i].size;
            const rotation = coin.r.interpolate({
              inputRange: [-30, 30],
              outputRange: ['-30deg', '30deg'],
            });
            return (
              <Animated.Image
                key={i}
                source={COIN_IMG}
                style={[
                  styles.burstCoin,
                  {
                    width: size,
                    height: size,
                    bottom: H - 12,
                    left: W / 2 - size / 2,
                    opacity: coin.op,
                    transform: [
                      { translateX: coin.x },
                      { translateY: coin.y },
                      { scale: coin.s },
                      { rotate: rotation },
                    ],
                  },
                ]}
              />
            );
          })}
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
  burstCoin: {
    position: 'absolute',
    resizeMode: 'contain',
  },
});
