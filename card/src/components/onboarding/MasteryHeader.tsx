import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface MasteryHeaderProps {
  cumulativeSum: number;
  remainingTargets: number;
  timedMasteryEnabled: boolean;
  timerProgress: number;
}

export default function MasteryHeader({
  cumulativeSum,
  remainingTargets,
  timedMasteryEnabled,
  timerProgress,
}: MasteryHeaderProps) {
  const safeProgress = Math.max(0, Math.min(1, timerProgress));
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>Σ {cumulativeSum}</Text>
        <Text style={styles.label}>Targets left: {remainingTargets}</Text>
      </View>
      {timedMasteryEnabled ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${safeProgress * 100}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    backgroundColor: 'rgba(3,7,18,0.72)',
    borderRadius: 12,
    padding: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#F9FAFB',
    fontSize: 13,
    fontWeight: '700',
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F59E0B',
  },
});
