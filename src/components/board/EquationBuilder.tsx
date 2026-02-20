import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useGame } from '../../hooks/useGame'
import { Operation } from '../../types/game'
import { checkEquation } from '../../utils/validation'
import Button from '../ui/Button'

const ALL_OPS: Operation[] = ['+', '-', 'x', '÷']

export default function EquationBuilder() {
  const { state, dispatch } = useGame()

  // Local equation-building state
  const [slotDieIndex, setSlotDieIndex] = useState<(number | null)[]>([null, null, null])
  const [ops, setOps] = useState<(Operation)[]>(['+', '+'])
  const [grouping, setGrouping] = useState<'left' | 'right'>('left')

  // Reset when dice or card selection changes
  const selectedKey = state.selectedCards.map((c) => c.id).join(',')
  useEffect(() => {
    setSlotDieIndex([null, null, null])
    setOps(['+', '+'])
    setGrouping('left')
  }, [state.dice, selectedKey])

  // Only render when: dice rolled, select-cards phase, haven't played yet, number cards selected
  if (!state.dice || state.phase !== 'select-cards' || state.hasPlayedCards) return null

  const numberCards = state.selectedCards.filter((c) => c.type === 'number')
  if (numberCards.length === 0) return null

  const diceValues = [state.dice.die1, state.dice.die2, state.dice.die3]
  const targetSum = numberCards.reduce((s, c) => s + (c.value ?? 0), 0)

  // Track which dice are placed in slots
  const usedDiceIndices = new Set(slotDieIndex.filter((i): i is number => i !== null))

  // Filled slot values for display and evaluation
  const filledSlots = slotDieIndex.map((i) => (i !== null ? diceValues[i] : null))
  const filledCount = filledSlots.filter((s) => s !== null).length

  // Evaluate current equation
  const { result } = checkEquation(filledSlots, ops, grouping)

  const handleDiceTap = (dieIndex: number) => {
    if (usedDiceIndices.has(dieIndex)) {
      // Remove this die — shift subsequent slots left
      setSlotDieIndex((prev) => {
        const next = prev.filter((s) => s !== dieIndex)
        while (next.length < 3) next.push(null)
        return next
      })
    } else {
      // Place in next empty slot
      setSlotDieIndex((prev) => {
        const next = [...prev]
        const emptyIdx = next.findIndex((s) => s === null)
        if (emptyIdx !== -1) next[emptyIdx] = dieIndex
        return next
      })
    }
  }

  const handleSlotTap = (slotIndex: number) => {
    if (slotDieIndex[slotIndex] === null) return
    // Remove die from slot and shift subsequent slots left
    setSlotDieIndex((prev) => {
      const next = prev.filter((_, i) => i !== slotIndex)
      while (next.length < 3) next.push(null)
      return next
    })
  }

  const handleOpTap = (opIndex: number) => {
    setOps((prev) => {
      const next = [...prev]
      const currentIdx = ALL_OPS.indexOf(next[opIndex])
      next[opIndex] = ALL_OPS[(currentIdx + 1) % ALL_OPS.length]
      return next
    })
  }

  const handleConfirm = () => {
    if (filledCount < 2 || result === null || result !== targetSum) {
      Alert.alert('שגיאה', 'המשוואה אינה נכונה או חסרה!')
      return
    }
    // Also verify it's a valid target from the dice
    const isValidTarget = state.validTargets.some((t) => t.result === result)
    if (!isValidTarget) {
      Alert.alert('שגיאה', 'המשוואה אינה נכונה או חסרה!')
      return
    }
    dispatch({ type: 'CONFIRM_EQUATION', equationResult: result })
  }

  // Build equation display string
  const eqParts: string[] = []
  if (filledSlots[0] !== null) eqParts.push(String(filledSlots[0]))
  if (filledSlots[1] !== null) {
    eqParts.push(ops[0])
    eqParts.push(String(filledSlots[1]))
  }
  if (filledSlots[2] !== null) {
    eqParts.push(ops[1])
    eqParts.push(String(filledSlots[2]))
  }

  let equationDisplay = ''
  if (filledCount === 3) {
    if (grouping === 'left') {
      equationDisplay = `(${filledSlots[0]} ${ops[0]} ${filledSlots[1]}) ${ops[1]} ${filledSlots[2]}`
    } else {
      equationDisplay = `${filledSlots[0]} ${ops[0]} (${filledSlots[1]} ${ops[1]} ${filledSlots[2]})`
    }
  } else if (filledCount === 2) {
    equationDisplay = `${filledSlots[0]} ${ops[0]} ${filledSlots[1]}`
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>בנה/י משוואה מהקוביות</Text>

      {/* Available dice */}
      <View style={styles.diceRow}>
        <Text style={styles.label}>קוביות:</Text>
        {diceValues.map((val, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.diceBtn, usedDiceIndices.has(i) && styles.diceBtnUsed]}
            onPress={() => handleDiceTap(i)}
          >
            <Text style={[styles.diceBtnText, usedDiceIndices.has(i) && styles.diceBtnTextUsed]}>
              {val}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Equation slots */}
      <View style={styles.equationRow}>
        <TouchableOpacity style={styles.slot} onPress={() => handleSlotTap(0)}>
          <Text style={styles.slotText}>{filledSlots[0] ?? '_'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.opBtn} onPress={() => handleOpTap(0)}>
          <Text style={styles.opText}>{ops[0]}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.slot} onPress={() => handleSlotTap(1)}>
          <Text style={styles.slotText}>{filledSlots[1] ?? '_'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.opBtn} onPress={() => handleOpTap(1)}>
          <Text style={styles.opText}>{ops[1]}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.slot} onPress={() => handleSlotTap(2)}>
          <Text style={styles.slotText}>{filledSlots[2] ?? '_'}</Text>
        </TouchableOpacity>
      </View>

      {/* Grouping toggle — only relevant with 3 dice */}
      {filledCount === 3 && (
        <View style={styles.groupingRow}>
          <Text style={styles.label}>סוגריים:</Text>
          <TouchableOpacity
            style={[styles.groupBtn, grouping === 'left' && styles.groupBtnActive]}
            onPress={() => setGrouping('left')}
          >
            <Text style={[styles.groupBtnText, grouping === 'left' && styles.groupBtnTextActive]}>
              (A {ops[0]} B) {ops[1]} C
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.groupBtn, grouping === 'right' && styles.groupBtnActive]}
            onPress={() => setGrouping('right')}
          >
            <Text style={[styles.groupBtnText, grouping === 'right' && styles.groupBtnTextActive]}>
              A {ops[0]} (B {ops[1]} C)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Equation preview + result */}
      <View style={styles.resultRow}>
        {equationDisplay ? (
          <Text style={styles.equationPreview}>
            {equationDisplay} = {result !== null ? result : '?'}
          </Text>
        ) : (
          <Text style={styles.equationHint}>הנח/י קוביות במשבצות</Text>
        )}
      </View>

      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>יעד (סכום הקלפים):</Text>
        <Text style={[styles.targetValue, result === targetSum && styles.targetMatch]}>
          {targetSum}
        </Text>
      </View>

      {/* Confirm button */}
      <Button variant="success" onPress={handleConfirm}>
        אשר
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(30,58,95,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  title: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    color: '#9CA3AF',
    fontSize: 12,
    marginRight: 6,
  },
  diceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  diceBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 2,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceBtnUsed: {
    backgroundColor: 'rgba(107,114,128,0.2)',
    borderColor: '#4B5563',
  },
  diceBtnText: {
    color: '#F59E0B',
    fontSize: 20,
    fontWeight: '800',
  },
  diceBtnTextUsed: {
    color: '#6B7280',
  },
  equationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  slot: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#6B7280',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.5)',
  },
  slotText: {
    color: '#E5E7EB',
    fontSize: 18,
    fontWeight: '700',
  },
  opBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  opText: {
    color: '#C4B5FD',
    fontSize: 18,
    fontWeight: '700',
  },
  groupingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  groupBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: 'rgba(31,41,55,0.5)',
  },
  groupBtnActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  groupBtnText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  groupBtnTextActive: {
    color: '#93C5FD',
  },
  resultRow: {
    alignItems: 'center',
  },
  equationPreview: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  equationHint: {
    color: '#6B7280',
    fontSize: 13,
    fontStyle: 'italic',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  targetLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  targetValue: {
    color: '#FDE68A',
    fontSize: 18,
    fontWeight: '800',
  },
  targetMatch: {
    color: '#4ADE80',
  },
})
