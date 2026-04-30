import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocale } from '../i18n/LocaleContext';
import { initializeSfx, playMeterCelebrateSequence, playSfx } from '../audio/sfx';
import { ExtractedMeterCelebrationOverlayCard } from '../components/ExtractedMeterCelebration';

type Props = {
  onBack: () => void;
};

const FILL_STEPS = [0, 0.34, 0.68, 1] as const;

function LiquidMeter({ progress }: { progress: number }) {
  const fill = useRef(new Animated.Value(progress)).current;
  const waveShift = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: progress,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, progress]);

  useEffect(() => {
    const waveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveShift, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveShift, {
          toValue: -1,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 0.55,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0.25,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    waveLoop.start();
    shimmerLoop.start();
    return () => {
      waveLoop.stop();
      shimmerLoop.stop();
    };
  }, [shimmer, waveShift]);

  const fillHeight = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const waveTranslate = waveShift.interpolate({
    inputRange: [-1, 1],
    outputRange: [-8, 8],
  });

  return (
    <View style={styles.meterShell}>
      <View style={styles.meterGlass}>
        <Animated.View style={[styles.liquidWrap, { height: fillHeight }]}>
          <LinearGradient
            colors={['#1fbf61', '#2fd46c', '#86ff31']}
            start={{ x: 0.12, y: 1 }}
            end={{ x: 0.8, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Animated.View style={[styles.liquidWave, { transform: [{ translateX: waveTranslate }] }]} />
          <Animated.View style={[styles.liquidShimmer, { opacity: shimmer }]} />
        </Animated.View>
        <View style={styles.meterGloss} />
      </View>
    </View>
  );
}

export function CelebrationMockupRoom({ onBack }: Props) {
  const { width } = useWindowDimensions();
  const { isRTL } = useLocale();
  const [fillStep, setFillStep] = useState(0);
  const [rewardCoins, setRewardCoins] = useState(25);
  const [totalCoins, setTotalCoins] = useState(128);
  const [showCelebration, setShowCelebration] = useState(false);

  const progress = FILL_STEPS[Math.max(0, Math.min(FILL_STEPS.length - 1, fillStep))];
  const stageLabel = useMemo(() => {
    if (fillStep <= 0) return 'מוכן להתחלה';
    if (fillStep === 1) return 'מילוי ראשון';
    if (fillStep === 2) return 'מילוי שני';
    return 'מילוי שלישי';
  }, [fillStep]);

  useEffect(() => {
    initializeSfx().catch(() => {});
  }, []);

  const triggerCelebration = () => {
    setShowCelebration(true);
    setTotalCoins((prev) => prev + rewardCoins);
    playMeterCelebrateSequence({ cooldownMs: 0, volumeOverride: 0.8 }).catch(() => {});
  };

  const addFill = () => {
    playSfx('meterBounce', { cooldownMs: 80, volumeOverride: 0.42 }).catch(() => {});
    let reachedFull = false;
    setFillStep((prev) => {
      const next = Math.min(3, prev + 1);
      if (next >= 3) {
        reachedFull = true;
        return 0;
      }
      return next;
    });
    if (reachedFull) {
      triggerCelebration();
    }
  };

  const resetAll = () => {
    playSfx('tap', { cooldownMs: 0, volumeOverride: 0.3 }).catch(() => {});
    setFillStep(0);
    setShowCelebration(false);
    setRewardCoins(25);
    setTotalCoins(128);
  };

  const closeCelebration = () => {
    playSfx('success', { cooldownMs: 0, volumeOverride: 0.45 }).catch(() => {});
    setShowCelebration(false);
  };

  const cardWidth = Math.min(width - 28, 430);
  const isPhone = width < 520;

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#06101b', '#0d2137', '#173a58']} style={StyleSheet.absoluteFillObject} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
      <View style={[styles.roomWrap, { width: cardWidth }]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onBack} style={styles.backChip}>
            <Text style={styles.backChipText}>חזרה ללובי</Text>
          </TouchableOpacity>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>חדר מוקאפ חגיגה</Text>
          </View>
        </View>

        <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>
          מוקאפ חגיגת מד הצטיינות
        </Text>
        <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>
          כאן אני מציג את האנימציה שחולצה מהקובץ שהבאת, בתוך החדר, כדי שתוכל לראות אותה לפני החיבור למשחק.
        </Text>

        <View style={[styles.phoneFrame, isPhone && styles.phoneFrameCompact]}>
          <View style={styles.phoneHeader}>
            <View>
              <Text style={styles.playerName}>נועה כהן</Text>
              <Text style={styles.playerMeta}>שלב 12 • תור שחקן</Text>
            </View>
            <View style={styles.coinsBox}>
              <Text style={styles.coinsLabel}>סך מטבעות</Text>
              <Text style={styles.coinsValue}>{totalCoins}</Text>
            </View>
          </View>

          <View style={styles.stageArea}>
            <LiquidMeter progress={progress} />
            <View style={styles.readoutCol}>
              <Text style={styles.readoutLabel}>מצב המד</Text>
              <Text style={styles.readoutValue}>{Math.round(progress * 100)}%</Text>
              <Text style={styles.stageChip}>{stageLabel}</Text>
              <Text style={styles.readoutLabel}>פרס נוכחי</Text>
              <Text style={styles.rewardValue}>{rewardCoins} מטבעות</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              לחץ על "הוסף מטבע". בפעם השלישית המד יתמלא, תיפתח האנימציה שחולצה מהקובץ שלך, והמד יתאפס.
            </Text>
          </View>

          <View style={styles.controlRow}>
            <TouchableOpacity
              onPress={() => setRewardCoins((prev) => Math.max(5, prev - 5))}
              style={styles.smallControl}
            >
              <Text style={styles.smallControlText}>-5</Text>
            </TouchableOpacity>
            <View style={styles.rewardChip}>
              <Text style={styles.rewardChipText}>פרס: {rewardCoins}</Text>
            </View>
            <TouchableOpacity onPress={() => setRewardCoins((prev) => prev + 5)} style={styles.smallControl}>
              <Text style={styles.smallControlText}>+5</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={addFill} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>הוסף מטבע</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetAll} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>איפוס</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </ScrollView>

      {showCelebration && (
        <View style={styles.overlay}>
          <ExtractedMeterCelebrationOverlayCard
            rewardCoins={rewardCoins}
            onContinue={closeCelebration}
            badge="המד התמלא עד הסוף"
            title="כל הכבוד!"
            body="זו האנימציה המקורית מהקובץ שהבאת, והיא מוצגת עכשיו בתוך חדר המוקאפ."
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  roomWrap: {
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  backChipText: {
    color: '#eff6ff',
    fontSize: 13,
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,200,61,0.16)',
  },
  badgeText: {
    color: '#ffe8aa',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  phoneFrame: {
    borderRadius: 30,
    backgroundColor: 'rgba(8,20,15,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  phoneFrameCompact: {
    padding: 14,
  },
  phoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  playerName: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '900',
  },
  playerMeta: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  coinsBox: {
    minWidth: 110,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,200,61,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,61,0.24)',
    alignItems: 'center',
  },
  coinsLabel: {
    color: '#e2e8f0',
    fontSize: 11,
  },
  coinsValue: {
    color: '#ffc83d',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  stageArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  meterShell: {
    width: 92,
    height: 260,
    padding: 8,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  meterGlass: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: 'rgba(15,23,42,0.58)',
    borderWidth: 2,
    borderColor: 'rgba(226,232,240,0.85)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  liquidWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'visible',
  },
  liquidWave: {
    position: 'absolute',
    top: -7,
    left: -12,
    right: -12,
    height: 16,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    backgroundColor: 'rgba(214,255,189,0.5)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.7)',
  },
  liquidShimmer: {
    position: 'absolute',
    right: 7,
    top: 12,
    width: 8,
    height: 56,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  meterGloss: {
    position: 'absolute',
    top: 12,
    left: 8,
    width: 7,
    height: '70%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  readoutCol: {
    flex: 1,
    gap: 8,
  },
  readoutLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  readoutValue: {
    color: '#f8fafc',
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 48,
  },
  stageChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(133,240,180,0.12)',
    color: '#d1fae5',
    fontSize: 13,
    fontWeight: '800',
  },
  rewardValue: {
    color: '#ffc83d',
    fontSize: 28,
    fontWeight: '900',
  },
  infoCard: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 14,
  },
  infoText: {
    color: '#dbeafe',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  controlRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  smallControl: {
    width: 54,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  smallControlText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
  },
  rewardChip: {
    minWidth: 120,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,200,61,0.14)',
  },
  rewardChipText: {
    color: '#ffe39a',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
  },
  actionsRow: {
    marginTop: 16,
    gap: 10,
  },
  primaryBtn: {
    borderRadius: 18,
    backgroundColor: '#f5b321',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#17212f',
    fontSize: 16,
    fontWeight: '900',
  },
  ghostBtn: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ghostBtnText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '800',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,12,17,0.72)',
    paddingHorizontal: 20,
  },
});
