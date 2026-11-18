import { Image } from 'react-native';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { ApiError } from '../src/types/api';
import { getOwnListingDetails } from '../src/features/listings/services/ownListingDetailsService';
import {
  removeListingImage,
  canRemoveListingImage,
  hasUploadedListingImage,
} from '../src/features/listings/services/listingImageDeleteService';
import {
  acquireListingImage,
  listingImageOperation,
} from '../src/features/post-listing/services/listingImageOperations';
import { uploadListingImage } from '../src/features/post-listing/services/listingImageUploadService';
import { createListing } from '../src/features/post-listing/services/createListingService';
import { useListingDraft } from '../src/features/post-listing/store/listingDraftStore';
import {
  createdListingRecord,
  createListingDraft,
  referenceResponse,
  loadListingReferences,
} from '../test/fixtures/createListing';
import { OwnListingRecord } from '../src/features/listings/types/myListingsApi.types';
const custom =
    'https://media.example.test/frontend/img/listing/api_listing_123_original.jpg',
  placeholder = 'https://media.example.test/frontend/img/listing/listing.png';
const record: OwnListingRecord = {
  ...createdListingRecord,
  ad_type: 'Carring',
  status: 1,
  image_url: custom,
};
const success = (image_url: string | null = placeholder) => ({
  status: 200,
  data: {
    success: true,
    message: 'Listing image removed successfully.',
    data: { image_url },
  },
});
let get: jest.SpyInstance,
  del: jest.SpyInstance,
  post: jest.SpyInstance,
  own: OwnListingRecord;
