import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import GameCard from '../cards/GameCard'

export default function DiscardPile() {
  const { state } = useGame()
  const topCard = state.discardPile[state.discardPile.length - 1]

  return (
    <View style={styles.container}>
      {topCard ? (
        <GameCard card={topCard} />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>ריק</Text>
        </View>
      )}
      <Text style={styles.label}>ערימה</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4 },
  empty: {
    width: 72,
    height: 104,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: '#6B7280', fontSize: 11 },
  label: { color: '#9CA3AF', fontSize: 11 },
})
