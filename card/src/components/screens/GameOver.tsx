import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native'
import { useGame } from '../../hooks/useGame'
import Button from '../ui/Button'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const COLORS = ['#EAB308', '#3B82F6', '#EF4444', '#22C55E', '#8B5CF6', '#F97316']
const CONFETTI_COUNT = 30

function Confetti() {
  const anims = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => ({
      x: new Animated.Value(Math.random() * SCREEN_W),
      y: new Animated.Value(-20),
      rotate: new Animated.Value(0),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))
  ).current

  useEffect(() => {
    anims.forEach((a) => {
      const duration = 2000 + Math.random() * 2000
      const delay = Math.random() * 1500
      Animated.parallel([
        Animated.timing(a.y, {
          toValue: SCREEN_H + 20,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(a.rotate, {
          toValue: Math.random() * 720 - 360,
          duration,
          delay,
          useNativeDriver: true,
        }),
      ]).start()
    })
  }, [])

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: 2,
            backgroundColor: a.color,
            transform: [
              { translateX: a.x as any },
              { translateY: a.y as any },
              {
                rotateZ: a.rotate.interpolate({
                  inputRange: [-360, 360],
                  outputRange: ['-360deg', '360deg'],
                }) as any,
              },
            ],
          }}
        />
      ))}
    </View>
  )
}

export default function GameOver() {
  const { state, dispatch } = useGame()

  const sortedPlayers = [...state.players].sort(
    (a, b) => a.hand.length - b.hand.length
  )

  return (
    <View style={styles.container}>
      <Confetti />

      <Text style={styles.trophy}>🏆</Text>
      <Text style={styles.heading}>המשחק נגמר!</Text>
      <Text style={styles.winner}>{state.winner?.name} ניצח/ה!</Text>

      <View style={styles.standings}>
        <Text style={styles.standingsTitle}>תוצאות סופיות</Text>
        {sortedPlayers.map((p, i) => (
          <View key={p.id} style={styles.standingRow}>
            <Text style={styles.standingName}>
              {i + 1}. {p.name}
              {p.hand.length === 0 ? ' ★' : ''}
            </Text>
            <Text style={styles.standingCards}>{p.hand.length} קלפים נותרו</Text>
          </View>
        ))}
      </View>

      <Button
        variant="success"
        size="lg"
        onPress={() => dispatch({ type: 'RESET_GAME' })}
        style={{ width: '100%', marginTop: 20 }}
      >
        שחק/י שוב
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
  trophy: { fontSize: 56, marginBottom: 8 },
  heading: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  winner: { color: '#FACC15', fontSize: 20, fontWeight: '700', marginTop: 8, marginBottom: 24 },
  standings: {
    backgroundColor: 'rgba(55,65,81,0.5)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  standingsTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'right',
  },
  standingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  standingName: { color: '#D1D5DB', fontSize: 14 },
  standingCards: { color: '#9CA3AF', fontSize: 14 },
})
