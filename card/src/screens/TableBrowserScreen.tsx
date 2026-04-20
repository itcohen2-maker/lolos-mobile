// ============================================================
// TableBrowserScreen.tsx — Scrollable list of open tables
// (rooms with waiting players). Polls the game server every
// 5 seconds via Socket.io `list_rooms` event. Tap a table to
// join; pull-to-refresh for immediate update.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useLocale } from '../i18n/LocaleContext';
import { useAuth } from '../hooks/useAuth';

export interface OpenRoom {
  code: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  difficulty: 'easy' | 'full';
  hostRating: number;
}

interface Props {
  /** Socket.io instance (from useMultiplayer or passed in). */
  socket: any;
  /** Called when the player taps "Join" on a table. */
  onJoin: (roomCode: string) => void;
  /** Called when the player taps "Create Table". */
  onCreate: () => void;
  /** Called when the player taps the back button. */
  onBack: () => void;
}

const POLL_INTERVAL = 5000;

export function TableBrowserScreen({ socket, onJoin, onCreate, onBack }: Props) {
  const { t } = useLocale();
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRooms = useCallback(() => {
    if (!socket?.connected) return;
    socket.emit('list_rooms', {}, (response: { rooms: OpenRoom[] }) => {
      setRooms(response?.rooms ?? []);
      setLoading(false);
      setRefreshing(false);
    });
  }, [socket]);

  // Initial fetch + polling
  useEffect(() => {
    fetchRooms();
    pollRef.current = setInterval(fetchRooms, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchRooms]);

  // Listen for real-time room updates if the server pushes them
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { rooms: OpenRoom[] }) => {
      setRooms(data.rooms ?? []);
    };
    socket.on('room_list', handler);
    return () => { socket.off('room_list', handler); };
  }, [socket]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRooms();
  };

  const renderRoom = ({ item }: { item: OpenRoom }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.roomCode}>🎯 {t('browse.table')} {item.code}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.hostName}>{t('browse.host')}: {item.hostName}  ⭐{item.hostRating}</Text>
        <Text style={styles.info}>
          {item.playerCount}/{item.maxPlayers} {t('browse.players')}  │  {item.difficulty === 'easy' ? '0-12' : '0-25'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.joinBtn}
        onPress={() => onJoin(item.code)}
        activeOpacity={0.85}
      >
        <Text style={styles.joinText}>{t('browse.join')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← {t('browse.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('browse.title')}</Text>
        {profile && (
          <Text style={styles.myRating}>⭐{profile.rating}</Text>
        )}
      </View>

      {/* Room list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FCD34D" />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.code}
          renderItem={renderRoom}
          contentContainerStyle={rooms.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FCD34D" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('browse.noTables')}</Text>
              <Text style={styles.emptyHint}>{t('browse.noTablesHint')}</Text>
            </View>
          }
        />
      )}

      {/* Create table button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.createBtn} onPress={onCreate} activeOpacity={0.85}>
          <Text style={styles.createText}>{t('browse.createTable')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
