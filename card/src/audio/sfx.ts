import { Audio } from 'expo-av';

export type SfxKey =
  | 'tap'
  | 'success'
  | 'combo'
  | 'errorSoft'
  | 'start'
  | 'complete'
  | 'transition'
  | 'meterCelebrate'
  | 'meterBounce'
  | 'timerTick'
  | 'timerEnd'
  | 'gameWin';

type SfxState = {
  sound: Audio.Sound | null;
  loading: boolean;
  lastPlayedAt: number;
};

const SOURCES: Record<SfxKey, number> = {
  tap: require('../../assets/sounds/sfx_ui_tap.wav'),
  success: require('../../assets/sounds/sfx_ui_success.wav'),
  combo: require('../../assets/sounds/sfx_ui_combo.wav'),
  errorSoft: require('../../assets/sounds/sfx_ui_error_soft.wav'),
  start: require('../../assets/sounds/sfx_ui_start.wav'),
  complete: require('../../assets/sounds/sfx_ui_complete.wav'),
  transition: require('../../assets/sounds/sfx_ui_transition.wav'),
  meterCelebrate: require('../../assets/sounds/sfx_meter_celebrate.mp3'),
  meterBounce: require('../../assets/sounds/sfx_ui_success.wav'),
  timerTick: require('../../assets/sounds/bubble_mid.wav'),
  timerEnd: require('../../assets/sounds/bubble_end.wav'),
  gameWin: require('../../assets/sounds/sfx_game_win.wav'),
};

const REGISTRY: Record<SfxKey, SfxState> = {
  tap: { sound: null, loading: false, lastPlayedAt: 0 },
  success: { sound: null, loading: false, lastPlayedAt: 0 },
  combo: { sound: null, loading: false, lastPlayedAt: 0 },
  errorSoft: { sound: null, loading: false, lastPlayedAt: 0 },
  start: { sound: null, loading: false, lastPlayedAt: 0 },
  complete: { sound: null, loading: false, lastPlayedAt: 0 },
  transition: { sound: null, loading: false, lastPlayedAt: 0 },
  meterCelebrate: { sound: null, loading: false, lastPlayedAt: 0 },
  meterBounce: { sound: null, loading: false, lastPlayedAt: 0 },
  timerTick: { sound: null, loading: false, lastPlayedAt: 0 },
  timerEnd: { sound: null, loading: false, lastPlayedAt: 0 },
  gameWin: { sound: null, loading: false, lastPlayedAt: 0 },
};

let initialized = false;
let muted = false;
let volume = 0.33;

async function ensureAudioMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

async function ensureLoaded(key: SfxKey): Promise<Audio.Sound | null> {
  const slot = REGISTRY[key];
  if (slot.sound) {
    return slot.sound;
  }
  if (slot.loading) {
    return null;
  }
  slot.loading = true;
  try {
    const { sound } = await Audio.Sound.createAsync(SOURCES[key], {
      volume,
      shouldPlay: false,
    });
    slot.sound = sound;
    return sound;
  } catch (error) {
    if (__DEV__) console.warn('[sfx] failed to load', key, error);
    return null;
  } finally {
    slot.loading = false;
  }
}

export async function initializeSfx(): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;
  try {
    await ensureAudioMode();
    await Promise.all((Object.keys(SOURCES) as SfxKey[]).map((key) => ensureLoaded(key)));
  } catch (error) {
    if (__DEV__) {
      console.warn('[sfx] initialize failed', error);
    }
  }
}

export async function playSfx(
  key: SfxKey,
  options?: { cooldownMs?: number; volumeOverride?: number }
): Promise<void> {
  if (muted) {
    return;
  }
  const slot = REGISTRY[key];
  const now = Date.now();
  const cooldownMs = options?.cooldownMs ?? 140;
  if (cooldownMs > 0 && now - slot.lastPlayedAt < cooldownMs) {
    return;
  }
  slot.lastPlayedAt = now;

  try {
    await ensureAudioMode();
    const sound = await ensureLoaded(key);
    if (!sound) {
      return;
    }
    const nextVolume = options?.volumeOverride ?? volume;
    await sound.setVolumeAsync(nextVolume);
    const status = await sound.getStatusAsync();
    if (status.isLoaded && status.isPlaying) {
      await sound.stopAsync().catch(() => {});
    }
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (error) {
    if (__DEV__) console.warn('[sfx] play failed', key, error);
  }
}

export async function stopAllSfx(): Promise<void> {
  await Promise.all(
    (Object.keys(REGISTRY) as SfxKey[]).map(async (key) => {
      const sound = REGISTRY[key].sound;
      if (!sound) {
        return;
      }
      try {
        await sound.stopAsync();
      } catch {
        // ignore stop failures
      }
    })
  );
}

export async function setSfxVolume(nextVolume: number): Promise<void> {
  volume = Math.max(0, Math.min(1, nextVolume));
  await Promise.all(
    (Object.keys(REGISTRY) as SfxKey[]).map(async (key) => {
      const sound = REGISTRY[key].sound;
      if (!sound) {
        return;
      }
      try {
        await sound.setVolumeAsync(volume);
      } catch {
        // ignore volume update failures
      }
    })
  );
}

export function isSfxMuted(): boolean {
  return muted;
}

export function setSfxMuted(nextMuted: boolean): void {
  muted = nextMuted;
}

export async function disposeSfx(): Promise<void> {
  await Promise.all(
    (Object.keys(REGISTRY) as SfxKey[]).map(async (key) => {
      const sound = REGISTRY[key].sound;
      REGISTRY[key].sound = null;
      REGISTRY[key].loading = false;
      REGISTRY[key].lastPlayedAt = 0;
      if (!sound) {
        return;
      }
      try {
        await sound.unloadAsync();
      } catch (err) {
        if (__DEV__) console.warn('[sfx] unload failed', key, err);
      }
    })
  );
  initialized = false;
}
