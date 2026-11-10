import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { authService } from '../features/auth/services/authService';
import { restorePreferences, useUIStore } from '../store/uiStore';
import { useLocationStore } from '../features/location/store/locationStore';
import { appConfig } from '../constants/appConfig';
import { useAuthStore } from '../store/authStore';
import { notificationService } from '../services/notifications/notificationService';
export type StartupStatus = 'initializing' | 'onboardingRequired' | 'ready';
interface BootstrapState {
  ready: boolean;
  status: StartupStatus;
  error: string | null;
  retry: () => void;
  continueWithoutPreferences: () => void;
}
const BootstrapContext = createContext<BootstrapState>({
  ready: false,
  status: 'initializing',
  error: null,
  retry: () => {},
  continueWithoutPreferences: () => {},
});
export const useBootstrap = () => useContext(BootstrapContext);
// Bound native-storage and network operations; late restoration cannot change session/preferences.
function bounded<T>(
  work: (signal: AbortSignal) => Promise<T>,
  controller: AbortController,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Startup operation timed out.'));
    }, appConfig.requestTimeout);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Startup operation cancelled.'));
    };
    controller.signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted)
          throw new Error('Startup operation cancelled.');
        return work(controller.signal);
      })
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', onAbort);
      });
  });
}
export function AppBootstrap({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null),
    [attempt, setAttempt] = useState(0);
  const [enteredApp, setEnteredApp] = useState(false);
  const auth = useAuthStore(state => state.status);
  const onboarded = useUIStore(state => state.onboardingComplete);
  useEffect(() => {
    if (ready && (onboarded || auth === 'authenticated')) setEnteredApp(true);
  }, [ready, onboarded, auth]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const continueWithoutPreferences = useCallback(() => {
    setError(null);
    setReady(true);
  }, []);
  useEffect(() => {
    let active = true;
    const preferences = new AbortController(),
      location = new AbortController(),
      session = new AbortController();
    setReady(false);
    setError(null);
    Promise.allSettled([
      bounded(signal => restorePreferences(signal), preferences),
      bounded(async () => {
        await useLocationStore.persist.rehydrate();
      }, location),
      bounded(signal => authService.restore(signal), session),
    ]).then(results => {
      if (!active) return;
      // A transient failure never removes Keychain credentials or invents a verified session.
      if (
        results[2].status === 'rejected' &&
        useAuthStore.getState().status !== 'authenticated'
      )
        useAuthStore.getState().clear();
      if (results[0].status === 'rejected') {
        setError(
          'Unable to read saved preferences. Retry, or continue without restoring them.',
        );
        return;
      }
      setReady(true);
    });
    return () => {
      active = false;
      preferences.abort();
      location.abort();
      session.abort();
    };
  }, [attempt]);
  useEffect(() => notificationService.start(), []);
  const status: StartupStatus = !ready
    ? 'initializing'
    : enteredApp || onboarded || auth === 'authenticated'
    ? 'ready'
    : 'onboardingRequired';
  return (
    <BootstrapContext.Provider
      value={{ ready, status, error, retry, continueWithoutPreferences }}
    >
      {children}
    </BootstrapContext.Provider>
  );
}
