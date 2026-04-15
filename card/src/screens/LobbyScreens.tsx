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
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useMultiplayer } from '../hooks/useMultiplayer';
import type { BotDifficulty, Fraction, HostGameSettings } from '../../shared/types';

const ALL_FRACTION_KINDS: readonly Fraction[] = ['1/2', '1/3', '1/4', '1/5'];
import type { MsgParams } from '../../shared/i18n';
import { useLocale } from '../i18n/LocaleContext';
import SalindaLogoOption06 from '../components/branding/SalindaLogoOption06';
import { brand } from '../theme/brand';
import { CARDS_PER_PLAYER } from '../../shared/gameConstants';

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
  const [rulesOpen, setRulesOpen] = useState(false);

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
    setRoomCode(roomFromUrl.replace(/\D/g, '').slice(0, 4));
    if (name) setPlayerName(name.slice(0, 7));
    if (serverUrl) setServerUrl(serverUrl);
    setJoinFromLinkReady(true);
  }, [setServerUrl]);

  const handleCreate = () => {
    console.log('[MP][debug] handleCreate pressed, name=', JSON.stringify(playerName));
    if (!playerName.trim()) { console.log('[MP][debug] rejected: empty name'); return; }
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
      <TouchableOpacity style={styles.rulesLinkBtn} onPress={() => setRulesOpen(true)} accessibilityRole="button">
        <Text style={styles.rulesLinkText}>{t('start.showRules')}</Text>
      </TouchableOpacity>
      <Modal visible={rulesOpen} transparent animationType="fade" onRequestClose={() => setRulesOpen(false)}>
        <View style={styles.rulesModalBackdrop}>
          <View style={[styles.rulesModalCard, { direction: isRTL ? 'rtl' : 'ltr' }]}>
            <View style={styles.rulesModalLogoWrap}>
              <SalindaLogoOption06 width={220} />
            </View>
            <Text style={styles.rulesModalTitle}>{t('start.rulesTitle')}</Text>
            <ScrollView style={styles.rulesModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.rulesModalSection, { textAlign: ta }]}>{t('start.goalTitle')}</Text>
              <Text style={[styles.rulesModalBody, { textAlign: ta }]}>{t('start.rules.goal1', { n: CARDS_PER_PLAYER })}</Text>
              <Text style={[styles.rulesModalBody, { textAlign: ta }]}>{t('start.rules.goal2')}</Text>
              <Text style={[styles.rulesModalSection, { textAlign: ta }]}>{t('start.turnTitle')}</Text>
              <Text style={[styles.rulesModalBody, { textAlign: ta }]}>{t('start.rules.t1')}</Text>
              <Text style={[styles.rulesModalBody, { textAlign: ta }]}>{t('start.rules.t2')}</Text>
              <Text style={[styles.rulesModalBody, { textAlign: ta }]}>{t('start.rules.t3')}</Text>
              <Text style={[styles.rulesModalSection, { textAlign: ta }]}>{t('start.challengesTitle')}</Text>
              <Text style={[styles.rulesModalBody, { textAlign: ta }]}>{t('start.rules.c1')}</Text>
              <Text style={[styles.rulesModalBody, { textAlign: ta }]}>{t('start.rules.c2')}</Text>
              <Text style={[styles.rulesModalBody, { textAlign: ta }]}>{t('start.rules.c3')}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.rulesModalCloseBtn} onPress={() => setRulesOpen(false)}>
              <Text style={styles.rulesModalCloseBtnText}>{t('lobby.rulesModalClose')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
                onChangeText={(text) => setRoomCode(text.replace(/\D/g, '').slice(0, 4))}
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
  const [fractionKinds, setFractionKinds] = useState<Fraction[]>([...ALL_FRACTION_KINDS]);
  const [showPossibleResults, setShowPossibleResults] = useState(true);
  const [showSolveExercise, setShowSolveExercise] = useState(true);
  const [timerSetting, setTimerSetting] = useState<HostGameSettings['timerSetting']>('off');
  const [timerCustomSeconds, setTimerCustomSeconds] = useState(60);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [botDisplayName, setBotDisplayName] = useState('');
  const [starting, setStarting] = useState(false);
  const [startingBot, setStartingBot] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [botCountdown, setBotCountdown] = useState<number | null>(null);
  const [showAdvancedHostSettings, setShowAdvancedHostSettings] = useState(false);
  /** המארח רואה קודם את מסך הכיוון; רק לאחר אישור נחשף קוד החדר */
  const [settingsConfirmed, setSettingsConfirmed] = useState(false);
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

  const buildGameSettings = (): HostGameSettings => {
    const trimmed = botDisplayName.replace(/[\r\n\x00-\x1f]/g, '').trim().slice(0, 24);
    return {
      diceMode: '3',
      showFractions,
      showPossibleResults,
      showSolveExercise,
      mathRangeMax: difficulty === 'easy' ? 12 : 25,
      enabledOperators: ['+', '-'],
      allowNegativeTargets: false,
      fractionKinds: showFractions ? (fractionKinds.length > 0 ? fractionKinds : [...ALL_FRACTION_KINDS]) : [],
      difficultyStage: difficulty === 'easy' ? 'A' : 'H',
      abVariant: difficulty === 'easy' ? 'control_0_12_plus' : 'variant_0_15_plus',
      timerSetting,
      timerCustomSeconds: timerSetting === 'custom' ? timerCustomSeconds : 60,
      botDifficulty,
      ...(trimmed.length > 0 ? { botDisplayName: trimmed } : {}),
    };
  };

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
      <Text style={styles.title}>{isHost && !settingsConfirmed ? t('lobby.configureTitle') : t('lobby.roomReady')}</Text>
      {!(isHost && !settingsConfirmed) && (
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
      )}
      {!(isHost && !settingsConfirmed) && (
        <>
          <Text style={styles.label}>{t('lobby.playersInRoom', { count: players.length })}</Text>
          {players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <Text style={styles.playerName}>{p.name}</Text>
              {p.isHost && <Text style={styles.hostBadge}>{t('lobby.host')}</Text>}
              {p.isBot && <Text style={styles.botBadge}>{t('lobby.botBadge')}</Text>}
              {!p.isConnected && <Text style={styles.disconnectedBadge}>{t('lobby.disconnected')}</Text>}
            </View>
          ))}
        </>
      )}
      {isHost && (
        <>
          <Text style={styles.label}>{t('start.wheel.numberRange')}</Text>
          <View style={styles.diffRow}>
            <TouchableOpacity
              style={[styles.diffBtn, difficulty === 'full' && styles.diffBtnActive]}
              onPress={() => setDifficulty('full')}
            >
              <Text style={[styles.diffText, difficulty === 'full' && styles.diffTextActive]}>0-25</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.diffBtn, difficulty === 'easy' && styles.diffBtnActive]}
              onPress={() => setDifficulty('easy')}
            >
              <Text style={[styles.diffText, difficulty === 'easy' && styles.diffTextActive]}>0-12</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.advancedToggleBtn}
            onPress={() => setShowAdvancedHostSettings((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={styles.advancedToggleText}>
              {showAdvancedHostSettings ? t('lobby.advancedToggleHide') : t('lobby.advancedToggleShow')}
            </Text>
          </TouchableOpacity>

          {showAdvancedHostSettings && (
            <>
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

          {showFractions && (
            <View style={styles.fractionKindsRow}>
              {ALL_FRACTION_KINDS.map((fk) => {
                const on = fractionKinds.includes(fk);
                return (
                  <TouchableOpacity
                    key={fk}
                    onPress={() => setFractionKinds((prev) => {
                      if (!prev.includes(fk)) return [...prev, fk];
                      if (prev.length <= 1) return prev;
                      return prev.filter((x) => x !== fk);
                    })}
                    style={[styles.fractionChip, on && styles.fractionChipOn]}
                  >
                    <Text style={[styles.fractionChipText, on && styles.fractionChipTextOn]}>{fk}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

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
                  setTimerCustomSeconds(Math.min(600, Math.max(1, n)));
                }}
                keyboardType="number-pad"
                maxLength={3}
                textAlign="center"
              />
            </>
          )}
            </>
          )}

          <Text style={styles.label}>{t('lobby.summaryTitle')}</Text>
          <View style={styles.summaryBox}>
            <Text style={[styles.summaryText, { textAlign: ta }]}>{hostSettingsSummary}</Text>
          </View>

          {!settingsConfirmed ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setSettingsConfirmed(true)}
            >
              <Text style={styles.primaryBtnText}>{t('lobby.continueToRoom')}</Text>
            </TouchableOpacity>
          ) : (
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
          )}
          {settingsConfirmed && players.length < 2 && (
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
                  <Text style={[styles.label, { marginTop: 8, alignSelf: 'stretch' }]}>{t('lobby.botDifficultyLabel')}</Text>
                  <View style={styles.timerGrid}>
                    {(
                      [
                        ['easy', t('start.botEasy')],
                        ['medium', t('start.botMedium')],
                        ['hard', t('start.botHard')],
                      ] as const
                    ).map(([key, label]) => (
                      <TouchableOpacity
                        key={key}
                        onPress={() => setBotDifficulty(key)}
                        style={[styles.timerChip, botDifficulty === key && styles.diffBtnActive]}
                      >
                        <Text style={[styles.timerChipText, botDifficulty === key && styles.diffTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.label, { marginTop: 10, alignSelf: 'stretch' }]}>{t('start.botNameLabel')}</Text>
                  <TextInput
                    value={botDisplayName}
                    onChangeText={setBotDisplayName}
                    placeholder={t('start.botNamePlaceholder')}
                    placeholderTextColor="rgba(248,250,252,0.45)"
                    maxLength={24}
                    style={[styles.botNameInput, { textAlign: ta }]}
                  />
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
  fractionKindsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8, marginBottom: 4 },
  fractionChip: { minWidth: 56, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center' },
  fractionChipOn: { borderColor: '#F59E0B', backgroundColor: 'rgba(244,114,182,0.28)' },
  fractionChipText: { color: 'rgba(226,232,240,0.7)', fontSize: 15, fontWeight: '700' },
  fractionChipTextOn: { color: '#FEF3C7', fontWeight: '900' },
  botNameInput: {
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
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
  rulesLinkBtn: { marginTop: 8, marginBottom: 4, paddingVertical: 8 },
  rulesLinkText: { color: brand.cyan, fontSize: 14, fontWeight: '700', textAlign: 'center', textDecorationLine: 'underline' },
  rulesModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  rulesModalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    padding: 16,
    maxHeight: '85%',
  },
  rulesModalTitle: { color: brand.gold, fontSize: 20, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  rulesModalLogoWrap: { alignItems: 'center', marginBottom: 2 },
  rulesModalScroll: { maxHeight: 420 },
  rulesModalSection: { color: '#E2E8F0', fontSize: 15, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  rulesModalBody: { color: '#CBD5E1', fontSize: 14, lineHeight: 22, marginBottom: 6 },
  rulesModalCloseBtn: {
    marginTop: 14,
    backgroundColor: brand.gold,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rulesModalCloseBtnText: { color: '#111827', fontSize: 15, fontWeight: '800' },
  advancedToggleBtn: { marginTop: 12, alignSelf: 'stretch', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2, borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.15)' },
  advancedToggleText: { color: '#FCD34D', fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
