import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import DrawPile from '../board/DrawPile'
import DiscardPile from '../board/DiscardPile'
import PlayerHand from '../board/PlayerHand'
import DiceArea from '../board/DiceArea'
import ActionBar from '../board/ActionBar'
import Scoreboard from '../ui/Scoreboard'

export default function GameScreen() {
  const { state } = useGame()
  const currentPlayer = state.players[state.currentPlayerIndex]

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>לולוס</Text>
        <Text style={styles.turnInfo}>
          תורו/ה של <Text style={styles.playerName}>{currentPlayer?.name}</Text>
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Scoreboard */}
        <Scoreboard />

        {/* Piles */}
        <View style={styles.piles}>
          <DrawPile />
          <DiscardPile />
        </View>

        {/* Dice */}
        <DiceArea />

        {/* Actions */}
        <ActionBar />
      </ScrollView>

      {/* Player hand fixed at bottom */}
      <View style={styles.handArea}>
        <PlayerHand />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  logo: { color: '#F59E0B', fontSize: 20, fontWeight: '900', letterSpacing: 2, textAlign: 'right' },
  turnInfo: { color: '#D1D5DB', fontSize: 13 },
  playerName: { color: '#FFF', fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 12,
    gap: 16,
    paddingBottom: 20,
  },
  piles: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  handArea: {
    backgroundColor: 'rgba(31,41,55,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 24,
  },
})
