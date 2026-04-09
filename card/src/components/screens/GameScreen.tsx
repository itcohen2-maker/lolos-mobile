import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import DrawPile from '../board/DrawPile'
import DiscardPile from '../board/DiscardPile'
import PlayerHand from '../board/PlayerHand'
import DiceArea from '../board/DiceArea'
import ActionBar from '../board/ActionBar'
import Scoreboard from '../ui/Scoreboard'
import SalindaLogoOption06 from '../branding/SalindaLogoOption06'
import { useLocale } from '../../i18n/LocaleContext'

export default function GameScreen() {
  const { t } = useLocale()
  const { state } = useGame()
  const currentPlayer = state.players[state.currentPlayerIndex]

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SalindaLogoOption06 width={148} />
        <Text style={styles.turnInfo}>
          {t('game.turnOf', { name: currentPlayer?.name ?? '—' })}
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
  turnInfo: { color: '#D1D5DB', fontSize: 13, flex: 1, textAlign: 'left', marginStart: 12 },
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
