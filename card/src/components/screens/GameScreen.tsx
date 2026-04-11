import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native'
import { useGame } from '../../hooks/useGame'
import DrawPile from '../board/DrawPile'
import DiscardPile from '../board/DiscardPile'
import PlayerHand from '../board/PlayerHand'
import DiceArea from '../board/DiceArea'
import ActionBar from '../board/ActionBar'
import Scoreboard from '../ui/Scoreboard'
import SalindaLogoOption06 from '../branding/SalindaLogoOption06'
import { useLocale } from '../../i18n/LocaleContext'
import { validateIdenticalPlay } from '../../utils/validation'

export default function GameScreen() {
  const { t, isRTL } = useLocale()
  const { state } = useGame()
  const currentPlayer = state.players[state.currentPlayerIndex]
  const [dismissedHintKey, setDismissedHintKey] = useState<string | null>(null)

  const guidanceContext = useMemo(() => {
    if (state.phase !== 'roll-dice') return null
    if (!currentPlayer) return null
    if (state.guidanceTurnsRemaining <= 0) return null
    const topDiscard = state.discardPile[state.discardPile.length - 1]
    const hasIdentical = currentPlayer.hand.some((card) => validateIdenticalPlay(card, topDiscard))
    return {
      key: `${state.currentPlayerIndex}-${state.guidanceTurnsRemaining}-${state.phase}`,
      hasIdentical,
    }
  }, [currentPlayer, state.currentPlayerIndex, state.discardPile, state.guidanceTurnsRemaining, state.phase])

  useEffect(() => {
    if (!guidanceContext) {
      setDismissedHintKey(null)
    }
  }, [guidanceContext])

  const showGuidanceHint = Boolean(guidanceContext && dismissedHintKey !== guidanceContext.key)
  const hintTargetsDiscard = guidanceContext?.hasIdentical ?? false

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
          {showGuidanceHint ? (
            <View pointerEvents="box-none" style={styles.guidanceOverlay}>
              <View
                style={[
                  styles.guidanceBubbleWrap,
                  hintTargetsDiscard
                    ? (isRTL ? styles.bubbleToDrawRTL : styles.bubbleToDiscardLTR)
                    : (isRTL ? styles.bubbleToDiscardRTL : styles.bubbleToDrawLTR),
                ]}
              >
                <View style={styles.guidanceBubble}>
                  <Text style={styles.guidanceText}>
                    {hintTargetsDiscard ? t('guidance.hint.matchTopCard') : t('guidance.hint.drawFromDeck')}
                  </Text>
                  <Pressable
                    onPress={() => guidanceContext && setDismissedHintKey(guidanceContext.key)}
                    style={styles.guidanceDismissBtn}
                  >
                    <Text style={styles.guidanceDismissText}>{t('ui.gotIt')}</Text>
                  </Pressable>
                </View>
                <Text style={[styles.guidanceArrow, hintTargetsDiscard ? styles.arrowRight : styles.arrowLeft]}>
                  {hintTargetsDiscard ? '➜' : '⬅'}
                </Text>
              </View>
            </View>
          ) : null}
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
    position: 'relative',
  },
  guidanceOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  guidanceBubbleWrap: {
    position: 'absolute',
    top: -56,
    width: 170,
    alignItems: 'center',
  },
  bubbleToDrawLTR: { left: -6 },
  bubbleToDiscardLTR: { right: -6 },
  bubbleToDrawRTL: { right: -6 },
  bubbleToDiscardRTL: { left: -6 },
  guidanceBubble: {
    backgroundColor: 'rgba(17,24,39,0.96)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '100%',
  },
  guidanceText: {
    color: '#F9FAFB',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  guidanceDismissBtn: {
    alignSelf: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F59E0B',
  },
  guidanceDismissText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 11,
  },
  guidanceArrow: {
    marginTop: 2,
    color: '#F59E0B',
    fontSize: 20,
    fontWeight: '800',
  },
  arrowLeft: { transform: [{ rotate: '-15deg' }] },
  arrowRight: { transform: [{ rotate: '15deg' }] },
  handArea: {
    backgroundColor: 'rgba(31,41,55,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 24,
  },
})
