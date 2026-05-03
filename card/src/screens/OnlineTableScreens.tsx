import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useMultiplayer } from '../hooks/useMultiplayer';
import type {
  BotDifficulty,
  Fraction,
  HostGameSettings,
  LobbyTableSummary,
  LobbyTableVisibility,
  Operation,
} from '../../shared/types';
import type { MsgParams } from '../../shared/i18n';
import { useLocale } from '../i18n/LocaleContext';
import SalindaLogoOption06 from '../components/branding/SalindaLogoOption06';
import { brand } from '../theme/brand';
import { CARDS_PER_PLAYER } from '../../shared/gameConstants';
import { pickQuickMatchTable } from './TablesLobbyScreen';

const WEB_INVITE_BASE_STORAGE_KEY = 'salinda_web_invite_base';
const ALL_FRACTION_KINDS: readonly Fraction[] = ['1/2', '1/3', '1/4', '1/5'];

type TFn = (key: string, params?: MsgParams) => string;

function lobbyTimerLabel(t: TFn, ts: HostGameSettings['timerSetting'], customSec: number): string {
  if (ts === 'off') return t('lobby.timerOff');
  if (ts === 'custom') {
    return customSec >= 60
      ? t('lobby.timerFmtMinSec', { m: Math.floor(customSec / 60), s: customSec % 60 })
      : t('lobby.timerSec', { n: customSec });
  }
  if (ts === '60') return t('lobby.timerMin');
  if (ts === '90') return t('lobby.timerMinHalf');
  return t('lobby.timerSec', { n: ts });
}

