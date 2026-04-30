import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SalindaLogoOption06 from './branding/SalindaLogoOption06';
import type { MsgParams } from '../../shared/i18n';
import { brand } from '../theme/brand';

type TFn = (key: string, params?: MsgParams) => string;

export type GameplayPreviewTeaserProps = {
  t: TFn;
  soundsEnabled: boolean;
  onSkip: () => void;
  onComplete: () => void;
};

type Stage = 'slides' | 'guided-practice' | 'mini-round' | 'done';
type PracticeStep = 1 | 2 | 3;

type Slide = {
  titleKey: string;
  bodyKey: string;
  visual: 'goal' | 'dice' | 'equation' | 'cards' | 'special';
};

const slides: Slide[] = [
  { titleKey: 'previewManual.slide1.title', bodyKey: 'previewManual.slide1.body', visual: 'goal' },
  { titleKey: 'previewManual.slide2.title', bodyKey: 'previewManual.slide2.body', visual: 'dice' },
  { titleKey: 'previewManual.slide3.title', bodyKey: 'previewManual.slide3.body', visual: 'equation' },
  { titleKey: 'previewManual.slide4.title', bodyKey: 'previewManual.slide4.body', visual: 'cards' },
  { titleKey: 'previewManual.slide5.title', bodyKey: 'previewManual.slide5.body', visual: 'special' },
];

function BigVisual({ type }: { type: Slide['visual'] }) {
  if (type === 'goal') return <Text style={styles.bigVisual}>🎯 9</Text>;
  if (type === 'dice') return <Text style={styles.bigVisual}>🎲 5  4  1</Text>;
  if (type === 'equation') return <Text style={styles.bigVisual}>5 + 4 = 9</Text>;
  if (type === 'cards') return <Text style={styles.bigVisual}>4 + 5</Text>;
  return <Text style={styles.bigVisual}>★  פרא   1/2  שבר</Text>;
}

