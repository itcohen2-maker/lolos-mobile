import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import Card from './Card'
import { Card as CardType } from '../../types/game'

interface Props {
  card: CardType
  selected?: boolean
  onPress?: () => void
  small?: boolean
}

const display: Record<string, { num: string; den: string; sym: string }> = {
  '1/2': { num: '1', den: '2', sym: '½' },
  '1/3': { num: '1', den: '3', sym: '⅓' },
  '1/4': { num: '1', den: '4', sym: '¼' },
  '1/5': { num: '1', den: '5', sym: '⅕' },
}

export default function FractionCard({ card, selected, onPress, small }: Props) {
  const f = display[card.fraction ?? '1/2']
  return (
    <Card borderColor="#8B5CF6" bgColor="#F5F3FF" selected={selected} onPress={onPress} small={small}>
      <View style={styles.inner}>
        {small ? (
          <Text style={styles.symbol}>{f.sym}</Text>
        ) : (
          <>
            <Text style={styles.num}>{f.num}</Text>
            <View style={styles.line} />
            <Text style={styles.den}>{f.den}</Text>
            <Text style={styles.label}>שבר</Text>
          </>
        )}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  inner: { alignItems: 'center' },
  symbol: { color: '#7C3AED', fontSize: 20, fontWeight: '800' },
  num: { color: '#7C3AED', fontSize: 18, fontWeight: '800', lineHeight: 22 },
  line: { width: 22, height: 2, backgroundColor: '#A78BFA', marginVertical: 2 },
  den: { color: '#7C3AED', fontSize: 18, fontWeight: '800', lineHeight: 22 },
  label: { color: '#A78BFA', fontSize: 7, marginTop: 2, letterSpacing: 0.5 },
})
