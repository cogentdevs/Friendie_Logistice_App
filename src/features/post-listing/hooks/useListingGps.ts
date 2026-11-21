import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../store/authStore';
import {
  listingGpsService,
  ListingGpsResult,
} from '../services/listingGpsService';
import { LocationError } from '../../location/services/locationService';
import { locationProblem } from '../../location/services/filterLocationService';

export function useListingGps(
  enabled: boolean,
  canAuto: () => boolean,
  onResult: (value: ListingGpsResult) => void,
) {
  const account = useAuthStore(state => state.user),
    status = useAuthStore(state => state.status);
  const [busy, setBusy] = useState(false),
    [settings, setSettings] = useState<'app' | 'location'>();
  const generation = useRef(0),
    flight = useRef(false),
    controller = useRef<AbortController | null>(null);
  const live = useRef(false),
    resume = useRef(false),
    attempted = useRef(false);
  const callbacks = useRef({ canAuto, onResult });
  callbacks.current = { canAuto, onResult };
  const invalidate = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    if (live.current) setBusy(false);
  }, []);
  const detect = useCallback(
    async (explicit = true, resuming = false) => {
      if (
        !live.current ||
        flight.current ||
        useAuthStore.getState().user !== account ||
        useAuthStore.getState().status !== status ||
        (!explicit && !resuming && !callbacks.current.canAuto())
      )
        return;
      flight.current = true;
      const request = ++generation.current,
        abort = new AbortController();
      controller.current = abort;
      const current = () =>
        live.current &&
        request === generation.current &&
        !abort.signal.aborted &&
        useAuthStore.getState().user === account &&
        useAuthStore.getState().status === status;
      setBusy(true);
      try {
        const granted = await listingGpsService.hasPermission();
        if (!current()) return;
        if (!granted) {
          if (!explicit) return;
          await listingGpsService.requestPermission();
          if (!current()) return;
        }
        if (!(await listingGpsService.enabled())) {
          if (!current()) return;
          setSettings('location');
          if (explicit)
            Toast.show({
              type: 'info',
              text1: 'Information',
              text2:
                'Turn on device location using Open Location Settings, then return. Manual selection is still available.',
            });
          return;
        }
        const result = await listingGpsService.detect(abort.signal);
        if (!current()) return;
        if (!explicit && !resuming && !callbacks.current.canAuto()) return;
        setSettings(undefined);
        if (result) callbacks.current.onResult(result);
        if (!result || !result.city)
          Toast.show({
            type: 'info',
            text1: 'Information',
            text2: result
              ? 'Country detected. Select your city manually.'
              : 'No unique matching country was found. Select your location manually.',
          });
      } catch (error) {
        if (!current()) return;
        if (error instanceof LocationError && error.reason === 'blocked')
          setSettings('app');
        if (error instanceof LocationError && error.reason === 'disabled')
          setSettings('location');
        Toast.show({
          type: 'warning',
          text1: 'Warning',
          text2:
            error instanceof LocationError
              ? locationProblem(error).message
              : 'Unable to resolve your location. Please select it manually.',
        });
      } finally {
        flight.current = false;
        if (current()) setBusy(false);
        if (resume.current && AppState.currentState === 'active') {
          resume.current = false;
          detect(false, true);
        }
      }
    },
    [account, status],
  );
  useEffect(() => {
    attempted.current = false;
    setSettings(undefined);
  }, [account, status]);
  useEffect(() => {
    live.current = enabled;
    if (!enabled) attempted.current = false;
    if (enabled) setBusy(false);
    if (enabled && !attempted.current) {
      // Defer past effect setup/cleanup replay; Strict Mode must not consume
      // the single entry attempt with a request that has already been invalidated.
      Promise.resolve().then(() => {
        if (
          !live.current ||
          attempted.current ||
          useAuthStore.getState().user !== account ||
          useAuthStore.getState().status !== status
        )
          return;
        attempted.current = true;
        detect(false);
      });
    }
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') invalidate();
      else if (resume.current && enabled && !flight.current) {
        resume.current = false;
        detect(false, true);
      }
    });
    return () => {
      live.current = false;
      resume.current = false;
      invalidate();
      listener.remove();
    };
  }, [enabled, detect, invalidate, account, status]);
  const openSettings = async () => {
    if (!settings || !live.current || flight.current) return;
    resume.current = true;
    try {
      if (settings === 'app') await listingGpsService.openAppSettings();
      else await listingGpsService.openLocationSettings();
    } catch {
      resume.current = false;
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Unable to open Settings. Open device Settings manually.',
      });
    }
  };
  return {
    busy,
    settings,
    detect: () => detect(true),
    invalidate: () => {
      resume.current = false;
      invalidate();
    },
    openSettings,
  };
}
