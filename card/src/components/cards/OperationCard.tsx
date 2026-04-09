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

export default function OperationCard({ card, selected, onPress, small }: Props) {
  const loc = useLocaleOptional()?.locale ?? deviceDefaultLocale()
  return (
    <Card borderColor="#F97316" bgColor="#FFF7ED" selected={selected} onPress={onPress} small={small}>
      <View style={styles.inner}>
        <Text style={[styles.op, { fontSize: small ? 20 : 30 }]}>{card.operation}</Text>
        {!small && <Text style={styles.label}>{t(loc, 'cardLabel.operation')}</Text>}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  inner: { alignItems: 'center' },
  op: { color: '#EA580C', fontWeight: '800' },
  label: { color: '#FB923C', fontSize: 7, marginTop: 2, letterSpacing: 0.5 },
})
