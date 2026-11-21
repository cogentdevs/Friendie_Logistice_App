import {
  profileEditService,
  profileCallingCountry,
} from '../src/features/profile/services/profileEditService';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { ApiError } from '../src/types/api';
const member = { id: 8, name: 'Member', email: 'member@example.test' };
const profile = {
  ...member,
  phone: '+923001234567',
  countryId: 179,
  countryCode: 'PK',
  verified: true,
};
const values = {
  name: 'New Member',
  email: member.email,
  phone: profile.phone,
  callingCountry: 'PK' as const,
};
const raw = {
  ...member,
  name: 'New Member',
  phone: profile.phone,
  country_id: 179,
  country: { id: 179, name: 'Pakistan', short_name: 'PK' },
  image_url: null,
  is_verified: true,
  email_verified_at: null,
};
const accepted = (emailChanged = false) => ({
  status: 200,
  data: {
    success: true,
    message: emailChanged
      ? 'Profile updated. Verify your new email and sign in again.'
      : 'Profile updated successfully.',
    data: {
      profile: emailChanged
        ? { ...raw, email: 'changed@example.test', is_verified: false }
        : raw,
      verification_required: emailChanged,
      reauthentication_required: emailChanged,
    },
  },
});
beforeEach(() => {
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('profile-update-token');
  jest
    .spyOn(secureStorage, 'removeTokenIfCurrent')
    .mockImplementation(async (_token, current) => current());
});
afterEach(() => jest.restoreAllMocks());
test('PUT sends changed fields only with real Bearer and returns normalized complete profile', async () => {
  const put = jest.spyOn(apiClient, 'put').mockResolvedValue(accepted());
  const result = await profileEditService.save(
    values,
    undefined,
    false,
    profile,
  );
  expect(put).toHaveBeenCalledWith(
    '/customer/profile',
    { name: 'New Member' },
    expect.objectContaining({
      headers: { Authorization: 'Bearer profile-update-token' },
    }),
  );
  expect(result.profile).toMatchObject({
    id: 8,
    name: 'New Member',
    countryId: 179,
    countryCode: 'PK',
    avatarUrl: null,
    verified: true,
  });
  expect(result.reauthenticationRequired).toBe(false);
  expect(useAuthStore.getState().user).toBe(member);
  expect(secureStorage.removeTokenIfCurrent).not.toHaveBeenCalled();
});
test('phone and selected country use existing verified country IDs', async () => {
  const put = jest.spyOn(apiClient, 'put').mockResolvedValue(accepted());
  await profileEditService.save(
    {
      ...values,
      name: member.name,
      phone: '+971501234567',
      callingCountry: 'AE',
    },
    undefined,
    false,
    profile,
  );
  expect(put).toHaveBeenCalledWith(
    '/customer/profile',
    { phone: '+971501234567', country_id: 2 },
    expect.anything(),
  );
  expect(
    profileCallingCountry({
      ...profile,
      countryId: 235,
      countryCode: 'US',
      phone: '+12025550123',
    }),
  ).toBe('US');
});
test('email change clears revoked credentials and requires verification without Logout API', async () => {
  jest.spyOn(apiClient, 'put').mockResolvedValue(accepted(true));
  const post = jest.spyOn(apiClient, 'post');
  const result = await profileEditService.save(
    { ...values, email: 'changed@example.test' },
    undefined,
    false,
    profile,
  );
  expect(result).toMatchObject({
    reauthenticationRequired: true,
    verificationRequired: true,
    profile: { verified: false },
  });
  expect(useAuthStore.getState().status).toBe('guest');
  expect(secureStorage.removeTokenIfCurrent).toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});
test.each([
  'network',
  'validation',
  'forbidden',
  'rate-limit',
  'server',
  'unknown',
] as const)('%s failure preserves session', async kind => {
  jest
    .spyOn(apiClient, 'put')
    .mockRejectedValue(new ApiError('private server details', kind));
  await expect(
    profileEditService.save(values, undefined, false, profile),
  ).rejects.toMatchObject({ kind });
  expect(useAuthStore.getState().user).toBe(member);
  expect(secureStorage.removeTokenIfCurrent).not.toHaveBeenCalled();
});
test.each([false, true])(
  'guest/demo is never sent to backend (%s)',
  async previewActive => {
    useAuthStore.getState().clear();
    useDevelopmentStore.setState({ previewActive });
    const put = jest.spyOn(apiClient, 'put');
    await expect(
      profileEditService.save(values, undefined, false, profile),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(put).not.toHaveBeenCalled();
  },
);
test('conflicting photo changes and untouched fields never submit', async () => {
  const put = jest.spyOn(apiClient, 'put');
  await expect(
    profileEditService.save(
      values,
      { uri: 'content://test', type: 'image/png', fileSize: 100 },
      true,
      profile,
    ),
  ).rejects.toThrow('Choose either');
  await expect(
    profileEditService.save(
      { ...values, name: member.name },
      undefined,
      false,
      profile,
    ),
  ).rejects.toThrow('No supported');
  expect(put).not.toHaveBeenCalled();
});
test('malformed/wrong owner response cannot create success', async () => {
  const response = accepted();
  response.data.data.profile = { ...response.data.data.profile, id: 9 };
  jest.spyOn(apiClient, 'put').mockResolvedValue(response);
  await expect(
    profileEditService.save(values, undefined, false, profile),
  ).rejects.toMatchObject({ kind: 'unknown' });
});
test('late old-account response cannot affect replacement session', async () => {
  jest.spyOn(apiClient, 'put').mockImplementation(async () => {
    useAuthStore.getState().setUser({ ...member, id: 9 });
    return accepted();
  });
  await expect(
    profileEditService.save(values, undefined, false, profile),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  expect(useAuthStore.getState().user?.id).toBe(9);
});
test('token replacement or cancelled navigation prevents stale update consumption', async () => {
  jest.spyOn(apiClient, 'put').mockResolvedValue(accepted());
  jest
    .mocked(secureStorage.getToken)
    .mockResolvedValueOnce('profile-update-token')
    .mockResolvedValueOnce('replacement-token');
  await expect(
    profileEditService.save(values, undefined, false, profile),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  const controller = new AbortController();
  controller.abort();
  await expect(
    profileEditService.save(
      values,
      undefined,
      false,
      profile,
      controller.signal,
    ),
  ).rejects.toMatchObject({ kind: 'cancelled' });
});
test('rapid repeated save cannot issue duplicate PUT requests', async () => {
  let finish!: (value: ReturnType<typeof accepted>) => void;
  const put = jest.spyOn(apiClient, 'put').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const first = profileEditService.save(values, undefined, false, profile);
  await Promise.resolve();
  await expect(
    profileEditService.save(values, undefined, false, profile),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  finish(accepted());
  await first;
  expect(put).toHaveBeenCalledTimes(1);
});
test('logout during PUT prevents late profile result consumption', async () => {
  jest.spyOn(apiClient, 'put').mockImplementation(async () => {
    useAuthStore.getState().clear();
    return accepted();
  });
  await expect(
    profileEditService.save(values, undefined, false, profile),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  expect(useAuthStore.getState().status).toBe('guest');
});
test('untouched missing contact fields are omitted during a name-only update', async () => {
  const put = jest.spyOn(apiClient, 'put').mockResolvedValue(accepted());
  await profileEditService.save(
    { ...values, phone: '', callingCountry: null },
    undefined,
    false,
    { ...profile, phone: null, countryId: null, countryCode: null },
  );
  expect(put).toHaveBeenCalledWith(
    '/customer/profile',
    { name: 'New Member' },
    expect.anything(),
  );
});
