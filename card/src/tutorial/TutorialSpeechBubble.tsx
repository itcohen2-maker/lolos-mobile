// ============================================================
// TutorialSpeechBubble.tsx — Animated bot speech bubble
// Floats at the top of the screen during bot turns to explain
// what the bot is doing and why.
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, Platform } from 'react-native';

interface TutorialSpeechBubbleProps {
  text: string;
  visible: boolean;
}

export function TutorialSpeechBubble({ text, visible }: TutorialSpeechBubbleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, speed: 14, bounciness: 6, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible, opacity, translateY]);

  if (!visible && !text) return null;

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.bubble}>
        <Text style={styles.botLabel}>🤖</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      <View style={styles.arrow} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 10000,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  bubble: {
    backgroundColor: 'rgba(15, 40, 64, 0.95)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFD700',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    maxWidth: 360,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  botLabel: {
    fontSize: 24,
    marginTop: 2,
  },
  text: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
    fontWeight: '600',
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFD700',
    alignSelf: 'center',
  },
});
