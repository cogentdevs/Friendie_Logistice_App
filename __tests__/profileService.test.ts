import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { getProfile } from '../src/features/profile/services/profileService';
import { secureStorage } from '../src/services/storage/secureStorage';
let previous: { base: string; verified: boolean; ui: boolean };
beforeEach(() => {
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('profile-contract-token');
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
test('verified profile maps nullable backend fields and rejects another identity without inventing stats', async () => {
  appConfig.apiBaseUrl = 'https://example.test';
  appConfig.profileApiVerified = true;
  jest
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        data: {
          id: 8,
          name: 'Member',
          email: 'member@example.test',
          is_verified: false,
          phone: null,
          image_url: null,
          country_id: null,
          country: null,
        },
      },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        data: { id: 9, name: 'Other', email: 'other@example.test' },
      },
    });
  await expect(getProfile()).resolves.toMatchObject({
    phone: null,
    avatarUrl: null,
    verified: false,
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
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: {
      success: true,
      data: {
        id: 8,
        name: 'Real Member',
        email: 'member@example.test',
        is_verified: false,
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
