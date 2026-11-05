import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { authService } from '../features/auth/services/authService';
import { restorePreferences } from '../store/uiStore';
import { useLocationStore } from '../features/location/store/locationStore';
import { appConfig } from '../constants/appConfig';
import { useAuthStore } from '../store/authStore';
import { notificationService } from '../services/notifications/notificationService';
interface BootstrapState {
  ready: boolean;
  error: string | null;
  retry: () => void;
}
const BootstrapContext = createContext<BootstrapState>({
  ready: false,
  error: null,
  retry: () => {},
});
export const useBootstrap = () => useContext(BootstrapContext);
export function AppBootstrap({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null),
    [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);
    (async () => {
      await Promise.all([
        restorePreferences(),
        useLocationStore.persist.rehydrate(),
      ]);
      if (appConfig.navigationPreview || appConfig.uiPreviewEnabled)
        useAuthStore.getState().clear();
      else await authService.restore();
    })()
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active)
          setError(
            'Unable to restore your preferences or session. Check device storage, API configuration or connection and try again.',
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => notificationService.start(), []);
  return (
    <BootstrapContext.Provider value={{ ready, error, retry }}>
      {children}
    </BootstrapContext.Provider>
  );
}
