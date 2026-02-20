import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import { validateIdenticalPlay } from '../../utils/validation'
import GameCard from '../cards/GameCard'

export default function PlayerHand() {
  const { state, dispatch } = useGame()
  const currentPlayer = state.players[state.currentPlayerIndex]
  if (!currentPlayer) return null

  const isRollPhase = state.phase === 'roll-dice'
  const isSelecting = state.phase === 'select-cards'
  const topDiscard = state.discardPile[state.discardPile.length - 1]

  const sortedHand = [...currentPlayer.hand].sort((a, b) => {
    const order = { number: 0, fraction: 1, operation: 2, joker: 3 } as const
    const ta = order[a.type]
    const tb = order[b.type]
    if (ta !== tb) return ta - tb
    if (a.type === 'number' && b.type === 'number') return (a.value ?? 0) - (b.value ?? 0)
    return 0
  })

  const handleCardPress = (card: typeof sortedHand[0]) => {
    if (isRollPhase) {
      // Pre-roll: only identical plays allowed — tap matching card to play & end turn
      if (validateIdenticalPlay(card, topDiscard)) {
        dispatch({ type: 'PLAY_IDENTICAL', card })
        dispatch({ type: 'END_TURN' })
      }
      // Non-matching card: do nothing
      return
    }

    if (isSelecting) {
      // Post-roll: number cards are selected for the equation builder;
      // special cards are played directly
      if (card.type === 'number') {
        dispatch({ type: 'SELECT_CARD', card })
      } else if (card.type === 'fraction') {
        dispatch({ type: 'PLAY_FRACTION', card })
      } else if (card.type === 'operation') {
        dispatch({ type: 'PLAY_OPERATION', card })
      } else if (card.type === 'joker') {
        dispatch({ type: 'OPEN_JOKER_MODAL', card })
      }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>היד של {currentPlayer.name}</Text>
        <Text style={styles.count}>({currentPlayer.hand.length} קלפים)</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cards}
      >
        {sortedHand.map((card) => {
          const isSelected = state.selectedCards.some((c) => c.id === card.id)
          const isTappable = isRollPhase || isSelecting
          return (
            <GameCard
              key={card.id}
              card={card}
              selected={isSelected}
              small
              onPress={isTappable ? () => handleCardPress(card) : undefined}
            />
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  name: { color: '#D1D5DB', fontSize: 13, fontWeight: '600' },
  count: { color: '#6B7280', fontSize: 11 },
  cards: { gap: 6, paddingHorizontal: 4, paddingBottom: 4 },
})
