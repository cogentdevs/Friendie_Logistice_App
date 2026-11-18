import { AxiosError, AxiosHeaders } from 'axios';
// Node's FormData stringifies RN file descriptors. Bootstrap the actual native
// polyfill before Axios captures its FormData constructor, as the app does.
jest.mock('axios', () => {
  Object.defineProperty(globalThis, 'FormData', {
    value: jest.requireActual('react-native/Libraries/Network/FormData')
      .default,
    configurable: true,
    writable: true,
  });
  return jest.requireActual('axios');
});
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { uploadProfileAvatar } from '../src/features/profile/services/profileAvatarService';
import {
  profileEditService,
  AvatarPartialSaveError,
} from '../src/features/profile/services/profileEditService';
const member = { id: 8, name: 'Member', email: 'member@example.test' };
const profile = {
  ...member,
  phone: '+923001234567',
  countryId: 179,
  countryCode: 'PK',
  avatarUrl: 'https://example.test/old.jpg',
};
const values = {
  name: member.name,
  email: member.email,
  phone: profile.phone,
  callingCountry: 'PK' as const,
};
const image = {
  uri: 'content://photos/new',
  type: 'image/webp' as const,
  fileSize: 1000,
  fileName: 'selected.webp',
};
const savedUrl = 'https://example.test/api_user_8_unique.jpg';
const raw = {
  ...member,
  phone: profile.phone,
  country_id: 179,
  country: { id: 179, name: 'Pakistan', short_name: 'PK' },
  image_url: savedUrl,
  is_verified: true,
};
const adapter = apiClient.defaults.adapter,
  flag = appConfig.profileApiVerified;
