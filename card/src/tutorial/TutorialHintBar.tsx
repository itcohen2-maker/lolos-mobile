// ============================================================
// TutorialHintBar.tsx — Bottom hint bar for user guidance
// Shows what the user should do next during their turn.
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, Platform } from 'react-native';

interface TutorialHintBarProps {
  text: string;
  visible: boolean;
  isWarning?: boolean;
}

export function TutorialHintBar({ text, visible, isWarning }: TutorialHintBarProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      // Gentle pulse to draw attention
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.03, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible, opacity, pulse]);

  if (!visible && !text) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ scale: pulse }] },
        isWarning && styles.containerWarning,
      ]}
    >
      <Text style={[styles.text, isWarning && styles.textWarning]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    zIndex: 10000,
    pointerEvents: 'none',
    backgroundColor: 'rgba(15, 40, 64, 0.92)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  containerWarning: {
    borderColor: 'rgba(255, 100, 100, 0.7)',
    backgroundColor: 'rgba(80, 20, 20, 0.92)',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#FFD700',
    fontWeight: '700',
    textAlign: 'center',
  },
  textWarning: {
    color: '#FF9999',
  },
});
