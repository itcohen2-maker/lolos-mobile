// ============================================================
// TableBrowserScreen.tsx - Scrollable list of joinable tables.
// Polls the game server via `list_tables` and listens for
// `tables_updated` pushes. Pull-to-refresh triggers an immediate
// update request.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { LobbyTableSummary } from '../../shared/types';
import { useAuth } from '../hooks/useAuth';
import { useWebViewportSize } from '../hooks/useWebViewportSize';
import { useLocale } from '../i18n/LocaleContext';
import { getWebContentWidth } from '../theme/webLayout';

export type OpenRoom = LobbyTableSummary;

interface Props {
  socket: any;
  onJoin: (roomCode: string) => void;
  onCreate: () => void;
  onBack: () => void;
}

const POLL_INTERVAL = 5000;

function isJoinableTable(table: OpenRoom): boolean {
  return table.visibility === 'public' && table.status === 'waiting';
}

function formatDifficulty(table: OpenRoom): string {
  if (table.configuredDifficulty === 'easy') return '0-12';
  if (table.configuredDifficulty === 'full') return '0-25';
  return '--';
}

export function TableBrowserScreen({ socket, onJoin, onCreate, onBack }: Props) {
  const { t } = useLocale();
  const { profile } = useAuth();
  const viewport = useWebViewportSize();
  const contentWidth =
    Platform.OS === 'web'
      ? getWebContentWidth(viewport.width, { maxWidth: 960, sidePadding: 40 })
      : undefined;
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRooms = useCallback(() => {
    if (!socket?.connected) return;
    socket.emit('list_tables');
  }, [socket]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleConnect = () => {
      fetchRooms();
    };
    socket.on('connect', handleConnect);
    fetchRooms();
    pollRef.current = setInterval(fetchRooms, POLL_INTERVAL);
    return () => {
      socket.off('connect', handleConnect);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchRooms, socket]);

  useEffect(() => {
    if (!socket) return undefined;
    const handler = (data: { tables: OpenRoom[] }) => {
      setRooms((data.tables ?? []).filter(isJoinableTable));
      setLoading(false);
      setRefreshing(false);
    };
    socket.on('tables_updated', handler);
    return () => {
      socket.off('tables_updated', handler);
    };
  }, [socket]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRooms();
  };

  const renderRoom = ({ item }: { item: OpenRoom }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.roomCode}>{t('browse.table')} {item.roomCode}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.hostName}>{t('browse.host')}: {item.hostName}</Text>
        <Text style={styles.info}>
          {item.currentParticipants}/{item.maxParticipants} {t('browse.players')} | {formatDifficulty(item)}
        </Text>
      </View>
      <TouchableOpacity style={styles.joinBtn} onPress={() => onJoin(item.roomCode)} activeOpacity={0.85}>
        <Text style={styles.joinText}>{t('browse.join')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.contentFrame, contentWidth ? { width: contentWidth } : null]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>{t('browse.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('browse.title')}</Text>
          {profile ? <Text style={styles.myRating}>{profile.rating}</Text> : <View style={styles.ratingSpacer} />}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#FCD34D" />
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(room) => room.roomCode}
            renderItem={renderRoom}
            contentContainerStyle={rooms.length === 0 ? styles.emptyContainer : styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FCD34D" />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>{t('browse.noTables')}</Text>
                <Text style={styles.emptyHint}>{t('browse.noTablesHint')}</Text>
              </View>
            }
          />
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.createBtn} onPress={onCreate} activeOpacity={0.85}>
            <Text style={styles.createText}>{t('browse.createTable')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
    alignItems: 'center',
  },
  contentFrame: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backText: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#FCD34D',
    fontSize: 22,
    fontWeight: '900',
  },
  myRating: {
    color: '#FDE68A',
    fontSize: 14,
    fontWeight: '800',
  },
  ratingSpacer: {
    width: 40,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    marginBottom: 8,
  },
  roomCode: {
    color: '#FCD34D',
    fontSize: 16,
    fontWeight: '900',
  },
  cardBody: {
    marginBottom: 12,
  },
  hostName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  info: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  joinBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: 24,
  },
  joinText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: '#0a1628',
  },
  createBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
