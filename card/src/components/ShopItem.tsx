import React, { ReactNode } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { SlindaCoin } from '../../components/SlindaCoin';

type Props = {
  /** Hero visual — coin, card preview, icon, etc. */
  preview: ReactNode;
  name: string;
  description: string;
  /** Price in coins. */
  price: number;
  owned: boolean;
  loading?: boolean;
  onBuy: () => void;
  ownedLabel?: string;
  buyLabel?: string;
};

export function ShopItem({
  preview,
  name,
  description,
  price,
  owned,
  loading = false,
  onBuy,
  ownedLabel = 'ברשותך ✓',
  buyLabel = 'קנה',
}: Props) {
  return (
    <View style={styles.card}>
      {/* Hero preview — sits above the card border */}
      <View style={styles.previewWrap}>
        <View style={styles.previewGlow} />
        {preview}
      </View>

      <View style={styles.body}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.desc}>{description}</Text>

        <View style={styles.priceRow}>
          <SlindaCoin size={16} />
          <Text style={styles.priceText}>{price}</Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, owned && styles.btnOwned]}
          onPress={onBuy}
          disabled={owned || loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={styles.btnText}>{owned ? ownedLabel : buyLabel}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    paddingTop: 64,   // room for the preview that breaks out of the top
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  previewWrap: {
    position: 'absolute',
    top: -50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  previewGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 36px 16px rgba(252,211,77,0.20)' }
      : { shadowColor: '#FCD34D', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 12 }),
  },
  body: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  desc: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  priceText: {
    color: '#FCD34D',
    fontSize: 14,
    fontWeight: '800',
  },
  btn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  btnOwned: {
    backgroundColor: '#374151',
  },
  btnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
