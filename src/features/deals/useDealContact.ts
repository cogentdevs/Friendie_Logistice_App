import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { readDealContact, subscribeDealRevocation } from './dealContactService';
export function useDealContact(dealId: number, focused: boolean) {
  const user = useAuthStore(state => state.user);
  const status = useAuthStore(state => state.status);
  const [grant, setGrant] = useState<
    Awaited<ReturnType<typeof readDealContact>> & {
      owner: typeof user;
      dealId: number;
    }
  >();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const epoch = useRef(0),
    abort = useRef<AbortController | null>(null);
  const flight = useRef(false);
  const clear = useCallback(() => {
    epoch.current++;
    abort.current?.abort();
    flight.current = false;
    setGrant(undefined);
    setLoading(false);
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      clear();
      setActive(state === 'active');
    });
    return () => sub.remove();
  }, [clear]);
  useEffect(() => {
    clear();
    setError(undefined);
    setRequested(false);
    return clear;
  }, [user, status, dealId, focused, clear]);
  useEffect(
    () =>
      subscribeDealRevocation(id => {
        if (id === undefined || id === dealId) {
          clear();
          if (id !== undefined) setError(new Error('Contact access revoked.'));
        }
      }),
    [dealId, clear],
  );
  const load = useCallback(async () => {
    if (
      flight.current ||
      !focused ||
      !active ||
      !user ||
      status !== 'authenticated'
    )
      return;
    clear();
    flight.current = true;
    const generation = epoch.current;
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setRequested(true);
    setError(undefined);
    try {
      const result = await readDealContact(dealId, controller.signal);
      if (
        generation === epoch.current &&
        !controller.signal.aborted &&
        useAuthStore.getState().user === user
      )
        setGrant({ ...result, owner: user, dealId });
    } catch (failure) {
      if (
        generation === epoch.current &&
        !controller.signal.aborted &&
        useAuthStore.getState().user === user
      )
        setError(failure);
    } finally {
      if (
        generation === epoch.current &&
        !controller.signal.aborted &&
        useAuthStore.getState().user === user
      ) {
        flight.current = false;
        setLoading(false);
      }
    }
  }, [focused, active, user, status, dealId, clear]);
  useEffect(() => {
    if (!grant) return;
    const timer = setTimeout(() => {
      clear();
      if (focused && active && requested) load().catch(() => {});
    }, Math.max(0, grant.validUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [grant, focused, active, requested, load, clear]);
  const currentEpoch = epoch.current;
  const isAuthorized = () =>
    focused &&
    AppState.currentState === 'active' &&
    useAuthStore.getState().status === 'authenticated' &&
    useAuthStore.getState().user === user &&
    grant?.owner === user &&
    grant.dealId === dealId &&
    grant.validUntil > Date.now() &&
    epoch.current === currentEpoch;
  return {
    isAuthorized,
    contact:
      focused &&
      active &&
      status === 'authenticated' &&
      grant?.owner === user &&
      grant.dealId === dealId &&
      grant.validUntil > Date.now()
        ? grant?.contact
        : undefined,
    loading,
    error,
    load,
    clear,
  };
}
