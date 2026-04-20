// ============================================================
// HighlightOverlay.tsx — Pulsing visual ring on top of a target
// UI region. Used by InteractiveTutorialScreen to draw the
// learner's eye to the next thing to interact with.
//
// MVP: no full-screen dim, no SVG mask. A bright animated
// rectangle outline + glow. Good enough to verify the engine.
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, type ViewStyle } from 'react-native';

export type HighlightTarget = {
  /** Absolute position from top-left of screen */
  top: number;
  left: number;
  width: number;
  height: number;
};

type Props = {
  target: HighlightTarget | null;
  /** ring (rectangular outline) or arrow (TODO) */
  shape?: 'ring' | 'arrow';
  /** ARIA-friendly hint label rendered above ring (optional) */
  label?: string;
};

export function HighlightOverlay({ target, shape = 'ring' }: Props): React.ReactElement | null {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!target) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [target, pulse]);

  if (!target) return null;

  const ringStyle: Animated.WithAnimatedObject<ViewStyle> = {
    position: 'absolute',
    top: target.top - 8,
    left: target.left - 8,
    width: target.width + 16,
    height: target.height + 16,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#FCD34D',
    transform: [
      {
        scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
      },
    ],
    shadowColor: '#FCD34D',
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9000 }}
    >
      <Animated.View style={ringStyle} pointerEvents="none" />
      {shape === 'arrow' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: target.top - 36,
            left: target.left + target.width / 2 - 12,
            width: 24,
            height: 24,
          }}
        >
          {/* MVP: triangle pointer using border trick */}
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 12,
              borderRightWidth: 12,
              borderTopWidth: 18,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: '#FCD34D',
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
