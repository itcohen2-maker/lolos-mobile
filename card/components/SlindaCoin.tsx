import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';

const COIN_IMG = require('../assets/slinda_coin_nobg.png');

type Props = {
  size?: number;
  /** Changes in this value trigger a 2-bounce animation (skips first mount). */
  pulseKey?: string | number | null;
  /** Continuous full-rotation spin loop with no pauses. */
  spin?: boolean;
  style?: object;
};

export function SlindaCoin({ size = 32, pulseKey, spin = false, style }: Props) {
  const bounceY  = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const mounted  = useRef(false);
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Continuous full rotation — no pauses, no stutters
  useEffect(() => {
    if (!spin) {
      spinLoopRef.current?.stop();
      spinLoopRef.current = null;
      spinAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3600,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    spinLoopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, [spin, spinAnim]);

  // Bounce on pulseKey
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (pulseKey == null) return;
    Animated.sequence([
      Animated.timing(bounceY, { toValue: -size * 0.45, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(bounceY, { toValue: 0,            duration: 140, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
      Animated.timing(bounceY, { toValue: -size * 0.28, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(bounceY, { toValue: 0,            duration: 120, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  // Approximates |cos(t·2π)| — wide at faces, fast through the thin edge,
  // smooth deceleration near 0° and 180°
  const scaleX = spinAnim.interpolate({
    inputRange: [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1],
    outputRange: [1, 0.7, 0.04, 0.7, 1, 0.7, 0.04, 0.7, 1],
  });

  return (
    <Animated.Image
      source={COIN_IMG}
      style={[{
        width: size,
        height: size,
        transform: [{ translateY: bounceY }, { scaleX }],
      }, style]}
      resizeMode="contain"
    />
  );
}
