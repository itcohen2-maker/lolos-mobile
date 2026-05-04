import React, { useEffect, useMemo, useState } from 'react';
import {
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HostGameSettings, LobbyTableSummary, LobbyTableTheme } from '../../shared/types';

const BG_IMAGE = require('../../assets/bg.jpg');

type LobbyFilter = 'all' | 'easy' | 'full' | 'open' | 'private';

interface TablesLobbyScreenProps {
  balance?: number;
  error?: string | null;
  headerAccessory?: React.ReactNode;
  onBack?: () => void;
  onCreateTable: () => void;
  onJoinTable: (table: LobbyTableSummary) => void;
  onOpenRules: () => void;
  onPlayerNameChange: (value: string) => void;
  onQuickMatch: () => void;
  onRefresh: () => void;
  playerName: string;
  tables: LobbyTableSummary[];
}

const GOLD_1 = '#f5d27a';
const GOLD_2 = '#c9a55a';
const INK = '#f5f1e6';
const INK_DIM = '#b9b0a0';
const INK_MUTE = '#8a8275';
const LINE = 'rgba(245, 210, 122, 0.18)';

const THEME_FELT: Record<LobbyTableTheme, [string, string]> = {
  classic: ['#122440', '#060c1c'],
  royal: ['#6b1818', '#2a0606'],
  forest: ['#0f4a36', '#03251a'],
  ocean: ['#1a3a8a', '#0a1c4a'],
};

const HEBREW_LETTERS = ['ש', 'א', 'מ', 'י', 'ל', 'ר', 'נ', 'ע', 'ד', 'ה', 'ב', 'ג', 'ת', 'ק'];

function countdownSeconds(deadlineAt: number | null): number | null {
  if (!deadlineAt) return null;
  return Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
}

function formatTimer(timerSetting: HostGameSettings['timerSetting'] | null, timerCustomSeconds: number | null): string {
  if (!timerSetting || timerSetting === 'off') return 'ללא טיימר';
  if (timerSetting === '60') return '60 שנ׳';
  if (timerSetting === '90') return '90 שנ׳';
  const total = Math.max(0, timerCustomSeconds ?? 0);
  if (timerSetting === 'custom') {
    return total >= 60 ? `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}` : `${total} שנ׳`;
  }
  return timerSetting;
}

function formatRange(table: LobbyTableSummary): string {
  if (table.configuredDifficulty === 'easy') return '0-12';
  if (table.configuredDifficulty === 'full') return '0-25';
  return 'ברירת מחדל';
}

function formatPot(table: LobbyTableSummary): string {
  const active = table.currentParticipants;
  const cap = table.maxParticipants;
  if (active <= 1) return 'קופה חדשה';
  return `${active}/${cap} מוכנים`;
}

function formatBalance(balance: number): string {
  return new Intl.NumberFormat('he-IL').format(balance);
}

function getInitial(seed: number): string {
  return HEBREW_LETTERS[seed % HEBREW_LETTERS.length] ?? 'ס';
}

export function isTableJoinable(table: LobbyTableSummary): boolean {
  return table.status === 'waiting';
}

export function pickQuickMatchTable(tables: LobbyTableSummary[]): LobbyTableSummary | null {
  return (
    [...tables]
      .filter((table) => table.visibility === 'public' && isTableJoinable(table))
      .sort(
        (a, b) =>
          b.currentParticipants - a.currentParticipants ||
          a.maxParticipants - b.maxParticipants ||
          a.roomCode.localeCompare(b.roomCode),
      )[0] ?? null
  );
}

function applyFilter(tables: LobbyTableSummary[], filter: LobbyFilter): LobbyTableSummary[] {
  if (filter === 'easy') return tables.filter((table) => table.configuredDifficulty === 'easy');
  if (filter === 'full') return tables.filter((table) => table.configuredDifficulty === 'full');
  if (filter === 'open') return tables.filter((table) => table.status === 'waiting');
  if (filter === 'private') return tables.filter((table) => table.visibility === 'private_locked');
  return tables;
}

function statusView(table: LobbyTableSummary): { label: string; fg: string; bg: string; border: string } {
  if (table.status === 'countdown') {
    return {
      label: `מתחיל עוד ${countdownSeconds(table.countdownEndsAt) ?? 0}`,
      fg: '#f5d27a',
      bg: 'rgba(245,210,122,0.2)',
      border: 'rgba(245,210,122,0.5)',
    };
  }
  if (table.status === 'full') {
    return {
      label: 'מלא',
      fg: '#fca5a5',
      bg: 'rgba(239,68,68,0.18)',
      border: 'rgba(252,165,165,0.4)',
    };
  }
  if (table.visibility === 'private_locked') {
    return {
      label: 'פרטי',
      fg: '#d8b4fe',
      bg: 'rgba(168,85,247,0.18)',
      border: 'rgba(216,180,254,0.4)',
    };
  }
  return {
    label: 'פתוח',
    fg: '#86efac',
    bg: 'rgba(34,197,94,0.18)',
    border: 'rgba(134,239,172,0.4)',
  };
}

