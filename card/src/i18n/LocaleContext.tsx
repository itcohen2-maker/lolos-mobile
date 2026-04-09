import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import type { AppLocale, MsgParams } from '../../shared/i18n';
import { t } from '../../shared/i18n';

const STORAGE_KEY = 'salinda_locale_v1';

export function deviceDefaultLocale(): AppLocale {
  const code = Localization.getLocales()[0]?.languageCode?.toLowerCase() ?? 'he';
  return code === 'en' ? 'en' : 'he';
}

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (l: AppLocale) => Promise<void>;
  t: (key: string, params?: MsgParams) => string;
  isRTL: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => deviceDefaultLocale());

  useLayoutEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'he' || stored === 'en') setLocaleState(stored);
    });
  }, []);

  useLayoutEffect(() => {
    // Keep physical layout stable across languages.
    // We still drive text direction with `isRTL`, but avoid global RTL flips.
    I18nManager.allowRTL(true);
    I18nManager.swapLeftAndRightInRTL(false);
  }, []);

  const setLocale = useCallback(async (l: AppLocale) => {
    setLocaleState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const translate = useCallback((key: string, params?: MsgParams) => t(locale, key, params), [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: translate,
      isRTL: locale === 'he',
    }),
    [locale, setLocale, translate],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider');
  return ctx;
}

export function useLocaleOptional(): LocaleContextValue | null {
  return useContext(LocaleContext);
}
