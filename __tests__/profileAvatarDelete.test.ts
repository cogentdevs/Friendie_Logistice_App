import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import {
  deleteProfileAvatar,
  uploadProfileAvatar,
  AvatarDeleteUncertainError,
  avatarDeleteRecovery,
} from '../src/features/profile/services/profileAvatarService';
import {
  profileEditService,
  AvatarPartialSaveError,
} from '../src/features/profile/services/profileEditService';
const user = { id: 8, name: 'Member', email: 'member@example.test' };
const profile = {
  ...user,
  phone: '+923001234567',
  countryId: 179,
  countryCode: 'PK',
  avatarUrl: 'https://example.test/custom.jpg',
};
const values = {
  name: user.name,
  email: user.email,
  phone: profile.phone,
  callingCountry: 'PK' as const,
};
const canonical = 'https://example.test/server-default.jpg';
const image = {
  uri: 'content://photo/new',
  type: 'image/png' as const,
  fileSize: 100,
};
const adapter = apiClient.defaults.adapter;
let token: string | null;
let calls: string[];
const reply = (config: any, data: unknown, status = 200) => ({
  status,
  statusText: 'OK',
  headers: {},
  config,
  data,
});
const removed = {
  success: true,
  message: 'Avatar removed successfully.',
  data: { image_url: canonical },
};
const raw = {
  ...user,
  phone: profile.phone,
  country_id: 179,
  image_url: canonical,
};
beforeEach(() => {
  useAuthStore.getState().clear();
  useAuthStore.getState().setUser(user);
  useDevelopmentStore.setState({ previewActive: false });
  token = 'dummy-avatar-delete-token';
  calls = [];
  jest.spyOn(secureStorage, 'getToken').mockImplementation(async () => token);
  jest
    .spyOn(secureStorage, 'removeTokenIfCurrent')
    .mockImplementation(async (expected, current) => {
      if (token !== expected || !current()) return false;
      token = null;
      return true;
    });
  apiClient.defaults.adapter = async config => {
    calls.push(`${config.method} ${config.url}`);
    expect(config.headers.Authorization).toBe(
      'Bearer dummy-avatar-delete-token',
    );
    expect(config.params).toBeUndefined();
    expect(config.data).toBeUndefined();
    return reply(
      config,
      config.method === 'delete' ? removed : { success: true, data: raw },
    );
  };
});
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  jest.restoreAllMocks();
  useAuthStore.getState().clear();
});
test('DELETE uses exact protected avatar endpoint without body/query and returns canonical URL', async () => {
  expect(await deleteProfileAvatar()).toBe(canonical);
  expect(calls).toEqual(['delete /customer/profile/avatar']);
});
test('existing Remove then Save refreshes complete authoritative profile without PUT', async () => {
  const result = await profileEditService.save(
    values,
    undefined,
    true,
    profile,
  );
  expect(result.profile).toMatchObject({ id: 8, avatarUrl: canonical });
  expect(calls).toEqual([
    'delete /customer/profile/avatar',
    'get /customer/profile',
  ]);
});
test('no custom avatar still accepts actual backend default response', async () => {
  expect(
    (
      await profileEditService.save(values, undefined, true, {
        ...profile,
        avatarUrl: canonical,
      })
    ).profile.avatarUrl,
  ).toBe(canonical);
});
test('missing backend default file returns null and uses authoritative no-avatar profile', async () => {
  apiClient.defaults.adapter = async config =>
    reply(
      config,
      config.method === 'delete'
        ? { ...removed, data: { image_url: null } }
        : { success: true, data: { ...raw, image_url: null } },
    );
  expect(
    (await profileEditService.save(values, undefined, true, profile)).profile
      .avatarUrl,
  ).toBeNull();
});
test.each([false, true])(
  'guest/demo rejects without any endpoint: %s',
  async previewActive => {
    useAuthStore.getState().clear();
    useDevelopmentStore.setState({ previewActive });
    await expect(deleteProfileAvatar()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(calls).toEqual([]);
  },
);
test('missing token makes no DELETE', async () => {
  token = null;
  await expect(deleteProfileAvatar()).rejects.toMatchObject({
    kind: 'unauthorized',
  });
  expect(calls).toEqual([]);
});
test.each([400, 401, 403, 404, 409, 422, 429])(
  'HTTP %s is not success and releases definite-failure guard',
  async status => {
    apiClient.defaults.adapter = async config => {
      calls.push(config.method!);
      throw new axios.AxiosError(
        'private',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        { status, statusText: '', headers: {}, config, data: {} },
      );
    };
    await expect(deleteProfileAvatar()).rejects.toMatchObject({ status });
    expect(avatarDeleteRecovery()).toBeUndefined();
    expect(calls).toEqual(['delete']);
    if (status === 401) {
      expect(token).toBeNull();
      expect(useAuthStore.getState().status).toBe('guest');
    }
  },
);
test.each(['ERR_NETWORK', 'ECONNABORTED', 500, 'invalid', 204])(
  'uncertain %s preserves hold, refetches, never automatically repeats',
  async kind => {
    apiClient.defaults.adapter = async config => {
      calls.push(config.method!);
      if (config.method === 'get')
        return reply(config, { success: true, data: raw });
      if (kind === 'invalid') return reply(config, {});
      if (kind === 204) return reply(config, undefined, 204);
      if (kind === 500)
        throw new axios.AxiosError(
          'private',
          'ERR_BAD_RESPONSE',
          config,
          undefined,
          { status: 500, statusText: '', headers: {}, config, data: {} },
        );
      throw new axios.AxiosError('offline', kind as string, config);
    };
    await expect(deleteProfileAvatar()).rejects.toBeInstanceOf(
      AvatarDeleteUncertainError,
    );
    await expect(deleteProfileAvatar()).rejects.toBeInstanceOf(
      AvatarDeleteUncertainError,
    );
    await expect(uploadProfileAvatar(image)).rejects.toBeInstanceOf(
      AvatarDeleteUncertainError,
    );
    expect(calls).toEqual(['delete', 'get']);
    expect(avatarDeleteRecovery()?.phase).toBe('unknown');
  },
);
test.each(['logout', 'account', 'token', 'abort'])(
  'late DELETE cannot apply after %s',
  async change => {
    let finish!: () => void;
    let start!: () => void;
    const ready = new Promise<void>(r => {
      start = r;
    });
    apiClient.defaults.adapter = config =>
      new Promise(resolve => {
        calls.push(config.method!);
        finish = () => resolve(reply(config, removed));
        start();
      });
    const controller = new AbortController();
    const pending = deleteProfileAvatar(controller.signal).catch(
      error => error,
    );
    await ready;
    if (change === 'logout') useAuthStore.getState().clear();
    if (change === 'account')
      useAuthStore.getState().setUser({ ...user, id: 9 });
    if (change === 'token') token = 'replacement-token';
    if (change === 'abort') controller.abort();
    finish();
    expect(await pending).toMatchObject({ kind: 'cancelled' });
    expect(calls).toEqual(['delete']);
    expect(useAuthStore.getState().user?.id).toBe(
      change === 'logout' ? undefined : change === 'account' ? 9 : 8,
    );
  },
);
test('pending Delete blocks repeated Delete and Upload; confirmed Delete is reused for partial-save retry', async () => {
  let finish!: () => void;
  let start!: () => void;
  const ready = new Promise<void>(r => {
    start = r;
  });
  apiClient.defaults.adapter = config =>
    new Promise(resolve => {
      calls.push(config.method!);
      finish = () => resolve(reply(config, removed));
      start();
    });
  const pending = deleteProfileAvatar();
  await ready;
  await expect(deleteProfileAvatar()).rejects.toMatchObject({
    kind: 'cancelled',
  });
  await expect(uploadProfileAvatar(image)).rejects.toMatchObject({
    kind: 'cancelled',
  });
  finish();
  await pending;
  expect(await deleteProfileAvatar()).toBe(canonical);
  expect(calls).toEqual(['delete']);
});
test('pending Upload blocks Delete without changing upload request', async () => {
  let finish!: () => void;
  let start!: () => void;
  const ready = new Promise<void>(r => {
    start = r;
  });
  apiClient.defaults.adapter = config =>
    new Promise(resolve => {
      calls.push(config.method!);
      finish = () =>
        resolve(
          reply(config, {
            success: true,
            message: 'Avatar updated successfully.',
            data: { image_url: 'https://example.test/new.png' },
          }),
        );
      start();
    });
  const pending = uploadProfileAvatar(image);
  await ready;
  await expect(deleteProfileAvatar()).rejects.toMatchObject({
    kind: 'cancelled',
  });
  finish();
  await pending;
  expect(calls).toEqual(['post']);
});
test('confirmed deletion plus failed text save preserves canonical photo and retries only PUT', async () => {
  let puts = 0;
  apiClient.defaults.adapter = async config => {
    calls.push(config.method!);
    if (config.method === 'delete') return reply(config, removed);
    puts++;
    if (puts === 1)
      throw new axios.AxiosError('offline', 'ERR_NETWORK', config);
    return reply(config, {
      success: true,
      message: 'Profile updated successfully.',
      data: {
        profile: { ...raw, name: 'New name' },
        verification_required: false,
        reauthentication_required: false,
      },
    });
  };
  await expect(
    profileEditService.save(
      { ...values, name: 'New name' },
      undefined,
      true,
      profile,
    ),
  ).rejects.toBeInstanceOf(AvatarPartialSaveError);
  const result = await profileEditService.save(
    { ...values, name: 'New name' },
    undefined,
    true,
    profile,
  );
  expect(result.profile.avatarUrl).toBe(canonical);
  expect(calls).toEqual(['delete', 'put', 'put']);
});
