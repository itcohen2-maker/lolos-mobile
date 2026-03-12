import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import Die from '../dice/Die'
import Button from '../ui/Button'

export default function DiceArea() {
  const { state, dispatch } = useGame()
  const [rolling, setRolling] = useState(false)

  const handleRoll = () => {
    if (state.phase !== 'roll-dice') return
    setRolling(true)
    setTimeout(() => {
      dispatch({ type: 'ROLL_DICE' })
      setRolling(false)
    }, 600)
  }

  return (
    <View style={styles.container}>
      <View style={styles.dice}>
        <Die value={state.dice?.die1 ?? null} rolling={rolling} />
        <Die value={state.dice?.die2 ?? null} rolling={rolling} />
        <Die value={state.dice?.die3 ?? null} rolling={rolling} />
      </View>
      {state.phase === 'roll-dice' && (
        <Button onPress={handleRoll} variant="primary" disabled={rolling}>
          {rolling ? 'מגלגל...' : 'הטל קוביות'}
        </Button>
      )}
      {state.dice && !rolling && (
        <Text style={styles.info}>
          תוצאה: {state.dice.die1}, {state.dice.die2}, {state.dice.die3}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 10 },
  dice: { flexDirection: 'row', gap: 12 },
  info: { color: '#9CA3AF', fontSize: 12 },
})
