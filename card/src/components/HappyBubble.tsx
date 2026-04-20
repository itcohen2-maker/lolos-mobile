// ============================================================
// HappyBubble — bouncy, lively speech bubble. Spring-pop on
// mount + gentle scale loop. Used by the tutorial and by big
// "positive moment" notifications (game-over win, welcome,
// etc.). Keep this minimal and stateless.
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

export type HappyBubbleTone = 'demo' | 'turn' | 'celebrate' | 'welcome';

const TONE_STYLES: Record<HappyBubbleTone, { bg: string; border: string; text: string }> = {
  // No brown anywhere. Demo uses a fresh sky/teal palette so the bubble
  // reads as a friendly hint, not a parchment / coffee notice.
  demo:      { bg: '#E0F2FE', border: '#0EA5E9', text: '#0C4A6E' },
  turn:      { bg: '#DBEAFE', border: '#2563EB', text: '#1E3A8A' },
  celebrate: { bg: '#FCE7F3', border: '#DB2777', text: '#831843' },
  welcome:   { bg: '#DCFCE7', border: '#16A34A', text: '#14532D' },
};

type Props = {
  text: string;
  tone?: HappyBubbleTone;
  /** Optional title rendered above `text` in a larger, bolder style */
  title?: string;
  /** Show the downward-pointing tail under the bubble */
  withTail?: boolean;
  /** Tail size — 'small' is the default speech-tail; 'big' is a chunky
   *  attention-grabbing arrow useful for drawing the eye to a UI region. */
  arrowSize?: 'small' | 'big';
  /** Override max width — defaults to 88% of parent */
  maxWidth?: number | string;
};

export function HappyBubble({
  text,
  tone = 'demo',
  title,
  withTail = true,
  arrowSize = 'small',
  maxWidth = '88%',
}: Props): React.ReactElement {
  const scale = useRef(new Animated.Value(0)).current;
  // Pop in once, then stay still. (No looping bob — it reads as a glitch
  // because the bubble looks like it never finishes opening.)
  useEffect(() => {
    scale.setValue(0);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 110, useNativeDriver: true }).start();
  }, [text, title, scale]);

  const palette = TONE_STYLES[tone];

  return (
    <View pointerEvents="box-none" style={{ alignItems: 'center' }}>
      <Animated.View
        style={{
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: 3,
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 28,
          maxWidth: maxWidth as number,
          transform: [{ scale }],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        {title ? (
          <Text style={{ color: palette.text, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 4 }}>
            {title}
          </Text>
        ) : null}
        <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>{text}</Text>
      </Animated.View>
      {withTail ? (
        arrowSize === 'big' ? (
          <Animated.View style={{ marginTop: -2, alignItems: 'center', transform: [{ scale }] }}>
            {/* Outer (border) triangle */}
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 28,
                borderRightWidth: 28,
                borderTopWidth: 36,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: palette.border,
              }}
            />
            {/* Inner fill triangle, slightly smaller, overlaid for a clean filled look */}
            <View
              style={{
                marginTop: -36,
                width: 0,
                height: 0,
                borderLeftWidth: 22,
                borderRightWidth: 22,
                borderTopWidth: 28,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: palette.bg,
              }}
            />
          </Animated.View>
        ) : (
          <View
            style={{
              marginTop: -2,
              width: 0,
              height: 0,
              borderLeftWidth: 12,
              borderRightWidth: 12,
              borderTopWidth: 14,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: palette.border,
            }}
          />
        )
      ) : null}
    </View>
  );
}