function countdownSeconds(deadlineAt: number | null): number | null {
  if (!deadlineAt) return null;
  return Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();
  return (
    <View style={styles.langRow}>
      <Text style={styles.langLabel}>{t('lang.label')}:</Text>
      <TouchableOpacity onPress={() => void setLocale('he')} style={[styles.langBtn, locale === 'he' && styles.langBtnActive]}>
        <Text style={[styles.langBtnText, locale === 'he' && styles.langBtnTextActive]}>{t('lang.he')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => void setLocale('en')} style={[styles.langBtn, locale === 'en' && styles.langBtnActive]}>
        <Text style={[styles.langBtnText, locale === 'en' && styles.langBtnTextActive]}>{t('lang.en')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function getInviteWebBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_WEB_APP_URL) {
    return String(process.env.EXPO_PUBLIC_WEB_APP_URL).trim();
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const pathname = window.location.pathname || '/';
    const cleanPath = pathname === '/' ? '' : pathname.replace(/\/$/, '');
    return `${window.location.origin}${cleanPath}`;
  }
  return '';
}

function isLocalServerUrl(url: string): boolean {
  const raw = (url || '').trim().toLowerCase();
  return raw.includes('localhost') || raw.includes('127.0.0.1') || raw.includes('0.0.0.0') || raw.includes('10.0.2.2');
}

function guestInviteSearchParams(roomCode: string, serverUrl: string, inviteCode?: string | null): URLSearchParams {
  const fallbackPublicServer =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SERVER_URL
      ? String(process.env.EXPO_PUBLIC_SERVER_URL).trim()
      : '';
  const safeServerUrl = isLocalServerUrl(serverUrl) ? fallbackPublicServer : serverUrl.trim();
  const params = new URLSearchParams({ room: roomCode });
  if (inviteCode?.trim()) params.set('invite', inviteCode.trim());
  if (safeServerUrl) params.set('server', safeServerUrl);
  return params;
}

export function parseJoinParamsFromUrl(): { roomCode?: string; inviteCode?: string; serverUrl?: string; name?: string } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      roomCode: params.get('room') ?? undefined,
      inviteCode: params.get('invite') ?? undefined,
      serverUrl: params.get('server') ?? undefined,
      name: params.get('name') ?? undefined,
    };
  } catch {
    return {};
  }
}

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, isRTL } = useLocale();
  const ta = isRTL ? 'right' : 'left';
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.rulesModalLogoWrap}>
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
          <TouchableOpacity style={styles.rulesModalCloseBtn} onPress={onClose}>
            <Text style={styles.rulesModalCloseBtnText}>{t('lobby.rulesModalClose')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function LobbyEntry({
  onBackToChoice,
  defaultPlayerName,
  onOpenCelebrationMockup: _onOpenCelebrationMockup,
}: {
  onBackToChoice?: () => void;
  defaultPlayerName?: string;
  onOpenCelebrationMockup?: () => void;
} = {}) {
  const { t, isRTL } = useLocale();
  const { createTable, joinTable, joinPrivateTable, refreshTables, tables, error, clearError, setServerUrl } = useMultiplayer();
  const ta = isRTL ? 'right' : 'left';
  const [playerName, setPlayerName] = useState((defaultPlayerName ?? '').slice(0, 7));
  const [privateJoinRoomCode, setPrivateJoinRoomCode] = useState('');
  const [privateJoinCode, setPrivateJoinCode] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [, setCountdownTick] = useState(Date.now());

  useEffect(() => {
    refreshTables();
  }, [refreshTables]);

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

  useEffect(() => {
    const hasCountdown = tables.some((table) => table.countdownEndsAt != null);
    if (!hasCountdown) return;
    const timer = setInterval(() => setCountdownTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tables]);

  const renderTableStatus = (table: LobbyTableSummary) => {
    if (table.status === 'countdown') return t('lobby.countdownRunning', { n: countdownSeconds(table.countdownEndsAt) ?? 0 });
    if (table.status === 'full') return t('lobby.tableFull');
    return t('lobby.tableWaiting');
  };

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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <LanguageToggle />
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
      {onBackToChoice && (
        <TouchableOpacity style={styles.backBtn} onPress={onBackToChoice}>
          <Text style={styles.backBtnText}>{t('lobby.backToMode')}</Text>
        </TouchableOpacity>
      )}
      <View style={styles.logoWrap}>
        <SalindaLogoOption06 width={260} />
      </View>
      <Text style={styles.title}>{t('lobby.tablesTitle')}</Text>
      <Text style={styles.subtitle}>{t('lobby.tablesSubtitle')}</Text>
      <TouchableOpacity style={styles.rulesLinkBtn} onPress={() => setRulesOpen(true)}>
        <Text style={styles.rulesLinkText}>הדרכה | {t('start.showRules')}</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { alignSelf: 'center', textAlign: 'center' }]}>{t('lobby.yourName')}</Text>
      <View style={styles.inputShell}>
        <TextInput
          style={styles.input}
          value={playerName}
          onChangeText={(value) => setPlayerName(value.slice(0, 7))}
          placeholder={t('lobby.namePlaceholder')}
          placeholderTextColor="#94A3B8"
          textAlign="center"
          maxLength={7}
        />
      </View>
      <TouchableOpacity style={[styles.primaryBtn, !playerName.trim() && styles.primaryBtnDisabled]} onPress={() => {
        if (!playerName.trim()) return;
        setIsConnecting(true);
        createTable(playerName.trim());
      }} disabled={!playerName.trim()}>
        <Text style={styles.primaryBtnText}>{t('lobby.createTable')}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>{t('lobby.createHint')}</Text>

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.label, { marginTop: 0 }]}>{t('lobby.availableTables')}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={refreshTables}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>
      {tables.length === 0 ? (
        <View style={styles.emptyTablesBox}>
          <Text style={[styles.infoText, { textAlign: 'center' }]}>{t('lobby.noTables')}</Text>
        </View>
      ) : (
        tables.map((table) => {
          const disabled = table.status === 'countdown' || table.status === 'full' || table.status === 'in_game';
          return (
            <View key={table.roomCode} style={styles.tableCard}>
              <View style={styles.tableTopRow}>
                <Text style={styles.tableCode}>{table.roomCode}</Text>
                <Text style={[styles.tableBadge, table.visibility === 'private_locked' && styles.tableBadgePrivate]}>
                  {table.visibility === 'private_locked' ? t('lobby.tablePrivate') : t('lobby.tablePublic')}
                </Text>
              </View>
              <Text style={[styles.tableHost, { textAlign: ta }]}>{table.hostName}</Text>
              <Text style={[styles.tableMeta, { textAlign: ta }]}>{t('lobby.tablePlayers', { count: table.currentParticipants, max: table.maxParticipants })}</Text>
              <Text style={[styles.tableMeta, { textAlign: ta }]}>{renderTableStatus(table)}</Text>
              {table.status === 'countdown' && (
                <Text style={[styles.tableMetaAccent, styles.tableCountdownNotice, { textAlign: ta }]}>
                  {t('lobby.startingSoonBanner')}
                </Text>
              )}
              {table.hasRandomJoiner && <Text style={[styles.tableMetaAccent, { textAlign: ta }]}>{t('lobby.randomJoiner')}</Text>}
              <TouchableOpacity
                style={[styles.tableActionBtn, table.visibility === 'private_locked' && styles.tableActionBtnPrivate, (disabled || !playerName.trim()) && styles.primaryBtnDisabled]}
                disabled={disabled || !playerName.trim()}
                onPress={() => {
                  if (table.visibility === 'private_locked') {
                    setPrivateJoinRoomCode(table.roomCode);
                    return;
                  }
                  setIsConnecting(true);
                  joinTable(table.roomCode, playerName.trim());
                }}
              >
                <Text style={styles.tableActionBtnText}>
                  {disabled ? renderTableStatus(table) : table.visibility === 'private_locked' ? t('lobby.enterCode') : t('lobby.joinTable')}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {privateJoinRoomCode.length > 0 && (
        <View style={styles.privateJoinCard}>
          <Text style={[styles.label, { marginTop: 0 }]}>{t('lobby.inviteCodeLabel')}</Text>
          <Text style={styles.privateJoinRoomCode}>{privateJoinRoomCode}</Text>
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
            style={[styles.primaryBtn, (!playerName.trim() || privateJoinCode.length < 6) && styles.primaryBtnDisabled]}
            onPress={() => {
              if (!playerName.trim() || privateJoinCode.length < 6) return;
              setIsConnecting(true);
              joinPrivateTable(privateJoinRoomCode, privateJoinCode, playerName.trim());
            }}
            disabled={!playerName.trim() || privateJoinCode.length < 6}
          >
            <Text style={styles.primaryBtnText}>{t('lobby.joinTable')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </ScrollView>
  );
}

export function LobbyScreen({ onOpenCelebrationMockup: _onOpenCelebrationMockup }: { onOpenCelebrationMockup?: () => void } = {}) {
  const { t, isRTL } = useLocale();
  const {
    roomCode,
    currentInviteCode,
    currentTableVisibility,
    players,
    tables,
    isHost,
    configureTable,
    startTableCountdown,
    leaveRoom,
    error,
    clearError,
    toast,
    clearToast,
    startBotGame,
    serverUrl,
  } = useMultiplayer();
  const ta = isRTL ? 'right' : 'left';
  const currentTable = tables.find((table) => table.roomCode === roomCode) ?? null;
  const [difficulty, setDifficulty] = useState<'easy' | 'full'>('full');
  const [enabledOperators, setEnabledOperators] = useState<Operation[]>(['+', '-', 'x', '÷' as Operation]);
  const [showFractions, setShowFractions] = useState(true);
  const [fractionKinds, setFractionKinds] = useState<Fraction[]>([...ALL_FRACTION_KINDS]);
  const [showPossibleResults, setShowPossibleResults] = useState(true);
  const [showSolveExercise, setShowSolveExercise] = useState(true);
  const [timerSetting, setTimerSetting] = useState<HostGameSettings['timerSetting']>('off');
  const [timerCustomSeconds, setTimerCustomSeconds] = useState(60);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [botDisplayName, setBotDisplayName] = useState('');
  const [visibility, setVisibility] = useState<LobbyTableVisibility>('public');
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [manualWebInviteBase, setManualWebInviteBase] = useState('');
  const [startingBot, setStartingBot] = useState(false);
  const [, setTick] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(WEB_INVITE_BASE_STORAGE_KEY)
      .then((value) => {
        if (!cancelled && value?.trim()) setManualWebInviteBase(value.trim());
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  useEffect(() => {
    if (currentTableVisibility) {
      setVisibility(currentTableVisibility);
    }
  }, [currentTableVisibility]);

  useEffect(() => {
    if (currentTable?.countdownEndsAt == null) return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [currentTable?.countdownEndsAt]);

  useEffect(() => {
    const value = manualWebInviteBase.trim();
    const timer = setTimeout(() => {
      if (value) void AsyncStorage.setItem(WEB_INVITE_BASE_STORAGE_KEY, value);
      else void AsyncStorage.removeItem(WEB_INVITE_BASE_STORAGE_KEY);
    }, 300);
    return () => clearTimeout(timer);
  }, [manualWebInviteBase]);

  useEffect(() => {
    if (!copyFeedback) return;
    const timer = setTimeout(() => setCopyFeedback(null), 2500);
    return () => clearTimeout(timer);
  }, [copyFeedback]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, 6000);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  const configuredWebBase = getInviteWebBaseUrl().replace(/\/$/, '');
  const inviteSuffix = useMemo(() => {
    if (!roomCode) return '';
    return `?${guestInviteSearchParams(roomCode, serverUrl, currentInviteCode).toString()}`;
  }, [roomCode, serverUrl, currentInviteCode]);
  const effectiveWebBase = (manualWebInviteBase.trim() || configuredWebBase).replace(/\/$/, '');
  const inviteLink = useMemo(() => {
    if (!roomCode || !effectiveWebBase) return '';
    return `${effectiveWebBase}${inviteSuffix}`;
  }, [roomCode, effectiveWebBase, inviteSuffix]);
  const shareRoomMessage = useMemo(() => {
    if (!roomCode) return '';
    const lines = [
      t('lobby.shareCodeHint'),
      `${t('lobby.roomCodeLabel')}: ${roomCode}`,
      currentInviteCode ? `${t('lobby.inviteCodeLabel')}: ${currentInviteCode}` : null,
      inviteLink || null,
    ].filter((line): line is string => Boolean(line));
    return lines.join('\n');
  }, [currentInviteCode, inviteLink, roomCode, t]);
  const humanCount = players.filter((player) => !player.isBot).length;
  const configured = configSaved || currentTable != null;
  const countdownRemaining = countdownSeconds(currentTable?.countdownEndsAt ?? null);
  const roomStatusCard = useMemo(() => {
    if (!configured || !currentTable) return null;
    if (currentTable.status === 'countdown') {
      return {
        accentStyle: styles.infoBoxCountdown,
        primary: t('lobby.countdownAnnouncement', { n: countdownRemaining ?? 0 }),
        secondary: t('lobby.startingSoonBanner'),
      };
    }
    if (humanCount < 2) {
      return {
        accentStyle: styles.infoBoxMuted,
        primary: t('lobby.waitingForMorePlayers'),
        secondary: t('lobby.minPlayers'),
      };
    }
    if (isHost) {
      return {
        accentStyle: styles.infoBoxReady,
        primary: t('lobby.hostCanStartCountdown'),
        secondary: t('lobby.countdownCta'),
      };
    }
    return {
      accentStyle: styles.infoBoxMuted,
      primary: t('lobby.waitHost'),
      secondary: t('lobby.waitingRoomHint'),
    };
  }, [configured, countdownRemaining, currentTable, humanCount, isHost, t]);

  const buildGameSettings = (): HostGameSettings => ({
    diceMode: '3',
    showFractions,
    showPossibleResults,
    showSolveExercise,
    mathRangeMax: difficulty === 'easy' ? 12 : 25,
    enabledOperators: [...enabledOperators],
    allowNegativeTargets: false,
    fractionKinds: showFractions ? (fractionKinds.length > 0 ? fractionKinds : [...ALL_FRACTION_KINDS]) : [],
    difficultyStage: difficulty === 'easy' ? 'A' : 'H',
    abVariant: difficulty === 'easy' ? 'control_0_12_plus' : 'variant_0_15_plus',
    timerSetting,
    timerCustomSeconds: timerSetting === 'custom' ? timerCustomSeconds : 60,
    botDifficulty,
    ...(botDisplayName.trim() ? { botDisplayName: botDisplayName.trim().slice(0, 24) } : {}),
  });

  const summaryText = useMemo(() => {
    const timerSeconds = timerSetting === 'custom' ? timerCustomSeconds : 60;
    return [
      t('lobby.summary.difficulty', { value: difficulty === 'easy' ? t('lobby.diffEasyRange') : t('lobby.diffFullRange') }),
      t('lobby.summary.fractions', { value: showFractions ? t('lobby.yes') : t('lobby.no') }),
      t('lobby.summary.possible', { value: showPossibleResults ? t('lobby.show') : t('lobby.hide') }),
      t('lobby.summary.solve', { value: showSolveExercise ? t('lobby.on') : t('lobby.off') }),
      t('lobby.summary.timer', { value: lobbyTimerLabel(t, timerSetting, timerSeconds) }),
    ].join('\n');
  }, [difficulty, showFractions, showPossibleResults, showSolveExercise, timerSetting, timerCustomSeconds, t]);

  const handleSaveConfiguration = () => {
    configureTable({
      visibility,
      maxParticipants,
      difficulty,
      gameSettings: buildGameSettings(),
    });
    setConfigSaved(true);
  };

  const handleShareRoomCode = async () => {
    if (!shareRoomMessage) return;
    try {
      await Share.share({ message: shareRoomMessage });
    } catch {
      // ignore user cancel / unavailable share target
    }
  };

  const handleCopyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await Clipboard.setStringAsync(roomCode);
      setCopyFeedback(null);
    } catch {
      setCopyFeedback(t('lobby.copyFail'));
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <LanguageToggle />
      <TouchableOpacity style={styles.backBtn} onPress={leaveRoom}>
        <Text style={styles.backBtnText}>{t('lobby.leaveRoom')}</Text>
      </TouchableOpacity>
      <View style={styles.logoWrap}>
        <SalindaLogoOption06 width={260} />
      </View>
      <Text style={styles.title}>{configured ? t('lobby.waitingRoomTitle') : t('lobby.configureTitle')}</Text>
      <Text style={styles.subtitle}>{configured ? t('lobby.waitingRoomHint') : t('lobby.configureHint')}</Text>

      {!configured && isHost && (
        <>
          <Text style={styles.label}>{t('start.wheel.numberRange')}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.optionBtn, difficulty === 'full' && styles.optionBtnActive]} onPress={() => setDifficulty('full')}>
              <Text style={[styles.optionBtnText, difficulty === 'full' && styles.optionBtnTextActive]}>0-25</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, difficulty === 'easy' && styles.optionBtnActive]} onPress={() => setDifficulty('easy')}>
              <Text style={[styles.optionBtnText, difficulty === 'easy' && styles.optionBtnTextActive]}>0-12</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t('lobby.privateToggle')}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.optionBtn, visibility === 'public' && styles.optionBtnActive]} onPress={() => setVisibility('public')}>
              <Text style={[styles.optionBtnText, visibility === 'public' && styles.optionBtnTextActive]}>{t('lobby.tablePublic')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionBtn, visibility === 'private_locked' && styles.optionBtnActive]} onPress={() => setVisibility('private_locked')}>
              <Text style={[styles.optionBtnText, visibility === 'private_locked' && styles.optionBtnTextActive]}>{t('lobby.tablePrivate')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>{t('lobby.privateHint')}</Text>

          <Text style={styles.label}>{t('lobby.maxParticipants')}</Text>
          <View style={styles.countRow}>
            {Array.from({ length: 5 }, (_, index) => index + 2).map((count) => (
              <TouchableOpacity key={count} style={[styles.countBtn, maxParticipants === count && styles.countBtnActive]} onPress={() => setMaxParticipants(count)}>
                <Text style={[styles.countBtnText, maxParticipants === count && styles.countBtnTextActive]}>{count}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowAdvanced((value) => !value)}>
            <Text style={styles.secondaryBtnText}>{showAdvanced ? t('lobby.advancedToggleHide') : t('lobby.advancedToggleShow')}</Text>
          </TouchableOpacity>

          {showAdvanced && (
            <>
              <Text style={styles.label}>{t('lobby.fractions')}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.optionBtn, showFractions && styles.optionBtnActive]} onPress={() => setShowFractions(true)}>
                  <Text style={[styles.optionBtnText, showFractions && styles.optionBtnTextActive]}>{t('lobby.withFractions')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.optionBtn, !showFractions && styles.optionBtnActive]} onPress={() => setShowFractions(false)}>
                  <Text style={[styles.optionBtnText, !showFractions && styles.optionBtnTextActive]}>{t('lobby.noFractions')}</Text>
                </TouchableOpacity>
              </View>
              {showFractions && (
                <View style={styles.chipWrap}>
                  {ALL_FRACTION_KINDS.map((kind) => {
                    const active = fractionKinds.includes(kind);
                    return (
                      <TouchableOpacity
                        key={kind}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => {
                          setFractionKinds((current) => {
                            if (!current.includes(kind)) return [...current, kind];
                            if (current.length <= 1) return current;
                            return current.filter((value) => value !== kind);
                          });
                        }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{kind}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.label}>{t('lobby.possibleResults')}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.optionBtn, showPossibleResults && styles.optionBtnActive]} onPress={() => setShowPossibleResults(true)}>
                  <Text style={[styles.optionBtnText, showPossibleResults && styles.optionBtnTextActive]}>{t('lobby.show')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.optionBtn, !showPossibleResults && styles.optionBtnActive]} onPress={() => setShowPossibleResults(false)}>
                  <Text style={[styles.optionBtnText, !showPossibleResults && styles.optionBtnTextActive]}>{t('lobby.hide')}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>{t('lobby.solveExercise')}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.optionBtn, showSolveExercise && styles.optionBtnActive]} onPress={() => setShowSolveExercise(true)}>
                  <Text style={[styles.optionBtnText, showSolveExercise && styles.optionBtnTextActive]}>{t('lobby.on')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.optionBtn, !showSolveExercise && styles.optionBtnActive]} onPress={() => setShowSolveExercise(false)}>
                  <Text style={[styles.optionBtnText, !showSolveExercise && styles.optionBtnTextActive]}>{t('lobby.off')}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>{t('lobby.turnTimer')}</Text>
              <View style={styles.countRow}>
                {(['off', '60', '90', 'custom'] as const).map((value) => (
                  <TouchableOpacity key={value} style={[styles.timerChip, timerSetting === value && styles.optionBtnActive]} onPress={() => setTimerSetting(value)}>
                    <Text style={[styles.optionBtnText, timerSetting === value && styles.optionBtnTextActive]}>
                      {value === 'off' ? t('lobby.timerOff') : value === '60' ? t('lobby.timerMin') : value === '90' ? t('lobby.timerMinHalf') : t('lobby.timerCustom')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {timerSetting === 'custom' && (
                <View style={styles.inputShell}>
                  <TextInput
                    style={styles.input}
                    value={String(timerCustomSeconds)}
                    onChangeText={(value) => setTimerCustomSeconds(Math.max(10, Math.min(600, Number(value.replace(/\D/g, '')) || 60)))}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>{t('lobby.summaryTitle')}</Text>
          <View style={styles.summaryBox}>
            <Text style={[styles.summaryText, { textAlign: ta }]}>{summaryText}</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveConfiguration}>
            <Text style={styles.primaryBtnText}>{t('lobby.continueToRoom')}</Text>
          </TouchableOpacity>
        </>
      )}

      {configured && (
        <>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>{t('lobby.roomCodeLabel')}</Text>
            <Text style={styles.codeValue}>{roomCode}</Text>
            <Text style={[styles.codeHint, { textAlign: ta }]}>{t('lobby.shareCodeHint')}</Text>
            <View style={styles.inviteActionsRow}>
              <TouchableOpacity style={[styles.inviteBtn, !shareRoomMessage && styles.inviteBtnDisabled]} onPress={handleShareRoomCode} disabled={!shareRoomMessage}>
                <Text style={styles.inviteBtnText}>{t('lobby.share')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.inviteBtn, styles.inviteCopyBtn, !roomCode && styles.inviteBtnDisabled]} onPress={handleCopyRoomCode} disabled={!roomCode}>
                <Text style={[styles.inviteBtnText, styles.inviteCopyBtnLabel]}>{t('lobby.copy')}</Text>
              </TouchableOpacity>
            </View>
            {copyFeedback && <Text style={styles.copyFeedbackText}>{copyFeedback}</Text>}
            {visibility === 'private_locked' && currentInviteCode ? (
              <View style={styles.inviteBox}>
                <Text style={[styles.inviteLabel, { textAlign: ta }]}>{t('lobby.shareInviteCode')}</Text>
                <Text style={styles.privateInviteCode}>{currentInviteCode}</Text>
                <TextInput
                  style={styles.input}
                  value={manualWebInviteBase}
                  onChangeText={setManualWebInviteBase}
                  placeholder={configuredWebBase || 'https://your-site...'}
                  placeholderTextColor="#6B7280"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text selectable style={styles.inviteLink}>{inviteLink || inviteSuffix}</Text>
                <View style={styles.inviteActionsRow}>
                  <TouchableOpacity style={styles.inviteBtn} onPress={async () => {
                    const body = inviteLink || inviteSuffix;
                    await Share.share({ message: body });
                  }}>
                    <Text style={styles.inviteBtnText}>{t('lobby.share')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.inviteBtn, styles.inviteCopyBtn]} onPress={async () => {
                    await Clipboard.setStringAsync(currentInviteCode);
                    setCopyFeedback(t('lobby.inviteCodeCopied'));
                  }}>
                    <Text style={[styles.inviteBtnText, styles.inviteCopyBtnLabel]}>{t('lobby.copy')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>

          {toast ? (
            <View style={styles.toastBox}>
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null}

          {roomStatusCard ? (
            <View style={[styles.infoBox, roomStatusCard.accentStyle]}>
              <Text style={[styles.infoTextStrong, { textAlign: ta }]}>{roomStatusCard.primary}</Text>
              <Text style={[styles.infoText, { textAlign: ta }]}>{roomStatusCard.secondary}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>{t('lobby.playersInRoom', { count: players.length })}</Text>
          {players.map((player) => (
            <View key={player.id} style={styles.playerRow}>
              <Text style={styles.playerName}>{player.name}</Text>
              {player.isHost && <Text style={styles.hostBadge}>{t('lobby.host')}</Text>}
              {!player.isConnected && <Text style={styles.disconnectedBadge}>{t('lobby.disconnected')}</Text>}
            </View>
          ))}

          {isHost && currentTable?.status !== 'countdown' && humanCount >= 2 && (
            <TouchableOpacity style={styles.primaryBtn} onPress={startTableCountdown}>
              <Text style={styles.primaryBtnText}>{t('lobby.countdownCta')}</Text>
            </TouchableOpacity>
          )}

          {isHost && humanCount === 1 && (
            <TouchableOpacity
              style={styles.secondaryPrimaryBtn}
              onPress={async () => {
                setStartingBot(true);
                try {
                  await startBotGame(difficulty, buildGameSettings());
                } finally {
                  setStartingBot(false);
                }
              }}
            >
              {startingBot ? <ActivityIndicator color="#fff" /> : <Text style={styles.secondaryPrimaryBtnText}>{t('lobby.startBotGame')}</Text>}
            </TouchableOpacity>
          )}
        </>
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
  scroll: { flex: 1, backgroundColor: brand.bg },
  container: { padding: 24, paddingTop: 60, alignItems: 'center' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, alignSelf: 'stretch', justifyContent: 'center' },
  langLabel: { color: '#9CA3AF', fontSize: 12 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: brand.surface2 },
  langBtnActive: { backgroundColor: brand.gold },
  langBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  langBtnTextActive: { color: '#111827' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16, paddingVertical: 8, paddingHorizontal: 12 },
  backBtnText: { color: brand.cyan, fontSize: 14, fontWeight: '600' },
  logoWrap: { alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '800', color: '#F59E0B', marginBottom: 8, alignSelf: 'stretch', textAlign: 'right' },
  subtitle: { color: '#9CA3AF', fontSize: 14, marginBottom: 18, alignSelf: 'stretch', textAlign: 'right' },
  label: { color: '#D1D5DB', fontSize: 14, fontWeight: '600', alignSelf: 'stretch', marginTop: 16, marginBottom: 8 },
  inputShell: { width: '100%', backgroundColor: '#D4A010', borderRadius: 18, padding: 3, marginBottom: 8 },
  input: { width: '100%', backgroundColor: '#132238', borderWidth: 1, borderColor: 'rgba(255,240,180,0.22)', borderRadius: 15, paddingHorizontal: 16, paddingVertical: 12, color: '#FFF', fontSize: 16, fontWeight: '700' },
  primaryBtn: { backgroundColor: brand.gold, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 12 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#111827', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { marginTop: 12 },
  secondaryBtnText: { color: brand.cyan, fontSize: 14 },
  hint: { color: '#94A3B8', fontSize: 12, marginTop: 4, marginBottom: 8, alignSelf: 'stretch', textAlign: 'right' },
  sectionHeaderRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refreshBtn: { backgroundColor: 'rgba(34,211,238,0.15)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.35)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  refreshBtnText: { color: '#67E8F9', fontSize: 16, fontWeight: '700' },
  emptyTablesBox: { width: '100%', padding: 14, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.7)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.2)' },
  tableCard: { width: '100%', backgroundColor: 'rgba(15,23,42,0.78)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', borderRadius: 14, padding: 14, marginBottom: 10 },
  tableTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableCode: { color: '#F8FAFC', fontSize: 24, fontWeight: '800', letterSpacing: 3 },
  tableBadge: { color: '#082F49', backgroundColor: '#A5F3FC', fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tableBadgePrivate: { backgroundColor: '#FDE68A' },
  tableHost: { color: '#E2E8F0', fontSize: 16, fontWeight: '700', marginTop: 10 },
  tableMeta: { color: '#CBD5E1', fontSize: 13, marginTop: 4 },
  tableMetaAccent: { color: '#FCD34D', fontSize: 12, fontWeight: '700', marginTop: 4 },
  tableCountdownNotice: { lineHeight: 18 },
  tableActionBtn: { marginTop: 12, backgroundColor: '#0F766E', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  tableActionBtnPrivate: { backgroundColor: '#B45309' },
  tableActionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  privateJoinCard: { width: '100%', marginTop: 8, padding: 14, borderRadius: 14, backgroundColor: 'rgba(30,41,59,0.88)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.28)' },
  privateJoinRoomCode: { color: '#FDE68A', fontSize: 26, fontWeight: '800', letterSpacing: 4, textAlign: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 8 },
  optionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#374151', alignItems: 'center' },
  optionBtnActive: { backgroundColor: brand.gold },
  optionBtnText: { color: '#D1D5DB', fontWeight: '700' },
  optionBtnTextActive: { color: '#111827' },
  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', justifyContent: 'center' },
  countBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  countBtnActive: { backgroundColor: brand.gold },
  countBtnText: { color: '#E5E7EB', fontWeight: '700', fontSize: 16 },
  countBtnTextActive: { color: '#111827' },
  timerChip: { minWidth: 78, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, backgroundColor: '#374151', alignItems: 'center' },
  chipWrap: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(15,23,42,0.45)' },
  chipActive: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.16)' },
  chipText: { color: '#E2E8F0', fontWeight: '700' },
  chipTextActive: { color: '#FEF3C7' },
  codeBox: { width: '100%', backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)' },
  codeLabel: { color: brand.gold, fontSize: 12, marginBottom: 4 },
  codeValue: { fontSize: 36, fontWeight: '800', color: '#FFF', letterSpacing: 8 },
  codeHint: { color: '#94A3B8', fontSize: 11, marginTop: 8 },
  inviteBox: { marginTop: 12, width: '100%', backgroundColor: 'rgba(17,24,39,0.72)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34,211,238,0.4)', padding: 10 },
  inviteLabel: { color: brand.cyan, fontSize: 12, marginBottom: 6 },
  privateInviteCode: { color: '#FDE68A', fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: 4, marginBottom: 8 },
  inviteLink: { color: '#E2E8F0', fontSize: 12, textAlign: 'left', marginTop: 8 },
  inviteActionsRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  inviteBtn: { backgroundColor: brand.gold, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  inviteBtnDisabled: { opacity: 0.5 },
  inviteCopyBtn: { backgroundColor: '#0D9488' },
  inviteBtnText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  inviteCopyBtnLabel: { color: '#FFF' },
  copyFeedbackText: { color: '#A7F3D0', fontSize: 11, marginTop: 8, textAlign: 'center' },
  playerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: 'rgba(55,65,81,0.5)', borderRadius: 10, padding: 12, marginBottom: 6 },
  playerName: { color: '#E2E8F0', fontSize: 16, flex: 1, textAlign: 'right' },
  hostBadge: { backgroundColor: brand.gold, color: '#111827', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  disconnectedBadge: { color: '#EF4444', fontSize: 10 },
  secondaryPrimaryBtn: { backgroundColor: '#0F766E', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, marginTop: 12, alignItems: 'center', width: '100%' },
  secondaryPrimaryBtnText: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  summaryBox: { width: '100%', backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(250,204,21,0.35)', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 4 },
  summaryText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600', lineHeight: 21, textAlign: 'right' },
  errorBox: { marginTop: 16, padding: 12, backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 10, width: '100%' },
  errorText: { color: '#FCA5A5', textAlign: 'right' },
  infoBox: { width: '100%', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34,211,238,0.35)', backgroundColor: 'rgba(34,211,238,0.08)', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  infoBoxMuted: { borderColor: 'rgba(148,163,184,0.28)', backgroundColor: 'rgba(51,65,85,0.2)' },
  infoBoxReady: { borderColor: 'rgba(250,204,21,0.35)', backgroundColor: 'rgba(245,158,11,0.12)' },
  infoBoxCountdown: { borderColor: 'rgba(34,211,238,0.45)', backgroundColor: 'rgba(8,145,178,0.14)' },
  infoText: { color: brand.text, fontSize: 12, textAlign: 'right' },
  infoTextStrong: { color: '#F8FAFC', fontSize: 14, fontWeight: '800', textAlign: 'right', marginBottom: 4 },
  toastBox: { width: '100%', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(56,189,248,0.45)', backgroundColor: 'rgba(15,23,42,0.92)', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  toastText: { color: '#E0F2FE', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  rulesLinkBtn: { marginTop: 8, marginBottom: 4, paddingVertical: 8 },
  rulesLinkText: { color: brand.cyan, fontSize: 14, fontWeight: '700', textAlign: 'right', textDecorationLine: 'underline' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#0f172a', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(250,204,21,0.35)', padding: 18 },
  modalTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  rulesModalLogoWrap: { alignItems: 'center', marginBottom: 12 },
  rulesSectionTitle: { color: '#FCD34D', fontSize: 14, fontWeight: '800', marginBottom: 8, marginTop: 12 },
  rulesLine: { color: '#E2E8F0', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  rulesModalCloseBtn: { marginTop: 12, backgroundColor: '#334155', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  rulesModalCloseBtnText: { color: '#F8FAFC', fontWeight: '700' },
  connectingCard: { backgroundColor: '#0f172a', borderRadius: 18, borderWidth: 2, borderColor: 'rgba(253,224,71,0.55)', paddingVertical: 26, paddingHorizontal: 24, alignItems: 'center' },
  connectingTitle: { color: '#FDE047', fontSize: 20, fontWeight: '800', marginTop: 16, marginBottom: 6 },
  connectingBody: { color: '#CBD5E1', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
