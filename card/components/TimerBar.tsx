import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface TimerBarProps {
  totalTime: number;
  secsLeft: number;
  running: boolean;
}

// טבעת מוזהבת עדינה — כמו טבעת השולחן הירוק, בלי מספרים, גרפיקה 3D
const SIZE = 72;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
const circumference = 2 * Math.PI * R;

function getFuseColor(ratio: number): string {
  if (ratio > 0.6) return '#22C55E';
  if (ratio > 0.4) return '#EAB308';
  if (ratio > 0.25) return '#F97316';
  return '#EF4444';
}

export default function TimerBar({ totalTime, secsLeft, running }: TimerBarProps) {
  const ratio = totalTime > 0 ? Math.max(0, secsLeft / totalTime) : 1;
  const fuseLength = circumference * ratio;
  const color = getFuseColor(ratio);
  const glowAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!running || ratio > 0.25) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1.15, duration: 400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.92, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [running, ratio]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      {/* צל תחתון — אפקט 3D */}
      <View style={[styles.shadowRing, { width: SIZE + 4, height: SIZE + 4, borderRadius: (SIZE + 4) / 2 }]} />
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFF4C4" stopOpacity={1} />
            <Stop offset="40%" stopColor="#EAB308" stopOpacity={1} />
            <Stop offset="70%" stopColor="#B8860B" stopOpacity={1} />
            <Stop offset="100%" stopColor="#8B6914" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        {/* טבעת זהב — שכבה חיצונית (הצללה) */}
        <Circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={STROKE + 2} />
        {/* טבעת זהב — גרדיאנט 3D */}
        <Circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="url(#goldGrad)"
          strokeWidth={STROKE}
        />
        {/* הבזק עדין מלמעלה — הילוך */}
        <Circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={STROKE * 0.4}
          strokeDasharray={`${circumference * 0.12} ${circumference}`}
          strokeDashoffset={0}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
        {/* החלק שנשרף — אפור עמום */}
        {ratio < 1 && (
          <Circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="rgba(40,40,40,0.85)"
            strokeWidth={STROKE - 1}
            strokeLinecap="round"
            strokeDasharray={`${circumference * (1 - ratio)} ${circumference}`}
            strokeDashoffset={-fuseLength}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        )}
        {/* הפתיל — קשת צבעונית עדינה (ירוק→אדום) */}
        <Circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE - 1}
          strokeLinecap="round"
          strokeDasharray={`${fuseLength} ${circumference}`}
          strokeDashoffset={0}
          transform={`rotate(-90 ${CX} ${CY})`}
          opacity={0.95}
        />
      </Svg>
      {/* זוהר עדין כשנשאר מעט זמן */}
      {ratio <= 0.25 && ratio > 0 && (
        <Animated.View
          style={[
            styles.glowRing,
            {
              backgroundColor: getFuseColor(ratio),
              opacity: glowAnim.interpolate({ inputRange: [0.92, 1.15], outputRange: [0.2, 0.5] }),
              transform: [{ scale: glowAnim }],
            },
          ]}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#B8860B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  shadowRing: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.2)',
    top: 2,
    left: 0,
  },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SIZE / 2,
  },
});
