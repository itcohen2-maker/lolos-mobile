import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'gold'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  variant?: Variant
  size?: Size
  children: React.ReactNode
  onPress?: () => void
  disabled?: boolean
  style?: ViewStyle
}

const bgColors: Record<Variant, string> = {
  primary: '#2563EB',
  secondary: '#4B5563',
  danger: '#DC2626',
  success: '#16A34A',
  gold: '#EAB308',
}

const textColors: Record<Variant, string> = {
  primary: '#FFF',
  secondary: '#FFF',
  danger: '#FFF',
  success: '#FFF',
  gold: '#000',
}

const paddings: Record<Size, [number, number]> = {
  sm: [6, 12],
  md: [10, 16],
  lg: [14, 24],
}

const fontSizes: Record<Size, number> = {
  sm: 13,
  md: 15,
  lg: 17,
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  onPress,
  disabled,
  style,
}: ButtonProps) {
  const [pv, ph] = paddings[size]
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        {
          backgroundColor: bgColors[variant],
          paddingVertical: pv,
          paddingHorizontal: ph,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.text, { color: textColors[variant], fontSize: fontSizes[size] }]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
  },
})
