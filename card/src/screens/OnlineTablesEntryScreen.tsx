import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useMultiplayer } from '../hooks/useMultiplayer';
import type { LobbyTableSummary } from '../../shared/types';
import { useLocale } from '../i18n/LocaleContext';
import SalindaLogoOption06 from '../components/branding/SalindaLogoOption06';
import { CARDS_PER_PLAYER } from '../../shared/gameConstants';
import TablesLobbyScreen, { pickQuickMatchTable } from './TablesLobbyScreen';
import { LanguageToggle, parseJoinParamsFromUrl } from './OnlineTableScreens';

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, isRTL } = useLocale();
  const ta = isRTL ? 'right' : 'left';
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.logoWrap}>
            <SalindaLogoOption06 width={220} />
          </View>
          <Text style={styles.modalTitle}>{t('start.rulesTitle')}</Text>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.rulesSectionTitle, { textAlign: ta }]}>{t('start.goalTitle')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.goal1', { n: CARDS_PER_PLAYER })}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.goal2')}</Text>
            <Text style={[styles.rulesSectionTitle, { textAlign: ta }]}>{t('start.turnTitle')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.t1')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.t2')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.t3')}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>{t('lobby.rulesModalClose')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function OnlineTablesEntryScreen({
  defaultPlayerName,
  onBackToChoice,
}: {
  defaultPlayerName?: string;
  onBackToChoice?: () => void;
}) {
  const { t } = useLocale();
  const { profile } = useAuth();
  const { connected, createTable, joinTable, joinPrivateTable, refreshTables, tables, error, clearError, setServerUrl } = useMultiplayer();
  const [playerName, setPlayerName] = useState((defaultPlayerName ?? '').slice(0, 7));
  const [privateJoinRoomCode, setPrivateJoinRoomCode] = useState('');
  const [privateJoinCode, setPrivateJoinCode] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    refreshTables();
  }, [refreshTables]);

  useEffect(() => {
    if (!connected) return;
    refreshTables();
    const timer = setInterval(() => refreshTables(), 5000);
    return () => clearInterval(timer);
  }, [connected, refreshTables]);

  useEffect(() => {
    if (error) {
      setIsConnecting(false);
      const timer = setTimeout(clearError, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  useEffect(() => {
    if (!isConnecting) return;
    const timer = setTimeout(() => setIsConnecting(false), 15000);
    return () => clearTimeout(timer);
  }, [isConnecting]);

  useEffect(() => {
    const { roomCode, inviteCode, serverUrl, name } = parseJoinParamsFromUrl();
    if (!roomCode) return;
    setPrivateJoinRoomCode(roomCode.replace(/\D/g, '').slice(0, 4));
    setPrivateJoinCode((inviteCode ?? '').replace(/\D/g, '').slice(0, 6));
    if (name) setPlayerName(name.slice(0, 7));
    if (serverUrl) setServerUrl(serverUrl);
  }, [setServerUrl]);

  useEffect(() => {
    if (playerName.trim().length > 0) return;
    if (!defaultPlayerName) return;
    setPlayerName(defaultPlayerName.slice(0, 7));
  }, [defaultPlayerName, playerName]);

  const handleCreateTable = () => {
    if (!playerName.trim()) return;
    setIsConnecting(true);
    createTable(playerName.trim());
  };

  const handleJoinTable = (table: LobbyTableSummary) => {
    if (!playerName.trim()) return;
    if (table.visibility === 'private_locked') {
      setPrivateJoinCode('');
      setPrivateJoinRoomCode(table.roomCode);
      return;
    }
    setIsConnecting(true);
    joinTable(table.roomCode, playerName.trim());
  };

  const handleQuickMatch = () => {
    if (!playerName.trim()) return;
    const candidate = pickQuickMatchTable(tables);
    setIsConnecting(true);
    if (candidate) {
      joinTable(candidate.roomCode, playerName.trim());
      return;
    }
    createTable(playerName.trim());
  };

  const handleSubmitPrivateJoin = () => {
    if (!playerName.trim() || privateJoinCode.length < 6) return;
    setIsConnecting(true);
    joinPrivateTable(privateJoinRoomCode, privateJoinCode, playerName.trim());
  };

  return (
    <>
      <Modal visible={isConnecting} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.connectingCard}>
            <ActivityIndicator size="large" color="#FDE047" />
            <Text style={styles.connectingTitle}>{t('mp.connectingTitle')}</Text>
            <Text style={styles.connectingBody}>{t('mp.connectingBody')}</Text>
          </View>
        </View>
      </Modal>
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <TablesLobbyScreen
        balance={profile?.total_coins ?? 0}
        error={error}
        headerAccessory={<LanguageToggle />}
        onBack={onBackToChoice}
        onCreateTable={handleCreateTable}
        onJoinTable={handleJoinTable}
        onOpenRules={() => setRulesOpen(true)}
        onPlayerNameChange={setPlayerName}
        onQuickMatch={handleQuickMatch}
        onRefresh={refreshTables}
        playerName={playerName}
        tables={tables}
      />
      <Modal
        visible={privateJoinRoomCode.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setPrivateJoinRoomCode('')}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.privateJoinCard}>
            <Text style={styles.modalTitle}>{t('lobby.inviteCodeLabel')}</Text>
            <Text style={styles.roomCode}>{privateJoinRoomCode}</Text>
            <View style={styles.inputShell}>
              <TextInput
                style={styles.input}
                value={privateJoinCode}
                onChangeText={(value) => setPrivateJoinCode(value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('lobby.inviteCodePlaceholder')}
                placeholderTextColor="#94A3B8"
                textAlign="center"
                maxLength={6}
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, (!playerName.trim() || privateJoinCode.length < 6) && styles.primaryButtonDisabled]}
              onPress={handleSubmitPrivateJoin}
              disabled={!playerName.trim() || privateJoinCode.length < 6}
            >
              <Text style={styles.primaryButtonText}>{t('lobby.joinTable')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setPrivateJoinCode('');
                setPrivateJoinRoomCode('');
              }}
            >
              <Text style={styles.closeButtonText}>{t('lobby.rulesModalClose')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
    padding: 18,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  rulesSectionTitle: {
    color: '#FCD34D',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 12,
  },
  rulesLine: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  closeButton: {
    marginTop: 12,
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  connectingCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(253,224,71,0.55)',
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  connectingTitle: {
    color: '#FDE047',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 6,
  },
  connectingBody: {
    color: '#CBD5E1',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  privateJoinCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    padding: 18,
  },
  roomCode: {
    color: '#FDE68A',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 10,
  },
  inputShell: {
    width: '100%',
    backgroundColor: '#D4A010',
    borderRadius: 18,
    padding: 3,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    backgroundColor: '#132238',
    borderWidth: 1,
    borderColor: 'rgba(255,240,180,0.22)',
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
});
