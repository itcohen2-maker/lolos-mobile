/**
 * One-time offer after user chooses "with guidance": optional guided gameplay preview (~1 min).
 * Storage: salinda_gameplay_preview_prompt_v1 = 'declined' | 'watched'
 */
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocale } from '../i18n/LocaleContext';
import GameplayPreviewTeaser from './GameplayPreviewTeaser';

export const GAMEPLAY_PREVIEW_STORAGE_KEY = 'salinda_gameplay_preview_prompt_v1';

type Props = {
  visible: boolean;
  onFinished: () => void;
  /** When true, skip the yes/no sheet and open the animated teaser (replay / manual entry). */
  skipOffer?: boolean;
  soundsEnabled?: boolean;
};

export async function readGameplayPreviewDecision(): Promise<'declined' | 'watched' | null> {
  try {
    const v = await AsyncStorage.getItem(GAMEPLAY_PREVIEW_STORAGE_KEY);
    if (v === 'declined' || v === 'watched') return v;
    return null;
  } catch {
    return null;
  }
}

export default function GameplayPreviewOffer({ visible, onFinished, skipOffer = false, soundsEnabled = true }: Props) {
  const { t, isRTL } = useLocale();
  const [phase, setPhase] = useState<'offer' | 'teaser'>('offer');
  const prevVisibleRef = useRef(false);

  useLayoutEffect(() => {
    if (!visible) {
      setPhase('offer');
      prevVisibleRef.current = false;
      return;
    }
    if (!prevVisibleRef.current) {
      setPhase(skipOffer ? 'teaser' : 'offer');
    }
    prevVisibleRef.current = true;
  }, [visible, skipOffer]);

  const persistDeclined = useCallback(async () => {
    try {
      await AsyncStorage.setItem(GAMEPLAY_PREVIEW_STORAGE_KEY, 'declined');
    } catch {
      /* ignore */
    }
    onFinished();
  }, [onFinished]);

  const persistWatched = useCallback(async () => {
    try {
      await AsyncStorage.setItem(GAMEPLAY_PREVIEW_STORAGE_KEY, 'watched');
    } catch {
      /* ignore */
    }
    onFinished();
  }, [onFinished]);

  const onWatch = useCallback(() => {
    setPhase('teaser');
  }, []);

  if (!visible) return null;

  if (phase === 'teaser') {
    const endTeaser = () => void persistWatched();
    return (
      <Modal visible={visible} animationType="fade" onRequestClose={endTeaser}>
        <View style={{ flex: 1, backgroundColor: '#070f1a' }}>
          <GameplayPreviewTeaser key="teaser-run" t={t} soundsEnabled={soundsEnabled} onSkip={endTeaser} onComplete={endTeaser} />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void persistDeclined()}>
      <View style={styles.offerOverlay}>
        <LinearGradient colors={['#7C3AED', '#2563EB', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', maxWidth: 360, borderRadius: 28, padding: 3 }}>
          <View style={[styles.offerCard, { direction: isRTL ? 'rtl' : 'ltr' }]}>
            <Text style={styles.offerTitle}>{t('previewOffer.title')}</Text>
            <Text style={styles.offerBody}>{t('previewOffer.body')}</Text>
            <View style={styles.offerBtns}>
              <TouchableOpacity activeOpacity={0.9} onPress={onWatch} style={styles.offerPrimary}>
                <Text style={styles.offerPrimaryTxt}>{t('previewOffer.watch')}</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.9} onPress={() => void persistDeclined()} style={styles.offerSecondary}>
                <Text style={styles.offerSecondaryTxt}>{t('previewOffer.noThanks')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  offerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  offerCard: {
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  offerTitle: { color: '#FDE68A', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  offerBody: { marginTop: 10, fontSize: 14, lineHeight: 22, color: '#E0F2FE', textAlign: 'center' },
  offerBtns: { marginTop: 18, gap: 10, alignSelf: 'stretch' },
  offerPrimary: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  offerPrimaryTxt: { color: '#111827', fontSize: 15, fontWeight: '900' },
  offerSecondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  offerSecondaryTxt: { color: '#E5E7EB', fontSize: 15, fontWeight: '800' },
});
