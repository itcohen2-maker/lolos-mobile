import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import Card from '../cards/Card'

export default function DrawPile() {
  const { state, dispatch } = useGame()

  const handlePress = () => {
    if (state.phase === 'select-cards') dispatch({ type: 'DRAW_CARD' })
  }

  return (
    <View style={styles.container}>
      <Card faceDown onPress={handlePress}>
        <></>
      </Card>
      <Text style={styles.count}>{state.drawPile.length} נותרו</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4 },
  count: { color: '#9CA3AF', fontSize: 11 },
})
