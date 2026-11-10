import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const preferenceKey = 'friendie.preferences';
type Preferences = {
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
};
interface UIState extends Preferences {
  completeOnboarding: () => Promise<void>;
  setNotificationsEnabled: (value: boolean) => Promise<void>;
}
const defaults: Preferences = {
  onboardingComplete: false,
  notificationsEnabled: false,
};
// Serialize preference writes and publish only after AsyncStorage confirms success.
let pending: Promise<void> = Promise.resolve();
function savePreferences(change: Partial<Preferences>): Promise<void> {
  const operation = pending
    .catch(() => {})
    .then(async () => {
      const current = useUIStore.getState();
      const next = {
        onboardingComplete: current.onboardingComplete,
        notificationsEnabled: current.notificationsEnabled,
        ...change,
      };
      await AsyncStorage.setItem(
        preferenceKey,
        JSON.stringify({ state: next, version: 0 }),
      );
      useUIStore.setState(next);
    });
  pending = operation;
  return operation;
}
export const useUIStore = create<UIState>(() => ({
  ...defaults,
  completeOnboarding: () => savePreferences({ onboardingComplete: true }),
  setNotificationsEnabled: value =>
    savePreferences({ notificationsEnabled: value }),
}));

export async function restorePreferences(signal?: AbortSignal): Promise<void> {
  // Read failures propagate to bootstrap's retry screen. Only malformed data defaults.
  const raw = await AsyncStorage.getItem(preferenceKey);
  let preferences = defaults;
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'state' in parsed &&
        'version' in parsed &&
        parsed.version === 0 &&
        typeof parsed.state === 'object' &&
        parsed.state !== null
      ) {
        const state = parsed.state;
        preferences = {
          onboardingComplete:
            'onboardingComplete' in state && state.onboardingComplete === true,
          notificationsEnabled:
            'notificationsEnabled' in state &&
            state.notificationsEnabled === true,
        };
      }
    } catch {
      // Invalid JSON is an unset preference, never an authenticated session.
    }
  }
  if (!signal?.aborted) useUIStore.setState(preferences);
}
