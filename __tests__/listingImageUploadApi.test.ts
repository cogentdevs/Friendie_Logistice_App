import type { OwnListingRecord } from '../src/features/listings/types/myListingsApi.types';
import type { InternalAxiosRequestConfig } from 'axios';
import { Image } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
// Match native bootstrap, before Axios captures the FormData constructor.
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
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { ApiError } from '../src/types/api';
import { createListing } from '../src/features/post-listing/services/createListingService';
import {
  uploadListingImage,
  listingImageAttempt,
} from '../src/features/post-listing/services/listingImageUploadService';
import {
  validateListingImage,
  selectedListingImage,
  chooseListingImage,
  ListingImage,
} from '../src/features/post-listing/services/listingImageSelection';
import {
  createdListingRecord as row,
  createListingDraft as draft,
  referenceResponse,
  loadListingReferences,
} from '../test/fixtures/createListing';
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
export const image: ListingImage = {
  uri: 'content://media/123',
  type: 'image/jpeg',
  fileName: 'parcel.jpg',
  fileSize: 2097152,
  width: 1,
  height: 1,
};
const savedUrl =
  'https://media.example.test/frontend/img/listing/api_listing_123_unique.jpg';
let post: jest.SpyInstance, record: OwnListingRecord;
beforeEach(async () => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Test', email: 'test@example.test' });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('image-test-token');
  jest
    .spyOn(Image, 'getSize')
    .mockImplementation(async () => ({ width: 2048, height: 2048 }));
  jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) => referenceResponse(url, config));
  await loadListingReferences();
  post = jest.spyOn(apiClient, 'post').mockResolvedValue({
    status: 201,
    data: { success: true, message: 'Created', data: row },
  });
  record = await createListing(draft);
  post.mockClear();
  post.mockResolvedValue({
    status: 200,
    data: {
      success: true,
      message: 'Listing image updated successfully.',
      data: { image_url: savedUrl },
    },
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(launchImageLibrary).mockReset();
  useAuthStore.getState().clear();
});
test.each(['image/jpeg', 'image/png', 'image/webp'])(
  'correct endpoint, real ID, Bearer and one multipart image part for %s',
  async type => {
    const fileName =
      type === 'image/jpeg'
        ? 'parcel.jpg'
        : type === 'image/png'
        ? 'parcel.png'
        : 'parcel.webp';
    expect(await uploadListingImage(record, { ...image, type, fileName })).toBe(
      savedUrl,
    );
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/customer/listings/123/image');
    expect(config.headers).toEqual({
      Authorization: 'Bearer image-test-token',
      'Content-Type': 'multipart/form-data',
    });
    expect(body).toBeInstanceOf(FormData);
    const parts = body.getParts();
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      fieldName: 'image',
      uri: image.uri,
      type,
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(record.status).toBe(0);
  },
);
test.each([
  'file:///data/cache/parcel.jpg',
  'content://media/asset',
  '/data/cache/parcel.jpg',
])('native local URI %s preserved or safely normalized', async uri => {
  const selected = selectedListingImage({ ...image, uri });
  expect((await validateListingImage(selected)).uri).toBe(
    uri.startsWith('/') ? 'file://' + uri : uri,
  );
});
test.each([
  'https://example.test/photo.jpg',
  'data:image/png;base64,abc',
  '',
  'content://bad\nname',
])('invalid URI %s rejects', async uri => {
  await expect(
    uploadListingImage(record, { ...image, uri }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(post).not.toHaveBeenCalled();
});
test.each([1, 2097152])('byte boundary %i accepted', async fileSize => {
  await expect(
    validateListingImage({ ...image, fileSize }),
  ).resolves.toHaveProperty('fileSize', fileSize);
});
test.each([0, -1, 2097153, NaN, Infinity, undefined])(
  'invalid/unknown file size (%#) never POSTs',
  async fileSize => {
    await expect(
      uploadListingImage(record, { ...image, fileSize }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(post).not.toHaveBeenCalled();
  },
);
test.each([
  'image/gif',
  'image/heic',
  'image/svg+xml',
  'video/mp4',
  '',
  'application/octet-stream',
])('unsupported actual MIME %s rejects even with jpg filename', async type => {
  await expect(
    uploadListingImage(record, { ...image, type }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(post).not.toHaveBeenCalled();
});
test.each([
  [1, 1],
  [2048, 2048],
  [1, 2048],
])('decoded dimension boundary %s accepted', async (width, height) => {
  jest
    .mocked(Image.getSize)
    .mockImplementation(async () => ({ width, height }));
  await expect(validateListingImage(image)).resolves.toMatchObject({
    width,
    height,
  });
});
test.each([
  [0, 1],
  [1, 0],
  [2049, 1],
  [1, 2049],
  [-1, 10],
  [NaN, 20],
  [2.5, 10],
])(
  'decoded invalid dimensions (%#) reject despite plausible picker metadata',
  async (width, height) => {
    jest
      .mocked(Image.getSize)
      .mockImplementation(async () => ({ width, height }));
    await expect(uploadListingImage(record, image)).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(post).not.toHaveBeenCalled();
  },
);
test('inaccessible native image rejects before POST and retains selected file', async () => {
  jest.mocked(Image.getSize).mockImplementationOnce(async () => {
    throw new Error('Not accessible');
  });
  await expect(uploadListingImage(record, image)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(listingImageAttempt(123)?.image).toEqual(image);
  expect(post).not.toHaveBeenCalled();
});
test('missing filename gets a safe supported filename, never fabricated contents', async () => {
  await uploadListingImage(record, { ...image, fileName: undefined });
  expect(post.mock.calls[0][1].getParts()[0]).toMatchObject({
    uri: image.uri,
    type: image.type,
    name: 'listing.jpg',
  });
});
test('unsupported provided extension is rejected', async () => {
  await expect(
    uploadListingImage(record, { ...image, fileName: 'parcel.gif' }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(post).not.toHaveBeenCalled();
});
test.each([400, 401, 403, 404, 409, 413, 415, 422, 429])(
  'HTTP %i definite rejection permits explicit image-only retry and no Create replay',
  async status => {
    post.mockRejectedValueOnce(new ApiError('Rejected', 'validation', status));
    await expect(uploadListingImage(record, image)).rejects.toMatchObject({
      status,
    });
    expect(listingImageAttempt(123)?.state).toBe('failed');
    await uploadListingImage(record, image);
    expect(post).toHaveBeenCalledTimes(2);
    expect(
      post.mock.calls.every(([url]) => url === '/customer/listings/123/image'),
    ).toBe(true);
  },
);
test.each([
  new ApiError('Timeout', 'network'),
  new ApiError('Network lost', 'network'),
  new ApiError('Server error', 'server', 500),
])(
  'ambiguous result (%#) retained and never auto/manual retried',
  async error => {
    post.mockRejectedValueOnce(error);
    await expect(uploadListingImage(record, image)).rejects.toBe(error);
    expect(listingImageAttempt(123)).toEqual({ state: 'unknown', image });
    await expect(uploadListingImage(record, image)).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(post).toHaveBeenCalledTimes(1);
  },
);
test.each([
  {
    status: 201,
    data: { success: true, message: 'OK', data: { image_url: savedUrl } },
  },
  {
    status: 200,
    data: { success: true, message: 'OK', data: { image_url: null } },
  },
  {
    status: 200,
    data: {
      success: true,
      message: 'OK',
      data: { image_url: 'file:///fake.jpg' },
    },
  },
  { status: 200, data: {} },
])('invalid response (%#) cannot fabricate upload success', async response => {
  post.mockResolvedValueOnce(response);
  await expect(uploadListingImage(record, image)).rejects.toMatchObject({
    kind: 'unknown',
  });
  expect(listingImageAttempt(123)?.state).toBe('unknown');
});
test.each([{ ...row }, { ...row, id: 900001 }, { ...row, id: 0 }])(
  'copied/fixture/unverified record (%#) cannot upload even with numeric ID',
  async listing => {
    await expect(
      uploadListingImage(listing as typeof record, image),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(post).not.toHaveBeenCalled();
  },
);
test('concurrent duplicate and confirmed replay rejected', async () => {
  let resolve!: (value: unknown) => void;
  post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const first = uploadListingImage(record, image);
  await expect(uploadListingImage(record, image)).rejects.toMatchObject({
    kind: 'validation',
  });
  await Promise.resolve();
  await Promise.resolve();
  resolve({
    status: 200,
    data: { success: true, message: 'OK', data: { image_url: savedUrl } },
  });
  await first;
  await expect(uploadListingImage(record, image)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(post).toHaveBeenCalledTimes(1);
});
test.each(['logout', 'account', 'token', 'abort'])(
  'late upload after %s never confirms for a stale session',
  async mode => {
    let resolve!: (value: unknown) => void;
    post.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    const abort = new AbortController(),
      first = uploadListingImage(record, image, abort.signal);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    if (mode === 'logout') useAuthStore.getState().clear();
    if (mode === 'account')
      useAuthStore
        .getState()
        .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
    if (mode === 'token')
      jest
        .mocked(secureStorage.getToken)
        .mockResolvedValue('replacement-token');
    if (mode === 'abort') abort.abort();
    resolve({
      status: 200,
      data: { success: true, message: 'OK', data: { image_url: savedUrl } },
    });
    await expect(first).rejects.toMatchObject({ kind: 'cancelled' });
    expect(listingImageAttempt(123)?.state).not.toBe('uploaded');
  },
);
test.each(['guest', 'demo'])('%s cannot upload', async () => {
  useAuthStore.getState().clear();
  await expect(uploadListingImage(record, image)).rejects.toMatchObject({
    status: 401,
  });
  expect(post).not.toHaveBeenCalled();
});
test('missing secure token rejects without POST', async () => {
  jest.mocked(secureStorage.getToken).mockResolvedValue(null);
  await expect(uploadListingImage(record, image)).rejects.toMatchObject({
    status: 401,
  });
  expect(post).not.toHaveBeenCalled();
});
test('real centralized Axios transform retains native multipart descriptor and explicit Bearer header', async () => {
  post.mockRestore();
  const original = apiClient.defaults.adapter;
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
    expect(config.method).toBe('post');
    expect(config.url).toBe('/customer/listings/123/image');
    expect(config.headers.Authorization).toBe('Bearer image-test-token');
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    expect(config.data).toBeInstanceOf(FormData);
    expect(config.data.getParts()).toHaveLength(1);
    expect(config.data.getParts()[0]).toMatchObject({
      fieldName: 'image',
      uri: image.uri,
      type: image.type,
    });
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: { success: true, message: 'Saved', data: { image_url: savedUrl } },
    };
  });
  apiClient.defaults.adapter = adapter;
  try {
    await expect(uploadListingImage(record, image)).resolves.toBe(savedUrl);
    expect(adapter).toHaveBeenCalledTimes(1);
  } finally {
    apiClient.defaults.adapter = original;
  }
});
test('gallery uses one native image, no Base64, cancel preserves prior selection', async () => {
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ assets: [image] });
  expect(await chooseListingImage()).toEqual(image);
  expect(launchImageLibrary).toHaveBeenCalledWith(
    expect.objectContaining({
      selectionLimit: 1,
      includeBase64: false,
      mediaType: 'photo',
    }),
  );
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ didCancel: true });
  expect(await chooseListingImage()).toBeUndefined();
});
test.each([{ errorCode: 'permission' }, { errorCode: 'others' }, {}])(
  'gallery failure (%#) reported safely',
  async response => {
    jest.mocked(launchImageLibrary).mockResolvedValueOnce(response as never);
    await expect(chooseListingImage()).rejects.toMatchObject({
      kind: 'validation',
    });
  },
);
