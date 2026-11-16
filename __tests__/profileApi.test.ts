import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { getProfile } from '../src/features/profile/services/profileService';
import { authService } from '../src/features/auth/services/authService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
const member = { id: 8, name: 'Login Member', email: 'member@example.test' };
const rawProfile = {
  id: 8,
  name: 'Backend Member',
  email: 'member@example.test',
  phone: '+923001234567',
  country_id: 179,
  country: { id: 179, name: 'Pakistan', short_name: 'PK' },
  image_url: 'https://example.test/frontend/img/profiles/avatar.jpg',
  is_verified: true,
  email_verified_at: '2026-11-01T12:00:00.000000Z',
};
const envelope = {
  success: true,
  message: 'Profile retrieved successfully.',
  data: rawProfile,
};
const originalAdapter = apiClient.defaults.adapter;
const previousVerified = appConfig.profileApiVerified,
  previousPreview = appConfig.uiPreviewEnabled;
let record: { username: string; password: string } | false;
function respond(data: unknown = envelope, status = 200) {
  apiClient.defaults.adapter = async config => ({
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  appConfig.profileApiVerified = true;
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  record = {
    username: JSON.stringify(member),
    password: 'profile-contract-token',
  };
  jest
    .spyOn(Keychain, 'getGenericPassword')
    .mockImplementation(async () => record as never);
  jest.spyOn(Keychain, 'resetGenericPassword').mockImplementation(async () => {
    record = false;
    return true;
  });
  respond();
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  appConfig.profileApiVerified = previousVerified;
  appConfig.uiPreviewEnabled = previousPreview;
  jest.restoreAllMocks();
});
test('GET uses the verified own-profile endpoint with captured real-session token and no query/user ID', async () => {
  let count = 0;
  apiClient.defaults.adapter = async config => {
    count++;
    expect(config.method).toBe('get');
    expect(config.url).toBe('/customer/profile');
    expect(config.baseURL).toBe(appConfig.apiBaseUrl);
    expect(config.params).toBeUndefined();
    expect(config.headers.Authorization).toBe('Bearer profile-contract-token');
    return { status: 200, statusText: '', headers: {}, config, data: envelope };
  };
  expect(await getProfile()).toEqual({
    id: 8,
    name: 'Backend Member',
    email: 'member@example.test',
    phone: rawProfile.phone,
    countryId: rawProfile.country_id,
    countryCode: rawProfile.country?.short_name,
    avatarUrl: rawProfile.image_url,
    verified: true,
  });
  expect(count).toBe(1);
  expect(useAuthStore.getState().user).toBe(member);
  expect(record && record.password).toBe('profile-contract-token');
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
});
test('nullable fields remain absent/null and no backend statistics or location are fabricated', async () => {
  respond({
    success: true,
    data: {
      ...rawProfile,
      phone: null,
      country_id: null,
      country: null,
      image_url: null,
      email_verified_at: null,
      is_verified: false,
    },
  });
  const profile = await getProfile();
  expect(profile.phone).toBeNull();
  expect(profile.avatarUrl).toBeNull();
  expect(profile.verified).toBe(false);
  expect(profile.statistics).toBeUndefined();
  expect(profile.location).toBeUndefined();
});
test('guests never fetch private profile or read a token', async () => {
  useAuthStore.getState().clear();
  const get = jest.spyOn(apiClient, 'get'),
    read = jest.spyOn(secureStorage, 'getToken');
  await expect(getProfile()).rejects.toMatchObject({ kind: 'unauthorized' });
  expect(get).not.toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled();
});
test('demo profile stays local while a stale preview flag cannot affect real authentication', async () => {
  appConfig.uiPreviewEnabled = true;
  useDevelopmentStore.setState({ previewActive: true });
  const get = jest.spyOn(apiClient, 'get');
  expect((await getProfile()).name).toBe('Backend Member');
  expect(get).toHaveBeenCalledTimes(1);
  get.mockClear();
  useAuthStore.getState().clear();
  expect((await getProfile()).name).toBe('Demo Traveller');
  expect(get).not.toHaveBeenCalled();
});
test('missing local token clears the inconsistent local session without any API or Logout call', async () => {
  record = false;
  const get = jest.spyOn(apiClient, 'get'),
    logout = jest.spyOn(authService, 'logout');
  await expect(getProfile()).rejects.toMatchObject({ kind: 'unauthorized' });
  expect(get).not.toHaveBeenCalled();
  expect(logout).not.toHaveBeenCalled();
  expect(useAuthStore.getState().status).toBe('guest');
});
test('401 follows existing interceptor expiry cleanup without invoking Logout API', async () => {
  apiClient.defaults.adapter = async config => {
    throw new axios.AxiosError(
      'unauthenticated',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      {
        status: 401,
        statusText: '',
        headers: {},
        config,
        data: { success: false, message: 'Unauthenticated' },
      },
    );
  };
  const logout = jest.spyOn(authService, 'logout');
  await expect(getProfile()).rejects.toMatchObject({ status: 401 });
  expect(useAuthStore.getState().status).toBe('guest');
  expect(record).toBe(false);
  expect(logout).not.toHaveBeenCalled();
});
test.each([403, 404, 429, 500])(
  'HTTP %s retains the real session without leaking server details',
  async status => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError(
        'failure',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        {
          status,
          statusText: '',
          headers: {},
          config,
          data: { message: 'SQL/private profile detail' },
        },
      );
    };
    try {
      await getProfile();
      throw new Error('Unexpected success');
    } catch (error) {
      expect(error).toMatchObject({ status });
      expect((error as Error).message).not.toContain('SQL');
    }
    expect(useAuthStore.getState().user).toBe(member);
    expect(record).not.toBe(false);
  },
);
test.each(['ERR_NETWORK', 'ECONNABORTED'])(
  '%s preserves the session and supports retry',
  async code => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError('private details', code, config);
    };
    await expect(getProfile()).rejects.toMatchObject({ kind: 'network' });
    expect(useAuthStore.getState().user).toBe(member);
    respond();
    expect((await getProfile()).id).toBe(8);
  },
);
test.each([
  {},
  { success: false, data: rawProfile },
  { success: true, data: { ...rawProfile, id: '8' } },
  { success: true, data: { ...rawProfile, is_verified: 'yes' } },
])('malformed response cannot become profile data', async data => {
  respond(data);
  await expect(getProfile()).rejects.toMatchObject({ kind: 'unknown' });
  expect(useAuthStore.getState().user).toBe(member);
});
test('another account response is rejected', async () => {
  respond({ success: true, data: { ...rawProfile, id: 9 } });
  await expect(getProfile()).rejects.toMatchObject({ kind: 'forbidden' });
});
test('late profile response cannot restore private data after real logout', async () => {
  let finish!: () => void, started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  apiClient.defaults.adapter = config =>
    config.method === 'post'
      ? Promise.resolve({
          status: 200,
          statusText: '',
          headers: {},
          config,
          data: { success: true, message: 'Logout successful.', data: {} },
        })
      : new Promise(resolve => {
          finish = () =>
            resolve({
              status: 200,
              statusText: '',
              headers: {},
              config,
              data: envelope,
            });
          started();
        });
  const pending = getProfile().catch(error => error);
  await ready;
  await authService.logout();
  finish();
  expect(await pending).toMatchObject({ kind: 'cancelled' });
  expect(useAuthStore.getState().status).toBe('guest');
  expect(record).toBe(false);
});
test('same-ID reauthentication invalidates an older response', async () => {
  let finish!: () => void, started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  apiClient.defaults.adapter = config =>
    new Promise(resolve => {
      finish = () =>
        resolve({
          status: 200,
          statusText: '',
          headers: {},
          config,
          data: envelope,
        });
      started();
    });
  const pending = getProfile().catch(error => error);
  await ready;
  useAuthStore.getState().setUser({ ...member, name: 'New Session' });
  record = { username: JSON.stringify(member), password: 'new-session-token' };
  finish();
  expect(await pending).toMatchObject({ kind: 'cancelled' });
  expect(useAuthStore.getState().user?.name).toBe('New Session');
});