beforeEach(async () => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Image owner', email: 'owner@example.test' });
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('image-delete-test-token');
  get = jest.spyOn(apiClient, 'get').mockImplementation(async (url, config) =>
    String(url).startsWith('/customer/listings/')
      ? {
          status: 200,
          data: { success: true, message: 'Owned', data: record },
        }
      : referenceResponse(url, config),
  );
  del = jest.spyOn(apiClient, 'delete').mockResolvedValue(success());
  post = jest
    .spyOn(apiClient, 'post')
    .mockRejectedValue(new Error('Unexpected POST'));
  own = (await getOwnListingDetails('123')).backend;
});
afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.getState().clear();
});
test('exact authenticated image DELETE, no body/query/listing DELETE/POST/PUT', async () => {
  const put = jest.spyOn(apiClient, 'put');
  expect(await removeListingImage(own)).toEqual({
    imageUrl: placeholder,
    reconciled: false,
  });
  expect(del).toHaveBeenCalledTimes(1);
  expect(del).toHaveBeenCalledWith('/customer/listings/123/image', {
    signal: undefined,
    headers: { Authorization: 'Bearer image-delete-test-token' },
  });
  expect(post).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
  expect(listingImageOperation(123)?.state).toBe('deleted');
});
test.each([0, 1, 2] as const)(
  'status %s owner detail is eligible without status mutation',
  async status => {
    get.mockResolvedValue({
      status: 200,
      data: { success: true, message: 'Owned', data: { ...record, status } },
    });
    const row = (await getOwnListingDetails('123')).backend;
    expect(canRemoveListingImage(row)).toBe(true);
    await removeListingImage(row);
    expect(row.status).toBe(status);
  },
);
test.each([null, placeholder])(
  'no custom image %s never enables DELETE',
  async image_url => {
    get.mockResolvedValue({
      status: 200,
      data: { success: true, message: 'Owned', data: { ...record, image_url } },
    });
    const row = (await getOwnListingDetails('123')).backend;
    expect(hasUploadedListingImage(row)).toBe(false);
    await expect(removeListingImage(row)).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(del).not.toHaveBeenCalled();
  },
);
test('numeric fixture/clone cannot authorize deletion', async () => {
  await expect(removeListingImage({ ...own })).rejects.toMatchObject({
    kind: 'validation',
  });
  await expect(removeListingImage(record)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(del).not.toHaveBeenCalled();
});
test('guest/demo session cannot delete an old verified record', async () => {
  useAuthStore.getState().clear();
  await expect(removeListingImage(own)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(del).not.toHaveBeenCalled();
});
test('fresh preflight rejects a changed image instead of deleting it', async () => {
  get.mockResolvedValue({
    status: 200,
    data: {
      success: true,
      message: 'Owned',
      data: { ...record, image_url: 'https://media.example.test/newer.jpg' },
    },
  });
  await expect(removeListingImage(own)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(del).not.toHaveBeenCalled();
  expect(listingImageOperation(123)).toBeUndefined();
});
test('double taps and remount-like duplicate calls result in one DELETE', async () => {
  let resolve!: (value: unknown) => void;
  del.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const first = removeListingImage(own);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await expect(removeListingImage(own)).rejects.toMatchObject({
    kind: 'validation',
  });
  resolve(success());
  await first;
  expect(del).toHaveBeenCalledTimes(1);
  await expect(removeListingImage(own)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(del).toHaveBeenCalledTimes(1);
});
test.each([400, 401, 403, 404, 409, 422, 429])(
  'HTTP %s definite rejection releases guard and preserves image',
  async status => {
    del.mockRejectedValueOnce(new ApiError('Rejected', 'validation', status));
    await expect(removeListingImage(own)).rejects.toMatchObject({ status });
    expect(own.image_url).toBe(custom);
    expect(listingImageOperation(123)).toBeUndefined();
    await removeListingImage(own);
    expect(del).toHaveBeenCalledTimes(2);
  },
);
test.each([
  new ApiError('Timeout', 'network'),
  new ApiError('Server', 'server', 500),
])(
  'ambiguous failure holds retry without assuming image remained',
  async error => {
    del.mockRejectedValueOnce(error);
    await expect(removeListingImage(own)).rejects.toBe(error);
    expect(listingImageOperation(123)?.state).toBe('unknown');
    await expect(removeListingImage(own)).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(del).toHaveBeenCalledTimes(1);
    expect(own.image_url).toBe(custom);
  },
);
test('timeout followed by authoritative placeholder resolves absence without another DELETE', async () => {
  del.mockImplementationOnce(async () => {
    get.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        message: 'Owned',
        data: { ...record, image_url: placeholder },
      },
    });
    throw new ApiError('Timeout', 'network');
  });
  expect(await removeListingImage(own)).toEqual({
    imageUrl: placeholder,
    reconciled: true,
  });
  expect(del).toHaveBeenCalledTimes(1);
});
test('null reconciliation is inconclusive, not proof of removal', async () => {
  del.mockImplementationOnce(async () => {
    get.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        message: 'Owned',
        data: { ...record, image_url: null },
      },
    });
    throw new ApiError('Timeout', 'network');
  });
  await expect(removeListingImage(own)).rejects.toMatchObject({
    kind: 'network',
  });
  expect(listingImageOperation(123)?.state).toBe('unknown');
});
test.each([
  { status: 204, data: undefined },
  { status: 200, data: {} },
  success(custom),
])('unexpected response is not success', async response => {
  del.mockResolvedValueOnce(response);
  await expect(removeListingImage(own)).rejects.toMatchObject({
    kind: 'unknown',
  });
  expect(listingImageOperation(123)?.state).toBe('unknown');
});
test('HTTP200 null placeholder resolution is accepted from a confirmed DELETE only', async () => {
  del.mockResolvedValueOnce(success(null));
  expect(await removeListingImage(own)).toEqual({
    imageUrl: null,
    reconciled: false,
  });
});
test.each(['logout', 'account'] as const)(
  '%s prevents late deletion result from touching new session',
  async kind => {
    let resolve!: (value: unknown) => void;
    del.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    const pending = removeListingImage(own);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    if (kind === 'logout') useAuthStore.getState().clear();
    else
      useAuthStore
        .getState()
        .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
    resolve(success());
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
    expect(listingImageOperation(123)).toBeUndefined();
  },
);
test('token rotation prevents response confirmation through another token', async () => {
  del.mockImplementationOnce(async () => {
    jest.spyOn(secureStorage, 'getToken').mockResolvedValue('rotated-token');
    return success();
  });
  await expect(removeListingImage(own)).rejects.toMatchObject({
    kind: 'cancelled',
  });
  expect(listingImageOperation(123)?.state).toBe('unknown');
});
test('abort before dispatch never deletes', async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(removeListingImage(own, abort.signal)).rejects.toMatchObject({
    kind: 'cancelled',
  });
  expect(del).not.toHaveBeenCalled();
});
test.each(['pending', 'unknown'] as const)(
  'upload %s blocks deletion synchronously',
  async state => {
    const finish = acquireListingImage(123, 'upload');
    if (state === 'unknown') finish('unknown');
    await expect(removeListingImage(own)).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(del).not.toHaveBeenCalled();
  },
);
test.each(['ready', 'uploading', 'failed', 'unknown'] as const)(
  'retained upload recovery %s is preserved and blocks deletion',
  async phase => {
    const recovery = {
      listing: own,
      image: { uri: 'file:///image.jpg', type: 'image/jpeg' },
      draft: createListingDraft,
      phase,
    };
    useListingDraft.getState().recoverImage(recovery);
    await expect(removeListingImage(own)).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(useListingDraft.getState().imageRecovery).toBe(recovery);
    expect(del).not.toHaveBeenCalled();
  },
);
test('a pending deletion blocks an image-only upload attempt', async () => {
  await loadListingReferences();
  post.mockResolvedValueOnce({
    status: 201,
    data: { success: true, message: 'Created', data: createdListingRecord },
  });
  const created = await createListing(createListingDraft);
  const finish = acquireListingImage(123, 'delete');
  await expect(
    uploadListingImage(created, {
      uri: 'file:///test.jpg',
      type: 'image/jpeg',
      fileSize: 10,
    }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(post).toHaveBeenCalledTimes(1);
  finish('release');
});
test('an in-flight actual upload blocks DELETE, without altering its payload', async () => {
  await loadListingReferences();
  post.mockResolvedValueOnce({
    status: 201,
    data: { success: true, message: 'Created', data: createdListingRecord },
  });
  const created = await createListing(createListingDraft);
  jest
    .spyOn(Image, 'getSize')
    .mockImplementation(async () => ({ width: 100, height: 100 }));
  let resolve!: (value: unknown) => void;
  post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const uploading = uploadListingImage(created, {
    uri: 'file:///test.jpg',
    type: 'image/jpeg',
    fileSize: 10,
  });
  for (let i = 0; i < 15; i++) await Promise.resolve();
  await expect(removeListingImage(own)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(del).not.toHaveBeenCalled();
  resolve({
    status: 200,
    data: { success: true, message: 'Uploaded', data: { image_url: custom } },
  });
  await uploading;
});
test('a newly uploaded authoritative image can be removed after a prior confirmed deletion', async () => {
  await removeListingImage(own);
  const replacement =
    'https://media.example.test/frontend/img/listing/api_listing_123_replacement.jpg';
  get.mockResolvedValue({
    status: 200,
    data: {
      success: true,
      message: 'Owned',
      data: { ...record, image_url: replacement },
    },
  });
  const newer = (await getOwnListingDetails('123')).backend;
  expect(canRemoveListingImage(newer)).toBe(true);
  await removeListingImage(newer);
  expect(del).toHaveBeenCalledTimes(2);
});
