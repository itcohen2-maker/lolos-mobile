import React, { useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface CasinoButtonProps {
  text: string;
  onPress: () => void;
  disabled?: boolean;
  width?: number;
  height?: number;
  fontSize?: number;
  testID?: string;
  /** Optional row before label (e.g. compact turn countdown inside the felt area) */
  leadingContent?: React.ReactNode;
  style?: any;
}

export function CasinoButton({ text, onPress, disabled, width = 300, height = 62, fontSize = 26, testID, leadingContent, style }: CasinoButtonProps) {
  const pressAnim = useRef(new Animated.Value(0)).current;
  const twinkleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(twinkleAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handlePressIn = useCallback(() => {
    Animated.timing(pressAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.timing(pressAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
  }, []);

  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });
  const translateY = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 2] });

  const pillR = Math.round(height / 2);
  const rimWidth = Math.max(4, Math.round(height * 0.07));
  const insetWidth = Math.max(2, Math.round(height * 0.03));
  const innerR = Math.round((height - rimWidth * 2 - insetWidth * 2) / 2);

  // Twinkle opacity cycles
  const twinkle1 = twinkleAnim.interpolate({ inputRange: [0, 0.3, 0.5, 0.8, 1], outputRange: [0.1, 0.6, 0.15, 0.5, 0.1] });
  const twinkle2 = twinkleAnim.interpolate({ inputRange: [0, 0.2, 0.6, 0.9, 1], outputRange: [0.5, 0.1, 0.55, 0.15, 0.5] });
  const twinkle3 = twinkleAnim.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: [0.15, 0.5, 0.1, 0.15] });

  return (
    <View style={[{ width, height: height + 6, opacity: disabled ? 0.3 : 1 }, style]}>
      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={!!disabled}
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : handlePressIn}
        onPressOut={disabled ? undefined : handlePressOut}
        testID={testID}
      >
        <Animated.View style={{
          width,
          height: height + 4,
          transform: [{ scale }, { translateY }],
        }}>
          {/* Bottom shadow layer — 3D lift */}
          <View style={{
            position: 'absolute', bottom: 0, left: 2, right: 2,
            height: height,
            borderRadius: pillR,
            backgroundColor: '#1A0D00',
            ...Platform.select({
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8 },
              android: { elevation: 8 },
            }),
          }} />

          {/* Mid shadow layer */}
          <View style={{
            position: 'absolute', bottom: 2, left: 1, right: 1,
            height: height,
            borderRadius: pillR,
            backgroundColor: '#3A2504',
          }} />

          {/* Gold rim gradient */}
          <LinearGradient
            colors={['#FFF0A0', '#F5D45A', '#E8BC28', '#C89010', '#E0B828', '#F5D860']}
            locations={[0, 0.15, 0.4, 0.6, 0.85, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: height,
              borderRadius: pillR,
            }}
          />

          {/* Gold specular highlight — top */}
          <View style={{
            position: 'absolute', top: 1, left: pillR, right: pillR,
            height: Math.round(height * 0.35),
            borderBottomLeftRadius: height,
            borderBottomRightRadius: height,
            backgroundColor: 'rgba(255,255,230,0.2)',
          }} />

          {/* Dark inset ring */}
          <View style={{
            position: 'absolute',
            top: rimWidth - 1, left: rimWidth - 1,
            right: rimWidth - 1, bottom: rimWidth + 2,
            borderRadius: pillR - rimWidth + 1,
            backgroundColor: '#080E0A',
          }} />

          {/* Green felt surface */}
          <LinearGradient
            colors={['#2D6B48', '#1F5038', '#143824']}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={{
              position: 'absolute',
              top: rimWidth + insetWidth - 1,
              left: rimWidth + insetWidth - 1,
              right: rimWidth + insetWidth - 1,
              bottom: rimWidth + insetWidth + 2,
              borderRadius: innerR,
              overflow: 'hidden',
            }}
          >
            {/* Subtle suit symbols scattered on felt */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {suitPositions.map((pos, i) => (
                <Text key={i} style={{
                  position: 'absolute',
                  left: pos.left,
                  top: pos.top,
                  fontSize: 7,
                  opacity: pos.red ? 0.08 : 0.06,
                  color: pos.red ? '#6ABB80' : '#3A8855',
                }}>{pos.sym}</Text>
              ))}
            </View>

            {/* Felt edge vignette — darker edges */}
            <View style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: innerR,
              borderWidth: Math.max(6, Math.round(width * 0.04)),
              borderColor: 'rgba(0,0,0,0.2)',
            }} />

            {/* Animated twinkle dots */}
            <Animated.View style={{ position: 'absolute', left: '20%', top: '30%', width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(220,255,230,0.7)', opacity: twinkle1 }} />
            <Animated.View style={{ position: 'absolute', left: '55%', top: '45%', width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(220,255,230,0.6)', opacity: twinkle2 }} />
            <Animated.View style={{ position: 'absolute', left: '75%', top: '25%', width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: 'rgba(220,255,230,0.65)', opacity: twinkle3 }} />

            {/* Inner felt glow — subtle green highlight */}
            <View style={{
              position: 'absolute', top: 0, left: '15%', right: '15%',
              height: '50%',
              borderBottomLeftRadius: 100,
              borderBottomRightRadius: 100,
              backgroundColor: 'rgba(80,180,100,0.06)',
            }} />
          </LinearGradient>

          {/* Inner rim highlight */}
          <View style={{
            position: 'absolute',
            top: rimWidth + insetWidth - 1,
            left: rimWidth + insetWidth - 1,
            right: rimWidth + insetWidth - 1,
            bottom: rimWidth + insetWidth + 2,
            borderRadius: innerR,
            borderWidth: 0.5,
            borderColor: 'rgba(80,180,100,0.2)',
          }} />

          {/* Outer gold edge highlight */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: height,
            borderRadius: pillR,
            borderWidth: 0.8,
            borderColor: 'rgba(255,248,180,0.25)',
          }} />

          {/* Text label (+ optional leading slot, e.g. timer) */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: height,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: leadingContent ? 8 : 0,
            paddingHorizontal: leadingContent ? 10 : 0,
          }}>
            {leadingContent}
            <Text
              style={{
                color: '#F0E8C0',
                fontSize,
                fontWeight: '900',
                textShadowColor: 'rgba(0,0,0,0.7)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 6,
                letterSpacing: 0.5,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {text}
            </Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

// Pre-computed suit symbol positions (scattered across button area)
const suits = ['\u2660', '\u2665', '\u2666', '\u2663'];
const suitPositions: { left: number | `${number}%`; top: number | `${number}%`; sym: string; red: boolean }[] = [];
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 14; col++) {
    const idx = (col + row * 2) % 4;
    const sym = suits[idx];
    suitPositions.push({
      left: `${5 + col * 7}%`,
      top: `${15 + row * 30}%`,
      sym,
      red: sym === '\u2665' || sym === '\u2666',
    });
  }
}
