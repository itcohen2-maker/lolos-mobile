import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { celebrationHtmlSource } from './excellenceMeterCelebrationHtml';

type OverlayProps = {
  rewardCoins: number;
  onContinue?: () => void;
  continueLabel?: string;
  title?: string;
  badge?: string;
  body?: string;
};

function HtmlAnimationFrame({ size }: { size: number }) {
  if (Platform.OS === 'web') {
    return (
      <iframe
        srcDoc={celebrationHtmlSource}
        title="Excellence celebration"
        style={[styles.iframe, { width: size, height: size }] as any}
      />
    );
  }

  return (
    <View style={[styles.nativeFallback, { width: size, height: size }]}>
      <Text style={styles.nativeFallbackText}>אנימציית ה-HTML זמינה בתצוגת Web.</Text>
    </View>
  );
}

export function ExtractedMeterCelebrationOverlayCard({
  rewardCoins,
  onContinue,
  continueLabel = 'נמשיך',
  title = 'כל הכבוד!',
  badge = 'המד התמלא עד הסוף',
  body = 'זו האנימציה המקורית מהקובץ שהבאת, מוצגת עכשיו בתוך חלון החגיגה של המשחק.',
}: OverlayProps) {
  const { width, height } = useWindowDimensions();
  const compact = height < 860 || (Platform.OS !== 'web' && width < 420);
  const tight = height < 760 || (Platform.OS !== 'web' && width < 380);
  const animationSize = tight ? 220 : compact ? 260 : 340;
  const rewardText = rewardCoins === 1 ? 'הרווחת מטבע אחד' : `הרווחת ${rewardCoins} מטבעות`;

  return (
    <View style={[styles.card, compact && styles.cardCompact, tight && styles.cardTight]}>
      <HtmlAnimationFrame size={animationSize} />
      <Text style={[styles.badge, compact && styles.badgeCompact]}>{badge}</Text>
      <Text style={[styles.title, compact && styles.titleCompact, tight && styles.titleTight]}>{title}</Text>
      <Text style={[styles.reward, compact && styles.rewardCompact, tight && styles.rewardTight]}>
        {rewardText}
      </Text>
      <Text style={[styles.body, compact && styles.bodyCompact]}>{body}</Text>
      {onContinue ? (
        <TouchableOpacity style={[styles.continueBtn, compact && styles.continueBtnCompact]} onPress={onContinue}>
          <Text style={[styles.continueText, compact && styles.continueTextCompact]}>{continueLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 30,
    paddingVertical: 24,
    paddingHorizontal: 22,
    backgroundColor: 'rgba(18,47,36,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardCompact: {
    maxWidth: 380,
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  cardTight: {
    maxWidth: 340,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  iframe: {
    width: 340,
    height: 340,
    borderWidth: 0,
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  nativeFallback: {
    width: 340,
    height: 340,
    marginBottom: 10,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
  nativeFallbackText: {
    color: '#e5e7eb',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  badge: {
    color: '#ffe5a0',
    backgroundColor: 'rgba(255,200,61,0.14)',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 12,
  },
  badgeCompact: {
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '900',
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 32,
    lineHeight: 34,
  },
  titleTight: {
    fontSize: 28,
    lineHeight: 30,
  },
  reward: {
    color: '#ffc83d',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 14,
  },
  rewardCompact: {
    fontSize: 28,
    marginTop: 10,
  },
  rewardTight: {
    fontSize: 24,
    marginTop: 8,
  },
  body: {
    color: '#dbeafe',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
  },
  bodyCompact: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  continueBtn: {
    marginTop: 18,
    minWidth: 164,
    borderRadius: 18,
    backgroundColor: '#f5b321',
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  continueBtnCompact: {
    marginTop: 14,
    minWidth: 148,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  continueText: {
    color: '#17212f',
    fontSize: 17,
    fontWeight: '900',
  },
  continueTextCompact: {
    fontSize: 15,
  },
});
