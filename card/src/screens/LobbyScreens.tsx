// ============================================================
// LobbyScreens — Create/Join room + Lobby wait
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
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
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useMultiplayer } from '../hooks/useMultiplayer';
import type { HostGameSettings } from '../../shared/types';
import type { MsgParams } from '../../shared/i18n';
import { useLocale } from '../i18n/LocaleContext';
import SalindaLogoOption06 from '../components/branding/SalindaLogoOption06';
import { brand } from '../theme/brand';

const WEB_INVITE_BASE_STORAGE_KEY = 'salinda_web_invite_base';

type TFn = (key: string, params?: MsgParams) => string;

function lobbyTimerLabel(t: TFn, ts: HostGameSettings['timerSetting'], customSec: number): string {
  if (ts === 'off') return t('lobby.timerOff');
  if (ts === 'custom') {
    return customSec >= 60
      ? t('lobby.timerFmtMinSec', { m: Math.floor(customSec / 60), s: customSec % 60 })
      : t('lobby.timerSec', { n: customSec });
  }
  if (ts === '60') return t('lobby.timerMin');
  return t('lobby.timerSec', { n: ts });
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, alignSelf: 'stretch', justifyContent: 'center' }}>
      <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{t('lang.label')}:</Text>
      <TouchableOpacity onPress={() => void setLocale('he')} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: locale === 'he' ? brand.gold : brand.surface2 }}>
        <Text style={{ color: locale === 'he' ? '#111827' : '#fff', fontWeight: '700', fontSize: 12 }}>{t('lang.he')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => void setLocale('en')} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: locale === 'en' ? brand.gold : brand.surface2 }}>
        <Text style={{ color: locale === 'en' ? '#111827' : '#fff', fontWeight: '700', fontSize: 12 }}>{t('lang.en')}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** בסיס URL של לקוח ה-Web המפורסם (ללא "/" בסוף). בלי הגדרה — ריק; המארח יכול למלא ידנית. */
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
  return (
    raw.includes('localhost') ||
    raw.includes('127.0.0.1') ||
    raw.includes('0.0.0.0') ||
    raw.includes('10.0.2.2')
  );
}

function guestInviteSearchParams(roomCode: string, serverUrl: string): URLSearchParams {
  const fallbackPublicServer =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SERVER_URL
      ? String(process.env.EXPO_PUBLIC_SERVER_URL).trim()
      : '';
  const safeServerUrl = isLocalServerUrl(serverUrl) ? fallbackPublicServer : serverUrl.trim();
  const params = new URLSearchParams({ room: roomCode });
  if (safeServerUrl) params.set('server', safeServerUrl);
  return params;
}

export function parseJoinParamsFromUrl(): { roomCode?: string; serverUrl?: string; name?: string } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      roomCode: params.get('room') ?? undefined,
      serverUrl: params.get('server') ?? undefined,
      name: params.get('name') ?? undefined,
    };
  } catch {
    return {};
  }
}

