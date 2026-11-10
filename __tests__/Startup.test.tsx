import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppBootstrap, useBootstrap } from '../src/app/AppBootstrap';
import { authService } from '../src/features/auth/services/authService';
import { useAuthStore } from '../src/store/authStore';
import { useUIStore } from '../src/store/uiStore';
import { useLocationStore } from '../src/features/location/store/locationStore';
import { notificationService } from '../src/services/notifications/notificationService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { appConfig } from '../src/constants/appConfig';
let tree: ReactTestRenderer;
let snapshot: ReturnType<typeof useBootstrap>;
function Probe() {
  snapshot = useBootstrap();
  return null;
}
async function mount() {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <AppBootstrap>
        <Probe />
      </AppBootstrap>,
    );
  });
}
beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.removeItem('friendie.preferences');
  useUIStore.setState({ onboardingComplete: false });
  useAuthStore.setState({ status: 'restoring', user: null });
  jest.spyOn(authService, 'restore').mockImplementation(async () => {
    useAuthStore.getState().clear();
  });
  jest
    .spyOn(useLocationStore.persist, 'rehydrate')
    .mockResolvedValue(undefined);
  jest.spyOn(notificationService, 'start').mockReturnValue(() => {});
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
  });
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});
test('fresh startup requires onboarding, returning guest is ready without authentication', async () => {
  await mount();
  expect(snapshot.status).toBe('onboardingRequired');
  await Renderer.act(async () => {
    await useUIStore.getState().completeOnboarding();
  });
  expect(snapshot.status).toBe('ready');
  expect(useAuthStore.getState().status).toBe('guest');
});
test('existing session is restored even when UI preview is configured; auth stays independent of onboarding', async () => {
  jest.mocked(authService.restore).mockImplementation(async () => {
    useAuthStore.getState().setUser({
      id: 42,
      name: 'Existing member',
      email: 'existing@example.test',
    });
  });
  await mount();
  expect(authService.restore).toHaveBeenCalledTimes(1);
  expect(snapshot.status).toBe('ready');
  expect(useUIStore.getState().onboardingComplete).toBe(false);
  expect(useAuthStore.getState().user?.id).toBe(42);
});
test('temporary session failure opens public startup and never clears secure credentials', async () => {
  await AsyncStorage.setItem(
    'friendie.preferences',
    JSON.stringify({ state: { onboardingComplete: true }, version: 0 }),
  );
  const remove = jest.spyOn(secureStorage, 'removeToken');
  jest.mocked(authService.restore).mockRejectedValue(new Error('offline'));
  await mount();
  expect(snapshot.status).toBe('ready');
  expect(snapshot.error).toBeNull();
  expect(useAuthStore.getState().status).toBe('guest');
  expect(remove).not.toHaveBeenCalled();
});
test('hanging session operation is bounded and aborted instead of trapping splash', async () => {
  let signal: AbortSignal | undefined;
  jest.mocked(authService.restore).mockImplementation(value => {
    signal = value;
    return new Promise(() => {});
  });
  await mount();
  expect(snapshot.ready).toBe(false);
  await Renderer.act(async () => {
    jest.advanceTimersByTime(appConfig.requestTimeout + 1);
  });
  expect(snapshot.ready).toBe(true);
  expect(signal?.aborted).toBe(true);
  expect(useAuthStore.getState().status).toBe('guest');
});
test('storage read failure has retry and a nonpersisted continuation', async () => {
  jest
    .mocked(AsyncStorage.getItem)
    .mockRejectedValueOnce(new Error('storage unavailable'));
  await mount();
  expect(snapshot.error).toContain('saved preferences');
  await Renderer.act(async () => {
    snapshot.continueWithoutPreferences();
  });
  expect(snapshot.status).toBe('onboardingRequired');
  expect(useUIStore.getState().onboardingComplete).toBe(false);
  expect(await AsyncStorage.getItem('friendie.preferences')).toBeNull();
});

test('late storage response after a timeout cannot overwrite the chosen startup path', async () => {
  let finish!: (value: string) => void;
  jest.mocked(AsyncStorage.getItem).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  await Renderer.act(async () => {
    jest.advanceTimersByTime(appConfig.requestTimeout + 1);
  });
  expect(snapshot.error).toContain('saved preferences');
  await Renderer.act(async () => {
    snapshot.continueWithoutPreferences();
    finish(JSON.stringify({ state: { onboardingComplete: true }, version: 0 }));
  });
  expect(useUIStore.getState().onboardingComplete).toBe(false);
  expect(snapshot.status).toBe('onboardingRequired');
});

test('temporary network failure preserves an already confirmed in-memory session', async () => {
  useAuthStore
    .getState()
    .setUser({ id: 42, name: 'Member', email: 'member@example.test' });
  jest
    .mocked(authService.restore)
    .mockRejectedValue(new Error('temporary timeout'));
  await mount();
  expect(snapshot.status).toBe('ready');
  expect(useAuthStore.getState().user?.id).toBe(42);
});

test('session expiry after entering Home does not replay onboarding or manufacture completion', async () => {
  jest.mocked(authService.restore).mockImplementation(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 42, name: 'Member', email: 'member@example.test' });
  });
  await mount();
  expect(snapshot.status).toBe('ready');
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
  });
  expect(snapshot.status).toBe('ready');
  expect(useUIStore.getState().onboardingComplete).toBe(false);
});
