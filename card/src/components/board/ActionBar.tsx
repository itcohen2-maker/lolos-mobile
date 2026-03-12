import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import { Operation } from '../../types/game'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import EquationBuilder from './EquationBuilder'

export default function ActionBar() {
  const { state, dispatch } = useGame()
  const currentPlayer = state.players[state.currentPlayerIndex]
  if (!currentPlayer) return null

  const isSelectPhase = state.phase === 'select-cards'
  const hasPlayed = state.hasPlayedCards
  const hasActiveOp = isSelectPhase && !!state.activeOperation && !hasPlayed

  const canCallLolos =
    isSelectPhase && currentPlayer.hand.length === 1 && !currentPlayer.calledLolos

  const handleJokerChoice = (op: Operation) => {
    const jokerCard = state.selectedCards[0]
    if (jokerCard) dispatch({ type: 'PLAY_JOKER', card: jokerCard, chosenOperation: op })
  }

  return (
    <View style={styles.container}>
      {/* Operation challenge — info only, counter by tapping cards in hand */}
      {hasActiveOp && (
        <View style={styles.opSection}>
          <Text style={styles.opTitle}>אתגר פעולה: {state.activeOperation}</Text>
          <Text style={styles.opHint}>
            הגן/י עם קלף פעולה תואם או ג'וקר מהיד שלך, או קבל/י עונש של 2 קלפים.
          </Text>
          <View style={styles.row}>
            <Button variant="danger" size="sm" onPress={() => dispatch({ type: 'END_TURN' })}>
              קבל/י עונש
            </Button>
          </View>
        </View>
      )}

      {/* Equation Builder + Draw — only when not in operation challenge and haven't played */}
      {isSelectPhase && !hasActiveOp && !hasPlayed && (
        <>
          <EquationBuilder />
          <View style={styles.row}>
            <Button variant="secondary" onPress={() => dispatch({ type: 'DRAW_CARD' })}>
              שלוף קלף
            </Button>
          </View>
        </>
      )}

      {/* LOLOS + End Turn (End Turn only enabled after playing or drawing) */}
      {isSelectPhase && !hasActiveOp && (
        <View style={styles.row}>
          {canCallLolos && (
            <Button variant="danger" size="lg" onPress={() => dispatch({ type: 'CALL_LOLOS' })}>
              לולוס!
            </Button>
          )}

          {(hasPlayed || state.hasDrawnCard) && (
            <Button variant="secondary" onPress={() => dispatch({ type: 'END_TURN' })}>
              סיים תור
            </Button>
          )}
        </View>
      )}

      {/* Message */}
      {!!state.message && (
        <View style={styles.message}>
          <Text style={styles.messageText}>{state.message}</Text>
        </View>
      )}

      {/* Joker modal — opens when player taps a joker card in their hand */}
      <Modal
        visible={state.jokerModalOpen}
        onClose={() => dispatch({ type: 'CLOSE_JOKER_MODAL' })}
        title="בחר/י פעולה לג'וקר"
      >
        <View style={styles.jokerGrid}>
          {(['+', '-', 'x', '÷'] as Operation[]).map((op) => (
            <Button
              key={op}
              variant="primary"
              size="lg"
              onPress={() => handleJokerChoice(op)}
              style={styles.jokerBtn}
            >
              {op}
            </Button>
          ))}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 10 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  opSection: {
    backgroundColor: 'rgba(154,52,18,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    borderRadius: 10,
    padding: 12,
  },
  opTitle: { color: '#FDBA74', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  opHint: { color: '#9CA3AF', fontSize: 11, marginBottom: 8 },
  message: {
    backgroundColor: 'rgba(234,179,8,0.1)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  messageText: { color: '#FDE68A', fontSize: 13, textAlign: 'center' },
  jokerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  jokerBtn: { width: '45%', minWidth: 100 },
})