function Felt({ table }: { table: LobbyTableSummary }) {
  const [c1, c2] = THEME_FELT[table.tableTheme] ?? THEME_FELT.classic;
  const status = statusView(table);

  return (
    <View style={[styles.felt, { backgroundColor: c2 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c1, opacity: 0.85 }]} />
      <View style={[StyleSheet.absoluteFill, styles.feltVignette]} />

      <View style={[styles.statusPill, { backgroundColor: status.bg, borderColor: status.border }]}>
        <Text style={[styles.statusText, { color: status.fg }]}>{status.label}</Text>
      </View>

      <View style={styles.pile}>
        {[-12, -4, 5, 14].map((angle, index) => (
          <View
            key={index}
            style={[
              styles.miniCard,
              index % 2 === 0 && styles.miniCardBack,
              { transform: [{ rotate: `${angle}deg` }, { translateX: (index - 1.5) * 4 }] },
            ]}
          />
        ))}
      </View>

      <Seats currentParticipants={table.currentParticipants} maxParticipants={table.maxParticipants} />
    </View>
  );
}

function Seats({ currentParticipants, maxParticipants }: Pick<LobbyTableSummary, 'currentParticipants' | 'maxParticipants'>) {
  const positions =
    maxParticipants === 6
      ? [
          styles.seatPosTopLeft,
          styles.seatPosTopRight,
          styles.seatPosMidRight,
          styles.seatPosBottomRight,
          styles.seatPosBottomLeft,
          styles.seatPosMidLeft,
        ]
      : [styles.seatPosTopLeft, styles.seatPosTopRight, styles.seatPosBottomRight, styles.seatPosBottomLeft];

  return (
    <>
      {positions.map((positionStyle, index) => {
        const filled = index < currentParticipants;
        return (
          <View key={`${maxParticipants}-${index}`} style={[styles.seat, positionStyle, !filled && styles.seatEmpty]}>
            {filled ? <Text style={styles.seatText}>{getInitial(index + currentParticipants * 7)}</Text> : null}
          </View>
        );
      })}
    </>
  );
}

