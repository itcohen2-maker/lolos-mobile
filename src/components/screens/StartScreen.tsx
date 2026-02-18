import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { useGame } from '../../hooks/useGame'
import Button from '../ui/Button'

export default function StartScreen() {
  const { dispatch } = useGame()
  const [playerCount, setPlayerCount] = useState(2)
  const [names, setNames] = useState<string[]>(Array(10).fill(''))
  const [difficulty, setDifficulty] = useState<'easy' | 'full'>('full')
  const [showRules, setShowRules] = useState(false)

  const maxPlayers = difficulty === 'easy' ? 8 : 10

  const handleStart = () => {
    const players = Array.from({ length: playerCount }, (_, i) => ({
      name: names[i].trim() || `שחקן ${i + 1}`,
    }))
    dispatch({ type: 'START_GAME', players, difficulty })
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>לולוס</Text>
      <Text style={styles.subtitle}>משחק קלפים חשבוני חינוכי</Text>

      <Text style={styles.label}>מספר שחקנים</Text>
      <View style={styles.countRow}>
        {Array.from({ length: maxPlayers - 1 }, (_, i) => i + 2).map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => setPlayerCount(n)}
            style={[styles.countBtn, playerCount === n && styles.countBtnActive]}
          >
            <Text style={[styles.countText, playerCount === n && styles.countTextActive]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>שמות השחקנים</Text>
      {Array.from({ length: playerCount }, (_, i) => (
        <TextInput
          key={i}
          placeholder={`שחקן ${i + 1}`}
          placeholderTextColor="#6B7280"
          value={names[i]}
          onChangeText={(text) => {
            const newNames = [...names]
            newNames[i] = text
            setNames(newNames)
          }}
          style={styles.input}
          textAlign="right"
        />
      ))}

      <Text style={styles.label}>רמת קושי</Text>
      <View style={styles.diffRow}>
        <TouchableOpacity
          style={[styles.diffBtn, difficulty === 'easy' && styles.diffEasy]}
          onPress={() => {
            setDifficulty('easy')
            setPlayerCount((c) => Math.min(c, 8))
          }}
        >
          <Text style={[styles.diffText, difficulty === 'easy' && { color: '#FFF' }]}>
            קל (0-12)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.diffBtn, difficulty === 'full' && styles.diffFull]}
          onPress={() => setDifficulty('full')}
        >
          <Text style={[styles.diffText, difficulty === 'full' && { color: '#FFF' }]}>
            מלא (0-25)
          </Text>
        </TouchableOpacity>
      </View>

      <Button variant="success" size="lg" onPress={handleStart} style={{ width: '100%', marginTop: 12 }}>
        התחל משחק
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onPress={() => setShowRules(!showRules)}
        style={{ width: '100%', marginTop: 8 }}
      >
        {showRules ? 'הסתר חוקים' : 'איך משחקים?'}
      </Button>

      {showRules && (
        <View style={styles.rules}>
          <Text style={styles.rulesTitle}>איך משחקים לולוס</Text>
          <Text style={styles.ruleItem}>1. כל שחקן מקבל 10 קלפים. הראשון שמרוקן את היד מנצח!</Text>
          <Text style={styles.ruleItem}>2. הטל 3 קוביות וצור מספר יעד באמצעות חשבון (+, -, x, ÷).</Text>
          <Text style={styles.ruleItem}>3. שחק קלפי מספר מהיד שסכומם שווה ליעד.</Text>
          <Text style={styles.ruleItem}>4. קלף זהה: שחק קלף התואם לקלף העליון בערימה (עד פעמיים).</Text>
          <Text style={styles.ruleItem}>5. קלפי שבר: חלק את הקלף העליון במכנה השבר.</Text>
          <Text style={styles.ruleItem}>6. קלפי פעולה: השחקן הבא חייב להגן או לשלוף 2 קלפים.</Text>
          <Text style={styles.ruleItem}>7. ג'וקר: משמש כקלף פעולה כלשהו.</Text>
          <Text style={styles.ruleItem}>8. שלישייה בקוביות: כל שאר השחקנים שולפים N קלפים!</Text>
          <Text style={styles.ruleItem}>9. עם קלף אחד ביד - לחץ לולוס! אחרת תשלוף קלף עונשין.</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#111827' },
  container: { padding: 24, paddingTop: 60, alignItems: 'center' },
  title: { fontSize: 48, fontWeight: '900', color: '#F59E0B', letterSpacing: 4 },
  subtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 4, marginBottom: 28 },
  label: { color: '#D1D5DB', fontSize: 13, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 8, marginTop: 16 },
  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start' },
  countBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  countBtnActive: { backgroundColor: '#2563EB' },
  countText: { color: '#D1D5DB', fontWeight: '700', fontSize: 14 },
  countTextActive: { color: '#FFF' },
  input: { width: '100%', backgroundColor: '#374151', borderWidth: 1, borderColor: '#4B5563', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#FFF', fontSize: 14, marginBottom: 6 },
  diffRow: { flexDirection: 'row', gap: 10, width: '100%' },
  diffBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#374151', alignItems: 'center' },
  diffEasy: { backgroundColor: '#16A34A' },
  diffFull: { backgroundColor: '#DC2626' },
  diffText: { color: '#D1D5DB', fontWeight: '600', fontSize: 14 },
  rules: { marginTop: 16, backgroundColor: 'rgba(55,65,81,0.5)', borderRadius: 10, padding: 16, width: '100%' },
  rulesTitle: { color: '#FFF', fontWeight: '700', fontSize: 15, marginBottom: 10, textAlign: 'right' },
  ruleItem: { color: '#D1D5DB', fontSize: 12, marginBottom: 4, lineHeight: 18, textAlign: 'right' },
})
