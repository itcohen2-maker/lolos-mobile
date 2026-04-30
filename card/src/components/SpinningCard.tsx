import React, { useEffect, useRef, ReactNode } from 'react';
import { View, Image, StyleSheet, Animated, Easing, ImageSourcePropType } from 'react-native';

const CARD_BACK = require('../../assets/card-back.png');

type Props = {
  /** Image source for the card front (use require(...)). */
  frontSource?: ImageSourcePropType;
  /** Fallback front face when no image provided. */
  front?: ReactNode;
  width?: number;
  speed?: number;
  backLabel?: string;
};

function CardFace({
  width,
  height,
  source,
  children,
}: {
  width: number;
  height: number;
  source?: ImageSourcePropType;
  children?: ReactNode;
}) {
  if (source) {
    return (
      <View style={{ width, height, borderRadius: 14, overflow: 'hidden', backgroundColor: '#fafaf6' }}>
        <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      </View>
    );
  }
  return <>{children}</>;
}

export function SpinningCard({
  frontSource,
  front,
  width = 110,
  speed = 40,
  backLabel = 'סלינדה',
}: Props) {
  const height = Math.round(width * (3.5 / 2.5));
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const msPerRev = (360 / speed) * 1000;
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: msPerRev,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim, speed]);

  const perspective = width * 18;

  // opacity-based face switching (like the Expo HTML version)
  const frontOpacity = spinAnim.interpolate({
    inputRange: [0, 0.249, 0.25, 0.749, 0.75, 1],
    outputRange: [1, 1, 0, 0, 1, 1],
  });
  const backOpacity = spinAnim.interpolate({
    inputRange: [0, 0.249, 0.25, 0.749, 0.75, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  });

  const frontRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const backRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '540deg'],
  });

  return (
    <View style={{ width, height }}>
      {/* BACK */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: backOpacity, transform: [{ perspective }, { rotateY: backRotate }] },
        ]}
      >
        <View style={{ width, height, borderRadius: 14, overflow: 'hidden' }}>
          <Image source={CARD_BACK} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
      </Animated.View>

      {/* FRONT */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: frontOpacity, transform: [{ perspective }, { rotateY: frontRotate }] },
        ]}
      >
        <CardFace width={width} height={height} source={frontSource}>
          {front}
        </CardFace>
      </Animated.View>
    </View>
  );
}

