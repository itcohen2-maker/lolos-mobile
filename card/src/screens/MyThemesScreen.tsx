import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Platform, ActivityIndicator, ImageBackground, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SlindaCoin } from '../../components/SlindaCoin';
import { THEMES, THEME_IDS, type ThemeId } from '../theme/themes';
import { TABLE_SKINS, TABLE_SKIN_IDS, type TableSkinId } from '../theme/tableSkins';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../i18n/LocaleContext';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function MyThemesScreen({ visible, onClose }: Props) {
  const { t, locale } = useLocale();
  const { profile, setActiveSkin } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const ownedThemes = (profile?.themes_owned ?? ['classic']) as ThemeId[];
  const ownedTableSkins = (profile?.table_skins_owned ?? []) as TableSkinId[];
  const _rawTable = profile?.active_table_theme ?? 'classic';
  const activeTable = (THEMES[_rawTable as ThemeId] ? _rawTable : 'classic') as ThemeId;
  const _rawBg = profile?.active_card_back ?? 'classic';
  const activeBackground = (THEMES[_rawBg as ThemeId] ? _rawBg : 'classic') as ThemeId;
  const activeTableSkin = (profile?.active_table_skin ?? null) as TableSkinId | null;

  async function handleSetSkin(kind: 'card_back' | 'table_theme', themeId: ThemeId) {
    const key = `${kind}:${themeId}`;
    if (loading === key) return;
    setLoading(key);
    await setActiveSkin(kind, themeId);
    setLoading(null);
  }

  async function handleSetTableSkin(skinId: TableSkinId | 'none') {
    const key = `table_skin:${skinId}`;
    if (loading === key) return;
    setLoading(key);
    await setActiveSkin('table_skin', skinId);
    setLoading(null);
  }

  const ownedList = THEME_IDS.filter(id => ownedThemes.includes(id));

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <SlindaCoin size={22} spin />
              <Text style={styles.coinCount}>{profile?.total_coins ?? 0}</Text>
            </View>
            <Text style={styles.title}>{t('themes.myThemes')}</Text>
            <TouchableOpacity style={styles.closeHit} onPress={onClose}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerLine} />

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

            {/* Table Section */}
            <Text style={styles.sectionTitle}>{t('themes.table')}</Text>
            <Text style={styles.slotLabel}>{t('themes.currentlyUsed')}: {locale === 'he' ? THEMES[activeTable].name_he : THEMES[activeTable].name_en}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {ownedList.map(id => {
                const theme = THEMES[id];
                const isActive = id === activeTable;
                const key = `table:${id}`;
                const busy = loading === key;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.themeCard, isActive && styles.themeCardActive]}
                    onPress={() => !isActive && handleSetSkin('table_theme', id)}
                    activeOpacity={isActive ? 1 : 0.75}
                    disabled={isActive}
                  >
                    {theme.table.gradient ? (
                      <LinearGradient colors={theme.table.gradient} style={styles.tableSwatch} />
                    ) : (
                      <ImageBackground source={theme.table.image} resizeMode="cover" style={[styles.tableSwatch, { overflow: 'hidden' }]} />
                    )}
                    <Text style={styles.themeName}>{locale === 'he' ? theme.name_he : theme.name_en}</Text>
                    {busy ? (
                      <ActivityIndicator size="small" color={GOLD} style={{ marginTop: 4 }} />
                    ) : isActive ? (
                      <Text style={styles.activeLabel}>{t('themes.currentlyUsed')}</Text>
                    ) : (
                      <Text style={styles.equipLabel}>{t('themes.replaceable')}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.sectionSep} />

            {/* Background Section */}
            <Text style={styles.sectionTitle}>{t('themes.background')}</Text>
            <Text style={styles.slotLabel}>{t('themes.currentlyUsed')}: {locale === 'he' ? THEMES[activeBackground].name_he : THEMES[activeBackground].name_en}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {ownedList.map(id => {
                const theme = THEMES[id];
                const isActive = id === activeBackground;
                const key = `card_back:${id}`;
                const busy = loading === key;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.themeCard, isActive && styles.themeCardActive]}
                    onPress={() => !isActive && handleSetSkin('card_back', id)}
                    activeOpacity={isActive ? 1 : 0.75}
                    disabled={isActive}
                  >
                    <LinearGradient
                      colors={theme.background.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0.85, y: 1 }}
                      style={styles.bgSwatch}
                    />
                    <Text style={styles.themeName}>{locale === 'he' ? theme.name_he : theme.name_en}</Text>
                    {busy ? (
                      <ActivityIndicator size="small" color={GOLD} style={{ marginTop: 4 }} />
                    ) : isActive ? (
                      <Text style={styles.activeLabel}>{t('themes.currentlyUsed')}</Text>
                    ) : (
                      <Text style={styles.equipLabel}>{t('themes.replaceable')}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.sectionSep} />

            <Text style={styles.sectionTitle}>{t('themes.tableSkin')}</Text>
            <Text style={styles.slotLabel}>
              {t('themes.currentlyUsed')}: {activeTableSkin ? (locale === 'he' ? TABLE_SKINS[activeTableSkin].name_he : TABLE_SKINS[activeTableSkin].name_en) : t('themes.none')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              <TouchableOpacity
                style={[styles.themeCard, !activeTableSkin && styles.themeCardActive]}
                onPress={() => activeTableSkin && handleSetTableSkin('none')}
                activeOpacity={!activeTableSkin ? 1 : 0.75}
                disabled={!activeTableSkin}
              >
                <View style={[styles.tableSwatch, styles.noneSwatch]}>
                  <Text style={styles.noneSwatchText}>{t('themes.none')}</Text>
                </View>
                <Text style={styles.themeName}>{t('themes.removeSkin')}</Text>
                {!activeTableSkin ? (
                  <Text style={styles.activeLabel}>{t('themes.currentlyUsed')}</Text>
                ) : (
                  <Text style={styles.equipLabel}>{t('themes.replaceable')}</Text>
                )}
              </TouchableOpacity>
              {TABLE_SKIN_IDS.filter(id => ownedTableSkins.includes(id)).map(id => {
                const skin = TABLE_SKINS[id];
                const isActive = id === activeTableSkin;
                const key = `table_skin:${id}`;
                const busy = loading === key;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.themeCard, isActive && styles.themeCardActive]}
                    onPress={() => !isActive && handleSetTableSkin(id)}
                    activeOpacity={isActive ? 1 : 0.75}
                    disabled={isActive}
                  >
                    <Image source={skin.image} resizeMode="contain" style={styles.tableSkinSwatch} />
                    <Text style={styles.themeName}>{locale === 'he' ? skin.name_he : skin.name_en}</Text>
                    {busy ? (
                      <ActivityIndicator size="small" color={GOLD} style={{ marginTop: 4 }} />
                    ) : isActive ? (
                      <Text style={styles.activeLabel}>{t('themes.currentlyUsed')}</Text>
                    ) : (
                      <Text style={styles.equipLabel}>{t('themes.replaceable')}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.sectionSep} />

            {/* Mix notice */}
            <Text style={styles.mixNotice}>{t('themes.mixNotice')}</Text>

            {/* Active combo preview */}
            <View style={styles.activeCombo}>
              <Text style={styles.activeComboLabel}>{t('themes.currentCombo')}</Text>
              <View style={styles.comboPreview}>
                {/* Background */}
                <LinearGradient
                  colors={THEMES[activeBackground].background.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={styles.comboBg}
                >
                  {/* Table on top */}
                  {THEMES[activeTable].table.gradient ? (
                    <LinearGradient
                      colors={THEMES[activeTable].table.gradient!}
                      style={[StyleSheet.absoluteFill, { borderRadius: 8, opacity: 0.75 }]}
                    />
                  ) : (
                    <ImageBackground
                      source={THEMES[activeTable].table.image}
                      resizeMode="cover"
                      style={[StyleSheet.absoluteFill, { borderRadius: 8, opacity: 0.75, overflow: 'hidden' }]}
                    />
                  )}
                </LinearGradient>
              </View>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const GOLD = '#FCD34D';
const NAVY = '#0d2137';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: NAVY,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: GOLD,
    width: 320,
    maxHeight: '82%',
    overflow: 'hidden',
    ...(Platform.OS !== 'android'
      ? { shadowColor: GOLD, shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } }
      : { elevation: 20 }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 60 },
  coinCount: { color: GOLD, fontWeight: '700', fontSize: 16 },
  title: { color: '#FFF', fontWeight: '700', fontSize: 17, textAlign: 'center', flex: 1 },
  closeHit: { padding: 6, minWidth: 32, alignItems: 'flex-end' },
  closeX: { color: '#9CA3AF', fontSize: 18, fontWeight: '700' },
  dividerLine: { height: 1, backgroundColor: 'rgba(252,211,77,0.2)', marginHorizontal: 16 },
  body: { padding: 16, paddingBottom: 24 },
  sectionTitle: { color: GOLD, fontWeight: '700', fontSize: 14, marginBottom: 10 },
  slotLabel: { color: '#CBD5E1', fontSize: 12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  themeCard: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 76,
  },
  themeCardActive: {
    borderColor: GOLD,
    backgroundColor: 'rgba(252,211,77,0.08)',
  },
  tableSwatch: { width: 64, height: 42, borderRadius: 6 },
  tableSkinSwatch: { width: 64, height: 42, borderRadius: 6 },
  noneSwatch: { backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  noneSwatchText: { color: '#CBD5E1', fontSize: 10, fontWeight: '700' },
  bgSwatch: { width: 64, height: 42, borderRadius: 6 },
  themeName: { color: '#E2E8F0', fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  activeLabel: { color: GOLD, fontSize: 11, fontWeight: '700', marginTop: 4 },
  equipLabel: { color: '#94A3B8', fontSize: 11, marginTop: 4 },
  sectionSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 },
  mixNotice: { color: '#94A3B8', fontSize: 12, textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  activeCombo: { alignItems: 'center', gap: 8 },
  activeComboLabel: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  comboPreview: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  comboBg: { width: 120, height: 70, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
