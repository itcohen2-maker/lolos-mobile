import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

type Color = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray'

const colorMap: Record<Color, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.2)',  text: '#93C5FD', border: 'rgba(59,130,246,0.3)' },
  green:  { bg: 'rgba(34,197,94,0.2)',   text: '#86EFAC', border: 'rgba(34,197,94,0.3)' },
  red:    { bg: 'rgba(239,68,68,0.2)',   text: '#FCA5A5', border: 'rgba(239,68,68,0.3)' },
  yellow: { bg: 'rgba(234,179,8,0.2)',   text: '#FDE68A', border: 'rgba(234,179,8,0.3)' },
  purple: { bg: 'rgba(139,92,246,0.2)',  text: '#C4B5FD', border: 'rgba(139,92,246,0.3)' },
  gray:   { bg: 'rgba(107,114,128,0.2)', text: '#D1D5DB', border: 'rgba(107,114,128,0.3)' },
}

interface BadgeProps {
  children: string
  color?: Color
}

export default function Badge({ children, color = 'gray' }: BadgeProps) {
  const c = colorMap[color]
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
})
