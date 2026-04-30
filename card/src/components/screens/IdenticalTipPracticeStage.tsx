import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocale } from '../../i18n/LocaleContext'
import { buildIdenticalPracticePreset } from '../../tutorial/identicalPracticePreset'

type Props = {
  onStartPractice?: () => void
}

export default function IdenticalTipPracticeStage({ onStartPractice }: Props) {
  const { t } = useLocale()
  const preset = buildIdenticalPracticePreset(7)

  return (
    <View style={styles.card}>
      <Text style={styles.badge}>{t('tutorial.identicalMulti.stageChip')}</Text>
      <Text style={styles.title}>{t('tutorial.identicalMulti.didYouKnow')}</Text>
      <Text style={styles.boldLine}>{t('tutorial.identicalMulti.bestTip')}</Text>
      <Text style={styles.body}>{t('tutorial.identicalMulti.body')}</Text>

      <View style={styles.resultWrap}>
        <Text style={styles.resultLabel}>{t('tutorial.identicalMulti.targetLabel')}</Text>
        <Text style={styles.resultValue}>{preset.target}</Text>
      </View>

      <Text style={styles.fanLabel}>{t('tutorial.identicalMulti.fanLabel')}</Text>
      <View style={styles.fanRow}>
        {preset.fanCards.map((card) => (
          <View key={card.id} style={styles.fanCard}>
            <Text style={styles.fanCardValue}>{card.value}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.cta} onPress={onStartPractice}>
        <Text style={styles.ctaText}>{t('tutorial.identicalMulti.cta')}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.45)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  badge: {
    alignSelf: 'center',
    color: '#111827',
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
  },
  title: { color: '#FDE68A', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  boldLine: { color: '#F9FAFB', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  body: { color: '#E5E7EB', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  resultWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(17,24,39,0.35)',
  },
  resultLabel: { color: '#FCD34D', fontSize: 11, fontWeight: '700' },
  resultValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  fanLabel: { color: '#FDE68A', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  fanRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  fanCard: {
    width: 36,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(209,213,219,0.4)',
    backgroundColor: 'rgba(31,41,55,0.65)',
  },
  fanCardValue: { color: '#F9FAFB', fontSize: 18, fontWeight: '800' },
  cta: {
    alignSelf: 'center',
    marginTop: 4,
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ctaText: { color: '#111827', fontSize: 12, fontWeight: '700' },
})
