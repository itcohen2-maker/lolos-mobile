import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import Button from '../ui/Button'

export default function TurnTransition() {
  const { state, dispatch } = useGame()
  const currentPlayer = state.players[state.currentPlayerIndex]

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>העבר/י את המכשיר ל</Text>
      <Text style={styles.name}>{currentPlayer?.name}</Text>
      <Text style={styles.cardCount}>{currentPlayer?.hand.length} קלפים ביד</Text>

      {!!state.message && (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{state.message}</Text>
        </View>
      )}

      <Button
        variant="primary"
        size="lg"
        onPress={() => dispatch({ type: 'BEGIN_TURN' })}
        style={{ width: '100%', marginTop: 24 }}
      >
        אני מוכן/ה
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  hint: { color: '#9CA3AF', fontSize: 14 },
  name: { color: '#FFF', fontSize: 32, fontWeight: '800', marginTop: 8 },
  cardCount: { color: '#6B7280', fontSize: 12, marginTop: 8 },
  messageBox: {
    backgroundColor: 'rgba(234,179,8,0.1)',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    width: '100%',
  },
  messageText: { color: '#FDE68A', fontSize: 13, textAlign: 'center' },
})
