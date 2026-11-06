import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { getProfile } from '../src/features/profile/services/profileService';
let previous: { base: string; verified: boolean; ui: boolean };
beforeEach(() => {
  previous = {
    base: appConfig.apiBaseUrl,
    verified: appConfig.profileApiVerified,
    ui: appConfig.uiPreviewEnabled,
  };
  useDevelopmentStore.setState({
    previewActive: false,
    authEntryRequested: false,
  });
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
});
afterEach(() => {
  appConfig.apiBaseUrl = previous.base;
  appConfig.profileApiVerified = previous.verified;
  appConfig.uiPreviewEnabled = previous.ui;
  jest.restoreAllMocks();
});
test('unverified and unauthenticated profile reads send no network request', async () => {
  appConfig.profileApiVerified = false;
  const get = jest.spyOn(apiClient, 'get');
  await expect(getProfile()).rejects.toThrow('unavailable');
  useAuthStore.getState().clear();
  await expect(getProfile()).rejects.toThrow('Sign in');
  expect(get).not.toHaveBeenCalled();
});
test('verified profile rejects another identity; real nullable stats are preserved', async () => {
  appConfig.apiBaseUrl = 'https://example.test';
  appConfig.profileApiVerified = true;
  jest
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce({
      data: {
        data: {
          id: 8,
          name: 'Member',
          email: 'member@example.test',
          verified: null,
          statistics: { listings: 0, reviews: null, rating: null },
        },
      },
    })
    .mockResolvedValueOnce({
      data: { data: { id: 9, name: 'Other', email: 'other@example.test' } },
    });
  await expect(getProfile()).resolves.toMatchObject({
    statistics: { listings: 0, reviews: null, rating: null },
  });
  await expect(getProfile()).rejects.toMatchObject({ kind: 'forbidden' });
});
test('sample statistics are available exclusively in labeled UI preview', async () => {
  appConfig.uiPreviewEnabled = true;
  useAuthStore.getState().clear();
  useDevelopmentStore.setState({ previewActive: true });
  const get = jest.spyOn(apiClient, 'get');
  await expect(getProfile()).resolves.toMatchObject({
    name: 'Demo Traveller',
    statistics: { listings: 24, reviews: 128, rating: 4.9 },
  });
  expect(get).not.toHaveBeenCalled();
});

test('an active real session never receives the demo profile even when preview flag remains set', async () => {
  appConfig.uiPreviewEnabled = true;
  appConfig.apiBaseUrl = 'https://example.test';
  appConfig.profileApiVerified = true;
  useDevelopmentStore.setState({ previewActive: true });
  const get = jest
    .spyOn(apiClient, 'get')
    .mockResolvedValue({
      data: {
        data: {
          id: 8,
          name: 'Real Member',
          email: 'member@example.test',
          verified: false,
        },
      },
    });
  await expect(getProfile()).resolves.toMatchObject({
    id: 8,
    name: 'Real Member',
    verified: false,
  });
  expect(get).toHaveBeenCalledTimes(1);
});