let calls: string[];
beforeEach(() => {
  calls = [];
  useAuthStore.getState().clear();
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  appConfig.profileApiVerified = true;
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('avatar-test-token');
  jest
    .spyOn(secureStorage, 'removeTokenIfCurrent')
    .mockImplementation(async (_token, current) => current());
  apiClient.defaults.adapter = async config => {
    calls.push(`${config.method} ${config.url}`);
    expect(config.headers.Authorization).toBe('Bearer avatar-test-token');
    if (config.method === 'post') {
      expect(config.url).toBe('/customer/profile/avatar');
      expect(config.data).toBeInstanceOf(FormData);
      const parts = (
        config.data as FormData & {
          getParts: () => Array<{
            fieldName: string;
            uri: string;
            type: string;
            name: string;
          }>;
        }
      ).getParts();
      expect(parts).toHaveLength(1);
      expect(parts[0]).toMatchObject({
        fieldName: 'avatar',
        uri: image.uri,
        type: 'image/webp',
        name: 'selected.webp',
      });
      expect(config.headers.getContentType()).toBe('multipart/form-data');
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: {
          success: true,
          message: 'Avatar updated successfully.',
          data: { image_url: savedUrl },
        },
      };
    }
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data:
        config.method === 'get'
          ? { success: true, data: raw }
          : {
              success: true,
              message: 'Profile updated successfully.',
              data: {
                profile: raw,
                verification_required: false,
                reauthentication_required: false,
              },
            },
    };
  };
});
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  appConfig.profileApiVerified = flag;
  jest.restoreAllMocks();
});
test('real RN FormData carries avatar file, not a URI string or JSON body', async () => {
  await expect(uploadProfileAvatar(image)).resolves.toBe(savedUrl);
  expect(calls).toEqual(['post /customer/profile/avatar']);
});
test('photo-only Save uploads then refetches complete profile without an empty PUT', async () => {
  const result = await profileEditService.save(values, image, false, profile);
  expect(result.profile.avatarUrl).toBe(savedUrl);
  expect(calls).toEqual([
    'post /customer/profile/avatar',
    'get /customer/profile',
  ]);
});
test('combined text/photo Save uploads first and uses complete PUT response', async () => {
  const result = await profileEditService.save(
    { ...values, name: 'New Name' },
    image,
    false,
    profile,
  );
  expect(result.profile.avatarUrl).toBe(savedUrl);
  expect(calls).toEqual([
    'post /customer/profile/avatar',
    'put /customer/profile',
  ]);
});
test.each([false, true])(
  'guest/demo never uploads (%s)',
  async previewActive => {
    useAuthStore.getState().clear();
    useDevelopmentStore.setState({ previewActive });
    await expect(uploadProfileAvatar(image)).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(calls).toEqual([]);
  },
);
test('wrong image type or size never reaches Axios', async () => {
  await expect(
    uploadProfileAvatar({ ...image, fileSize: 2 * 1024 * 1024 + 1 }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(calls).toEqual([]);
});
test('unsafe original filename is replaced by a MIME-correct upload filename', async () => {
  const post = jest.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: {
      success: true,
      message: 'Avatar updated successfully.',
      data: { image_url: savedUrl },
    },
  });
  await uploadProfileAvatar({ ...image, fileName: '../photo.exe' });
  const body = post.mock.calls[0][1] as FormData & {
    getParts: () => Array<{ name: string; uri: string }>;
  };
  expect(body.getParts()[0]).toMatchObject({
    name: 'avatar.webp',
    uri: image.uri,
  });
});
test.each([401, 422, 403, 413, 500])(
  'HTTP %s cannot fabricate upload success',
  async status => {
    apiClient.defaults.adapter = async config => {
      throw new AxiosError('request failed', undefined, config, undefined, {
        status,
        statusText: 'Error',
        headers: new AxiosHeaders(),
        config,
        data: {
          message: 'Private server exception',
          errors: { avatar: ['Invalid avatar'] },
        },
      });
    };
    await expect(uploadProfileAvatar(image)).rejects.toMatchObject({ status });
  },
);
test('malformed or missing saved URL cannot succeed', async () => {
  jest.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: {
      success: true,
      message: 'Avatar updated successfully.',
      data: { image_url: null },
    },
  });
  await expect(uploadProfileAvatar(image)).rejects.toMatchObject({
    kind: 'unknown',
  });
});
test('late account-switch upload result is rejected', async () => {
  jest.spyOn(apiClient, 'post').mockImplementation(async () => {
    useAuthStore.getState().setUser({ ...member, id: 9 });
    return {
      status: 200,
      data: {
        success: true,
        message: 'Avatar updated successfully.',
        data: { image_url: savedUrl },
      },
    };
  });
  await expect(uploadProfileAvatar(image)).rejects.toMatchObject({
    kind: 'cancelled',
  });
});
test('successful upload followed by failed text save reports partial persistence', async () => {
  jest.spyOn(apiClient, 'put').mockRejectedValue(new Error('network failure'));
  await expect(
    profileEditService.save(
      { ...values, name: 'New Name' },
      image,
      false,
      profile,
    ),
  ).rejects.toBeInstanceOf(AvatarPartialSaveError);
});
test('combined email change uploads before the session is revoked', async () => {
  jest.spyOn(apiClient, 'put').mockImplementation(async () => {
    expect(calls).toEqual(['post /customer/profile/avatar']);
    calls.push('put /customer/profile');
    return {
      status: 200,
      data: {
        success: true,
        message: 'Profile updated. Verify your new email and sign in again.',
        data: {
          profile: {
            ...raw,
            email: 'changed@example.test',
            is_verified: false,
          },
          verification_required: true,
          reauthentication_required: true,
        },
      },
    };
  });
  const result = await profileEditService.save(
    { ...values, email: 'changed@example.test' },
    image,
    false,
    profile,
  );
  expect(result.reauthenticationRequired).toBe(true);
  expect(result.profile.avatarUrl).toBe(savedUrl);
  expect(useAuthStore.getState().status).toBe('guest');
  expect(calls).toEqual([
    'post /customer/profile/avatar',
    'put /customer/profile',
  ]);
});
