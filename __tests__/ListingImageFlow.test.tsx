import type { ImagePickerResponse } from 'react-native-image-picker';
import React from 'react';
import { Image } from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { launchImageLibrary } from 'react-native-image-picker';
import Toast from 'react-native-toast-message';
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
import { useListingDraft } from '../src/features/post-listing/store/listingDraftStore';
import { useCreateListing } from '../src/features/post-listing/hooks/useCreateListing';
import { ListingReviewScreen } from '../src/features/post-listing/screens/ListingReviewScreen';
import {
  ListingImageInput,
  ListingImagePreview,
} from '../src/features/post-listing/components/ListingImageInput';
import { ApiError } from '../src/types/api';
import {
  createdListingRecord as row,
  createListingDraft as draft,
  referenceResponse,
  loadListingReferences,
} from '../test/fixtures/createListing';
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
const image = {
  uri: 'content://images/parcel',
  type: 'image/png',
  fileName: 'parcel.png',
  fileSize: 2000,
};
const savedUrl = 'https://media.example.test/frontend/img/listing/unique.jpg';
let tree: ReactTestRenderer,
  client: QueryClient,
  post: jest.SpyInstance,
  get: jest.SpyInstance;
let controller: ReturnType<typeof useCreateListing>;
const created = jest.fn();
function Probe({ focused = true }: { focused?: boolean }) {
  controller = useCreateListing(focused, created);
  return null;
}
const wrap = (node: React.ReactNode) => (
  <QueryClientProvider client={client}>{node}</QueryClientProvider>
);
async function mount(node: React.ReactNode = <Probe />) {
  await Renderer.act(async () => {
    tree = Renderer.create(wrap(node));
  });
}
async function press(label: string) {
  await Renderer.act(async () => {
    await tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
}
beforeEach(async () => {
  jest.clearAllMocks();
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  useListingDraft.getState().update({ ...draft, image });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('image-flow-token');
  jest
    .spyOn(Image, 'getSize')
    .mockImplementation(async () => ({ width: 2048, height: 1 }));
  jest.spyOn(Toast, 'show').mockImplementation(() => {});
  get = jest.spyOn(apiClient, 'get').mockImplementation(async (url, config) =>
    url === '/customer/listings/123'
      ? {
          status: 200,
          data: { success: true, message: 'Listing', data: row },
        }
      : referenceResponse(url, config),
  );
  post = jest.spyOn(apiClient, 'post').mockImplementation(async url =>
    url === '/customer/listings'
      ? {
          status: 201,
          data: { success: true, message: 'Created', data: row },
        }
      : {
          status: 200,
          data: {
            success: true,
            message: 'Image updated',
            data: { image_url: savedUrl },
          },
        },
  );
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await loadListingReferences();
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client.clear();
    useAuthStore.getState().clear();
  });
  jest.restoreAllMocks();
  jest.mocked(launchImageLibrary).mockReset();
});
test('confirmed 201 precedes multipart POST; image never enters Create JSON; one success and navigation', async () => {
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(post.mock.calls.map(([url]) => url)).toEqual([
    '/customer/listings',
    '/customer/listings/123/image',
  ]);
  expect(post.mock.calls[0][1]).not.toHaveProperty('image');
  expect(post.mock.calls[1][1]).toBeInstanceOf(FormData);
  expect(created).toHaveBeenCalledWith(123);
  expect(Toast.show).toHaveBeenCalledTimes(1);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'success',
      text1: 'Listing image uploaded successfully',
    }),
  );
  expect(useListingDraft.getState().imageRecovery).toBeUndefined();
  expect(useListingDraft.getState().values.title).toBe('');
});
test('no selected image retains original Create-only behavior', async () => {
  useListingDraft.getState().update({ ...draft });
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(post.mock.calls.map(([url]) => url)).toEqual(['/customer/listings']);
  expect(created).toHaveBeenCalledWith(123);
});
test.each([
  new ApiError('Rejected', 'validation', 422),
  new ApiError('Timeout', 'network'),
])(
  'creation failure or unknown outcome (%#) never uploads and preserves image',
  async error => {
    post.mockRejectedValueOnce(error);
    await mount();
    await Renderer.act(async () => controller.submit());
    expect(post).toHaveBeenCalledTimes(1);
    expect(useListingDraft.getState().values.image).toEqual(image);
    expect(useListingDraft.getState().imageRecovery).toBeUndefined();
    expect(created).not.toHaveBeenCalled();
  },
);
test('invalid image prevents creation and preserves local preview', async () => {
  useListingDraft
    .getState()
    .update({ ...draft, image: { ...image, fileSize: 2097153 } });
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(post).not.toHaveBeenCalled();
  expect(useListingDraft.getState().values.image?.fileSize).toBe(2097153);
});
test('definite upload failure retains real ID/image, Retry posts only image and cannot recreate listing', async () => {
  post.mockImplementation(async url => {
    if (url === '/customer/listings')
      return {
        status: 201,
        data: { success: true, message: 'Created', data: row },
      };
    throw new ApiError('Bad image', 'validation', 422);
  });
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(controller.recovery).toMatchObject({
    phase: 'failed',
    listing: { id: 123 },
    image,
  });
  expect(created).not.toHaveBeenCalled();
  expect(useListingDraft.getState().values.image).toEqual(image);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ text1: 'Listing created; image not uploaded' }),
  );
  await Renderer.act(async () => controller.submit());
  expect(post).toHaveBeenCalledTimes(2);
  post.mockResolvedValue({
    status: 200,
    data: { success: true, message: 'Saved', data: { image_url: savedUrl } },
  });
  await Renderer.act(async () => controller.retryImage());
  expect(post.mock.calls.map(([url]) => url)).toEqual([
    '/customer/listings',
    '/customer/listings/123/image',
    '/customer/listings/123/image',
  ]);
  expect(created).toHaveBeenCalledWith(123);
});
test('unknown upload reconciles owner GET but remains held without proof; remount never resubmits', async () => {
  post.mockImplementation(async url => {
    if (url === '/customer/listings')
      return {
        status: 201,
        data: { success: true, message: 'Created', data: row },
      };
    throw new ApiError('Timeout', 'network');
  });
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(controller.recovery).toMatchObject({
    phase: 'unknown',
    listing: { id: 123 },
    image,
    observedImageUrl: null,
  });
  expect(get).toHaveBeenCalledWith(
    '/customer/listings/123',
    expect.objectContaining({
      headers: { Authorization: 'Bearer image-flow-token' },
    }),
  );
  await Renderer.act(async () => tree.unmount());
  await mount();
  await Renderer.act(async () => {
    await controller.retryImage();
    await controller.submit();
  });
  expect(post).toHaveBeenCalledTimes(2);
  expect(created).not.toHaveBeenCalled();
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'warning',
      text1: 'Listing created; image status uncertain',
    }),
  );
});
test('a changed authoritative URL after lost response is not proof that this specific image was saved', async () => {
  get.mockImplementation(async (url, config) =>
    url === '/customer/listings/123'
      ? {
          status: 200,
          data: {
            success: true,
            message: 'Listing',
            data: { ...row, image_url: savedUrl },
          },
        }
      : referenceResponse(url, config),
  );
  post.mockImplementation(async url => {
    if (url === '/customer/listings')
      return {
        status: 201,
        data: { success: true, message: 'Created', data: row },
      };
    throw new ApiError('Lost', 'network');
  });
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(controller.recovery).toMatchObject({
    phase: 'unknown',
    observedImageUrl: savedUrl,
  });
  expect(created).not.toHaveBeenCalled();
});
test('cache synchronization refreshes My Listings, exact own details and remote public data without counter edits', async () => {
  const own = ['ownListingDetails', 8, '123'],
    mine = ['myListings.read', 'user:8', 'active'],
    publicKey = ['listingDetails', '123', 8],
    demoKey = ['listingDetails', '123', 'demo'],
    dashboard = ['profileDashboard', 'user:8', 'summary'];
  for (const key of [own, mine, publicKey, demoKey, dashboard])
    client.setQueryData(key, { untouched: true });
  const invalid = jest.spyOn(client, 'invalidateQueries');
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(client.getQueryState(own)?.isInvalidated).toBe(true);
  expect(client.getQueryState(mine)?.isInvalidated).toBe(true);
  expect(client.getQueryState(publicKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(demoKey)?.isInvalidated).toBe(false);
  expect(client.getQueryData(dashboard)).toEqual({ untouched: true });
  expect(
    invalid.mock.calls.filter(([q]) => q!.queryKey?.[0] === 'profileDashboard'),
  ).toHaveLength(1);
});
test('concurrent Retry and Submit blocked while upload remains pending', async () => {
  let resolve!: (value: unknown) => void;
  post.mockImplementation(async url =>
    url === '/customer/listings'
      ? { status: 201, data: { success: true, message: 'Created', data: row } }
      : new Promise(done => {
          resolve = done;
        }),
  );
  await mount();
  let first!: Promise<void>;
  await Renderer.act(async () => {
    first = controller.submit();
  });
  expect(controller.recovery?.phase).toBe('uploading');
  await Renderer.act(async () => {
    await controller.submit();
    await controller.retryImage();
  });
  expect(post).toHaveBeenCalledTimes(2);
  await Renderer.act(async () => {
    resolve({
      status: 200,
      data: { success: true, message: 'Saved', data: { image_url: savedUrl } },
    });
    await first;
  });
  expect(created).toHaveBeenCalledTimes(1);
});
test.each(['logout', 'account', 'blur', 'unmount'])(
  'upload completion after %s does not navigate or notify stale UI',
  async mode => {
    let resolve!: (value: unknown) => void;
    post.mockImplementation(async url =>
      url === '/customer/listings'
        ? {
            status: 201,
            data: { success: true, message: 'Created', data: row },
          }
        : new Promise(done => {
            resolve = done;
          }),
    );
    await mount();
    let first!: Promise<void>;
    await Renderer.act(async () => {
      first = controller.submit();
    });
    await Renderer.act(async () => {
      if (mode === 'logout') useAuthStore.getState().clear();
      if (mode === 'account')
        useAuthStore
          .getState()
          .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
      if (mode === 'blur') tree.update(wrap(<Probe focused={false} />));
      if (mode === 'unmount') tree.unmount();
    });
    await Renderer.act(async () => {
      resolve({
        status: 200,
        data: {
          success: true,
          message: 'Saved',
          data: { image_url: savedUrl },
        },
      });
      await first;
    });
    expect(created).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    if (mode === 'logout' || mode === 'account')
      expect(useListingDraft.getState().imageRecovery).toBeUndefined();
    else
      expect(useListingDraft.getState().imageRecovery?.phase).toBe('unknown');
  },
);
test('review retry control follows definite/uncertain state and keeps the created ID', async () => {
  post.mockImplementation(async url => {
    if (url === '/customer/listings')
      return {
        status: 201,
        data: { success: true, message: 'Created', data: row },
      };
    throw new ApiError('Reject', 'validation', 413);
  });
  await mount(
    <ListingReviewScreen
      route={{ key: 'review', name: 'ListingReview' }}
      navigation={
        {
          getParent: () => ({ navigate: created }),
          getState: () => ({ index: 1 }),
          goBack: jest.fn(),
        } as never
      }
    />,
  );
  await press('Create listing');
  const retry = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Retry image upload' &&
      node.props.onPress,
  )[0];
  expect(retry.props.disabled).toBe(false);
  post.mockRejectedValueOnce(new ApiError('Timeout', 'network'));
  await press('Retry image upload');
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Retry image upload' &&
        node.props.onPress,
    )[0].props.disabled,
  ).toBe(true);
  expect(
    post.mock.calls.filter(([url]) => url === '/customer/listings'),
  ).toHaveLength(1);
});
test('selection previews immediately, cancellation retains it and local Remove never calls DELETE', async () => {
  let value: typeof image | undefined;
  const change = jest.fn(next => {
    value = next;
    tree.update(wrap(<ListingImageInput value={value} onChange={change} />));
  });
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ assets: [image] });
  const remove = jest.spyOn(apiClient, 'delete');
  await mount(<ListingImageInput onChange={change} />);
  await press('Choose image');
  expect(tree.root.findByType(ListingImagePreview).props.uri).toBe(image.uri);
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ didCancel: true });
  await press('Choose image');
  expect(change).toHaveBeenCalledTimes(1);
  await press('Remove selected image');
  expect(value).toBeUndefined();
  expect(remove).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});
test('picker errors and invalid image preserve selected preview with existing Toast', async () => {
  const change = jest.fn();
  jest
    .mocked(launchImageLibrary)
    .mockResolvedValueOnce({ assets: [{ ...image, fileSize: 2097153 }] });
  await mount(<ListingImageInput value={image} onChange={change} />);
  await press('Choose image');
  expect(change).toHaveBeenCalledWith(
    expect.objectContaining({ fileSize: 2097153 }),
  );
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error' }),
  );
  expect(post).not.toHaveBeenCalled();
});
test('picker late response after account switch cannot restore another account image', async () => {
  let resolve!: (value: ImagePickerResponse) => void;
  const change = jest.fn();
  jest.mocked(launchImageLibrary).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await mount(<ListingImageInput onChange={change} />);
  let first!: Promise<void>;
  await Renderer.act(async () => {
    first = tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === 'Choose image' &&
          node.props.onPress,
      )[0]
      .props.onPress();
  });
  await Renderer.act(async () => useAuthStore.getState().clear());
  await Renderer.act(async () => {
    resolve({ assets: [image] });
    await first;
  });
  expect(change).not.toHaveBeenCalled();
  expect(Toast.show).not.toHaveBeenCalled();
});
