import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import Badge from './Badge'

export default function Scoreboard() {
  const { state } = useGame()

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>שחקנים</Text>
      {state.players.map((player, idx) => (
        <View
          key={player.id}
          style={[styles.row, idx === state.currentPlayerIndex && styles.activeRow]}
        >
          <Text style={styles.name}>
            {idx === state.currentPlayerIndex ? '▸ ' : ''}
            {player.name}
          </Text>
          <View style={styles.badges}>
            {player.calledLolos && <Badge color="yellow">לולוס!</Badge>}
            <Badge color={player.hand.length <= 2 ? 'red' : 'gray'}>
              {`${player.hand.length} קלפים`}
            </Badge>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(31,41,55,0.5)',
    borderRadius: 10,
    padding: 10,
  },
  heading: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  activeRow: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  name: {
    color: '#FFF',
    fontSize: 13,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
})
