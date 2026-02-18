import React, { useEffect, useRef } from 'react'
import { TouchableOpacity, View, Text, StyleSheet, Animated } from 'react-native'

interface CardProps {
  children: React.ReactNode
  borderColor?: string
  bgColor?: string
  selected?: boolean
  onPress?: () => void
  faceDown?: boolean
  small?: boolean
}

export default function Card({
  children,
  borderColor = '#9CA3AF',
  bgColor = '#FFF',
  selected = false,
  onPress,
  faceDown = false,
  small = false,
}: CardProps) {
  const w = small ? 52 : 72
  const h = small ? 76 : 104
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [])

  if (faceDown) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.card, { width: w, height: h, backgroundColor: '#312E81', borderColor: '#818CF8' }]}>
          <Text style={styles.faceDownText}>L</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <View
          style={[
            styles.card,
            {
              width: w,
              height: h,
              backgroundColor: bgColor,
              borderColor: selected ? '#FACC15' : borderColor,
              borderWidth: selected ? 2.5 : 2,
              transform: [{ translateY: selected ? -8 : 0 }],
            },
            selected && styles.selectedShadow,
          ]}
        >
          {children}
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  faceDownText: {
    color: '#818CF8',
    fontSize: 22,
    fontWeight: '800',
  },
  selectedShadow: {
    shadowColor: '#FACC15',
    shadowOpacity: 0.4,
    elevation: 8,
  },
})
