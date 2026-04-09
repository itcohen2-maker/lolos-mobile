import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import Card from './Card'
import { Card as CardType } from '../../types/game'
import { useLocaleOptional, deviceDefaultLocale } from '../../i18n/LocaleContext'
import { t } from '../../../shared/i18n'

interface Props {
  card: CardType
  selected?: boolean
  onPress?: () => void
  small?: boolean
}

function getColors(value: number) {
  if (value <= 9) return { border: '#3B82F6', text: '#2563EB' }
  if (value <= 19) return { border: '#22C55E', text: '#16A34A' }
  return { border: '#EF4444', text: '#DC2626' }
}

export default function NumberCard({ card, selected, onPress, small }: Props) {
  const loc = useLocaleOptional()?.locale ?? deviceDefaultLocale()
  const value = card.value ?? 0
  const { border, text } = getColors(value)

  return (
    <Card borderColor={border} bgColor="#FFF" selected={selected} onPress={onPress} small={small}>
      <View style={styles.inner}>
        <Text style={[styles.value, { color: text, fontSize: small ? 18 : 24 }]}>{value}</Text>
        {!small && <Text style={styles.label}>{t(loc, 'cardLabel.number')}</Text>}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  inner: { alignItems: 'center' },
  value: { fontWeight: '800' },
  label: { color: '#9CA3AF', fontSize: 7, marginTop: 2, letterSpacing: 0.5 },
})
