import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  value: number;
  pulseKey?: number;
  isCelebrating?: boolean;
  testID?: string;
};

export default function TutorialProgressMeter({
  value,
  pulseKey,
  isCelebrating = false,
  testID,
}: Props) {
  const width = 34;
  const height = 104;
  const fillHeight = useRef(new Animated.Value((Math.max(0, Math.min(100, value)) / 100) * height)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const prevPulse = useRef<number | undefined>(undefined);

  const animateFill = useCallback((nextValue: number, duration = 420) => {
    Animated.timing(fillHeight, {
      toValue: (Math.max(0, Math.min(100, nextValue)) / 100) * height,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fillHeight, height]);

  useEffect(() => {
    if (pulseKey === undefined || pulseKey === prevPulse.current) {
      animateFill(value, 520);
      return;
    }

    prevPulse.current = pulseKey;

    if (isCelebrating) {
      glow.setValue(0);
      scale.setValue(1);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.08,
            duration: 140,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 360,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
      animateFill(value, 260);
      return;
    }

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.04,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 180,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    animateFill(value, 360);
  }, [animateFill, glow, isCelebrating, pulseKey, scale, value]);

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <Animated.View testID={testID} style={[styles.wrap, { transform: [{ scale }] }]}>
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
      <View style={[styles.shell, { width, height }]}>
        <View style={styles.inner}>
          <Animated.View style={[styles.fillWrap, { height: fillHeight }]}>
            <LinearGradient
              colors={['#16A34A', '#4ADE80', '#7CFC00']}
              start={{ x: 0.15, y: 1 }}
              end={{ x: 0.85, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.wave} />
            <View style={styles.fillShine} />
          </Animated.View>
          <View style={styles.glossTrack} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 52,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  glow: {
    position: 'absolute',
    width: 44,
    height: 114,
    borderRadius: 16,
    backgroundColor: 'rgba(110,255,155,0.22)',
  },
  shell: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(218,233,249,0.92)',
    backgroundColor: 'rgba(8,22,44,0.62)',
    overflow: 'hidden',
    padding: 3,
  },
  inner: {
    flex: 1,
    borderRadius: 9,
    backgroundColor: 'rgba(7,18,35,0.7)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  wave: {
    position: 'absolute',
    top: -3,
    left: 0,
    right: 0,
    height: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: 'rgba(214,255,228,0.45)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,255,250,0.85)',
  },
  fillShine: {
    position: 'absolute',
    right: 4,
    top: 6,
    width: 5,
    height: 20,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  glossTrack: {
    position: 'absolute',
    left: 4,
    top: 8,
    width: 5,
    height: '70%',
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});
