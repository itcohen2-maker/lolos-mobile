import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type ExcellenceMeterProps = {
  title?: string;
  value: number;
  height?: number;
  compact?: boolean;
  pulseKey?: number;
};

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

export default function ExcellenceMeter({
  title,
  value,
  height = 150,
  compact = false,
  pulseKey,
}: ExcellenceMeterProps) {
  const safeValue = clamp(value, 0, 100);
  const meterWidth = compact ? 42 : 52;
  const meterHeight = compact ? Math.max(64, Math.round(height * 0.72)) : height;
  const fillAnim = React.useRef(new Animated.Value(safeValue)).current;
  const pulseAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: safeValue,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fillAnim, safeValue]);

  React.useEffect(() => {
    if (pulseKey == null) return;
    pulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulseAnim, pulseKey]);

  const animatedFillHeight = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, meterHeight],
  });
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });
  const pulseGlowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <View style={[styles.outer, compact ? styles.outerCompact : null]}>
      {title ? (
        <Text numberOfLines={1} style={[styles.title, compact ? styles.titleCompact : null]}>
          {title}
        </Text>
      ) : null}
      <Animated.View style={[styles.glass, { width: meterWidth, height: meterHeight }, { transform: [{ scale: pulseScale }] }]}>
        <Animated.View pointerEvents="none" style={[styles.pulseGlow, { opacity: pulseGlowOpacity }]} />
        <Animated.View style={[styles.fillWrap, { height: animatedFillHeight }]}>
          <LinearGradient
            colors={['#16A34A', '#22C55E', '#7CFC00']}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.65, y: 0 }}
            style={styles.fill}
          />
          <View style={styles.wave} />
          <View style={styles.fillShine} />
          <Text style={styles.valueInLiquid}>{safeValue}</Text>
        </Animated.View>
        <View style={styles.gloss} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
  },
  outerCompact: {
    marginTop: 0,
  },
  title: {
    color: '#DCFCE7',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  titleCompact: {
    fontSize: 10,
    marginBottom: 3,
  },
  glass: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(203,213,225,0.9)',
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  pulseGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'rgba(134,239,172,0.25)',
  },
  fillWrap: {
    width: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
    alignItems: 'center',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  wave: {
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
  valueInLiquid: {
    position: 'absolute',
    top: '35%',
    color: '#ECFDF5',
    fontWeight: '800',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
