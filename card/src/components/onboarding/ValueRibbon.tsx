import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RibbonTile } from './types';

interface ValueRibbonProps {
  tiles: RibbonTile[];
  selectedTileIds: string[];
  remainingTargetIds: string[];
  onSelectTile: (tileId: string) => void;
  onUserScrolled: () => void;
  onDemoScrolled: () => void;
}

export default function ValueRibbon({
  tiles,
  selectedTileIds,
  remainingTargetIds,
  onSelectTile,
  onUserScrolled,
  onDemoScrolled,
}: ValueRibbonProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  const userScrolledRef = useRef(false);
  const showTiles = useMemo(() => {
    return tiles.filter((tile) => tile.kind !== 'target' || remainingTargetIds.includes(tile.id));
  }, [tiles, remainingTargetIds]);

  useEffect(() => {
    const first = setTimeout(() => scrollRef.current?.scrollTo({ x: 130, animated: true }), 350);
    const second = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: 0, animated: true });
      onDemoScrolled();
    }, 1100);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [onDemoScrolled]);

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          if (userScrolledRef.current) return;
          userScrolledRef.current = true;
          onUserScrolled();
        }}
        contentContainerStyle={styles.content}
      >
        {showTiles.map((tile) => {
          const selected = selectedTileIds.includes(tile.id);
          const label = tile.kind === 'target' ? String(tile.value) : tile.label ?? String(tile.value ?? '');
          return (
            <TouchableOpacity
              key={tile.id}
              style={[styles.tile, tile.kind === 'target' && styles.targetTile, selected && styles.selected]}
              activeOpacity={0.85}
              onPress={() => onSelectTile(tile.id)}
            >
              <Text style={styles.tileText}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    backgroundColor: 'rgba(17,24,39,0.88)',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  content: {
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 10,
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(31,41,55,0.95)',
  },
  targetTile: {
    backgroundColor: 'rgba(30,64,175,0.45)',
  },
  selected: {
    borderColor: '#FBBF24',
    transform: [{ scale: 1.04 }],
  },
  tileText: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '700',
  },
});
