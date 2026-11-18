import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { Image } from 'react-native';
import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { ListingDetailsScreen } from '../src/features/listings/screens/ListingDetailsScreen';
import { RemoveListingImageConfirmation } from '../src/features/listings/components/RemoveListingImageConfirmation';
import { AppButton } from '../src/components/ui/AppButton';
import { useRemoveListingImage } from '../src/features/listings/hooks/useRemoveListingImage';
import { getOwnListingDetails } from '../src/features/listings/services/ownListingDetailsService';
import {
  loadListingEdit,
  editContext,
} from '../src/features/post-listing/services/updateListingService';
import { OwnListingRecord } from '../src/features/listings/types/myListingsApi.types';
import {
  createdListingRecord,
  referenceResponse,
  createListingDraft,
} from '../test/fixtures/createListing';
import { ApiError } from '../src/types/api';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
const custom =
    'https://media.example.test/frontend/img/listing/api_listing_123_original.jpg',
  placeholder = 'https://media.example.test/frontend/img/listing/listing.png';
let row: OwnListingRecord,
  verified: OwnListingRecord,
  tree: ReactTestRenderer,
  client: QueryClient,
  del: jest.SpyInstance,
  get: jest.SpyInstance;
let control: ReturnType<typeof useRemoveListingImage>;
const navigation = {
  setOptions: jest.fn(),
  getState: () => ({ routeNames: ['Listings'] }),
  canGoBack: () => true,
  goBack: jest.fn(),
  getParent: () => ({ navigate: jest.fn() }),
};
function Probe({
  record = verified,
  focused = true,
}: {
  record?: OwnListingRecord;
  focused?: boolean;
}) {
  control = useRemoveListingImage(record, focused);
  return null;
}
async function mount(element: React.ReactNode = <Probe />) {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>{element}</QueryClientProvider>,
    );
  });
}
async function details() {
  await mount(
    <ListingDetailsScreen
      navigation={navigation as never}
      route={{
        key: 'own',
        name: 'ListingDetails',
        params: { listingId: '123', returnTo: 'MyListings' },
      }}
    />,
  );
}
async function open() {
  await Renderer.act(async () => {
    tree.root
      .findAllByType(AppButton)
      .find(node => node.props.title === 'Remove uploaded image')!
      .props.onPress();
  });
}
async function action(title: string) {
  await Renderer.act(async () => {
    await tree.root
      .findByType(RemoveListingImageConfirmation)
      .findAllByType(AppButton)
      .find(node => node.props.title === title)!
      .props.onPress();
  });
}
beforeEach(async () => {
  jest.clearAllMocks();
  notifyManager.setScheduler(callback => callback());
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Owner', email: 'owner@example.test' });
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('image-delete-test-token');
  jest.spyOn(Toast, 'show').mockImplementation(() => {});
  row = {
    ...createdListingRecord,
    ad_type: 'Carring',
    status: 1,
    image_url: custom,
  };
  get = jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) =>
      String(url).startsWith('/customer/listings/')
        ? { status: 200, data: { success: true, message: 'Owned', data: row } }
        : referenceResponse(url, config),
    );
  del = jest.spyOn(apiClient, 'delete').mockImplementation(async () => {
    row = { ...row, image_url: placeholder };
    return {
      status: 200,
      data: {
        success: true,
        message: 'Removed',
        data: { image_url: placeholder },
      },
    };
  });
  verified = (await getOwnListingDetails('123')).backend;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
    useAuthStore.getState().clear();
  });
  notifyManager.setScheduler(callback => setTimeout(callback, 0));
  jest.restoreAllMocks();
});
test('owned server image shows exactly one unobtrusive action and original cover geometry', async () => {
  await details();
  const image = tree.root
    .findAllByType(Image)
    .find(node => node.props.source?.uri === custom)!;
  expect(image.props.resizeMode).toBe('cover');
  expect(image.props.style).toMatchObject({ width: '100%', height: '100%' });
  expect(
    tree.root
      .findAllByType(AppButton)
      .filter(node => node.props.title === 'Remove uploaded image'),
  ).toHaveLength(1);
  expect(
    tree.root.findByType(RemoveListingImageConfirmation).props.visible,
  ).toBe(false);
});
test('confirmation has exactly Cancel/Remove and Cancel calls no API', async () => {
  await details();
  const count = get.mock.calls.length;
  await open();
  const dialog = tree.root.findByType(RemoveListingImageConfirmation);
  expect(dialog.props.visible).toBe(true);
  expect(dialog.findAllByType(AppButton).map(node => node.props.title)).toEqual(
    ['Cancel', 'Remove'],
  );
  await action('Cancel');
  expect(del).not.toHaveBeenCalled();
  expect(get).toHaveBeenCalledTimes(count);
  expect(
    tree.root.findByType(RemoveListingImageConfirmation).props.visible,
  ).toBe(false);
});
test('Remove calls only image DELETE and refreshes default image with one success toast', async () => {
  const post = jest.spyOn(apiClient, 'post'),
    put = jest.spyOn(apiClient, 'put');
  await details();
  await open();
  await action('Remove');
  expect(del).toHaveBeenCalledTimes(1);
  expect(del.mock.calls[0][0]).toBe('/customer/listings/123/image');
  expect(post).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === custom),
  ).toBe(false);
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === placeholder),
  ).toBe(true);
  expect(Toast.show).toHaveBeenCalledTimes(1);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'success' }),
  );
  expect(row.status).toBe(1);
  expect(row.title).toBe(createdListingRecord.title);
});
test.each([null, placeholder])(
  'missing/default image %s has no server removal action',
  async image_url => {
    row = { ...row, image_url };
    await details();
    expect(
      tree.root
        .findAllByType(AppButton)
        .filter(node => node.props.title === 'Remove uploaded image'),
    ).toHaveLength(0);
  },
);
test('guest and unverified fixture record never enables action', async () => {
  await mount(<Probe record={{ ...verified }} />);
  expect(control.available).toBe(false);
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
  });
  expect(control.available).toBe(false);
  await Renderer.act(async () => {
    control.open();
    await control.confirm();
  });
  expect(del).not.toHaveBeenCalled();
});
test('definite failure retains authoritative cover and permits deliberate retry', async () => {
  del.mockRejectedValueOnce(new ApiError('Rejected', 'validation', 422));
  await details();
  await open();
  await action('Remove');
  expect(
    tree.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === custom),
  ).toBe(true);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error' }),
  );
  await open();
  await action('Remove');
  expect(del).toHaveBeenCalledTimes(2);
});
test('timeout keeps the image, blocks another attempt, and warns once', async () => {
  del.mockRejectedValueOnce(new ApiError('Timeout', 'network'));
  await mount();
  await Renderer.act(async () => {
    control.open();
  });
  await Renderer.act(async () => {
    await control.confirm();
  });
  expect(control.enabled).toBe(false);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'warning' }),
  );
  await Renderer.act(async () => {
    control.open();
    await control.confirm();
  });
  expect(del).toHaveBeenCalledTimes(1);
  expect(verified.image_url).toBe(custom);
});
test('double Remove handler calls produce one request while busy', async () => {
  await mount();
  await Renderer.act(async () => {
    control.open();
  });
  await Renderer.act(async () => {
    await Promise.all([control.confirm(), control.confirm()]);
  });
  expect(del).toHaveBeenCalledTimes(1);
});
test('logout during DELETE suppresses stale toast/cache resurrection', async () => {
  let resolve!: (value: unknown) => void;
  del.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await mount();
  await Renderer.act(async () => {
    control.open();
  });
  let pending!: Promise<void>;
  await Renderer.act(async () => {
    pending = control.confirm();
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
  });
  resolve({
    status: 200,
    data: {
      success: true,
      message: 'Removed',
      data: { image_url: placeholder },
    },
  });
  await Renderer.act(async () => {
    await pending;
  });
  expect(Toast.show).not.toHaveBeenCalled();
  expect(client.getQueryData(['ownListingDetails', 8, '123'])).toBeUndefined();
});
test('unmount cancels feedback and never automatically repeats deletion', async () => {
  let resolve!: (value: unknown) => void;
  del.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await mount();
  await Renderer.act(async () => {
    control.open();
  });
  let pending!: Promise<void>;
  await Renderer.act(async () => {
    pending = control.confirm();
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
  await Renderer.act(async () => {
    tree.unmount();
  });
  resolve({
    status: 200,
    data: {
      success: true,
      message: 'Removed',
      data: { image_url: placeholder },
    },
  });
  await Renderer.act(async () => {
    await pending;
  });
  expect(Toast.show).not.toHaveBeenCalled();
  expect(del).toHaveBeenCalledTimes(1);
});
test('cache invalidation is account scoped, preserves pages and Dashboard counts', async () => {
  const mine = ['myListings.read', 'user:8', 'active'],
    other = ['myListings.read', 'user:9', 'active'],
    dashboard = ['profileDashboard', 'user:8', 'summary'];
  client.setQueryData(mine, { pages: [{ id: 123 }], pageParams: [1] });
  client.setQueryData(other, { private: true });
  client.setQueryData(dashboard, {
    listings: { published: 3 },
    unread_messages: 5,
  });
  await mount();
  await Renderer.act(async () => {
    control.open();
  });
  await Renderer.act(async () => {
    await control.confirm();
  });
  expect(client.getQueryState(mine)?.isInvalidated).toBe(true);
  expect(client.getQueryState(other)?.isInvalidated).toBe(false);
  expect(client.getQueryData(mine)).toEqual({
    pages: [{ id: 123 }],
    pageParams: [1],
  });
  expect(client.getQueryState(dashboard)?.isInvalidated).toBe(false);
  expect(client.getQueryData(dashboard)).toEqual({
    listings: { published: 3 },
    unread_messages: 5,
  });
});
test('open editor image is refreshed without replacing edited values or diff snapshot', async () => {
  const context = await loadListingEdit('123');
  const snapshot = context.original;
  context.draft = { ...createListingDraft, title: 'Editing' };
  await mount();
  await Renderer.act(async () => {
    control.open();
  });
  await Renderer.act(async () => {
    await control.confirm();
  });
  expect(editContext('123')?.original.image_url).toBe(placeholder);
  expect(editContext('123')?.original.title).toBe(snapshot.title);
  expect(context.draft.title).toBe('Editing');
});
test('newer cached image is not overwritten by a delayed DELETE response', async () => {
  let resolve!: (value: unknown) => void;
  del.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  client.setQueryData(['ownListingDetails', 8, '123'], {
    backend: verified,
    coverImageUrl: custom,
  });
  await mount();
  await Renderer.act(async () => {
    control.open();
  });
  let pending!: Promise<void>;
  await Renderer.act(async () => {
    pending = control.confirm();
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
  const newer = 'https://media.example.test/newer.jpg';
  client.setQueryData(['ownListingDetails', 8, '123'], {
    backend: { ...verified, image_url: newer },
    coverImageUrl: newer,
  });
  resolve({
    status: 200,
    data: {
      success: true,
      message: 'Removed',
      data: { image_url: placeholder },
    },
  });
  await Renderer.act(async () => {
    await pending;
  });
  expect(client.getQueryData(['ownListingDetails', 8, '123'])).toMatchObject({
    coverImageUrl: newer,
  });
});
test('Cancel invalidates a previously captured Remove callback without an API call', async () => {
  await mount();
  await Renderer.act(async () => {
    control.open();
  });
  const stale = control.confirm;
  await Renderer.act(async () => {
    control.close();
    await stale();
  });
  expect(del).not.toHaveBeenCalled();
});
test('a changed image closes the old confirmation instead of deleting the new image', async () => {
  await mount();
  await Renderer.act(async () => {
    control.open();
  });
  row = { ...row, image_url: 'https://media.example.test/newer.jpg' };
  const latest = (await getOwnListingDetails('123')).backend;
  await Renderer.act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <Probe record={latest} />
      </QueryClientProvider>,
    );
  });
  expect(control.visible).toBe(false);
  await Renderer.act(async () => {
    await control.confirm();
  });
  expect(del).not.toHaveBeenCalled();
});
