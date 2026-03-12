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

export default function JokerCard({ card: _card, selected, onPress, small }: Props) {
  return (
    <Card borderColor="#EAB308" bgColor="#FEFCE8" selected={selected} onPress={onPress} small={small}>
      <View style={styles.inner}>
        <Text style={[styles.star, { fontSize: small ? 14 : 20 }]}>★</Text>
        <Text style={[styles.text, { fontSize: small ? 10 : 13 }]}>ג'וקר</Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  inner: { alignItems: 'center' },
  star: { color: '#CA8A04' },
  text: { color: '#CA8A04', fontWeight: '800' },
})