export function LobbyEntry({ onBackToChoice }: { onBackToChoice?: () => void } = {}) {
  const { t, isRTL } = useLocale();
  const { createRoom, joinRoom, error, clearError, setServerUrl } = useMultiplayer();
  const ta = isRTL ? 'right' : 'left';
  const [step, setStep] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinFromLinkReady, setJoinFromLinkReady] = useState(false);

  useEffect(() => {
    if (error) {
      const t = setTimeout(clearError, 4000);
      return () => clearTimeout(t);
    }
  }, [error, clearError]);

  useEffect(() => {
    const { roomCode: roomFromUrl, serverUrl, name } = parseJoinParamsFromUrl();
    if (!roomFromUrl) return;
    setStep('join');
    setRoomCode(roomFromUrl.slice(0, 4));
    if (name) setPlayerName(name.slice(0, 7));
    if (serverUrl) setServerUrl(serverUrl);
    setJoinFromLinkReady(true);
  }, [setServerUrl]);

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
      <LanguageToggle />
      {onBackToChoice && (
        <TouchableOpacity style={styles.backBtn} onPress={onBackToChoice}>
          <Text style={styles.backBtnText}>{t('lobby.backToMode')}</Text>
        </TouchableOpacity>
      )}
      <View style={styles.logoWrap}>
        <SalindaLogoOption06 width={260} />
      </View>
      <Text style={styles.title}>{t('lobby.connectTitle')}</Text>
      <Text style={styles.subtitle}>{t('lobby.connectSubtitle')}</Text>
      {joinFromLinkReady && (
        <View style={styles.infoBox}>
          <Text style={[styles.infoText, { textAlign: ta }]}>{t('lobby.inviteLinkHint')}</Text>
        </View>
      )}

      <>
        <Text style={styles.label}>{t('lobby.yourName')}</Text>
          <TextInput
            style={styles.input}
            value={playerName}
            onChangeText={(x) => setPlayerName(x.slice(0, 7))}
            placeholder={t('lobby.namePlaceholder')}
            placeholderTextColor="#6B7280"
            textAlign={ta}
            maxLength={7}
          />
          {step === 'create' && (
            <TouchableOpacity
              style={[styles.primaryBtn, !playerName.trim() && styles.primaryBtnDisabled]}
              onPress={handleCreate}
              disabled={!playerName.trim()}
            >
              <Text style={styles.primaryBtnText}>{t('lobby.createRoom')}</Text>
            </TouchableOpacity>
          )}
          {step === 'join' && (
            <>
              <Text style={styles.label}>{t('lobby.roomCode')}</Text>
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
                <Text style={styles.primaryBtnText}>{t('lobby.joinRoom')}</Text>
              </TouchableOpacity>
            </>
          )}
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(step === 'create' ? 'join' : 'create')}>
          <Text style={styles.secondaryBtnText}>{step === 'create' ? t('lobby.toggleToJoin') : t('lobby.toggleToCreate')}</Text>
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
  const { t, isRTL } = useLocale();
  const ta = isRTL ? 'right' : 'left';
  const { roomCode, players, lobbyStatus, isHost, connected, startGame, startBotGame, leaveRoom, error, clearError, serverUrl } = useMultiplayer();
  const [difficulty, setDifficulty] = useState<'easy' | 'full'>('full');
  const [showFractions, setShowFractions] = useState(true);
  const [showPossibleResults, setShowPossibleResults] = useState(true);
  const [showSolveExercise, setShowSolveExercise] = useState(true);
  const [timerSetting, setTimerSetting] = useState<HostGameSettings['timerSetting']>('off');
  const [timerCustomSeconds, setTimerCustomSeconds] = useState(60);
  const [starting, setStarting] = useState(false);
  const [startingBot, setStartingBot] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [botCountdown, setBotCountdown] = useState<number | null>(null);
  /** עוקף בסיס Web אוטומטי; ריק = שימוש ב־EXPO_PUBLIC_WEB_APP_URL או במקור הדף (Web). נשמר במכשיר. */
  const [manualWebInviteBase, setManualWebInviteBase] = useState('');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(WEB_INVITE_BASE_STORAGE_KEY)
      .then((v) => {
        if (!cancelled && v?.trim()) setManualWebInviteBase(v.trim());
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const v = manualWebInviteBase.trim();
    const t = setTimeout(() => {
      if (v) void AsyncStorage.setItem(WEB_INVITE_BASE_STORAGE_KEY, v);
      else void AsyncStorage.removeItem(WEB_INVITE_BASE_STORAGE_KEY);
    }, 300);
    return () => clearTimeout(t);
  }, [manualWebInviteBase]);

  useEffect(() => {
    if (error) {
      setStarting(false);
      setStartingBot(false);
      const t = setTimeout(clearError, 4000);
      return () => clearTimeout(t);
    }
  }, [error, clearError]);

  useEffect(() => {
    if (lobbyStatus?.status !== 'waiting_for_player' || !lobbyStatus.botOfferAt) {
      setBotCountdown(null);
      return;
    }
    const updateCountdown = () => {
      const seconds = Math.max(0, Math.ceil((lobbyStatus.botOfferAt! - Date.now()) / 1000));
      setBotCountdown(seconds);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [lobbyStatus]);

  const handleStart = () => {
    if (!isHost || players.length < 2) return;
    setStarting(true);
    startGame(difficulty, buildGameSettings());
  };

  const buildGameSettings = (): HostGameSettings => ({
    diceMode: '3',
    showFractions,
    showPossibleResults,
    showSolveExercise,
    mathRangeMax: difficulty === 'easy' ? 12 : 25,
    enabledOperators: ['+'],
    allowNegativeTargets: false,
    difficultyStage: difficulty === 'easy' ? 'A' : 'E',
    abVariant: difficulty === 'easy' ? 'control_0_12_plus' : 'variant_0_15_plus',
    timerSetting,
    timerCustomSeconds: timerSetting === 'custom' ? timerCustomSeconds : 60,
  });

  const handleStartBotGame = async () => {
    if (!isHost) return;
    setStartingBot(true);
    try {
      await startBotGame(difficulty, buildGameSettings());
    } finally {
      setStartingBot(false);
    }
  };

  const hostSettingsSummary = useMemo(() => {
    const ts = timerSetting === 'custom' ? timerCustomSeconds : 60;
    const diffLabel = difficulty === 'easy' ? t('lobby.diffEasyRange') : t('lobby.diffFullRange');
    const lines = [
      t('lobby.summary.difficulty', { value: diffLabel }),
      t('lobby.summary.dice'),
      t('lobby.summary.fractions', { value: showFractions ? t('lobby.yes') : t('lobby.no') }),
      t('lobby.summary.possible', { value: showPossibleResults ? t('lobby.show') : t('lobby.hide') }),
      t('lobby.summary.solve', { value: showSolveExercise ? t('lobby.on') : t('lobby.off') }),
      t('lobby.summary.timer', { value: lobbyTimerLabel(t, timerSetting, ts) }),
    ];
    return lines.join('\n');
  }, [t, difficulty, showFractions, showPossibleResults, showSolveExercise, timerSetting, timerCustomSeconds]);

  const configuredWebBase = getInviteWebBaseUrl().replace(/\/$/, '');
  const inviteSuffix = useMemo(() => {
    if (!roomCode) return '';
    return `?${guestInviteSearchParams(roomCode, serverUrl).toString()}`;
  }, [roomCode, serverUrl]);

  const effectiveWebBase = (manualWebInviteBase.trim() || configuredWebBase).replace(/\/$/, '');
  const inviteLink = useMemo(() => {
    if (!roomCode || !inviteSuffix) return '';
    if (!effectiveWebBase) return '';
    return `${effectiveWebBase}${inviteSuffix}`;
  }, [roomCode, inviteSuffix, effectiveWebBase]);

  const copyableInvite = inviteLink || inviteSuffix;

  const handleShareInvite = async () => {
    if (!copyableInvite) return;
    try {
      const body = inviteLink
        ? inviteLink
        : t('lobby.shareBodyNoLink', { suffix: inviteSuffix, room: roomCode ?? '' });
      await Share.share({
        message: t('lobby.shareTitle', { body }),
      });
    } catch {
      // ignore user-cancel or share not available
    }
  };

  const handleCopyInvite = async () => {
    if (!copyableInvite) return;
    try {
      await Clipboard.setStringAsync(copyableInvite);
      setCopyFeedback(inviteLink ? t('lobby.copyDoneLink') : t('lobby.copyDoneSuffix'));
    } catch {
      setCopyFeedback(t('lobby.copyFail'));
    }
  };

  useEffect(() => {
    if (!copyFeedback) return;
    const t = setTimeout(() => setCopyFeedback(null), 2500);
    return () => clearTimeout(t);
  }, [copyFeedback]);

  const canStartBotGame = isHost && players.filter((player) => !player.isBot).length === 1;
  const waitingForBotOffer = canStartBotGame && lobbyStatus?.status === 'waiting_for_player';
  const botOfferReady = canStartBotGame && lobbyStatus?.status === 'bot_offer';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <LanguageToggle />
      <TouchableOpacity style={styles.backBtn} onPress={() => leaveRoom()}>
        <Text style={styles.backBtnText}>{t('lobby.leaveRoom')}</Text>
      </TouchableOpacity>
      <View style={styles.logoWrap}>
        <SalindaLogoOption06 width={260} />
      </View>
      <Text style={styles.title}>{t('lobby.roomReady')}</Text>
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>{t('lobby.roomCodeLabel')}</Text>
        <Text style={styles.codeValue}>{roomCode}</Text>
        <Text style={[styles.codeHint, { textAlign: ta }]}>{t('lobby.shareCodeHint')}</Text>
        {isHost && (
          <View style={styles.inviteBox}>
            <Text style={[styles.inviteLabel, { textAlign: ta }]}>{t('lobby.browserInvite')}</Text>
            <Text style={[styles.inviteHint, { textAlign: ta }]}>
              {configuredWebBase
                ? t('lobby.inviteHintConfigured', { base: configuredWebBase })
                : t('lobby.inviteHintMobile')}
            </Text>
            <Text style={styles.inviteFieldLabel}>{t('lobby.baseUrl')}</Text>
            <TextInput
              style={styles.input}
              value={manualWebInviteBase}
              onChangeText={setManualWebInviteBase}
              placeholder={configuredWebBase ? t('lobby.baseDefault', { base: configuredWebBase }) : t('lobby.basePlaceholder')}
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textAlign={isRTL ? 'right' : 'left'}
            />
            {inviteLink ? (
              <Text selectable style={styles.inviteLink}>{inviteLink}</Text>
            ) : (
              <>
                <Text style={[styles.inviteSuffixCaption, { textAlign: ta }]}>{t('lobby.suffixCaption')}</Text>
                <Text selectable style={styles.inviteLink}>{inviteSuffix || '—'}</Text>
              </>
            )}
            <View style={styles.inviteActionsRow}>
              <TouchableOpacity style={[styles.inviteBtn, !copyableInvite && styles.inviteBtnDisabled]} onPress={handleShareInvite} disabled={!copyableInvite}>
                <Text style={styles.inviteBtnText}>{t('lobby.share')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.inviteBtn, styles.inviteCopyBtn, !copyableInvite && styles.inviteBtnDisabled]} onPress={handleCopyInvite} disabled={!copyableInvite}>
                <Text style={[styles.inviteBtnText, styles.inviteCopyBtnLabel]}>{t('lobby.copy')}</Text>
              </TouchableOpacity>
            </View>
            {copyFeedback && <Text style={styles.copyFeedbackText}>{copyFeedback}</Text>}
          </View>
        )}
      </View>
      <Text style={styles.label}>{t('lobby.playersInRoom', { count: players.length })}</Text>
      {players.map((p) => (
        <View key={p.id} style={styles.playerRow}>
          <Text style={styles.playerName}>{p.name}</Text>
          {p.isHost && <Text style={styles.hostBadge}>{t('lobby.host')}</Text>}
          {p.isBot && <Text style={styles.botBadge}>{t('lobby.botBadge')}</Text>}
          {!p.isConnected && <Text style={styles.disconnectedBadge}>{t('lobby.disconnected')}</Text>}
        </View>
      ))}
      {isHost && (
        <>
          <Text style={styles.label}>{t('lobby.difficulty')}</Text>
          <View style={styles.diffRow}>
            <TouchableOpacity
              style={[styles.diffBtn, difficulty === 'easy' && styles.diffBtnActive]}
              onPress={() => setDifficulty('easy')}
            >
              <Text style={[styles.diffText, difficulty === 'easy' && styles.diffTextActive]}>{t('lobby.diffShortEasy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.diffBtn, difficulty === 'full' && styles.diffBtnActive]}
              onPress={() => setDifficulty('full')}
            >
              <Text style={[styles.diffText, difficulty === 'full' && styles.diffTextActive]}>{t('lobby.diffShortFull')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t('lobby.fractions')}</Text>
          <View style={styles.diffRow}>
            <TouchableOpacity
              style={[styles.diffBtn, showFractions && styles.diffBtnActive]}
              onPress={() => setShowFractions(true)}
            >
              <Text style={[styles.diffText, showFractions && styles.diffTextActive]}>{t('lobby.withFractions')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.diffBtn, !showFractions && styles.diffBtnActive]}
              onPress={() => setShowFractions(false)}
            >
              <Text style={[styles.diffText, !showFractions && styles.diffTextActive]}>{t('lobby.noFractions')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t('lobby.possibleResults')}</Text>
          <View style={styles.diffRow}>
            <TouchableOpacity
              style={[styles.diffBtn, showPossibleResults && styles.diffBtnActive]}
              onPress={() => setShowPossibleResults(true)}
            >
              <Text style={[styles.diffText, showPossibleResults && styles.diffTextActive]}>{t('lobby.show')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.diffBtn, !showPossibleResults && styles.diffBtnActive]}
              onPress={() => {
                setShowPossibleResults(false);
                setShowSolveExercise(false);
              }}
            >
              <Text style={[styles.diffText, !showPossibleResults && styles.diffTextActive]}>{t('lobby.hide')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t('lobby.solveExercise')}</Text>
          <View style={styles.diffRow}>
            <TouchableOpacity
              style={[styles.diffBtn, showSolveExercise && styles.diffBtnActive, !showPossibleResults && styles.diffBtnDisabled]}
              onPress={() => showPossibleResults && setShowSolveExercise(true)}
            >
              <Text style={[styles.diffText, showSolveExercise && styles.diffTextActive]}>{t('lobby.on')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.diffBtn, !showSolveExercise && styles.diffBtnActive]}
              onPress={() => setShowSolveExercise(false)}
            >
              <Text style={[styles.diffText, !showSolveExercise && styles.diffTextActive]}>{t('lobby.off')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t('lobby.turnTimer')}</Text>
          <View style={styles.timerGrid}>
            {(
              [
                ['off', t('lobby.timerOff')] as const,
                ['30', t('lobby.timerSec', { n: 30 })] as const,
                ['60', t('lobby.timerMin')] as const,
                ['custom', t('lobby.timerCustom')] as const,
              ]
            ).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.timerChip, timerSetting === key && styles.diffBtnActive]}
                onPress={() => setTimerSetting(key)}
              >
                <Text style={[styles.timerChipText, timerSetting === key && styles.diffTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {timerSetting === 'custom' && (
            <>
              <Text style={styles.hint}>{t('lobby.timerCustomHint')}</Text>
              <TextInput
                style={styles.input}
                value={String(timerCustomSeconds)}
                onChangeText={(tx) => {
                  const n = parseInt(tx.replace(/\D/g, ''), 10);
                  if (Number.isNaN(n)) {
                    setTimerCustomSeconds(60);
                    return;
                  }
                  setTimerCustomSeconds(Math.min(600, Math.max(10, n)));
                }}
                keyboardType="number-pad"
                maxLength={3}
                textAlign="center"
              />
            </>
          )}

          <Text style={styles.label}>{t('lobby.summaryTitle')}</Text>
          <View style={styles.summaryBox}>
            <Text style={[styles.summaryText, { textAlign: ta }]}>{hostSettingsSummary}</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (players.length < 2 || starting) && styles.primaryBtnDisabled]}
            onPress={handleStart}
            disabled={players.length < 2 || starting}
          >
            {starting ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={styles.primaryBtnText}>{t('lobby.startGame')}</Text>
            )}
          </TouchableOpacity>
          {players.length < 2 && (
            <>
              <Text style={styles.hint}>{t('lobby.minPlayers')}</Text>
              {waitingForBotOffer && (
                <Text style={styles.waitingHint}>
                  {botCountdown != null
                    ? t('lobby.waitingForPlayerCountdown', { n: botCountdown })
                    : t('lobby.waitingForPlayer')}
                </Text>
              )}
              {canStartBotGame && (
                <View style={styles.botOfferBox}>
                  <Text style={[styles.botOfferTitle, { textAlign: ta }]}>
                    {botOfferReady ? t('lobby.botOfferTitle') : t('lobby.startBotGame')}
                  </Text>
                  <Text style={[styles.botOfferBody, { textAlign: ta }]}>
                    {botOfferReady ? t('lobby.botOfferBody') : t('lobby.waitingForPlayer')}
                  </Text>
                  <TouchableOpacity
                    style={[styles.secondaryPrimaryBtn, (startingBot || !connected) && styles.primaryBtnDisabled]}
                    onPress={handleStartBotGame}
                    disabled={startingBot || !connected}
                  >
                    {startingBot ? (
                      <ActivityIndicator color="#F8FAFC" />
                    ) : (
                      <Text style={styles.secondaryPrimaryBtnText}>{t('lobby.startBotGame')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </>
      )}
      {!isHost && (
        <Text style={[styles.waitingText, { textAlign: ta }]}>{t('lobby.waitHost')}</Text>
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
  logoWrap: { alignSelf: 'center', marginBottom: 12 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16, paddingVertical: 8, paddingHorizontal: 12 },
  backBtnText: { color: brand.cyan, fontSize: 14, fontWeight: '600' },
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
    backgroundColor: brand.gold,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#111827', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { marginTop: 12 },
  secondaryBtnText: { color: brand.cyan, fontSize: 14 },
  codeBox: {
    width: '100%',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  codeLabel: { color: brand.gold, fontSize: 12, marginBottom: 4 },
  codeValue: { fontSize: 36, fontWeight: '800', color: '#FFF', letterSpacing: 8 },
  codeHint: { color: '#6B7280', fontSize: 11, marginTop: 8 },
  inviteBox: {
    marginTop: 12,
    width: '100%',
    backgroundColor: 'rgba(17,24,39,0.72)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.4)',
    padding: 10,
  },
  inviteLabel: { color: brand.cyan, fontSize: 12, textAlign: 'right', marginBottom: 6 },
  inviteHint: { color: '#94A3B8', fontSize: 11, textAlign: 'right', lineHeight: 16, marginBottom: 8 },
  inviteFieldLabel: { color: '#CBD5E1', fontSize: 11, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 4 },
  inviteSuffixCaption: { color: 'rgba(34,211,238,0.85)', fontSize: 11, textAlign: 'right', marginTop: 8, marginBottom: 4 },
  inviteLink: { color: '#E2E8F0', fontSize: 12, textAlign: 'left' },
  inviteActionsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  inviteBtn: {
    backgroundColor: brand.gold,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  inviteCopyBtn: { backgroundColor: '#0D9488' },
  inviteBtnDisabled: { opacity: 0.45 },
  inviteBtnText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  inviteCopyBtnLabel: { color: '#FFF' },
  copyFeedbackText: { color: '#A7F3D0', fontSize: 11, marginTop: 8, textAlign: 'center' },
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
  hostBadge: { backgroundColor: brand.gold, color: '#111827', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  botBadge: { backgroundColor: 'rgba(34,211,238,0.18)', color: brand.cyan, fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  disconnectedBadge: { color: '#EF4444', fontSize: 10 },
  diffRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 8 },
  diffBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#374151', alignItems: 'center' },
  diffBtnActive: { backgroundColor: brand.gold },
  diffBtnDisabled: { opacity: 0.45 },
  diffText: { color: '#9CA3AF', fontWeight: '600' },
  diffTextActive: { color: '#111827' },
  timerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    gap: 8,
    marginBottom: 4,
    justifyContent: 'center',
  },
  timerChip: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  timerChipText: { color: '#9CA3AF', fontWeight: '600', fontSize: 13 },
  waitingText: { color: '#9CA3AF', fontSize: 14, marginTop: 24, textAlign: 'center' },
  waitingHint: { color: '#93C5FD', fontSize: 12, marginTop: 6, textAlign: 'center' },
  botOfferBox: {
    width: '100%',
    marginTop: 10,
    backgroundColor: 'rgba(8,47,73,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    borderRadius: 12,
    padding: 14,
  },
  botOfferTitle: { color: '#E0F2FE', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  botOfferBody: { color: '#BFDBFE', fontSize: 12, lineHeight: 18 },
  secondaryPrimaryBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  secondaryPrimaryBtnText: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  summaryBox: {
    width: '100%',
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  summaryText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600', lineHeight: 21, textAlign: 'right' },
  errorBox: { marginTop: 16, padding: 12, backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 10, width: '100%' },
  errorText: { color: '#FCA5A5', textAlign: 'center' },
  infoBox: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    backgroundColor: 'rgba(34,211,238,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  infoText: { color: brand.text, fontSize: 12, textAlign: 'right' },
});
