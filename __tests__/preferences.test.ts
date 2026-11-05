import AsyncStorage from '@react-native-async-storage/async-storage';
import { restorePreferences, useUIStore } from '../src/store/uiStore';
import { useAuthStore } from '../src/store/authStore';
const key = 'friendie.preferences';
beforeEach(async () => {
  await AsyncStorage.removeItem(key);
  useUIStore.setState({
    onboardingComplete: false,
    notificationsEnabled: false,
  });
});
test.each([
  null,
  'broken JSON',
  'null',
  '{"state":{"onboardingComplete":"true"},"version":0}',
  '{"state":{"onboardingComplete":true},"version":99}',
])('missing or corrupt preferences default safely: %s', async raw => {
  if (raw !== null) await AsyncStorage.setItem(key, raw);
  useUIStore.setState({ onboardingComplete: true });
  await restorePreferences();
  expect(useUIStore.getState().onboardingComplete).toBe(false);
});
test('legacy valid preferences restore independently of authentication', async () => {
  await AsyncStorage.setItem(
    key,
    JSON.stringify({
      state: { onboardingComplete: true, notificationsEnabled: true },
      version: 0,
    }),
  );
  const auth = useAuthStore.getState();
  await restorePreferences();
  expect(useUIStore.getState().onboardingComplete).toBe(true);
  expect(useUIStore.getState().notificationsEnabled).toBe(true);
  expect(useAuthStore.getState()).toBe(auth);
});
test('storage read failure propagates for bootstrap retry', async () => {
  jest
    .mocked(AsyncStorage.getItem)
    .mockRejectedValueOnce(new Error('unavailable'));
  await expect(restorePreferences()).rejects.toThrow('unavailable');
});
test('completion waits for durable storage, preserving concurrent notification preference writes', async () => {
  let release!: () => void;
  const deferred = new Promise<void>(resolve => {
    release = resolve;
  });
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(() => deferred);
  const completion = useUIStore.getState().completeOnboarding();
  const notification = useUIStore.getState().setNotificationsEnabled(true);
  await Promise.resolve();
  expect(useUIStore.getState().onboardingComplete).toBe(false);
  release();
  await Promise.all([completion, notification]);
  expect(JSON.parse((await AsyncStorage.getItem(key))!).state).toEqual({
    onboardingComplete: true,
    notificationsEnabled: true,
  });
});
test('failed write does not complete onboarding and subsequent retry succeeds', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('full'));
  await expect(useUIStore.getState().completeOnboarding()).rejects.toThrow(
    'full',
  );
  expect(useUIStore.getState().onboardingComplete).toBe(false);
  await useUIStore.getState().completeOnboarding();
  expect(useUIStore.getState().onboardingComplete).toBe(true);
});

test('completing onboarding preserves an already restored authenticated session', async () => {
  useAuthStore.getState().setUser({id: 1, name: 'Traveller', email: 'traveller@example.test'});
  const auth = useAuthStore.getState();
  await useUIStore.getState().completeOnboarding();
  await restorePreferences();
  expect(useAuthStore.getState()).toBe(auth);
  expect(useAuthStore.getState().status).toBe('authenticated');
});
