// ============================================================
// LobbyScreens — Create/Join room + Lobby wait
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useMultiplayer } from '../hooks/useMultiplayer';

export function LobbyEntry({ onBackToChoice }: { onBackToChoice?: () => void } = {}) {
  const { createRoom, joinRoom, error, clearError } = useMultiplayer();
  const [step, setStep] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    if (error) {
      const t = setTimeout(clearError, 4000);
      return () => clearTimeout(t);
    }
  }, [error, clearError]);

  const handleCreate = () => {
    if (!playerName.trim()) return;
    createRoom(playerName.trim());
    setStep('create');
  };

  const handleJoin = () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    joinRoom(roomCode.trim(), playerName.trim());
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {onBackToChoice && (
        <TouchableOpacity style={styles.backBtn} onPress={onBackToChoice}>
          <Text style={styles.backBtnText}>← בחירת אופן משחק</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title}>התחבר למשחק</Text>
      <Text style={styles.subtitle}>הזן שם וצור חדר או הצטרף עם קוד</Text>

      <>
        <Text style={styles.label}>השם שלך</Text>
          <TextInput
            style={styles.input}
            value={playerName}
            onChangeText={setPlayerName}
            placeholder="השם שלי"
            placeholderTextColor="#6B7280"
            textAlign="right"
          />
          {step === 'create' && (
            <TouchableOpacity
              style={[styles.primaryBtn, !playerName.trim() && styles.primaryBtnDisabled]}
              onPress={handleCreate}
              disabled={!playerName.trim()}
            >
              <Text style={styles.primaryBtnText}>צור חדר</Text>
            </TouchableOpacity>
          )}
          {step === 'join' && (
            <>
              <Text style={styles.label}>קוד החדר (4 ספרות)</Text>
              <TextInput
                style={styles.input}
                value={roomCode}
                onChangeText={setRoomCode}
                placeholder="1234"
                placeholderTextColor="#6B7280"
                keyboardType="number-pad"
                maxLength={4}
                textAlign="center"
              />
              <TouchableOpacity
                style={[styles.primaryBtn, (!playerName.trim() || roomCode.length < 4) && styles.primaryBtnDisabled]}
                onPress={handleJoin}
                disabled={!playerName.trim() || roomCode.length < 4}
              >
                <Text style={styles.primaryBtnText}>הצטרף לחדר</Text>
              </TouchableOpacity>
            </>
          )}
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(step === 'create' ? 'join' : 'create')}>
          <Text style={styles.secondaryBtnText}>{step === 'create' ? 'יש לי קוד חדר — הצטרף' : 'צור חדר חדש'}</Text>
        </TouchableOpacity>
      </>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </ScrollView>
  );
}

export function LobbyScreen() {
  const { roomCode, players, isHost, startGame, leaveRoom, error, clearError } = useMultiplayer();
  const [difficulty, setDifficulty] = useState<'easy' | 'full'>('full');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (error) {
      const t = setTimeout(clearError, 4000);
      return () => clearTimeout(t);
    }
  }, [error, clearError]);

  const handleStart = () => {
    if (!isHost || players.length < 2) return;
    setStarting(true);
    startGame(difficulty);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => leaveRoom()}>
        <Text style={styles.backBtnText}>← עזוב חדר</Text>
      </TouchableOpacity>
      <Text style={styles.title}>החדר מוכן</Text>
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>קוד החדר</Text>
        <Text style={styles.codeValue}>{roomCode}</Text>
        <Text style={styles.codeHint}>שתף את הקוד עם החברים כדי שיוכלו להצטרף</Text>
      </View>
      <Text style={styles.label}>שחקנים בחדר ({players.length}/6)</Text>
      {players.map((p) => (
        <View key={p.id} style={styles.playerRow}>
          <Text style={styles.playerName}>{p.name}</Text>
          {p.isHost && <Text style={styles.hostBadge}>מארח</Text>}
          {!p.isConnected && <Text style={styles.disconnectedBadge}>מנותק</Text>}
        </View>
      ))}
      {isHost && (
        <>
          <Text style={styles.label}>רמת קושי</Text>
          <View style={styles.diffRow}>
            <TouchableOpacity
              style={[styles.diffBtn, difficulty === 'easy' && styles.diffBtnActive]}
              onPress={() => setDifficulty('easy')}
            >
              <Text style={[styles.diffText, difficulty === 'easy' && styles.diffTextActive]}>קל</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.diffBtn, difficulty === 'full' && styles.diffBtnActive]}
              onPress={() => setDifficulty('full')}
            >
              <Text style={[styles.diffText, difficulty === 'full' && styles.diffTextActive]}>מלא</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, (players.length < 2 || starting) && styles.primaryBtnDisabled]}
            onPress={handleStart}
            disabled={players.length < 2 || starting}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>התחל משחק</Text>
            )}
          </TouchableOpacity>
          {players.length < 2 && (
            <Text style={styles.hint}>נדרשים לפחות 2 שחקנים כדי להתחיל</Text>
          )}
        </>
      )}
      {!isHost && (
        <Text style={styles.waitingText}>מחכים שהמארח יתחיל את המשחק...</Text>
      )}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a1628' },
  container: { padding: 24, paddingTop: 60, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16 },
  backBtnText: { color: '#93C5FD', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '800', color: '#F59E0B', marginBottom: 8 },
  subtitle: { color: '#9CA3AF', fontSize: 14, marginBottom: 24 },
  label: { color: '#D1D5DB', fontSize: 14, fontWeight: '600', alignSelf: 'flex-start', marginTop: 16, marginBottom: 8 },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 8,
  },
  hint: { color: '#6B7280', fontSize: 12, marginTop: 4, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { marginTop: 12 },
  secondaryBtnText: { color: '#93C5FD', fontSize: 14 },
  codeBox: {
    width: '100%',
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  codeLabel: { color: '#93C5FD', fontSize: 12, marginBottom: 4 },
  codeValue: { fontSize: 36, fontWeight: '800', color: '#FFF', letterSpacing: 8 },
  codeHint: { color: '#6B7280', fontSize: 11, marginTop: 8 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(55,65,81,0.5)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  playerName: { color: '#E2E8F0', fontSize: 16, flex: 1, textAlign: 'right' },
  hostBadge: { backgroundColor: '#2563EB', color: '#FFF', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  disconnectedBadge: { color: '#EF4444', fontSize: 10 },
  diffRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 8 },
  diffBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#374151', alignItems: 'center' },
  diffBtnActive: { backgroundColor: '#2563EB' },
  diffText: { color: '#9CA3AF', fontWeight: '600' },
  diffTextActive: { color: '#FFF' },
  waitingText: { color: '#9CA3AF', fontSize: 14, marginTop: 24 },
  errorBox: { marginTop: 16, padding: 12, backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 10, width: '100%' },
  errorText: { color: '#FCA5A5', textAlign: 'center' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16, paddingVertical: 8, paddingHorizontal: 12 },
  backBtnText: { color: '#93C5FD', fontSize: 14, fontWeight: '600' },
});
