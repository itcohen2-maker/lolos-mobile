import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import { useLocale } from '../../i18n/LocaleContext'
import Die from '../dice/Die'
import Button from '../ui/Button'

export default function DiceArea() {
  const { state, dispatch } = useGame()
  const { t } = useLocale()
  const [rolling, setRolling] = useState(false)

  if (state.phase === 'identical-tutorial') return null

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
          {rolling ? t('game.rolling') : t('game.rollDice')}
        </Button>
      )}
      {state.dice && !rolling && (
        <Text style={styles.info}>
          {t('game.diceLine', { d1: state.dice.die1, d2: state.dice.die2, d3: state.dice.die3 })}
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
