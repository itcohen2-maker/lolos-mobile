import React, { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface EquationDraftView {
  targetTileId: string | null;
  slots: [number | null, number | null];
  operator: '+' | '-';
  result: number | null;
}

interface EquationSlotsProps {
  equations: [EquationDraftView, EquationDraftView];
  activeEquationIndex: 0 | 1;
  sourceNumbers: number[];
  onSelectEquation: (index: 0 | 1) => void;
  onTapSource: (n: number) => void;
  onToggleOperator: (index: 0 | 1) => void;
  onConfirmEquation: (index: 0 | 1) => void;
}

function SourceBubble({ value, onPress }: { value: number; onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const handlePress = () => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  const style = useMemo(
    () => ({
      transform: [
        {
          translateY: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -8],
          }),
        },
      ],
    }),
    [anim],
  );

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.sourceShape, style]}>
        <Text style={styles.sourceTxt}>{value}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function EquationSlots({
  equations,
  activeEquationIndex,
  sourceNumbers,
  onSelectEquation,
  onTapSource,
  onToggleOperator,
  onConfirmEquation,
}: EquationSlotsProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.sourcesRow}>
        {sourceNumbers.map((n, i) => (
          <SourceBubble key={`${n}-${i}`} value={n} onPress={() => onTapSource(n)} />
        ))}
      </View>

      {equations.map((eq, idx) => {
        const active = idx === activeEquationIndex;
        return (
          <TouchableOpacity
            key={idx}
            activeOpacity={0.9}
            onPress={() => onSelectEquation(idx as 0 | 1)}
            style={[styles.eqBox, active && styles.eqActive]}
          >
            <View style={styles.eqRow}>
              <View style={styles.slot}><Text style={styles.slotTxt}>{eq.slots[0] ?? ' '}</Text></View>
              <TouchableOpacity style={styles.operatorBtn} onPress={() => onToggleOperator(idx as 0 | 1)}>
                <Text style={styles.slotTxt}>{eq.operator}</Text>
              </TouchableOpacity>
              <View style={styles.slot}><Text style={styles.slotTxt}>{eq.slots[1] ?? ' '}</Text></View>
              <Text style={styles.equals}>=</Text>
              <View style={styles.slot}><Text style={styles.slotTxt}>{eq.result ?? '?'}</Text></View>
            </View>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirmEquation(idx as 0 | 1)}>
              <Text style={styles.confirmTxt}>Confirm</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  sourcesRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  sourceShape: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  sourceTxt: { color: '#EFF6FF', fontSize: 22, fontWeight: '800' },
  eqBox: {
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(17,24,39,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    gap: 8,
  },
  eqActive: { borderColor: '#F59E0B' },
  eqRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  slot: {
    width: 44,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  operatorBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.24)',
  },
  slotTxt: { color: '#fff', fontSize: 22, fontWeight: '800' },
  equals: { color: '#fff', fontSize: 24, fontWeight: '800' },
  confirmBtn: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#22C55E' },
  confirmTxt: { color: '#082312', fontWeight: '800' },
});