export default function GameplayPreviewTeaser({ t, onSkip, onComplete }: GameplayPreviewTeaserProps) {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>('slides');
  const [slideIndex, setSlideIndex] = useState(0);
  const [practiceStep, setPracticeStep] = useState<PracticeStep>(1);
  const [feedback, setFeedback] = useState<'ok' | 'wrong' | null>(null);
  const [guidedShowMock, setGuidedShowMock] = useState(false);
  const [guidedStepCompleted, setGuidedStepCompleted] = useState(false);
  const [mini, setMini] = useState({ rolled: false, equationOk: false, cardsPicked: false });
  const [miniShowMock, setMiniShowMock] = useState(false);

  const currentSlide = slides[slideIndex];
  const canCompleteMini = mini.rolled && mini.equationOk && mini.cardsPicked;
  const miniTitle = useMemo(() => {
    if (!mini.rolled) return t('previewManual.mini.stepRoll');
    if (!mini.equationOk) return t('previewManual.mini.stepEquation');
    if (!mini.cardsPicked) return t('previewManual.mini.stepCards');
    return t('previewManual.mini.ready');
  }, [mini, t]);

  const renderSlides = () => (
    <>
      <Text style={styles.title}>{t(currentSlide.titleKey)}</Text>
      <Text style={styles.body}>{t(currentSlide.bodyKey)}</Text>
      <View style={styles.visualCard}>
        <BigVisual type={currentSlide.visual} />
      </View>
      <Text style={styles.indexText}>{slideIndex + 1}/{slides.length}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, slideIndex === 0 && styles.btnDisabled]}
          disabled={slideIndex === 0}
          onPress={() => setSlideIndex((n) => Math.max(0, n - 1))}
        >
          <Text style={styles.btnText}>{t('previewManual.prev')}</Text>
        </TouchableOpacity>
        {slideIndex < slides.length - 1 ? (
          <TouchableOpacity style={styles.btn} onPress={() => setSlideIndex((n) => Math.min(slides.length - 1, n + 1))}>
            <Text style={styles.btnText}>{t('previewManual.next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setStage('guided-practice')}>
            <Text style={styles.btnPrimaryText}>{t('previewManual.startPractice')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  const renderGuidedPractice = () => (
    <>
      <Text style={styles.title}>{t('previewManual.practice.title')}</Text>
      <Text style={styles.body}>
        {practiceStep === 1 && t('previewManual.practice.step1')}
        {practiceStep === 2 && t('previewManual.practice.step2')}
        {practiceStep === 3 && t('previewManual.practice.step3')}
      </Text>
      {!guidedShowMock ? (
        <TouchableOpacity style={styles.btnPrimary} onPress={() => setGuidedShowMock(true)}>
          <Text style={styles.btnPrimaryText}>{t('previewManual.showDemo')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.visualCard}>
          <View style={styles.row}>
            {[5, 4, 1].map((n) => (
              <TouchableOpacity
                key={n}
                style={styles.chip}
                onPress={() => {
                  const ok =
                    (practiceStep === 1 && n === 5) ||
                    (practiceStep === 2 && n === 4) ||
                    (practiceStep === 3 && n === 1);
                  setFeedback(ok ? 'ok' : 'wrong');
                  if (ok) {
                    setGuidedStepCompleted(true);
                    setGuidedShowMock(false);
                  }
                }}
              >
                <Text style={styles.chipText}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.equationPreview}>
            {practiceStep === 1 ? '? + ? = 9' : practiceStep === 2 ? '5 + ? = 9' : '5 + 4 = 9'}
          </Text>
        </View>
      )}
      {feedback ? (
        <Text style={[styles.feedback, feedback === 'ok' ? styles.ok : styles.wrong]}>
          {feedback === 'ok' ? t('previewManual.feedback.ok') : t('previewManual.feedback.tryAgain')}
        </Text>
      ) : null}
      {guidedStepCompleted ? (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            setGuidedStepCompleted(false);
            setFeedback(null);
            setPracticeStep((s) => (Math.min(3, s + 1) as PracticeStep));
          }}
        >
          <Text style={styles.btnText}>{t('previewManual.continue')}</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => setStage('slides')}>
          <Text style={styles.btnText}>{t('previewManual.backToSlides')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, practiceStep < 3 && styles.btnDisabled]}
          disabled={practiceStep < 3}
          onPress={() => setStage('mini-round')}
        >
          <Text style={styles.btnPrimaryText}>{t('previewManual.toMiniRound')}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderMiniRound = () => (
    <>
      <Text style={styles.title}>{t('previewManual.mini.title')}</Text>
      <Text style={styles.body}>{miniTitle}</Text>
      {!miniShowMock ? (
        <TouchableOpacity style={styles.btnPrimary} onPress={() => setMiniShowMock(true)}>
          <Text style={styles.btnPrimaryText}>{t('previewManual.showDemo')}</Text>
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.visualCard}>
            <Text style={styles.bigVisual}>
              {mini.rolled ? '🎲 6  2' : '🎲 ?  ?'}{'\n'}
              {mini.equationOk ? '6 − 2 = 4' : '? − ? = 4'}
            </Text>
          </View>
          <View style={styles.rowWrap}>
            <TouchableOpacity
              style={[styles.btn, mini.rolled && styles.btnDisabled]}
              disabled={mini.rolled}
              onPress={() => {
                setMini((s) => ({ ...s, rolled: true }));
                setMiniShowMock(false);
              }}
            >
              <Text style={styles.btnText}>{t('previewManual.mini.roll')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, (!mini.rolled || mini.equationOk) && styles.btnDisabled]}
              disabled={!mini.rolled || mini.equationOk}
              onPress={() => {
                setMini((s) => ({ ...s, equationOk: true }));
                setMiniShowMock(false);
              }}
            >
              <Text style={styles.btnText}>{t('previewManual.mini.build')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, (!mini.equationOk || mini.cardsPicked) && styles.btnDisabled]}
              disabled={!mini.equationOk || mini.cardsPicked}
              onPress={() => {
                setMini((s) => ({ ...s, cardsPicked: true }));
                setMiniShowMock(false);
              }}
            >
              <Text style={styles.btnText}>{t('previewManual.mini.pick')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => setStage('guided-practice')}>
          <Text style={styles.btnText}>{t('previewManual.backToPractice')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, !canCompleteMini && styles.btnDisabled]}
          disabled={!canCompleteMini}
          onPress={() => {
            setStage('done');
            onComplete();
          }}
        >
          <Text style={styles.btnPrimaryText}>{t('previewManual.finish')}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.skipRow, { top: (insets.top || 0) + 8 }]}>
        <TouchableOpacity onPress={onSkip}>
          <Text style={styles.skipTxt}>{t('previewTeaser.skip')}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.content, { paddingBottom: (insets.bottom || 0) + 22 }]}>
        <SalindaLogoOption06 width={168} />
        {stage === 'slides' && renderSlides()}
        {stage === 'guided-practice' && renderGuidedPractice()}
        {stage === 'mini-round' && renderMiniRound()}
        <TouchableOpacity style={styles.exitBtn} onPress={onSkip}>
          <Text style={styles.exitBtnText}>{t('tutorial.exit')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.bg },
  skipRow: { position: 'absolute', left: 16, right: 16, zIndex: 20, alignItems: 'flex-end' },
  skipTxt: { color: brand.textMuted, fontSize: 16, fontWeight: '800' },
  content: { flex: 1, paddingTop: 52, paddingHorizontal: 16, alignItems: 'center', gap: 12 },
  title: { color: brand.gold, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  body: { color: brand.text, fontSize: 22, lineHeight: 34, textAlign: 'center', maxWidth: 420 },
  visualCard: {
    width: '100%',
    minHeight: 160,
    borderRadius: 18,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 10,
  },
  bigVisual: { color: brand.white, fontSize: 34, fontWeight: '900', textAlign: 'center', lineHeight: 42 },
  indexText: { color: brand.textMuted, fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  btn: { backgroundColor: brand.surface2, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  btnPrimary: { backgroundColor: brand.gold, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: brand.text, fontSize: 18, fontWeight: '800' },
  btnPrimaryText: { color: brand.bg, fontSize: 18, fontWeight: '900' },
  chip: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: brand.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { color: brand.bg, fontSize: 26, fontWeight: '900' },
  equationPreview: { color: brand.white, fontSize: 32, fontWeight: '900' },
  feedback: { fontSize: 20, fontWeight: '900' },
  ok: { color: '#86EFAC' },
  wrong: { color: '#FCA5A5' },
  exitBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  exitBtnText: {
    color: '#FCA5A5',
    fontSize: 18,
    fontWeight: '800',
  },
});
