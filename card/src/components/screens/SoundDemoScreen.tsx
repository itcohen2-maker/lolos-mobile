import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { playSfx, setSfxMuted, setSfxVolume, stopAllSfx, type SfxKey } from '../../audio/sfx';
import { useLocale } from '../../i18n/LocaleContext';
import { brand } from '../../theme/brand';

type DemoItem = { key: SfxKey; label: string; hintKey: string };

export default function SoundDemoScreen({ onBack }: { onBack: () => void }) {
  const { t } = useLocale();
  const ITEMS: DemoItem[] = useMemo(
    () => [
      { key: 'tap', label: 'Tap', hintKey: 'sound.hint.tap' },
      { key: 'success', label: 'Success', hintKey: 'sound.hint.success' },
      { key: 'combo', label: 'Combo', hintKey: 'sound.hint.combo' },
      { key: 'errorSoft', label: 'Error Soft', hintKey: 'sound.hint.errorSoft' },
      { key: 'start', label: 'Start', hintKey: 'sound.hint.start' },
      { key: 'complete', label: 'Complete', hintKey: 'sound.hint.complete' },
      { key: 'transition', label: 'Transition', hintKey: 'sound.hint.transition' },
    ],
    [],
  );
  const [volume, setVolume] = useState(0.33);
  const [muted, setMuted] = useState(false);
  const volumePct = useMemo(() => Math.round(volume * 100), [volume]);

  const stepVolume = async (delta: number) => {
    const next = Math.max(0, Math.min(1, Number((volume + delta).toFixed(2))));
    setVolume(next);
    await setSfxVolume(next);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSfxMuted(next);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('sound.demoTitle')}</Text>
      <Text style={styles.subtitle}>{t('sound.demoSubtitle')}</Text>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.smallBtn} onPress={() => stepVolume(-0.05)}>
          <Text style={styles.smallBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.volumeText}>SFX: {volumePct}%</Text>
        <TouchableOpacity style={styles.smallBtn} onPress={() => stepVolume(0.05)}>
          <Text style={styles.smallBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallBtn, muted && styles.smallBtnMuted]} onPress={toggleMute}>
          <Text style={styles.smallBtnText}>{muted ? '🔇' : '🔊'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.row}
            onPress={() => playSfx(item.key, { cooldownMs: 120 })}
          >
            <View>
              <Text style={styles.rowTitle}>{item.label}</Text>
              <Text style={styles.rowHint}>{t(item.hintKey)}</Text>
            </View>
            <Text style={styles.playText}>{t('sound.play')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.secondary} onPress={() => stopAllSfx()}>
          <Text style={styles.secondaryText}>{t('sound.stopAll')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primary} onPress={onBack}>
          <Text style={styles.primaryText}>{t('sound.back')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.bg },
  content: { padding: 20, paddingTop: 36, paddingBottom: 40 },
  title: { color: '#F8FAFC', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: brand.cyan, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 },
  smallBtn: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  smallBtnMuted: { borderColor: '#F59E0B' },
  smallBtnText: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  volumeText: { color: '#E2E8F0', fontSize: 13, minWidth: 88, textAlign: 'center' },
  list: { gap: 10, marginTop: 8 },
  row: { backgroundColor: 'rgba(30,41,59,0.88)', borderColor: 'rgba(148,163,184,0.28)', borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  rowHint: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  playText: { color: brand.cyan, fontSize: 13, fontWeight: '700' },
  bottomActions: { marginTop: 22, flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, backgroundColor: '#1F2937', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  secondaryText: { color: '#E5E7EB', fontWeight: '700' },
  primary: { flex: 1, backgroundColor: brand.gold, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#111827', fontWeight: '800' },
});