function PlayerStack({ currentParticipants, maxParticipants }: Pick<LobbyTableSummary, 'currentParticipants' | 'maxParticipants'>) {
  return (
    <View style={styles.avatarStack}>
      {Array.from({ length: maxParticipants }).map((_, index) => {
        const filled = index < currentParticipants;
        return (
          <View
            key={`${maxParticipants}-${index}`}
            style={[
              styles.avatar,
              !filled && styles.avatarEmpty,
              { marginRight: index === 0 ? 0 : -6, zIndex: maxParticipants - index },
            ]}
          >
            {filled ? <Text style={styles.avatarText}>{getInitial(index * 3 + currentParticipants)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function TableCard({
  canJoin,
  onPress,
  table,
}: {
  canJoin: boolean;
  onPress: (table: LobbyTableSummary) => void;
  table: LobbyTableSummary;
}) {
  const disabled = !canJoin || !isTableJoinable(table);
  const countdownLocked = table.status === 'countdown';
  const countdownRemaining = countdownSeconds(table.countdownEndsAt) ?? 0;

  return (
    <Pressable
      testID={`table-card-${table.roomCode}`}
      style={[styles.card, disabled && styles.cardDisabled]}
      onPress={() => onPress(table)}
      disabled={disabled}
    >
      <Felt table={table} />

      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.tableName}>שולחן {table.roomCode}</Text>
          <Text style={styles.tableId}>ROOM {table.roomCode}</Text>
        </View>

        <View style={styles.metaLine}>
          <MetaItem label="טווח" value={formatRange(table)} />
          <View style={styles.metaDivider} />
          <MetaItem label="טיימר" value={formatTimer(table.timerSetting, table.timerCustomSeconds)} />
          <View style={styles.metaDivider} />
          <MetaItem label="קופה" value={formatPot(table)} />
        </View>

        <View style={[styles.cardRow, { marginTop: 4 }]}>
          <View style={styles.playersBar}>
            <PlayerStack currentParticipants={table.currentParticipants} maxParticipants={table.maxParticipants} />
            <Text style={styles.playersCount}>
              {table.currentParticipants}/{table.maxParticipants}
            </Text>
          </View>
          <Text style={styles.hostText}>
            מארח: <Text style={styles.hostName}>{table.hostName}</Text>
          </Text>
        </View>
        {countdownLocked ? (
          <View style={styles.countdownNotice}>
            <Text style={styles.countdownNoticeText}>לא ניתן להצטרף יותר. המשחק מתחיל בעוד {countdownRemaining} שניות.</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function TablesLobbyScreen({
  balance = 0,
  error,
  headerAccessory,
  onBack,
  onCreateTable,
  onJoinTable,
  onOpenRules,
  onPlayerNameChange,
  onQuickMatch,
  onRefresh,
  playerName,
  tables,
}: TablesLobbyScreenProps) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<LobbyFilter>('all');
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const hasCountdown = tables.some((table) => table.countdownEndsAt != null);
    if (!hasCountdown) return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tables]);

  const visibleTables = useMemo(() => applyFilter(tables, filter), [filter, tables]);
  const canAct = playerName.trim().length > 0;
  const fabBottom = Math.max(insets.bottom + 18, Platform.OS === 'web' ? 34 : 22);
  const scrollBottomPad = fabBottom + 86;

  void tick;

  return (
    <ImageBackground source={BG_IMAGE} style={styles.root} resizeMode="cover">
      <View style={styles.overlay} />

      <View style={[styles.topbar, { marginTop: Math.max(insets.top + 8, 12) }]}>
        <View style={styles.topbarLeft}>
          {onBack ? (
            <TouchableOpacity style={styles.smallGhostButton} onPress={onBack}>
              <Text style={styles.smallGhostButtonText}>חזרה</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.smallGhostButtonPlaceholder} />
          )}
          <TouchableOpacity style={styles.smallGhostButton} onPress={onRefresh}>
            <Text style={styles.smallGhostButtonText}>רענן</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.brand}>
          <View style={styles.brandMark} />
          <Text style={styles.brandText}>Salinda</Text>
        </View>

        <View style={styles.balance}>
          <View style={styles.coin} />
          <Text style={styles.balanceText}>{formatBalance(balance)}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>שולחנות פתוחים</Text>
            <Text style={styles.sectionSub}>OPEN TABLES · LIVE</Text>
          </View>
        </View>

        <View style={styles.controlCard}>
          {headerAccessory ? <View style={styles.headerAccessoryWrap}>{headerAccessory}</View> : null}
          <View style={styles.controlRow}>
            <TouchableOpacity testID="lobby-create-room" style={[styles.createBtn, !canAct && styles.disabledButton]} disabled={!canAct} onPress={onCreateTable}>
              <Text style={styles.createBtnText}>צור שולחן</Text>
            </TouchableOpacity>
            <View style={styles.inputWrap}>
              <TextInput
                testID="lobby-player-name"
                style={styles.nameInput}
                value={playerName}
                onChangeText={(value) => onPlayerNameChange(value.slice(0, 7))}
                placeholder="השם שלך"
                placeholderTextColor="#8a8275"
                maxLength={7}
                textAlign="center"
              />
            </View>
          </View>
          <View style={styles.utilityRow}>
            <TouchableOpacity style={styles.linkButton} onPress={onOpenRules}>
              <Text style={styles.linkButtonText}>הדרכה</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chips}
          contentContainerStyle={styles.chipsContent}
        >
          {[
            { key: 'all' as const, label: 'הכול' },
            { key: 'easy' as const, label: '0-12' },
            { key: 'full' as const, label: '0-25' },
            { key: 'open' as const, label: 'מקום פנוי' },
            { key: 'private' as const, label: 'פרטי' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.chip, filter === item.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === item.key && styles.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.list}>
          {visibleTables.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>אין כרגע שולחנות מתאימים</Text>
              <Text style={styles.emptyBody}>אפשר ליצור שולחן חדש או לעדכן את הרשימה.</Text>
            </View>
          ) : (
            visibleTables.map((table) => (
              <TableCard key={`${table.roomCode}-${table.status}-${table.currentParticipants}`} table={table} onPress={onJoinTable} canJoin={canAct} />
            ))
          )}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }, !canAct && styles.disabledButton]}
        onPress={onQuickMatch}
        activeOpacity={0.85}
        disabled={!canAct}
      >
        <Text style={styles.fabBolt}>⚡</Text>
        <Text style={styles.fabText}>התאמה מהירה</Text>
      </TouchableOpacity>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0d14' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  topbar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: 'rgba(20,15,8,0.85)',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 14,
  },
  topbarLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  smallGhostButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  smallGhostButtonText: {
    color: INK_DIM,
    fontWeight: '700',
    fontSize: 12,
  },
  smallGhostButtonPlaceholder: {
    width: 0,
    height: 0,
  },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: GOLD_2,
    borderWidth: 1.5,
    borderColor: '#6e4f17',
  },
  brandText: { fontSize: 22, color: GOLD_1, fontWeight: '600', letterSpacing: 1 },
  balance: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 999,
  },
  coin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: GOLD_2,
    borderWidth: 1,
    borderColor: '#6e4f17',
  },
  balanceText: { color: INK, fontWeight: '600', fontSize: 14 },
  scrollContent: { paddingBottom: 110 },
  sectionHead: { paddingHorizontal: 16, marginTop: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 26, fontWeight: '600', color: GOLD_1, letterSpacing: 0.5, textAlign: 'right' },
  sectionSub: { fontSize: 11, color: INK_MUTE, letterSpacing: 2, marginTop: 2, textAlign: 'right' },
  controlCard: {
    marginHorizontal: 12,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: 'rgba(20,15,8,0.72)',
  },
  headerAccessoryWrap: {
    marginBottom: 8,
  },
  controlRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  inputWrap: {
    flex: 1,
  },
  nameInput: {
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    color: INK,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  createBtn: {
    backgroundColor: GOLD_1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  createBtnText: {
    color: '#1a1207',
    fontWeight: '800',
    fontSize: 14,
  },
  utilityRow: {
    marginTop: 10,
    flexDirection: 'row-reverse',
    gap: 8,
  },
  linkButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: LINE,
  },
  linkButtonText: {
    color: INK_DIM,
    fontSize: 12,
    fontWeight: '700',
  },
  chips: { paddingHorizontal: 14, marginBottom: 12, flexGrow: 0 },
  chipsContent: { gap: 6, paddingHorizontal: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: 'rgba(245,210,122,0.18)', borderColor: GOLD_2 },
  chipText: { color: INK_DIM, fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: GOLD_1 },
  list: { paddingHorizontal: 12, gap: 10 },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: 'rgba(20,15,8,0.7)',
  },
  cardDisabled: {
    opacity: 0.65,
  },
  felt: { aspectRatio: 2.25, position: 'relative', overflow: 'hidden' },
  feltVignette: { backgroundColor: 'rgba(0,0,0,0.35)' },
  pile: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCard: {
    position: 'absolute',
    width: 22,
    height: 30,
    borderRadius: 4,
    backgroundColor: '#fafaf6',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  miniCardBack: { backgroundColor: '#4a1818', borderColor: 'rgba(245,210,122,0.4)' },
  seat: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(245,210,122,0.6)',
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatEmpty: {
    borderStyle: 'dashed',
    borderColor: 'rgba(245,210,122,0.25)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  seatText: { fontSize: 9, fontWeight: '600', color: GOLD_1 },
  seatPosTopLeft: { top: '8%', left: '12%' },
  seatPosTopRight: { top: '8%', right: '12%' },
  seatPosMidRight: { top: '50%', right: '4%', marginTop: -9 },
  seatPosBottomRight: { bottom: '8%', right: '12%' },
  seatPosBottomLeft: { bottom: '8%', left: '12%' },
  seatPosMidLeft: { top: '50%', left: '4%', marginTop: -9 },
  statusPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  cardBody: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  cardRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tableName: { fontSize: 16, fontWeight: '600', color: INK },
  tableId: { fontSize: 10, color: INK_MUTE, letterSpacing: 1.5 },
  metaLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  metaLabel: { color: INK_MUTE, fontSize: 10, letterSpacing: 0.8 },
  metaValue: { color: GOLD_1, fontWeight: '600', fontSize: 12 },
  metaDivider: { width: 1, height: 12, backgroundColor: LINE },
  playersBar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  avatarStack: { flexDirection: 'row-reverse' },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#0a0804',
    backgroundColor: '#3f2a10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmpty: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderColor: 'rgba(245,210,122,0.15)',
    borderStyle: 'dashed',
  },
  avatarText: { fontSize: 8, fontWeight: '700', color: GOLD_1 },
  playersCount: { fontSize: 10, color: INK_MUTE },
  hostText: { fontSize: 10, color: INK_MUTE },
  hostName: { color: INK_DIM },
  countdownNotice: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,210,122,0.35)',
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  countdownNoticeText: { color: GOLD_1, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: 'rgba(20,15,8,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyTitle: {
    color: INK,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    color: INK_MUTE,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  errorBox: {
    marginTop: 14,
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(252,165,165,0.28)',
    backgroundColor: 'rgba(127,29,29,0.55)',
  },
  errorText: {
    color: '#fecaca',
    fontSize: 13,
    textAlign: 'right',
  },
  fab: {
    position: 'absolute',
    left: 22,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 14,
    backgroundColor: GOLD_1,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabBolt: { fontSize: 14, color: '#1a1207' },
  fabText: { color: '#1a1207', fontWeight: '700', fontSize: 14, letterSpacing: 0.6 },
  disabledButton: {
    opacity: 0.5,
  },
});
