import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity } from 'react-native';

interface SourceGeneratorButtonProps {
  disabled?: boolean;
  onPress: () => void;
  label: string;
}

export default function SourceGeneratorButton({ disabled, onPress, label }: SourceGeneratorButtonProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (disabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, pulse]);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <TouchableOpacity style={[styles.btn, disabled && styles.btnDisabled]} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
        <Text style={styles.txt}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  btnDisabled: {
    backgroundColor: '#4B5563',
  },
  txt: {
    color: '#03121c',
    fontWeight: '800',
    fontSize: 15,
  },
});
