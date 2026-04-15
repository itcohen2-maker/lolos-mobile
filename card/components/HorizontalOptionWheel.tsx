import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';

const ITEM_W = 106;
const GAP = 6;
/** רוחב תוואי אינטרפולציה סביב מרכז הפריט (פיקסלים) */
const BAND = 110;

export type HorizontalWheelOption = {
  key: string;
  label: string;
  accessibilityLabel: string;
};

function centerOffsetForIndex(i: number, width: number, paddingH: number) {
  const centerContent = paddingH + i * (ITEM_W + GAP) + ITEM_W / 2;
  return Math.max(0, centerContent - width / 2);
}

/** מיקום מרכז הפריט הנבחר ביחס לשמאל ה־viewport (מצב leading — צמוד לתווית) */
const LEADING_FOCUS_X = ITEM_W / 2 + 8;

function leadingOffsetForIndex(i: number, paddingL: number) {
  const centerContent = paddingL + i * (ITEM_W + GAP) + ITEM_W / 2;
  return Math.max(0, centerContent - LEADING_FOCUS_X);
}

function paddingRightForLeading(trackW: number, numItems: number, paddingL: number) {
  if (numItems <= 0) return 8;
  const lastI = numItems - 1;
  const centerLast = paddingL + lastI * (ITEM_W + GAP) + ITEM_W / 2;
  const scrollLast = Math.max(0, centerLast - LEADING_FOCUS_X);
  const contentWBase = paddingL + numItems * ITEM_W + (numItems - 1) * GAP;
  return Math.max(8, Math.ceil(scrollLast + trackW - contentWBase));
}

export function HorizontalOptionWheel({
  options,
  selectedKey,
  onSelect,
  /** אם מחזיר false — לא מגוללים למרכז אחרי בחירה (למשל פותחים מודאל בלי לעדכן state) */
  scrollAfterSelect = () => true,
  /** center = פריט במרכז המסלול; leading = פריט צמוד לשמאל (למשל ליד תווית בשורת הגדרות) */
  snapFocus = 'center',
}: {
  options: readonly HorizontalWheelOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  scrollAfterSelect?: (key: string) => boolean;
  snapFocus?: 'center' | 'leading';
}) {
  const [trackW, setTrackW] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<ScrollView>(null);
  const prevSelectedKey = useRef<string | null>(null);

  const paddingL = 8;
  const paddingH = useMemo(
    () => (trackW > 0 && snapFocus === 'center' ? Math.max(8, (trackW - ITEM_W) / 2) : 0),
    [trackW, snapFocus]
  );

  const paddingR = useMemo(() => {
    if (trackW <= 0 || options.length === 0) return 0;
    if (snapFocus === 'leading') return paddingRightForLeading(trackW, options.length, paddingL);
    return paddingH;
  }, [trackW, options.length, snapFocus, paddingH]);

  const snapToOffsets = useMemo(() => {
    if (trackW <= 0 || options.length === 0) return undefined;
    if (snapFocus === 'leading') {
      return options.map((_, i) => leadingOffsetForIndex(i, paddingL));
    }
    return options.map((_, i) => centerOffsetForIndex(i, trackW, paddingH));
  }, [trackW, paddingH, options, snapFocus, paddingL]);

  const scrollToIndex = useCallback(
    (i: number, animated: boolean) => {
      if (trackW <= 0 || i < 0) return;
      const x =
        snapFocus === 'leading'
          ? leadingOffsetForIndex(i, paddingL)
          : centerOffsetForIndex(i, trackW, paddingH);
      listRef.current?.scrollTo({ x, animated });
      if (!animated) scrollX.setValue(x);
    },
    [trackW, paddingH, scrollX, snapFocus, paddingL]
  );

  const focusScrollX = useCallback(
    (i: number) =>
      snapFocus === 'leading'
        ? leadingOffsetForIndex(i, paddingL)
        : centerOffsetForIndex(i, trackW, paddingH),
    [trackW, paddingH, snapFocus, paddingL]
  );

  useEffect(() => {
    if (trackW <= 0) return;
    const i = options.findIndex((o) => o.key === selectedKey);
    if (i < 0) return;
    const animate = prevSelectedKey.current !== null && prevSelectedKey.current !== selectedKey;
    prevSelectedKey.current = selectedKey;
    requestAnimationFrame(() => scrollToIndex(i, animate));
  }, [selectedKey, trackW, options, scrollToIndex]);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: false,
      }),
    [scrollX]
  );

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setTrackW(Math.round(e.nativeEvent.layout.width))}
    >
      {trackW <= 0 ? null : (
        <Animated.ScrollView
          ref={listRef}
          horizontal
          style={{ direction: 'ltr' }}
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          decelerationRate="fast"
          snapToOffsets={snapToOffsets}
          snapToEnd={false}
          snapToStart={false}
          disableIntervalMomentum
          contentContainerStyle={{
            paddingLeft: snapFocus === 'leading' ? paddingL : paddingH,
            paddingRight: snapFocus === 'leading' ? paddingR : paddingH,
            alignItems: 'center',
          }}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {options.map((opt, i) => {
            const c = focusScrollX(i);
            const rotateY = scrollX.interpolate({
              inputRange: [c - BAND, c, c + BAND],
              outputRange: ['16deg', '0deg', '-16deg'],
              extrapolate: 'clamp',
            });
            const scale = scrollX.interpolate({
              inputRange: [c - BAND, c, c + BAND],
              outputRange: [0.86, 1, 0.86],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange: [c - BAND * 0.65, c, c + BAND * 0.65],
              outputRange: [0.78, 1, 0.78],
              extrapolate: 'clamp',
            });
            const selected = selectedKey === opt.key;
            return (
              <Animated.View
                key={opt.key}
                style={[
                  styles.chipSlot,
                  i < options.length - 1 && { marginRight: GAP },
                  {
                    transform: [{ perspective: 900 }, { rotateY }, { scale }],
                    opacity,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={opt.accessibilityLabel}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onSelect(opt.key);
                    if (scrollAfterSelect(opt.key)) scrollToIndex(i, true);
                  }}
                  style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
                >
                  <Text
                    style={[styles.chipTxt, selected ? styles.chipTxtOn : styles.chipTxtOff]}
                    numberOfLines={2}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    maxHeight: 56,
  },
  chipSlot: {
    width: ITEM_W,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  chip: {
    width: ITEM_W,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: '#FBBC05',
    borderColor: 'rgba(251,188,5,0.5)',
    ...Platform.select({
      ios: {
        shadowColor: '#FBBC05',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  chipOff: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  chipTxt: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  chipTxtOn: { color: '#3c3c00' },
  chipTxtOff: { color: 'rgba(255,255,255,0.88)' },
});
