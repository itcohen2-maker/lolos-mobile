import React, { useState } from 'react';
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
import { useWebViewportSize } from '../hooks/useWebViewportSize';
import { getWebContentWidth } from '../theme/webLayout';

const SALINDA_IMAGE = require('../../assets/salinda.jpg');
const CLASSIC_TABLE_IMAGE = require('../../assets/table_green_nobg.png');
const SLINDA_PRICE = 100;

type FeedbackTone = 'success' | 'error';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && THEME_IDS.includes(value as ThemeId);
}

function isTableSkinId(value: string | null | undefined): value is TableSkinId {
  return !!value && TABLE_SKIN_IDS.includes(value as TableSkinId);
}

export function ShopScreen({ visible, onClose }: Props) {
  const { t, locale } = useLocale();
  const { profile, purchaseSlinda, purchaseTheme, purchaseTableSkin, setActiveSkin } = useAuth();
  const { background } = useActiveTheme();
  const { width, height } = useWindowDimensions();
  const viewport = useWebViewportSize();
  const viewportWidth = Platform.OS === 'web' ? viewport.width : width;
  const contentWidth = Platform.OS === 'web'
    ? getWebContentWidth(viewportWidth, { maxWidth: 1120, sidePadding: 40 })
    : width;
  const [slindaLoading, setSlindaLoading] = useState(false);
  const [themeLoading, setThemeLoading] = useState<ThemeId | null>(null);
  const [tableSkinLoading, setTableSkinLoading] = useState<TableSkinId | null>(null);
  const [activationLoading, setActivationLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone | null>(null);
  const [previewTheme, setPreviewTheme] = useState<ThemeId | null>(null);
  const [previewTableSkin, setPreviewTableSkin] = useState<TableSkinId | null>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const slindaOwned = profile?.slinda_owned ?? false;
  const rawOwnedThemes = profile?.themes_owned ?? ['classic'];
  const ownedThemes = THEME_IDS.filter((themeId) => themeId === 'classic' || rawOwnedThemes.includes(themeId));
  const rawOwnedTableSkins = profile?.table_skins_owned ?? [];
  const ownedTableSkins = TABLE_SKIN_IDS.filter((skinId) => rawOwnedTableSkins.includes(skinId));
  const coins = profile?.total_coins ?? 0;
  const activeBackgroundThemeId = isThemeId(profile?.active_card_back) ? profile.active_card_back : 'classic';
  const activeTableThemeId = isThemeId(profile?.active_table_theme) ? profile.active_table_theme : 'classic';
  const activeTableSkinId = isTableSkinId(profile?.active_table_skin) ? profile.active_table_skin : null;

  const previewData = previewTheme ? THEMES[previewTheme] : null;
  const previewTableSkinData = previewTableSkin ? TABLE_SKINS[previewTableSkin] : null;
  const isPreviewOpen = !!previewTheme || !!previewTableSkin;

  function clearFeedback() {
    setFeedback(null);
    setFeedbackTone(null);
  }

  function showSuccess(message: string) {
    setFeedback(message);
    setFeedbackTone('success');
  }

  function showError(message: string) {
    setFeedback(message);
    setFeedbackTone('error');
  }

  function isThemeFullyActive(themeId: ThemeId) {
    return activeBackgroundThemeId === themeId && activeTableThemeId === themeId;
  }

  async function handleBuySlinda() {
    if (slindaOwned || slindaLoading || coins < SLINDA_PRICE) return;
    setSlindaLoading(true);
    clearFeedback();
    try {
      const result = await purchaseSlinda();
      if (result === 'ok') showSuccess(t('shop.purchaseSuccess'));
      else if (result === 'insufficient_coins') showError(t('shop.insufficientCoins'));
      else if (result !== 'already_owned') showError(t('shop.purchaseError'));
    } finally {
      setSlindaLoading(false);
    }
  }

  async function handleBuyTheme(themeId: ThemeId) {
    const theme = THEMES[themeId];
    if (ownedThemes.includes(themeId) || themeLoading || coins < theme.price) return;
    setThemeLoading(themeId);
    clearFeedback();
    try {
      const result = await purchaseTheme(themeId);
      if (result === 'ok') showSuccess(t('shop.themePurchaseSuccess'));
      else if (result === 'insufficient_coins') showError(t('shop.insufficientCoins'));
      else if (result !== 'already_owned') showError(t('shop.purchaseError'));
    } finally {
      setThemeLoading(null);
    }
  }

  async function handleBuyTableSkin(skinId: TableSkinId) {
    const skin = TABLE_SKINS[skinId];
    if (ownedTableSkins.includes(skinId) || tableSkinLoading || coins < skin.price) return;
    setTableSkinLoading(skinId);
    clearFeedback();
    try {
      const result = await purchaseTableSkin(skinId);
      if (result === 'ok') showSuccess(t('shop.tableSkinPurchaseSuccess'));
      else if (result === 'insufficient_coins') showError(t('shop.insufficientCoins'));
      else if (result !== 'already_owned') showError(t('shop.purchaseError'));
    } finally {
      setTableSkinLoading(null);
    }
  }

  async function handleActivateTheme(themeId: ThemeId) {
    const key = `theme:${themeId}`;
    if (activationLoading === key || isThemeFullyActive(themeId)) return;
    setActivationLoading(key);
    clearFeedback();
    try {
      const backgroundResult = await setActiveSkin('card_back', themeId);
      const tableResult = backgroundResult === 'ok'
        ? await setActiveSkin('table_theme', themeId)
        : backgroundResult;
      if (backgroundResult === 'ok' && tableResult === 'ok') showSuccess(t('shop.activationSuccess'));
      else if (backgroundResult === 'not_owned' || tableResult === 'not_owned') showError(t('shop.notOwnedError'));
      else showError(t('shop.activationError'));
    } finally {
      setActivationLoading(null);
    }
  }

  async function handleActivateTableSkin(skinId: TableSkinId | 'none') {
    const key = `table_skin:${skinId}`;
    if (activationLoading === key) return;
    if (skinId !== 'none' && activeTableSkinId === skinId) return;
    setActivationLoading(key);
    clearFeedback();
    try {
      const result = await setActiveSkin('table_skin', skinId);
      if (result === 'ok' && skinId === 'none') {
        await setActiveSkin('table_theme', 'classic');
        await setActiveSkin('card_back', 'classic');
      }
      if (result === 'ok') {
        showSuccess(skinId === 'none' ? t('shop.tableSkinRemovedSuccess') : t('shop.activationSuccess'));
      } else if (result === 'not_owned') {
        showError(t('shop.notOwnedError'));
      } else {
        showError(t('shop.activationError'));
      }
    } finally {
      setActivationLoading(null);
    }
  }

  const slindaBtnDisabled = slindaOwned || slindaLoading || coins < SLINDA_PRICE;
  const slindaBtnStyle = slindaOwned ? styles.btnOwned : coins < SLINDA_PRICE ? styles.btnLocked : styles.btnBuy;

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

  function renderStatusPill(label: string) {
    return (
      <View key={label} style={styles.statusPill}>
        <Text style={styles.statusPillText}>{label}</Text>
      </View>
    );
  }

  function renderThemeAction(themeId: ThemeId, previewMode: boolean) {
    const active = isThemeFullyActive(themeId);
    const busy = activationLoading === `theme:${themeId}`;
    const containerStyle = previewMode ? styles.previewActionBtn : styles.productBtn;
    const textStyle = previewMode ? styles.previewActionBtnText : styles.productBtnText;
    return (
      <TouchableOpacity
        style={[containerStyle, active ? styles.productBtnActive : styles.productBtnSelect]}
        onPress={() => void handleActivateTheme(themeId)}
        disabled={active || busy}
        activeOpacity={0.8}
      >
        {busy
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Text style={textStyle}>{active ? t('shop.activeBadge') : t('shop.activateButton')}</Text>
        }
      </TouchableOpacity>
    );
  }

  function renderThemeActions(themeId: ThemeId, previewMode: boolean) {
    const theme = THEMES[themeId];
    const owned = ownedThemes.includes(themeId);
    const busy = themeLoading === themeId;
    const canAfford = coins >= theme.price;
    if (!owned) {
      return (
        <TouchableOpacity
          style={[
            previewMode ? styles.previewActionBtn : styles.productBtn,
            !canAfford ? styles.productBtnLocked : styles.productBtnBuy,
          ]}
          onPress={() => void handleBuyTheme(themeId)}
          disabled={busy || !canAfford}
          activeOpacity={0.8}
        >
          {busy
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={previewMode ? styles.previewActionBtnText : styles.productBtnText}>
                {!canAfford ? `🔒 ${t('shop.buyButton')}` : t('shop.buyButton')}
              </Text>
          }
        </TouchableOpacity>
      );
    }

    return renderThemeAction(themeId, previewMode);
  }

  function renderTableSkinAction(skinId: TableSkinId, previewMode: boolean) {
    const owned = ownedTableSkins.includes(skinId);
    const active = activeTableSkinId === skinId;
    const busy = tableSkinLoading === skinId || activationLoading === `table_skin:${skinId}`;
    const skin = TABLE_SKINS[skinId];
    const canAfford = coins >= skin.price;
    const containerStyle = previewMode ? styles.previewActionBtn : styles.productBtn;
    const textStyle = previewMode ? styles.previewActionBtnText : styles.productBtnText;

    if (owned) {
      return (
        <TouchableOpacity
          style={[containerStyle, active ? styles.productBtnActive : styles.productBtnSelect]}
          onPress={() => void handleActivateTableSkin(skinId)}
          disabled={active || busy}
          activeOpacity={0.8}
        >
          {busy
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Text style={textStyle}>{active ? t('shop.activeBadge') : t('shop.activateButton')}</Text>
          }
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[containerStyle, !canAfford ? styles.productBtnLocked : styles.productBtnBuy]}
        onPress={() => void handleBuyTableSkin(skinId)}
        disabled={busy || !canAfford}
        activeOpacity={0.8}
      >
        {busy
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Text style={textStyle}>{!canAfford ? `🔒 ${t('shop.buyButton')}` : t('shop.buyButton')}</Text>
        }
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { width, height }, isPreviewOpen ? styles.containerHidden : null]}>
          <LinearGradient
            colors={['#0a0f1e', '#0d1f35', '#0a1628']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.3, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <LinearGradient
            colors={['transparent', GOLD, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.topShimmer}
          />

          <View style={[styles.contentFrame, { width: contentWidth }]}>
            <View style={styles.header}>
              <View style={styles.coinBadge}>
                <View style={styles.coinHeroWrap}>
                  <View style={styles.coinHeroGlow} />
                  <SlindaCoin size={34} spin />
                </View>
                <Text style={styles.coinCount}>{coins}</Text>
              </View>
              <View style={styles.titleWrap}>
                <Text style={styles.titleSmall}>{t('shop.title')}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.closeX}>X</Text>
              </TouchableOpacity>
            </View>

            <LinearGradient
              colors={['transparent', 'rgba(252,211,77,0.35)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.dividerGradient}
            />

            <ScrollView
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.scrollBody}
            >
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
                          {slindaOwned ? `✓ ${t('shop.ownedButton')}` : coins < SLINDA_PRICE ? `🔒 ${t('shop.buyButton')}` : t('shop.buyButton')}
                        </Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <SectionHeader title={t('shop.themesSection')} />
            <Text style={styles.subsectionTitle}>{t('shop.backgroundsTitle')}</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {THEME_IDS.map((themeId) => {
                const theme = THEMES[themeId];
                const owned = ownedThemes.includes(themeId);
                const hasPreview = !!theme.background.image;
                return (
                  <View key={themeId} style={[styles.productCard, styles.themeProductCard, owned && styles.productCardOwned]}>
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
                    {!owned && theme.price > 0 && (
                      <View style={styles.productPriceRow}>
                        <SlindaCoin size={13} />
                        <Text style={styles.productPriceText}>{theme.price}</Text>
                      </View>
                    )}
                    {renderThemeActions(themeId, false)}
                  </View>
                );
              })}
            </ScrollView>

            <SectionHeader title={t('shop.tablesSection')} />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              <View style={[styles.productCard, !activeTableSkinId && styles.productCardOwned]}>
                {!activeTableSkinId && (
                  <LinearGradient
                    colors={['rgba(252,211,77,0.12)', 'transparent']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <ImageBackground
                  source={CLASSIC_TABLE_IMAGE as any}
                  style={[styles.tableSkinThumb, styles.noneSkinThumb]}
                  resizeMode="contain"
                />
                <Text style={styles.productName}>{t('shop.noTableSkinName')}</Text>
                    {!activeTableSkinId ? (
                  <View style={[styles.productBtn, styles.productBtnActive]}>
                    <Text style={styles.productBtnText}>{t('shop.activeBadge')}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.productBtn, styles.productBtnSelect]}
                    onPress={() => void handleActivateTableSkin('none')}
                    disabled={activationLoading === 'table_skin:none'}
                    activeOpacity={0.8}
                  >
                    {activationLoading === 'table_skin:none'
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={styles.productBtnText}>{t('shop.removeTableSkinButton')}</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>
              {TABLE_SKIN_IDS.map((skinId) => {
                const skin = TABLE_SKINS[skinId];
                const owned = ownedTableSkins.includes(skinId);
                return (
                  <View key={skinId} style={[styles.productCard, owned && styles.productCardOwned]}>
                    {owned && (
                      <LinearGradient
                        colors={['rgba(252,211,77,0.12)', 'transparent']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <TouchableOpacity onPress={() => setPreviewTableSkin(skinId)} activeOpacity={0.8}>
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
                        <Text style={styles.productPriceText}>{skin.price}</Text>
                      </View>
                    )}
                    {renderTableSkinAction(skinId, false)}
                  </View>
                );
              })}
            </ScrollView>

            {!!feedback && (
              <View style={styles.feedbackWrap}>
                <Text style={[
                  styles.feedbackText,
                  feedbackTone === 'success' ? styles.feedbackSuccess : null,
                ]}>
                  {feedback}
                </Text>
              </View>
            )}

              <View style={{ height: 40 }} />
            </ScrollView>

            {!scrolledToBottom && (
              <LinearGradient
                colors={['transparent', 'rgba(10,15,30,0.92)']}
                style={styles.bottomFade}
                pointerEvents="none"
              >
                <Text style={styles.scrollHintText}>v</Text>
              </LinearGradient>
            )}
          </View>
        </View>

        {previewTheme && previewData && (
          <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="auto">
            {previewData.background.image ? (
              <ImageBackground source={previewData.background.image} resizeMode="cover" style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient colors={previewData.background.gradient} style={StyleSheet.absoluteFill} />
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 320 }}
            />

            <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewTheme(null)}>
              <Text style={styles.previewCloseText}>X</Text>
            </TouchableOpacity>

            <View style={styles.previewBar}>
              <Text style={styles.previewThemeName}>{locale === 'he' ? previewData.name_he : previewData.name_en}</Text>
              {!ownedThemes.includes(previewTheme) && (
                <View style={styles.previewPriceRow}>
                  <SlindaCoin size={18} />
                  <Text style={styles.previewPriceText}>{previewData.price} {t('shop.coinsUnit')}</Text>
                </View>
              )}
              {renderThemeActions(previewTheme, true)}
            </View>
          </View>
        )}

        {previewTableSkin && previewTableSkinData && (
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
              <Text style={styles.previewCloseText}>X</Text>
            </TouchableOpacity>

            <View style={styles.previewBar}>
              <Text style={styles.previewThemeName}>{locale === 'he' ? previewTableSkinData.name_he : previewTableSkinData.name_en}</Text>
              {!ownedTableSkins.includes(previewTableSkin) && (
                <View style={styles.previewPriceRow}>
                  <SlindaCoin size={18} />
                  <Text style={styles.previewPriceText}>{previewTableSkinData.price} {t('shop.coinsUnit')}</Text>
                </View>
              )}
              {ownedTableSkins.includes(previewTableSkin) && activeTableSkinId === previewTableSkin && (
                <View style={styles.statusPillsRow}>
                  {renderStatusPill(t('shop.activeBadge'))}
                </View>
              )}
              {renderTableSkinAction(previewTableSkin, true)}
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
    right: 0,
    overflow: 'hidden',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: 'inset 0 0 120px rgba(252,211,77,0.04)' } as any
      : {}),
  },
  containerHidden: { opacity: 0 },
  contentFrame: {
    flex: 1,
    maxWidth: '100%',
  },

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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: 'rgba(252,211,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.25)',
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 7,
    minWidth: 84,
  },
  coinHeroWrap: {
    width: 42,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinHeroGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 20px 8px rgba(252,211,77,0.18)' }
      : { shadowColor: '#FCD34D', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6 }),
  },
  coinCount: { color: GOLD_LIGHT, fontSize: 14, fontWeight: '800', lineHeight: 16 },
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

  horizontalList: { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },
  subsectionTitle: {
    color: GOLD_LIGHT,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginTop: -4,
    marginBottom: 10,
  },
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
  themeProductCard: {
    minWidth: 150,
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
  productBtnLocked: { backgroundColor: 'rgba(255,255,255,0.06)', opacity: 0.65 },
  productBtnSelect: { backgroundColor: '#0369A1' },
  productBtnActive: { backgroundColor: '#15803D', borderWidth: 1, borderColor: '#4ADE80' },
  productBtnText: { color: '#FFF', fontSize: 10.5, fontWeight: '800', textAlign: 'center' },
  statusPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    minHeight: 24,
  },
  statusPill: {
    backgroundColor: 'rgba(252,211,77,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.28)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: { color: GOLD_LIGHT, fontSize: 10, fontWeight: '800' },

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
  noneSkinThumb: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },

  feedbackWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, alignItems: 'center' },
  feedbackText: { color: '#F87171', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  feedbackSuccess: { color: '#4ADE80' },

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
    textAlign: 'center',
  },
  previewPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewPriceText: { color: GOLD, fontSize: 18, fontWeight: '800' },
  previewActionBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', width: '100%' },
  previewActionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.4, textAlign: 'center' },
});
