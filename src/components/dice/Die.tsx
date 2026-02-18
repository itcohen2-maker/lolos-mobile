import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'

interface DieProps {
  value: number | null
  rolling?: boolean
}

const dotPositions: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
}

const SIZE = 56

export default function Die({ value, rolling }: DieProps) {
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (rolling) {
      spin.setValue(0)
      Animated.timing(spin, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start()
    }
  }, [rolling])

  const rotateZ = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  })

  const dots = value && !rolling ? dotPositions[value] || [] : []

  return (
    <Animated.View style={[styles.die, { transform: [{ rotateZ }] }]}>
      {dots.length > 0 ? (
        dots.map(([xPct, yPct], i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: (xPct / 100) * SIZE - 6,
                top: (yPct / 100) * SIZE - 6,
              },
            ]}
          />
        ))
      ) : (
        <Text style={styles.placeholder}>?</Text>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  die: {
    width: SIZE,
    height: SIZE,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1F2937',
  },
  placeholder: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    top: 14,
    fontSize: 22,
    fontWeight: '700',
    color: '#D1D5DB',
  },
})
