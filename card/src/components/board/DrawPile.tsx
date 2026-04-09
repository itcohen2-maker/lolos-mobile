import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import { useLocale } from '../../i18n/LocaleContext'
import Card from '../cards/Card'

export default function DrawPile() {
  const { t } = useLocale()
  const { state, dispatch } = useGame()

  const handlePress = () => {
    if (state.phase === 'select-cards') dispatch({ type: 'DRAW_CARD' })
  }

  return (
    <View style={styles.container}>
      <Card faceDown onPress={handlePress}>
        <></>
      </Card>
      <Text style={styles.count}>{t('game.deckLeft', { n: String(state.drawPile.length) })}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4 },
  count: { color: '#9CA3AF', fontSize: 11 },
})
