// ============================================================
// AuthScreen.tsx — Optional "save progress" screen.
// Anonymous users can link an email + password to keep their
// coins and rating accessible across devices.
// Existing email users can sign in to restore their account.
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocale } from '../i18n/LocaleContext';
import { useAuth } from '../hooks/useAuth';

interface Props {
  onSuccess: () => void;
  onBack: () => void;
}

export function AuthScreen({ onSuccess, onBack }: Props) {
  const { t, locale } = useLocale();
  const { signUp, signIn, isAnonymous, user, profile } = useAuth();
  const shortUserId = user?.id ? user.id.slice(0, 3).toUpperCase() : null;

  // Anon users start on 'link' (upgrade); returning users can switch to 'signin'
  const [mode, setMode] = useState<'link' | 'signin'>(isAnonymous ? 'link' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'link') {
        if (!username.trim() || username.trim().length < 2) {
          setError(t('auth.usernameMinLength'));
          setLoading(false);
          return;
        }
        const result = await signUp(email.trim(), password, username.trim());
        if (result.error) {
          setError(result.error);
        } else {
          onSuccess();
        }
      } else {
        const result = await signIn(email.trim(), password);
        if (result.error) {
          setError(result.error);
        } else {
          onSuccess();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {mode === 'link' ? t('auth.linkTitle') : t('auth.signInTitle')}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'link' ? t('auth.linkSubtitle') : t('auth.signInSubtitle')}
        </Text>
        <Text style={styles.accountMeta}>
          {locale === 'he'
            ? `מזהה משתמש: ${shortUserId ?? 'לא זמין עדיין'}`
            : `User ID: ${shortUserId ?? 'Not available yet'}`}
          {profile?.username ? ` • ${profile.username}` : ''}
        </Text>

        {mode === 'link' && (
          <TextInput
            style={styles.input}
            placeholder={t('auth.usernamePlaceholder')}
            placeholderTextColor="#6B7280"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            maxLength={15}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor="#6B7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <TextInput
          style={styles.input}
          placeholder={t('auth.passwordPlaceholder')}
          placeholderTextColor="#6B7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnText}>
              {mode === 'link' ? t('auth.linkBtn') : t('auth.signInBtn')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setMode(mode === 'link' ? 'signin' : 'link');
            setError(null);
          }}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>
            {mode === 'link' ? t('auth.haveAccount') : t('auth.noAccount')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>{t('auth.back')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  title: {
    color: '#FCD34D',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  accountMeta: {
    color: 'rgba(147,197,253,0.9)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    color: '#FFF',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  btn: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  errorBox: {
    backgroundColor: 'rgba(220,38,38,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.5)',
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  toggle: {
    marginTop: 18,
    alignItems: 'center',
  },
  toggleText: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '600',
  },
  backBtn: {
    marginTop: 24,
    alignItems: 'center',
  },
  backText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
});
