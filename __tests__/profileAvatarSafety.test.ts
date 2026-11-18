import { Image } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { ApiError } from '../src/types/api';
import {
  uploadProfileAvatar,
  avatarUploadRecovery,
  completeAvatarUpload,
  AvatarUploadUncertainError,
} from '../src/features/profile/services/profileAvatarService';
import {
  chooseProfilePhoto,
  validateAvatar,
} from '../src/features/profile/services/profilePhotoService';
import * as profiles from '../src/features/profile/services/profileService';
import { profileEditService } from '../src/features/profile/services/profileEditService';
const user = { id: 8, name: 'Test Member', email: 'test@example.test' };
const image = {
  uri: 'content://photos/new',
  type: 'image/png' as const,
  fileSize: 512,
  fileName: 'photo.png',
  width: 100,
  height: 100,
};
const baseline = { ...user, avatarUrl: 'https://example.test/old.jpg' };
const savedUrl = 'https://example.test/api_user_8_new.jpg';
const success = {
  status: 200,
  data: {
    success: true,
    message: 'Avatar updated successfully.',
    data: { image_url: savedUrl },
  },
};
let post: jest.SpiedFunction<typeof apiClient.post>;
beforeEach(() => {
  useAuthStore.getState().clear();
  useAuthStore.getState().setUser({ ...user });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('dummy-avatar-token');
  jest.spyOn(profiles, 'getProfile').mockResolvedValue(baseline);
  jest.spyOn(Image, 'getSize').mockImplementation((_uri, ok) => {
    ok?.(100, 200);
    return Promise.resolve({ width: 100, height: 200 });
  });
  post = jest.spyOn(apiClient, 'post').mockResolvedValue(success);
});
afterEach(() => {
  useAuthStore.getState().clear();
  jest.restoreAllMocks();
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
};
test('synchronous mutation lock blocks concurrent callers before token lookup completes', async () => {
  const wait = deferred<string>();
  jest.mocked(secureStorage.getToken).mockReturnValue(wait.promise);
  const first = uploadProfileAvatar(image);
  await expect(uploadProfileAvatar(image)).rejects.toMatchObject({
    kind: 'cancelled',
  });
  expect(post).not.toHaveBeenCalled();
  wait.resolve('dummy-avatar-token');
  await expect(first).resolves.toBe(savedUrl);
  expect(post).toHaveBeenCalledTimes(1);
});
test('confirmed upload is reused for partial-save recovery, never posted twice', async () => {
  await uploadProfileAvatar(image);
  await expect(uploadProfileAvatar(image)).resolves.toBe(savedUrl);
  expect(post).toHaveBeenCalledTimes(1);
  completeAvatarUpload(image);
  expect(avatarUploadRecovery()).toBeUndefined();
});
test('successful upload followed by a failed profile read retries GET only', async () => {
  const values = {
    name: user.name,
    email: user.email,
    phone: '',
    callingCountry: null,
  };
  jest
    .mocked(profiles.getProfile)
    .mockRejectedValueOnce(new ApiError('offline', 'network'));
  await expect(
    profileEditService.save(values, image, false, baseline),
  ).rejects.toMatchObject({ avatarUrl: savedUrl });
  jest
    .mocked(profiles.getProfile)
    .mockResolvedValue({ ...baseline, avatarUrl: savedUrl });
  await expect(
    profileEditService.save(values, image, false, baseline),
  ).resolves.toMatchObject({ profile: { avatarUrl: savedUrl } });
  expect(post).toHaveBeenCalledTimes(1);
});
test.each([400, 401, 403, 404, 409, 413, 415, 422, 429])(
  'HTTP %s is a definite rejection and allows deliberate retry',
  async status => {
    post.mockRejectedValueOnce(
      new ApiError('safe rejection', 'validation', status),
    );
    await expect(uploadProfileAvatar(image)).rejects.toMatchObject({ status });
    expect(avatarUploadRecovery()).toBeUndefined();
    await uploadProfileAvatar(image);
    expect(post).toHaveBeenCalledTimes(2);
  },
);
test.each(['timeout', 'network', 'server', 'invalid'] as const)(
  '%s holds draft and never automatically retries or infers success from a changed URL',
  async kind => {
    if (kind === 'invalid')
      post.mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: { image_url: null } },
      });
    else
      post.mockRejectedValueOnce(
        new ApiError(
          'unavailable',
          kind === 'server' ? 'server' : 'network',
          kind === 'server' ? 500 : undefined,
        ),
      );
    jest
      .mocked(profiles.getProfile)
      .mockResolvedValue({ ...baseline, avatarUrl: savedUrl });
    await expect(uploadProfileAvatar(image)).rejects.toBeInstanceOf(
      AvatarUploadUncertainError,
    );
    expect(avatarUploadRecovery()).toMatchObject({
      avatar: image,
      phase: 'unknown',
      observed: { avatarUrl: savedUrl },
    });
    await expect(
      uploadProfileAvatar({ ...image, uri: 'file:///different.png' }),
    ).rejects.toBeInstanceOf(AvatarUploadUncertainError);
    expect(post).toHaveBeenCalledTimes(1);
    expect(profiles.getProfile).toHaveBeenCalledTimes(1);
  },
);
test('reconciliation failure retains the unknown hold', async () => {
  post.mockRejectedValue(new ApiError('timeout', 'network'));
  jest
    .mocked(profiles.getProfile)
    .mockRejectedValue(new ApiError('offline', 'network'));
  await expect(uploadProfileAvatar(image)).rejects.toBeInstanceOf(
    AvatarUploadUncertainError,
  );
  expect(avatarUploadRecovery()?.phase).toBe('unknown');
  await expect(uploadProfileAvatar(image)).rejects.toBeInstanceOf(
    AvatarUploadUncertainError,
  );
  expect(post).toHaveBeenCalledTimes(1);
});
test.each(['logout', 'switch', 'token', 'navigate'] as const)(
  '%s prevents a late upload result from becoming authoritative',
  async action => {
    const wait = deferred<typeof success>();
    post.mockReturnValue(wait.promise);
    const controller = new AbortController();
    const pending = uploadProfileAvatar(image, controller.signal);
    await Promise.resolve();
    if (action === 'logout') useAuthStore.getState().clear();
    if (action === 'switch')
      useAuthStore.getState().setUser({ ...user, id: 99 });
    if (action === 'token')
      jest
        .mocked(secureStorage.getToken)
        .mockResolvedValue('replacement-token');
    if (action === 'navigate') controller.abort();
    wait.resolve(success);
    await expect(pending).rejects.toMatchObject({
      kind: action === 'token' ? 'unknown' : 'cancelled',
    });
    if (action === 'logout' || action === 'switch')
      expect(avatarUploadRecovery()).toBeUndefined();
    else expect(avatarUploadRecovery()?.phase).toBe('unknown');
  },
);
test('aborted request before dispatch cannot reach Axios', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    uploadProfileAvatar(image, controller.signal),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  expect(post).not.toHaveBeenCalled();
});
test.each([null, '', 'bad token'])(
  'missing/invalid secure token %s never uploads',
  async token => {
    jest.mocked(secureStorage.getToken).mockResolvedValue(token);
    await expect(uploadProfileAvatar(image)).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(post).not.toHaveBeenCalled();
  },
);
test.each(['file:///selected.png', 'content://photos/selected'])(
  'picker decodes %s without rewriting its URI or inventing size',
  async uri => {
    jest
      .mocked(launchImageLibrary)
      .mockResolvedValueOnce({ assets: [{ uri, type: 'image/png' }] });
    await expect(chooseProfilePhoto('gallery')).resolves.toMatchObject({
      uri,
      width: 100,
      height: 200,
      fileSize: undefined,
    });
    expect(Image.getSize).toHaveBeenCalledWith(
      uri,
      expect.any(Function),
      expect.any(Function),
    );
  },
);
test('unreadable image is rejected before it becomes the selected preview', async () => {
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ assets: [image] });
  jest.mocked(Image.getSize).mockImplementationOnce((_uri, _ok, fail) => {
    fail?.(new Error('private decoder path'));
    return Promise.resolve({ width: 0, height: 0 });
  });
  await expect(chooseProfilePhoto('gallery')).rejects.toThrow(
    'could not be opened',
  );
  expect(post).not.toHaveBeenCalled();
});
test('decoded dimensions override untrusted small picker metadata', async () => {
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ assets: [image] });
  jest.mocked(Image.getSize).mockImplementationOnce((_uri, ok) => {
    ok?.(2049, 1);
    return Promise.resolve({ width: 2049, height: 1 });
  });
  await expect(chooseProfilePhoto('gallery')).rejects.toThrow('2048');
});
test.each([1, 2048])('accepts dimension boundary %s', dimension => {
  expect(
    validateAvatar({ ...image, width: dimension, height: dimension }),
  ).toMatchObject({ width: dimension });
});
test.each([0, 2049, Number.NaN, Number.POSITIVE_INFINITY])(
  'rejects invalid dimension %s',
  width => {
    expect(() => validateAvatar({ ...image, width })).toThrow();
  },
);
test.each(['image/gif', 'image/heic', 'image/svg+xml', undefined])(
  'rejects unsupported or missing MIME %s',
  type => {
    expect(() => validateAvatar({ ...image, type })).toThrow();
  },
);
test('picker cancellation does not decode or upload', async () => {
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ didCancel: true });
  expect(await chooseProfilePhoto('gallery')).toBeUndefined();
  expect(Image.getSize).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test.each([
  ['https://example.test/old.jpg', 'unchanged'],
  [savedUrl, 'changed'],
  [undefined, 'unavailable'],
] as const)(
  'compares the authoritative snapshot %s without removing the unknown hold',
  async (avatarUrl, comparison) => {
    post.mockRejectedValueOnce(new ApiError('timeout', 'network'));
    jest
      .mocked(profiles.getProfile)
      .mockResolvedValue({ ...baseline, avatarUrl });
    await expect(
      uploadProfileAvatar(image, undefined, baseline.avatarUrl),
    ).rejects.toBeInstanceOf(AvatarUploadUncertainError);
    expect(avatarUploadRecovery()).toMatchObject({
      previousUrl: baseline.avatarUrl,
      comparison,
      phase: 'unknown',
    });
    expect(post).toHaveBeenCalledTimes(1);
  },
);
