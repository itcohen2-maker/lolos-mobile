import { Platform } from 'react-native';

const HEBREW_TEXT_RE = /[\u0590-\u05FF]/;
const MATH_SYMBOL_RE = /[×÷−]/;

const HEBREW_FONT_FAMILY =
  Platform.OS === 'web'
    ? '"Noto Sans Hebrew", "Rubik", Arial, sans-serif'
    : Platform.select({
        ios: 'Arial Hebrew',
        android: 'sans-serif-medium',
        default: undefined,
      });

export function hasHebrewText(text: string | null | undefined): boolean {
  return Boolean(text && HEBREW_TEXT_RE.test(text));
}

export function hasMathSymbols(text: string | null | undefined): boolean {
  return Boolean(text && MATH_SYMBOL_RE.test(text));
}

export function displayFontFamily(text: string | null | undefined): string | undefined {
  if (hasHebrewText(text) || hasMathSymbols(text)) {
    return HEBREW_FONT_FAMILY;
  }
  return 'Fredoka_700Bold';
}
