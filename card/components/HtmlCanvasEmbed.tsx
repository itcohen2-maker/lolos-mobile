import React, { useCallback } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export type HtmlCanvasEmbedProps = {
  html: string;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
  onLoadEnd?: () => void;
  borderRadius?: number;
};

/** Renders self-contained HTML canvas animations: WebView on native, iframe + srcDoc on web (WebView is a no-op there). */
export function HtmlCanvasEmbed({
  html,
  style,
  pointerEvents = 'none',
  onLoadEnd,
  borderRadius,
}: HtmlCanvasEmbedProps) {
  const onIframeLoad = useCallback(() => {
    onLoadEnd?.();
  }, [onLoadEnd]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webRoot, borderRadius != null && { borderRadius, overflow: 'hidden' }, style]}>
        <iframe
          title=""
          srcDoc={html}
          onLoad={onIframeLoad}
          sandbox="allow-scripts allow-same-origin"
          style={{
            border: 'none',
            width: '100%',
            height: '100%',
            display: 'block',
            backgroundColor: 'transparent',
            pointerEvents: pointerEvents === 'none' ? 'none' : 'auto',
          }}
        />
      </View>
    );
  }

  return (
    <WebView
      source={{ html }}
      style={[styles.webview, borderRadius != null && { borderRadius }, style]}
      scrollEnabled={false}
      bounces={false}
      pointerEvents={pointerEvents}
      javaScriptEnabled
      originWhitelist={['*']}
      onLoadEnd={onLoadEnd}
      transparent
      androidLayerType="hardware"
    />
  );
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});
