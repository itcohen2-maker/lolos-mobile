import { Platform } from 'react-native';

const HEBREW_TEXT_RE = /[\u0590-\u05FF]/;

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

export function displayFontFamily(text: string | null | undefined): string | undefined {
  return hasHebrewText(text) ? HEBREW_FONT_FAMILY : 'Fredoka_700Bold';
}
