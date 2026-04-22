import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SlindaCoin } from '../../components/SlindaCoin';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../i18n/LocaleContext';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function SlindaCardPreview() {
  return (
    <LinearGradient
      colors={['#EA4335', '#4285F4', '#34A853', '#FBBC05', '#EA4335']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.cardBorder}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F5F5F5', '#ECECEC']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={styles.cardInner}
      >
        <Text style={styles.cardStar}>★</Text>
        <Text style={styles.cardLabel}>סלינדה</Text>
        <View style={styles.cardCorners}>
          <Text style={[styles.cardCornerSym, { color: '#EA4335' }]}>+</Text>
          <Text style={[styles.cardCornerSym, { color: '#2196F3' }]}>÷</Text>
        </View>
        <View style={[styles.cardCorners, { bottom: 8, top: undefined }]}>
          <Text style={[styles.cardCornerSym, { color: '#34A853' }]}>×</Text>
          <Text style={[styles.cardCornerSym, { color: '#FBBC05' }]}>−</Text>
        </View>
      </LinearGradient>
    </LinearGradient>
  );
}

export function ShopScreen({ visible, onClose }: Props) {
  const { t } = useLocale();
  const { profile, purchaseSlinda } = useAuth();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const slindaOwned = profile?.slinda_owned ?? false;
  const coins = profile?.total_coins ?? 0;

  async function handleBuySlinda() {
    if (slindaOwned || loading) return;
    setLoading(true);
    setFeedback(null);
    const result = await purchaseSlinda();
    setLoading(false);
    if (result === 'ok') {
      setFeedback(t('shop.purchaseSuccess'));
    } else if (result === 'insufficient_coins') {
      setFeedback(t('shop.insufficientCoins'));
    } else if (result === 'already_owned') {
      setFeedback(t('shop.ownedButton'));
    } else {
      setFeedback(t('shop.purchaseError'));
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <SlindaCoin size={40} spin />
            <Text style={styles.title}>{t('shop.title')}</Text>
            <SlindaCoin size={40} spin />
          </View>

          {/* Coin balance */}
          <View style={styles.balanceRow}>
            <SlindaCoin size={18} />
            <Text style={styles.balanceText}>
              {t('shop.coinBalance', { count: String(coins) })}
            </Text>
          </View>

          {/* Slinda card item */}
          <View style={styles.itemCard}>
            <SlindaCardPreview />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{t('shop.slindaCard.name')}</Text>
              <Text style={styles.itemDesc}>{t('shop.slindaCard.description')}</Text>
              <View style={styles.priceRow}>
                <SlindaCoin size={16} />
                <Text style={styles.priceText}>{t('shop.slindaCard.price')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.buyBtn, slindaOwned && styles.ownedBtn]}
                onPress={handleBuySlinda}
                disabled={slindaOwned || loading}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.buyBtnText}>
                      {slindaOwned ? t('shop.ownedButton') : t('shop.buyButton')}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* Feedback message */}
          {!!feedback && (
            <Text style={styles.feedback}>{feedback}</Text>
          )}

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#0f2840',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FCD34D',
    padding: 24,
    width: 320,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FCD34D',
    letterSpacing: 1,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  balanceText: {
    color: '#FDE68A',
    fontSize: 15,
    fontWeight: '700',
  },
  itemCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  // Card preview
  cardBorder: {
    width: 72,
    height: 100,
    borderRadius: 10,
    padding: 3,
    flexShrink: 0,
  },
  cardInner: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  cardStar: {
    fontSize: 28,
    color: '#FCD34D',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 2,
  },
  cardCorners: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardCornerSym: {
    fontSize: 11,
    fontWeight: '900',
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  itemDesc: {
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 15,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  priceText: {
    color: '#FCD34D',
    fontSize: 13,
    fontWeight: '700',
  },
  buyBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  ownedBtn: {
    backgroundColor: '#374151',
  },
  buyBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  feedback: {
    color: '#FDE68A',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  closeBtn: {
    marginTop: 8,
    padding: 8,
  },
  closeBtnText: {
    color: '#9CA3AF',
    fontSize: 18,
  },
});
