import React from 'react';
import { TextInput } from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useListingDraft } from '../src/features/post-listing/store/listingDraftStore';
import { useCreateListing } from '../src/features/post-listing/hooks/useCreateListing';
import { ListingLocationPicker } from '../src/features/post-listing/components/ListingLocationPicker';
import { ListingReviewScreen } from '../src/features/post-listing/screens/ListingReviewScreen';
import { navigationRef } from '../src/navigation/navigationRef';
import { useMyListingsTabs } from '../src/features/listings/store/myListingsStore';
import { getMyListings } from '../src/features/listings/services/myListingsService';
import {
  createListing,
  listingSubmission,
} from '../src/features/post-listing/services/createListingService';
import { ApiError } from '../src/types/api';
import * as authFlow from '../src/features/auth/services/authFlowCoordinator';
import * as development from '../src/store/developmentStore';
import {
  createListingDraft as draft,
  createdListingRecord as record,
  referenceResponse,
  loadListingReferences,
} from '../test/fixtures/createListing';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));

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
function wrap(element: React.ReactNode) {
  return <QueryClientProvider client={client}>{element}</QueryClientProvider>;
}
async function mount(element: React.ReactNode = <Probe />) {
  await Renderer.act(async () => {
    tree = Renderer.create(wrap(element));
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
async function flush() {
  await Renderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
beforeEach(async () => {
  notifyManager.setScheduler(callback => {
    Promise.resolve().then(callback);
  });
  jest.clearAllMocks();
  jest.spyOn(Toast, 'show').mockImplementation(() => {});
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  useListingDraft.getState().update({ ...draft });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('listing-test-token');
  get = jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) => referenceResponse(url, config));
  post = jest.spyOn(apiClient, 'post').mockResolvedValue({
    status: 201,
    data: { success: true, message: 'Created', data: record },
  });
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
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
  notifyManager.setScheduler(callback => setTimeout(callback, 0));
});

test('201 invalidates only real account My Listings and Dashboard summary, clears submitted draft and emits one success', async () => {
  const listingsKey = ['myListings.read', 'user:8', 'active'];
  const summaryKey = ['profileDashboard', 'user:8', 'summary'];
  const reviewsKey = ['reviews', 'user:8'];
  client.setQueryData(listingsKey, {
    pages: [{ data: [], meta: { current_page: 1 } }],
    pageParams: [1],
  });
  client.setQueryData(summaryKey, {
    unread_messages: 3,
    reviews_received: 5,
    listings: { published: 2 },
  });
  client.setQueryData(reviewsKey, { total: 5 });
  const invalidate = jest.spyOn(client, 'invalidateQueries'),
    cancel = jest.spyOn(client, 'cancelQueries');
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(invalidate.mock.calls.map(([options]) => options!.queryKey)).toEqual([
    ['myListings.read', 'user:8'],
    summaryKey,
  ]);
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(client.getQueryState(listingsKey)?.isInvalidated).toBe(true);
  expect(client.getQueryData(summaryKey)).toEqual({
    unread_messages: 3,
    reviews_received: 5,
    listings: { published: 2 },
  });
  expect(client.getQueryState(reviewsKey)?.isInvalidated).toBe(false);
  expect(useListingDraft.getState().values.title).toBe('');
  expect(created).toHaveBeenCalledWith(123);
  expect(Toast.show).toHaveBeenCalledTimes(1);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'success',
      text2: 'Your listing is Pending approval.',
    }),
  );
});
test('explicit Create submits Pending, selects All and opens existing My Listings without polluting public Details', async () => {
  const navigate = jest.fn();
  jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
  const ownerNavigate = jest
    .spyOn(navigationRef, 'navigate')
    .mockImplementation(() => {});
  useMyListingsTabs.getState().select('user:8', 'active');
  await mount(
    <ListingReviewScreen
      route={{ key: 'review', name: 'ListingReview' }}
      navigation={
        {
          getParent: () => ({ navigate }),
          getState: () => ({ index: 1 }),
          goBack: jest.fn(),
        } as never
      }
    />,
  );
  expect(post).not.toHaveBeenCalled();
  await press('Create listing');
  expect(post).toHaveBeenCalledTimes(1);
  expect(ownerNavigate).toHaveBeenCalledWith('AppDrawer', {
    screen: 'MyListings',
  });
  expect(useMyListingsTabs.getState().tabs['user:8']).toBe('all');
  expect(navigate).not.toHaveBeenCalled();
});
test('double taps and re-renders do not create duplicate POSTs', async () => {
  let finish!: (value: unknown) => void;
  post.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  let first!: Promise<void>;
  await Renderer.act(async () => {
    first = controller.submit();
    controller.submit();
  });
  expect(controller.busy).toBe(true);
  await Renderer.act(async () => {
    tree.update(wrap(<Probe />));
  });
  await Renderer.act(async () => controller.submit());
  expect(post).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    finish({
      status: 201,
      data: { success: true, message: 'Created', data: record },
    });
    await first;
  });
  expect(created).toHaveBeenCalledTimes(1);
});
test('422 maps backend fields, keeps draft and permits deliberate corrected submission', async () => {
  post.mockRejectedValueOnce(
    new ApiError('Invalid', 'validation', 422, {
      title: ['The title field is required.'],
      from_city_id: [
        'Select an active city belonging to the selected country.',
      ],
    }),
  );
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(controller.errors).toHaveProperty('from_city_id');
  expect(useListingDraft.getState().values).toEqual(draft);
  expect(controller.busy).toBe(false);
  expect(controller.held).toBeUndefined();
  expect(created).not.toHaveBeenCalled();
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error' }),
  );
  await Renderer.act(async () => controller.submit());
  expect(created).toHaveBeenCalledWith(123);
});
test('timeout warning preserves full draft and held state across remount, no automatic or manual repeat POST', async () => {
  post.mockRejectedValueOnce(new ApiError('Timeout', 'network'));
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(useListingDraft.getState().values).toEqual(draft);
  expect(controller.held).toBe('unknown');
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'warning',
      text1: 'Creation not confirmed',
    }),
  );
  await Renderer.act(async () => tree.unmount());
  await mount();
  expect(controller.held).toBe('unknown');
  await Renderer.act(async () => controller.submit());
  expect(post).toHaveBeenCalledTimes(1);
  expect(created).not.toHaveBeenCalled();
});
test('newer draft edits are preserved when confirmed response arrives', async () => {
  let finish!: (value: unknown) => void;
  post.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  let first!: Promise<void>;
  await Renderer.act(async () => {
    first = controller.submit();
  });
  await Renderer.act(async () =>
    useListingDraft.getState().update({ ...draft, title: 'Newer edit' }),
  );
  await Renderer.act(async () => {
    finish({
      status: 201,
      data: { success: true, message: 'Created', data: record },
    });
    await first;
  });
  expect(useListingDraft.getState().values.title).toBe('Newer edit');
  expect(created).not.toHaveBeenCalled();
});
test.each(['logout', 'account', 'blur', 'unmount'])(
  '%s during POST prevents stale navigation, toast and private restoration',
  async change => {
    let finish!: (value: unknown) => void;
    post.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await mount();
    let first!: Promise<void>;
    await Renderer.act(async () => {
      first = controller.submit();
    });
    await Renderer.act(async () => {
      if (change === 'logout') useAuthStore.getState().clear();
      if (change === 'account')
        useAuthStore
          .getState()
          .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
      if (change === 'blur') tree.update(wrap(<Probe focused={false} />));
      if (change === 'unmount') tree.unmount();
    });
    await Renderer.act(async () => {
      finish({
        status: 201,
        data: { success: true, message: 'Created', data: record },
      });
      await first;
    });
    expect(created).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    if (change === 'logout' || change === 'account') {
      expect(useListingDraft.getState().values.title).toBe('');
      expect(listingSubmission()).toBeUndefined();
    }
  },
);
test('authoritative active queries refetch rather than receiving fabricated counts', async () => {
  let calls = 0;
  const options = {
    queryKey: ['profileDashboard', 'user:8', 'summary'],
    queryFn: async () => ({ count: ++calls }),
  };
  await client.fetchQuery(options);
  // A mounted observer is how the real Dashboard requests an active refresh.
  const { QueryObserver } = require('@tanstack/react-query');
  const observer = new QueryObserver(client, options),
    unsubscribe = observer.subscribe(() => {});
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(calls).toBeGreaterThanOrEqual(2);
  expect(client.getQueryData(options.queryKey)).toEqual({ count: calls });
  unsubscribe();
});
test('country selection clears old city, dependent city reads stay isolated, Cancel preserves parent value', async () => {
  const select = jest.fn(),
    close = jest.fn();
  await mount(
    <ListingLocationPicker
      title="From location"
      value={draft.from}
      onSelect={select}
      onClose={close}
    />,
  );
  await press('Select Country');
  await flush();
  await press('United Arab Emirates');
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Apply location' &&
        typeof node.props.onPress === 'function',
    )[0].props.disabled,
  ).toBe(true);
  await press('Select City');
  await flush();
  expect(get).toHaveBeenCalledWith(
    '/cities',
    expect.objectContaining({ params: { country_id: 2 } }),
  );
  await press('Dubai');
  await Renderer.act(async () =>
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Area (optional)')!
      .props.onChangeText('Downtown'),
  );
  await press('Apply location');
  expect(select).toHaveBeenCalledWith({
    country: { id: 2, name: 'United Arab Emirates' },
    city: { id: 102, name: 'Dubai', countryId: 2 },
    area: { name: 'Downtown' },
    source: 'api',
  });
  expect(draft.from!.city.id).toBe(101);
  await press('Cancel location');
  expect(close).toHaveBeenCalledTimes(1);
  expect(post).not.toHaveBeenCalled();
});
test('late city response after changing selection screen cannot restore previous country city', async () => {
  let finish!: (value: unknown) => void;
  get.mockImplementation(async (url, config) =>
    url === '/cities' && config?.params?.country_id === 1
      ? new Promise(resolve => {
          finish = resolve;
        })
      : referenceResponse(url, config),
  );
  const select = jest.fn();
  await mount(
    <ListingLocationPicker
      title="From location"
      value={undefined}
      onSelect={select}
      onClose={jest.fn()}
    />,
  );
  await press('Select Country');
  await flush();
  await press('Pakistan');
  await press('Select City');
  await flush();
  await press('Cancel selection');
  await press('Select Country');
  await flush();
  await press('United Arab Emirates');
  await press('Select City');
  await flush();
  await Renderer.act(async () =>
    finish(referenceResponse('/cities', { params: { country_id: 1 } })),
  );
  await flush();
  expect(
    tree.root.findAll(node => node.props.title === 'Karachi'),
  ).toHaveLength(0);
  await press('Dubai');
  await press('Apply location');
  expect(select.mock.calls[0][0]).toMatchObject({
    country: { id: 2 },
    city: { id: 102, countryId: 2 },
  });
});
test('reference errors and empty data never substitute fixtures; explicit retry failure uses existing toast', async () => {
  const {
    ListingReferencePicker,
  } = require('../src/features/post-listing/components/ListingReferencePicker');
  get.mockRejectedValue(new ApiError('Offline', 'network'));
  await mount(
    <ListingReferencePicker
      title="Select currency"
      kind="currencies"
      onSelect={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  await flush();
  expect(Toast.show).not.toHaveBeenCalled();
  await press('Retry options');
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error' }),
  );
  get.mockResolvedValue({
    status: 200,
    data: { success: true, message: 'OK', data: { items: [] } },
  });
  await press('Retry options');
  await flush();
  expect(
    tree.root.findAll(node => node.props.children === 'No options available.')
      .length,
  ).toBeGreaterThan(0);
  expect(post).not.toHaveBeenCalled();
});
test('draft state clears on same-ID session replacement as well as logout', () => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Fresh session', email: 'test@example.test' });
  expect(useListingDraft.getState().values.title).toBe('');
});
test('invalid draft never POSTs from review controller', async () => {
  useListingDraft.getState().discard();
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(post).not.toHaveBeenCalled();
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error' }),
  );
});
test('pre-aborted request never posts', async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(createListing(draft, abort.signal)).rejects.toMatchObject({
    kind: 'cancelled',
  });
  expect(post).not.toHaveBeenCalled();
});
test('guest uses existing Login gate and login never automatically submits the saved form', async () => {
  useAuthStore.getState().clear();
  const gate = jest.spyOn(authFlow, 'requireAuth').mockReturnValue(false);
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(gate).toHaveBeenCalledWith({
    type: 'POST_LISTING',
    params: { listingType: 'carry' },
  });
  expect(post).not.toHaveBeenCalled();
  await Renderer.act(async () =>
    useAuthStore
      .getState()
      .setUser({ id: 9, name: 'Signed in', email: 'test@example.test' }),
  );
  expect(post).not.toHaveBeenCalled();
});
test('demo composer state never calls protected Create API', async () => {
  useAuthStore.getState().clear();
  jest.spyOn(development, 'isUiPreviewActive').mockReturnValue(true);
  await mount();
  await Renderer.act(async () => controller.submit());
  expect(post).not.toHaveBeenCalled();
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'info' }),
  );
});

