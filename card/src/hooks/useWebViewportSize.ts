import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * מידות אזור התצוגה בדפדפן: עדיפות ל־visualViewport (סרגל כתובות / מקלדת / zoom),
 * ואז innerWidth/innerHeight — כדי שהמשחק יתאים לרוחב/גובה הנראים בפועל.
 */
function readInnerSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  const vv = window.visualViewport;
  if (vv && vv.width >= 1 && vv.height >= 1) {
    return { width: Math.round(vv.width), height: Math.round(vv.height) };
  }
  return {
    width: Math.round(window.innerWidth),
    height: Math.round(window.innerHeight),
  };
}

/**
 * בדפדפן: עדכון מובטח כשמשנים גודל חלון — innerWidth/innerHeight + resize + ResizeObserver.
 * בפלטפורמות אחרות: זהה ל־useWindowDimensions.
 */
export function useWebViewportSize(): { width: number; height: number } {
  const { width: w, height: h } = useWindowDimensions();
  const [dims, setDims] = useState<{ width: number; height: number } | null>(() => {
    if (typeof window === 'undefined' || Platform.OS !== 'web') return null;
    return readInnerSize();
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const update = () => {
      setDims(readInnerSize());
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => update());
      ro.observe(document.documentElement);
    }

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    setDims(readInnerSize());
  }, [w, h]);

  if (Platform.OS !== 'web') return { width: w, height: h };
  return dims ?? { width: w, height: h };
}
