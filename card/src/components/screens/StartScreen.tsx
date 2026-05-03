import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useGame } from '../../hooks/useGame';
import SalindaLogoOption06 from '../branding/SalindaLogoOption06';
import Button from '../ui/Button';
import { useLocale } from '../../i18n/LocaleContext';
import { CARDS_PER_PLAYER } from '../../../shared/gameConstants';

interface StartScreenProps {
  onBackToChoice?: () => void;
  onHowToPlay?: () => void;
  onShop?: () => void;
  preferredName?: string;
}

export default function StartScreen({
  onBackToChoice,
  onHowToPlay,
  onShop,
  preferredName,
}: StartScreenProps = {}) {
  const { t, isRTL } = useLocale();
  const { dispatch } = useGame();
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState<string[]>(() => {
    const base = Array(10).fill('');
    const first = (preferredName ?? '').trim();
    if (first) base[0] = first;
    return base;
  });
  const [difficulty, setDifficulty] = useState<'easy' | 'full'>('full');
  const [showRules, setShowRules] = useState(false);

  const maxPlayers = difficulty === 'easy' ? 8 : 10;
  const ta = isRTL ? 'right' : 'left';

  useEffect(() => {
    const first = (preferredName ?? '').trim();
    if (!first) return;
    setNames((prev) => {
      // Don't overwrite if the user already typed a first player name.
      if ((prev[0] ?? '').trim().length > 0) return prev;
      const next = [...prev];
      next[0] = first;
      return next;
    });
  }, [preferredName]);

  const handleStart = () => {
    const players = Array.from({ length: playerCount }, (_, i) => ({
      name: names[i].trim() || t('start.playerPlaceholder', { n: String(i + 1) }),
    }));
    dispatch({ type: 'START_GAME', players, difficulty });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topActions}>
        {onBackToChoice ? (
          <Button variant="secondary" size="sm" onPress={onBackToChoice} style={styles.topActionBtn}>
            {t('lobby.backToMode')}
          </Button>
        ) : null}
        {onHowToPlay ? (
          <Button variant="primary" size="sm" onPress={onHowToPlay} style={styles.topActionBtn}>
            {t('mode.howToPlay')}
          </Button>
        ) : null}
        {onShop ? (
          <Button variant="gold" size="sm" onPress={onShop} style={styles.topActionBtn}>
            {t('shop.openShop')}
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" onPress={() => setShowRules((prev) => !prev)} style={styles.topActionBtn}>
          {t('start.rulesButton')}
        </Button>
      </View>
      <View style={styles.logoWrap}>
        <SalindaLogoOption06 width={300} />
      </View>
      <Text style={styles.subtitle}>{t('start.subtitle')}</Text>

      <Text style={[styles.label, { textAlign: ta }]}>{t('start.playerCount')}</Text>
      <View style={styles.countRow}>
        {Array.from({ length: maxPlayers - 1 }, (_, i) => i + 2).map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => setPlayerCount(n)}
            style={[styles.countBtn, playerCount === n && styles.countBtnActive]}
          >
            <Text style={[styles.countText, playerCount === n && styles.countTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { textAlign: ta }]}>{t('start.playerNames')}</Text>
      {Array.from({ length: playerCount }, (_, i) => (
        <TextInput
          key={i}
          placeholder={t('start.playerPlaceholder', { n: String(i + 1) })}
          placeholderTextColor="#6B7280"
          value={names[i]}
          onChangeText={(text) => {
            const newNames = [...names];
            newNames[i] = text;
            setNames(newNames);
          }}
          style={[styles.input, { textAlign: ta }]}
        />
      ))}

      <Text style={[styles.label, { textAlign: ta }]}>{t('start.difficulty')}</Text>
      <View style={styles.diffRow}>
        <TouchableOpacity
          style={[styles.diffBtn, difficulty === 'full' && styles.diffFull]}
          onPress={() => setDifficulty('full')}
        >
          <Text style={[styles.diffText, difficulty === 'full' && { color: '#FFF' }]}>{t('start.diffFull')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.diffBtn, difficulty === 'easy' && styles.diffEasy]}
          onPress={() => {
            setDifficulty('easy');
            setPlayerCount((c) => Math.min(c, 8));
          }}
        >
          <Text style={[styles.diffText, difficulty === 'easy' && { color: '#FFF' }]}>{t('start.diffEasy')}</Text>
        </TouchableOpacity>
      </View>

      <Button
        variant="primary"
        size="lg"
        onPress={handleStart}
        style={{ width: 220, height: 56, borderRadius: 28, marginTop: 12, alignSelf: 'center' }}
      >
        {t('start.startGame')}
      </Button>
      <Button variant="secondary" size="sm" onPress={() => setShowRules(!showRules)} style={{ width: '100%', marginTop: 8 }}>
        {showRules ? t('start.hideRules') : t('start.showRules')}
      </Button>

      {showRules && (
        <View style={styles.rules}>
          <Text style={[styles.rulesTitle, { textAlign: ta }]}>{t('start.rulesTitle')}</Text>
          <View style={styles.newUserBox}>
            <Text style={[styles.newUserTitle, { textAlign: ta }]}>{t('start.quickOpen')}</Text>
            <Text style={[styles.newUserText, { textAlign: ta }]}>{t('welcome.body')}</Text>
          </View>

          <View style={styles.rulesSection}>
            <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('start.goalTitle')}</Text>
            <Text style={[styles.ruleItem, { textAlign: ta }]}>{t('start.rules.goal1', { n: String(CARDS_PER_PLAYER) })}</Text>
            <Text style={[styles.ruleItem, { textAlign: ta }]}>{t('start.rules.goal2')}</Text>
          </View>

          <View style={styles.rulesSection}>
            <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('start.turnTitle')}</Text>
            <Text style={[styles.ruleItem, { textAlign: ta }]}>{t('start.rules.t1')}</Text>
            <Text style={[styles.ruleItem, { textAlign: ta }]}>{t('start.rules.t2')}</Text>
            <Text style={[styles.ruleItem, { textAlign: ta }]}>{t('start.rules.t3')}</Text>
          </View>

          <View style={styles.challengeSection}>
            <Text style={[styles.challengeTitle, { textAlign: ta }]}>{t('start.challengesTitle')}</Text>
            <Text style={[styles.challengeItem, { textAlign: ta }]}>{t('start.rules.c1')}</Text>
            <Text style={[styles.challengeItem, { textAlign: ta }]}>{t('start.rules.c2')}</Text>
            <Text style={[styles.challengeItem, { textAlign: ta }]}>{t('start.rules.c3')}</Text>
          </View>

          <View style={styles.rulesSection}>
            <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('start.cardTypesTitle')}</Text>
            <Text style={[styles.ruleItem, { textAlign: ta }]}>{t('rulesLine.fracCard')}</Text>
            <Text style={[styles.ruleItem, { textAlign: ta }]}>{t('rulesLine.opCard')}</Text>
            <Text style={[styles.ruleItem, { textAlign: ta }]}>{t('rulesLine.jokerCard')}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#111827' },
  container: { padding: 24, paddingTop: 60, alignItems: 'stretch' },
  topActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  topActionBtn: {
    minWidth: 92,
  },
  logoWrap: { alignSelf: 'center', marginBottom: 8, maxWidth: '100%' },
  subtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 4, marginBottom: 28, alignSelf: 'center', textAlign: 'center' },
  label: { color: '#D1D5DB', fontSize: 13, fontWeight: '600', alignSelf: 'stretch', marginBottom: 8, marginTop: 16 },
  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-end', direction: 'ltr' },
  countBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  countBtnActive: { backgroundColor: '#F59E0B' },
  countText: { color: '#D1D5DB', fontWeight: '700', fontSize: 14 },
  countTextActive: { color: '#FFF' },
  input: { width: '100%', backgroundColor: '#374151', borderWidth: 1, borderColor: '#4B5563', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#FFF', fontSize: 14, marginBottom: 6 },
  diffRow: { flexDirection: 'row', gap: 10, width: '100%', direction: 'ltr' },
  diffBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#374151', alignItems: 'center' },
  diffEasy: { backgroundColor: '#16A34A' },
  diffFull: { backgroundColor: '#DC2626' },
  diffText: { color: '#D1D5DB', fontWeight: '600', fontSize: 14 },
  rules: {
    marginTop: 16,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    padding: 16,
    width: '100%',
  },
  rulesTitle: { color: '#FFF', fontWeight: '700', fontSize: 15, marginBottom: 10 },
  newUserBox: { backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.45)', padding: 12, marginBottom: 12 },
  newUserTitle: { fontSize: 14, fontWeight: '800', color: '#F59E0B', marginBottom: 6 },
  newUserText: { color: '#E5E7EB', fontSize: 13, lineHeight: 20 },
  rulesSection: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: { color: '#F9FAFB', fontWeight: '700', fontSize: 13, marginBottom: 6 },
  ruleItem: { color: '#D1D5DB', fontSize: 12, marginBottom: 4, lineHeight: 18 },
  challengeSection: {
    backgroundColor: '#3F1D0B',
    borderWidth: 1,
    borderColor: '#C2410C',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  challengeTitle: { color: '#FDBA74', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  challengeItem: { color: '#FED7AA', fontSize: 12, marginBottom: 4, lineHeight: 18 },
});
