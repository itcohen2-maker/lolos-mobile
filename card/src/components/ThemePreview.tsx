import React from 'react';
import { View, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEMES, type ThemeId } from '../theme/themes';

interface Props {
  themeId: ThemeId;
  size?: 'small' | 'medium';
}

export function ThemePreview({ themeId, size = 'medium' }: Props) {
  const theme = THEMES[themeId];
  const w = size === 'small' ? 64 : 80;
  const h = size === 'small' ? 42 : 52;

  return (
    <View style={{ borderRadius: 8, overflow: 'hidden', width: w, height: h }}>
      {theme.background.image ? (
        <ImageBackground
          source={theme.background.image}
          resizeMode="cover"
          style={{ position: 'absolute', width: w, height: h }}
        />
      ) : (
        <LinearGradient
          colors={theme.background.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{ position: 'absolute', inset: 0, width: w, height: h }}
        />
      )}
      {theme.table.gradient ? (
        <LinearGradient
          colors={theme.table.gradient}
          style={{ position: 'absolute', inset: 0, width: w, height: h, opacity: 0.75 }}
        />
      ) : (
        <ImageBackground
          source={theme.table.image}
          resizeMode="cover"
          style={{ position: 'absolute', width: w, height: h, opacity: 0.85, backgroundColor: theme.table.imageTint }}
        />
      )}
    </View>
  );
}