test('confirmed creation refetches All from the customer endpoint and exposes the authoritative Pending record', async () => {
  let saved = false;
  get.mockImplementation(async (url, config) =>
    url === '/customer/listings'
      ? {
          status: 200,
          data: {
            success: true,
            message: 'Your listings',
            data: {
              items: saved ? [record] : [],
              pagination: {
                current_page: 1,
                per_page: 20,
                total: saved ? 1 : 0,
                last_page: 1,
              },
            },
          },
        }
      : referenceResponse(url, config),
  );
  post.mockImplementation(async () => {
    saved = true;
    return {
      status: 201,
      data: { success: true, message: 'Created', data: record },
    };
  });
  const options = {
    queryKey: ['myListings.read', 'user:8', 'all'],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getMyListings('all', 1, signal),
  };
  await client.fetchQuery(options);
  const { QueryObserver } = require('@tanstack/react-query');
  const observer = new QueryObserver(client, options),
    unsubscribe = observer.subscribe(() => {});
  try {
    await mount();
    await Renderer.act(async () => controller.submit());
    expect(client.getQueryData(options.queryKey)).toMatchObject({
      data: [{ id: record.id, status: 'pending', backend: { status: 0 } }],
      meta: { total: 1 },
    });
    const reads = get.mock.calls.filter(
      ([url]) => url === '/customer/listings',
    );
    expect(reads.length).toBeGreaterThanOrEqual(2);
    for (const [, config] of reads)
      expect(config.params).not.toHaveProperty('status');
    expect(post).toHaveBeenCalledTimes(1);
  } finally {
    unsubscribe();
  }
});
