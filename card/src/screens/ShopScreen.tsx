import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Platform, ActivityIndicator, ScrollView, ImageBackground, Image,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SlindaCoin } from '../../components/SlindaCoin';
import { SpinningCard } from '../components/SpinningCard';
import { ThemePreview } from '../components/ThemePreview';
import { THEMES, THEME_IDS, type ThemeId } from '../theme/themes';
import { TABLE_SKINS, TABLE_SKIN_IDS, type TableSkinId } from '../theme/tableSkins';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../i18n/LocaleContext';
import { useActiveTheme } from '../theme/ThemeContext';

const SALINDA_IMAGE = require('../../assets/salinda.jpg');
const SLINDA_PRICE = 150;
const THEME_PRICE = 80;
const TABLE_SKIN_PRICE = 80;

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ShopScreen({ visible, onClose }: Props) {
  const { t, locale } = useLocale();
  const { profile, purchaseSlinda, purchaseTheme, purchaseTableSkin, setActiveSkin } = useAuth();
  const { background } = useActiveTheme();
  const { width, height } = useWindowDimensions();
  const [slindaLoading, setSlindaLoading] = useState(false);
  const [themeLoading, setThemeLoading] = useState<ThemeId | null>(null);
  const [tableSkinLoading, setTableSkinLoading] = useState<TableSkinId | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<ThemeId | null>(null);
  const [previewTableSkin, setPreviewTableSkin] = useState<TableSkinId | null>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const slindaOwned = profile?.slinda_owned ?? false;
  const ownedThemes = (profile?.themes_owned ?? ['classic']) as ThemeId[];
  const ownedTableSkins = (profile?.table_skins_owned ?? []) as string[];
  const coins = profile?.total_coins ?? 0;
  const activeTableSkinId = profile?.active_table_skin as TableSkinId | null | undefined;

  async function handleBuySlinda() {
    if (slindaOwned || slindaLoading || coins < SLINDA_PRICE) return;
    setSlindaLoading(true);
    setFeedback(null);
    const result = await purchaseSlinda();
    setSlindaLoading(false);
    if (result === 'ok') {
      setFeedback(t('shop.purchaseSuccess'));
    } else if (result === 'insufficient_coins') {
      setFeedback(t('shop.insufficientCoins'));
    } else if (result !== 'already_owned') {
      setFeedback(t('shop.purchaseError'));
    }
  }

  async function handleBuyTheme(themeId: ThemeId) {
    if (ownedThemes.includes(themeId) || themeLoading || coins < THEME_PRICE) return;
    setThemeLoading(themeId);
    setFeedback(null);
    const result = await purchaseTheme(themeId);
    setThemeLoading(null);
    if (result === 'ok') {
      await setActiveSkin('table_theme', themeId);
      setFeedback(t('shop.themePurchaseSuccess'));
      setPreviewTheme(null);
    } else if (result === 'insufficient_coins') {
      setFeedback(t('shop.insufficientCoins'));
    } else if (result !== 'already_owned') {
      setFeedback(t('shop.purchaseError'));
    }
  }

  async function handleBuyTableSkin(skinId: TableSkinId) {
    if (ownedTableSkins.includes(skinId) || tableSkinLoading || coins < TABLE_SKIN_PRICE) return;
    setTableSkinLoading(skinId);
    setFeedback(null);
    const result = await purchaseTableSkin(skinId);
    setTableSkinLoading(null);
    if (result === 'ok') {
      await setActiveSkin('table_skin', skinId);
      setFeedback(t('shop.themePurchaseSuccess'));
      setPreviewTableSkin(null);
    } else if (result === 'insufficient_coins') {
      setFeedback(t('shop.insufficientCoins'));
    } else if (result !== 'already_owned') {
      setFeedback(t('shop.purchaseError'));
    }
  }

  async function handleActivateTableSkin(skinId: TableSkinId) {
    await setActiveSkin('table_skin', skinId);
  }

  const slindaBtnDisabled = slindaOwned || slindaLoading || coins < SLINDA_PRICE;
  const slindaBtnStyle = slindaOwned ? styles.btnOwned : coins < SLINDA_PRICE ? styles.btnLocked : styles.btnBuy;
  const purchasableThemes = THEME_IDS.filter(id => id !== 'classic');

  const previewData = previewTheme ? THEMES[previewTheme] : null;
  const previewTableSkinData = previewTableSkin ? TABLE_SKINS[previewTableSkin] : null;
  const isPreviewOpen = !!previewTheme || !!previewTableSkin;

  function handleClose() {
    if (previewTheme) { setPreviewTheme(null); return; }
    if (previewTableSkin) { setPreviewTableSkin(null); return; }
    onClose();
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    setScrolledToBottom(isNearBottom);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>

        {/* ── Shop content ── */}
        <View style={[styles.container, { width, height }, isPreviewOpen ? styles.containerHidden : null]}>

          {/* Background gradient */}
          <LinearGradient
            colors={['#0a0f1e', '#0d1f35', '#0a1628']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.3, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Gold shimmer line at top */}
          <LinearGradient
            colors={['transparent', GOLD, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.topShimmer}
          />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.coinBadge}>
              <SlindaCoin size={20} spin />
              <Text style={styles.coinCount}>{coins}</Text>
            </View>
            <View style={styles.titleWrap}>
              <Text style={styles.titleSmall}>✦ {t('shop.title')} ✦</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <LinearGradient
            colors={['transparent', 'rgba(252,211,77,0.35)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.dividerGradient}
          />

          {/* Scrollable body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.scrollBody}
          >

            {/* ── Slinda section ── */}
            <View style={styles.slindaCard}>
              <LinearGradient
                colors={['rgba(252,211,77,0.08)', 'rgba(252,211,77,0.03)', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.slindaCardInner}>
                <View style={styles.cardCol}>
                  <View style={styles.cardGlow} />
                  <SpinningCard frontSource={SALINDA_IMAGE} width={104} speed={28} backLabel={t('shop.slindaCard.name')} />
                </View>
                <View style={styles.infoCol}>
                  <View style={styles.itemBadge}>
                    <Text style={styles.itemBadgeText}>{t('shop.specialCardBadge')}</Text>
                  </View>
                  <Text style={styles.cardName}>{t('shop.slindaCard.name')}</Text>
                  <Text style={styles.cardType}>{t('shop.slindaCard.description')}</Text>
                  <View style={styles.infoSep} />
                  <View style={styles.priceRow}>
                    <SlindaCoin size={16} />
                    <Text style={styles.priceValue}>{SLINDA_PRICE}</Text>
                    <Text style={styles.priceMeta}>{t('shop.coinsUnit')}</Text>
                  </View>
                  {!slindaOwned && coins < SLINDA_PRICE && (
                    <Text style={styles.shortfall}>
                      {t('shop.shortfall', { count: SLINDA_PRICE - coins })}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[styles.btn, slindaBtnStyle]}
                    onPress={handleBuySlinda}
                    disabled={slindaBtnDisabled}
                    activeOpacity={0.8}
                  >
                    {slindaLoading
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={styles.btnText}>
                          {slindaOwned ? '✓ ' + t('shop.ownedButton') : coins < SLINDA_PRICE ? '🔒 ' + t('shop.buyButton') : t('shop.buyButton')}
                        </Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── Themes section ── */}
            <SectionHeader title={t('shop.themesSection')} />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {purchasableThemes.map(themeId => {
                const theme = THEMES[themeId];
                const owned = ownedThemes.includes(themeId);
                const canAfford = coins >= THEME_PRICE;
                const busy = themeLoading === themeId;
                const hasPreview = !!theme.background.image;
                return (
                  <View key={themeId} style={[styles.productCard, owned && styles.productCardOwned]}>
                    {owned && (
                      <LinearGradient
                        colors={['rgba(252,211,77,0.12)', 'transparent']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <TouchableOpacity
                      onPress={hasPreview ? () => setPreviewTheme(themeId) : undefined}
                      activeOpacity={hasPreview ? 0.8 : 1}
                    >
                      <View style={styles.previewThumb}>
                        <ThemePreview themeId={themeId} size="medium" />
                        {hasPreview && (
                          <View style={styles.previewHint}>
                            <Text style={styles.previewHintText}>{t('shop.previewHint')}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.productName}>{locale === 'he' ? theme.name_he : theme.name_en}</Text>
                    {!owned && (
                      <View style={styles.productPriceRow}>
                        <SlindaCoin size={13} />
                        <Text style={styles.productPriceText}>{THEME_PRICE}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.productBtn, owned ? styles.productBtnOwned : !canAfford ? styles.productBtnLocked : styles.productBtnBuy]}
                      onPress={() => handleBuyTheme(themeId)}
                      disabled={owned || busy || !canAfford}
                      activeOpacity={0.8}
                    >
                      {busy
                        ? <ActivityIndicator color="#FFF" size="small" />
                        : <Text style={styles.productBtnText}>
                            {owned ? '✓ ' + t('shop.ownedButton') : !canAfford ? '🔒 ' + t('shop.buyButton') : t('shop.buyButton')}
                          </Text>
                      }
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            {/* ── Tables section ── */}
            <SectionHeader title={t('shop.tablesSection')} />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {TABLE_SKIN_IDS.map(skinId => {
                const skin = TABLE_SKINS[skinId];
                const owned = ownedTableSkins.includes(skinId);
                const isActive = activeTableSkinId === skinId;
                const canAfford = coins >= TABLE_SKIN_PRICE;
                const busy = tableSkinLoading === skinId;
                return (
                  <View key={skinId} style={[styles.productCard, owned && styles.productCardOwned]}>
                    {owned && (
                      <LinearGradient
                        colors={['rgba(252,211,77,0.12)', 'transparent']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <TouchableOpacity
                      onPress={() => setPreviewTableSkin(skinId)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.tableSkinThumb}>
                        <Image
                          source={skin.image}
                          resizeMode="contain"
                          style={styles.tableSkinThumbImg}
                        />
                        <View style={styles.previewHint}>
                          <Text style={styles.previewHintText}>{t('shop.previewHint')}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.productName}>{locale === 'he' ? skin.name_he : skin.name_en}</Text>
                    {!owned && (
                      <View style={styles.productPriceRow}>
                        <SlindaCoin size={13} />
                        <Text style={styles.productPriceText}>{TABLE_SKIN_PRICE}</Text>
                      </View>
                    )}
                    {owned && !isActive && (
                      <TouchableOpacity
                        style={[styles.productBtn, styles.productBtnSelect]}
                        onPress={() => void handleActivateTableSkin(skinId)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.productBtnText}>{t('shop.activateButton')}</Text>
                      </TouchableOpacity>
                    )}
                    {owned && isActive && (
                      <View style={[styles.productBtn, styles.productBtnActive]}>
                        <Text style={styles.productBtnText}>✓ {t('shop.activeBadge')}</Text>
                      </View>
                    )}
                    {!owned && (
                      <TouchableOpacity
                        style={[styles.productBtn, !canAfford ? styles.productBtnLocked : styles.productBtnBuy]}
                        onPress={() => void handleBuyTableSkin(skinId)}
                        disabled={busy || !canAfford}
                        activeOpacity={0.8}
                      >
                        {busy
                          ? <ActivityIndicator color="#FFF" size="small" />
                          : <Text style={styles.productBtnText}>
                              {!canAfford ? '🔒 ' + t('shop.buyButton') : t('shop.buyButton')}
                            </Text>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {!!feedback && (
              <View style={styles.feedbackWrap}>
                <Text style={[
                  styles.feedbackText,
                  feedback === t('shop.purchaseSuccess') || feedback === t('shop.themePurchaseSuccess')
                    ? styles.feedbackSuccess : null,
                ]}>
                  {feedback}
                </Text>
              </View>
            )}

            {/* Bottom spacer */}
            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Scroll hint fade - shown when not at bottom */}
          {!scrolledToBottom && (
            <LinearGradient
              colors={['transparent', 'rgba(10,15,30,0.92)']}
              style={styles.bottomFade}
              pointerEvents="none"
            >
              <Text style={styles.scrollHintText}>▾</Text>
            </LinearGradient>
          )}

        </View>

        {/* ── Full-screen theme preview overlay ── */}
        {previewData && (
          <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="auto">
            {previewData.background.image ? (
              <ImageBackground source={previewData.background.image} resizeMode="cover" style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient colors={previewData.background.gradient} style={StyleSheet.absoluteFill} />
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 280 }}
            />

            <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewTheme(null)}>
              <Text style={styles.previewCloseText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.previewBar}>
              <Text style={styles.previewThemeName}>{locale === 'he' ? previewData.name_he : previewData.name_en}</Text>
              {previewTheme && !ownedThemes.includes(previewTheme) && (
                <View style={styles.previewPriceRow}>
                  <SlindaCoin size={18} />
                  <Text style={styles.previewPriceText}>{THEME_PRICE} {t('shop.coinsUnit')}</Text>
                </View>
              )}
              {previewTheme && (
                <TouchableOpacity
                  style={[
                    styles.previewBuyBtn,
                    ownedThemes.includes(previewTheme) ? styles.productBtnOwned
                      : coins < THEME_PRICE ? styles.productBtnLocked
                      : styles.productBtnBuy,
                  ]}
                  onPress={() => { if (previewTheme) void handleBuyTheme(previewTheme); }}
                  disabled={ownedThemes.includes(previewTheme) || themeLoading === previewTheme || coins < THEME_PRICE}
                  activeOpacity={0.85}
                >
                  {themeLoading === previewTheme
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.previewBuyBtnText}>
                        {ownedThemes.includes(previewTheme)
                          ? '✓ ' + t('shop.ownedButton')
                          : coins < THEME_PRICE
                          ? '🔒 ' + t('shop.buyButton')
                          : t('shop.buyButton')}
                      </Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Full-screen table skin preview overlay ── */}
        {previewTableSkinData && (
          <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="auto">
            {background.image ? (
              <ImageBackground source={background.image} resizeMode="cover" style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient
                colors={[...background.gradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Image
              source={previewTableSkinData.image}
              resizeMode="contain"
              style={{ position: 'absolute', width: '100%', height: '100%' }}
            />

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 280 }}
            />

            <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewTableSkin(null)}>
              <Text style={styles.previewCloseText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.previewBar}>
              <Text style={styles.previewThemeName}>{locale === 'he' ? previewTableSkinData.name_he : previewTableSkinData.name_en}</Text>
              {previewTableSkin && !ownedTableSkins.includes(previewTableSkin) && (
                <View style={styles.previewPriceRow}>
                  <SlindaCoin size={18} />
                  <Text style={styles.previewPriceText}>{TABLE_SKIN_PRICE} {t('shop.coinsUnit')}</Text>
                </View>
              )}
              {previewTableSkin && (
                <TouchableOpacity
                  style={[
                    styles.previewBuyBtn,
                    ownedTableSkins.includes(previewTableSkin) ? styles.productBtnOwned
                      : coins < TABLE_SKIN_PRICE ? styles.productBtnLocked
                      : styles.productBtnBuy,
                  ]}
                  onPress={() => { if (previewTableSkin) void handleBuyTableSkin(previewTableSkin); }}
                  disabled={ownedTableSkins.includes(previewTableSkin) || tableSkinLoading === previewTableSkin || coins < TABLE_SKIN_PRICE}
                  activeOpacity={0.85}
                >
                  {tableSkinLoading === previewTableSkin
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={styles.previewBuyBtnText}>
                        {ownedTableSkins.includes(previewTableSkin)
                          ? '✓ ' + t('shop.ownedButton')
                          : coins < TABLE_SKIN_PRICE
                          ? '🔒 ' + t('shop.buyButton')
                          : t('shop.buyButton')}
                      </Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

      </View>
    </Modal>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={sectionHeaderStyles.wrap}>
      <LinearGradient
        colors={['transparent', 'rgba(252,211,77,0.5)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={sectionHeaderStyles.line}
      />
      <Text style={sectionHeaderStyles.text}>{title}</Text>
      <LinearGradient
        colors={['transparent', 'rgba(252,211,77,0.5)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={sectionHeaderStyles.line}
      />
    </View>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 10, marginTop: 28, marginBottom: 14 },
  line: { flex: 1, height: 1 },
  text: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
});

const GOLD = '#FCD34D';
const GOLD_LIGHT = '#FDE68A';
const GOLD_DIM = 'rgba(252,211,77,0.6)';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.0)',
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: 'inset 0 0 120px rgba(252,211,77,0.04)' } as any
      : {}),
  },
  containerHidden: { opacity: 0 },

  topShimmer: {
    height: 1,
    width: '100%',
    marginTop: Platform.OS === 'ios' ? 44 : 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 52,
    paddingBottom: 16,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(252,211,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 80,
  },
  coinCount: { color: GOLD_LIGHT, fontSize: 15, fontWeight: '800' },
  titleWrap: { flex: 1, alignItems: 'center' },
  titleSmall: { color: GOLD, fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 48,
    alignItems: 'center',
  },
  closeX: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700' },

  dividerGradient: { height: 1, width: '100%', marginBottom: 4 },

  scrollBody: { paddingBottom: 10 },

  /* ── Slinda hero card ── */
  slindaCard: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.2)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 32px rgba(252,211,77,0.08)' } as any
      : { shadowColor: GOLD, shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 8 }),
  },
  slindaCardInner: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, gap: 16 },
  cardCol: { alignItems: 'center', justifyContent: 'center' },
  cardGlow: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55, top: 10, left: -4, backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 40px 16px rgba(252,211,77,0.18)' } as any
      : { shadowColor: GOLD, shadowOpacity: 0.35, shadowRadius: 28, shadowOffset: { width: 0, height: 0 }, elevation: 12 }),
  },
  infoCol: { flex: 1, paddingTop: 2, gap: 6 },
  itemBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(252,211,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  itemBadgeText: { color: GOLD_DIM, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  cardName: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  cardType: { color: 'rgba(253,230,138,0.7)', fontSize: 12, fontWeight: '500', fontStyle: 'italic' },
  infoSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priceValue: { color: GOLD, fontSize: 16, fontWeight: '900' },
  priceMeta: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '500' },
  shortfall: { color: '#F87171', fontSize: 11, fontWeight: '700' },
  btn: { borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 4 },
  btnBuy: { backgroundColor: '#15803D' },
  btnOwned: { backgroundColor: 'rgba(255,255,255,0.08)' },
  btnLocked: { backgroundColor: 'rgba(255,255,255,0.06)', opacity: 0.7 },
  btnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  /* ── Horizontal product cards ── */
  horizontalList: { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },
  productCard: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
    minWidth: 120,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  productCardOwned: {
    borderColor: 'rgba(252,211,77,0.35)',
  },
  previewThumb: { position: 'relative' },
  previewHint: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  previewHintText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700' },
  productName: { color: '#E2E8F0', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  productPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  productPriceText: { color: GOLD, fontWeight: '800', fontSize: 12 },
  productBtn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', width: '100%' },
  productBtnBuy: { backgroundColor: '#15803D' },
  productBtnOwned: { backgroundColor: 'rgba(255,255,255,0.08)' },
  productBtnLocked: { backgroundColor: 'rgba(255,255,255,0.06)', opacity: 0.65 },
  productBtnSelect: { backgroundColor: '#0369A1' },
  productBtnActive: { backgroundColor: 'rgba(252,211,77,0.15)', borderWidth: 1, borderColor: 'rgba(252,211,77,0.3)' },
  productBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  tableSkinThumb: {
    width: 120,
    height: 46,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  tableSkinThumbImg: { width: 120, height: 46 },

  feedbackWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, alignItems: 'center' },
  feedbackText: { color: '#F87171', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  feedbackSuccess: { color: '#4ADE80' },

  /* ── Bottom fade scroll hint ── */
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  scrollHintText: {
    color: 'rgba(252,211,77,0.5)',
    fontSize: 18,
    fontWeight: '700',
  },

  /* ── Preview overlays ── */
  previewClose: {
    position: 'absolute', top: 52, right: 20,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  previewCloseText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  previewBar: {
    position: 'absolute', bottom: 60, left: 24, right: 24, alignItems: 'center', gap: 12,
  },
  previewThemeName: {
    color: '#FFF', fontSize: 30, fontWeight: '900', letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },
  previewPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewPriceText: { color: GOLD, fontSize: 18, fontWeight: '800' },
  previewBuyBtn: { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center', width: '100%' },
  previewBuyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
});
