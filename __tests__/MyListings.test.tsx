import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { FlatList } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyListingsScreen } from '../src/features/listings/screens/MyListingsScreen';
import * as service from '../src/features/listings/services/myListingsService';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { useMyListingsTabs } from '../src/features/listings/store/myListingsStore';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
let tree: ReactTestRenderer, client: QueryClient;
const nav = { setOptions: jest.fn(), navigate: jest.fn() };
const item: service.MyListing = {
  id: 1,
  ownerId: 8,
  status: 'active',
  type: 'carry',
  title: 'Trip',
  origin: 'Karachi',
  destination: 'Dubai',
  departureDate: '2099-11-12',
  category: 'Documents',
  price: 120,
  currency: 'USD',
  capacityKg: 15,
};
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 25));
  });
}
async function mount(gcTime = 0) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <MyListingsScreen
          navigation={
            nav as unknown as React.ComponentProps<
              typeof MyListingsScreen
            >['navigation']
          }
          route={{ key: 'mine', name: 'MyListings' }}
        />
      </QueryClientProvider>,
    );
  });
  await settle();
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
  await settle();
}
beforeEach(() => {
  jest.clearAllMocks();
  useDevelopmentStore.setState({ previewActive: false });
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'm@example.test' });
  useMyListingsTabs.getState().clear();
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
  });
  client?.clear();
  jest.restoreAllMocks();
});
test('status tabs filter requests, show real counts and preserve selection on remount', async () => {
  const get = jest
    .spyOn(service, 'getMyListings')
    .mockImplementation(async status => ({
      data: [{ ...item, status }],
      meta: {
        current_page: 1,
        last_page: 1,
        total: 1,
        counts: { active: 1, completed: 1, expired: 1 },
      },
    }));
  await mount();
  expect(
    tree.root.findAll(node => node.props.children === 'Active (1)').length,
  ).toBeGreaterThan(0);
  await press('Expired listings');
  expect(get.mock.calls.at(-1)![0]).toBe('expired');
  expect(tree.root.findByType(FlatList).props.data[0].status).toBe('expired');
  await Renderer.act(async () => tree.unmount());
  await mount();
  expect(get.mock.calls.at(-1)![0]).toBe('expired');
  await press('Open my listing 1');
  expect(nav.navigate).toHaveBeenCalledWith('MainTabs', {
    screen: 'ListingsStack',
    params: {
      screen: 'ListingDetails',
      params: { listingId: '1', returnTo: 'MyListings' },
    },
  });
});
test('error retries to an empty state without inventing counts', async () => {
  const get = jest
    .spyOn(service, 'getMyListings')
    .mockRejectedValueOnce(Error('offline'))
    .mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1 } });
  await mount();
  await press('Retry my listings');
  expect(get).toHaveBeenCalledTimes(2);
  expect(
    tree.root.findAll(node => node.props.children === 'No active listings')
      .length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(node => node.props.children === 'Active (0)'),
  ).toHaveLength(0);
});
test('pagination deduplicates IDs and pull-to-refresh refreshes server state', async () => {
  const get = jest
    .spyOn(service, 'getMyListings')
    .mockImplementation(async (status, page) => ({
      data: page === 1 ? [item] : [item, { ...item, id: 2 }],
      meta: { current_page: page, last_page: 2, total: 2 },
    }));
  await mount();
  await Renderer.act(async () =>
    tree.root.findByType(FlatList).props.onEndReached(),
  );
  await settle();
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(2);
  await Renderer.act(async () =>
    tree.root.findByType(FlatList).props.onRefresh(),
  );
  expect(get.mock.calls.filter(call => call[1] === 1).length).toBeGreaterThan(
    1,
  );
});

test('real Completed limitation is shown without inventing Pending mapping or an empty success', async () => {
  jest.spyOn(service, 'getMyListings').mockImplementation(async status => {
    if (status === 'completed')
      throw new service.UnsupportedMyListingStatusError();
    return { data: [item], meta: { current_page: 1, last_page: 1, total: 1 } };
  });
  await mount();
  await press('Completed listings');
  expect(tree.root.findByType(FlatList).props.data).toEqual([]);
  expect(
    tree.root.findAll(
      node =>
        node.props.children ===
        'Completed listings have no matching backend status. Pending listings cannot be shown as Completed.',
    ).length,
  ).toBeGreaterThan(0);
});
test('explicit failure retries produce one safe Toast; automatic loading has none', async () => {
  const Toast = require('react-native-toast-message').default;
  const toast = jest.spyOn(Toast, 'show');
  jest.spyOn(service, 'getMyListings').mockRejectedValue(new Error('private'));
  await mount();
  expect(toast).not.toHaveBeenCalled();
  const retry = tree.root.findAll(
    n => n.props.title === 'Retry my listings' && n.props.onPress,
  )[0];
  await Renderer.act(async () => {
    retry.props.onPress();
    retry.props.onPress();
  });
  await settle();
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith({
    type: 'error',
    text1: 'My Listings unavailable',
    text2: 'Your listings are temporarily unavailable. Please try again.',
  });
});
test('same-account tab state reuses cached pages and account switching/logout cannot show previous listings', async () => {
  const get = jest
    .spyOn(service, 'getMyListings')
    .mockImplementation(async status => ({
      data: [{ ...item, status, ownerId: useAuthStore.getState().user!.id }],
      meta: { current_page: 1, last_page: 1, total: 1 },
    }));
  await mount(30000);
  await press('Expired listings');
  await press('Active listings');
  expect(get).toHaveBeenCalledTimes(2);
  await Renderer.act(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
  });
  await settle();
  expect(tree.root.findByType(FlatList).props.data[0].ownerId).toBe(9);
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
    client.clear();
  });
  await settle();
  expect(tree.root.findByType(FlatList).props.data).toEqual([]);
});

test('real Axios adapter data renders existing Carry and Send cards without using sample listings', async () => {
  const { apiClient } = require('../src/services/api/apiClient');
  const { secureStorage } = require('../src/services/storage/secureStorage');
  const { ownListingFixture } = require('../test/fixtures/myListings');
  const original = apiClient.defaults.adapter;
  const token = jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('ui-listing-contract-test-token');
  let adType = 'Carring';
  apiClient.defaults.adapter = async (config: {
    params: { status: number };
  }) => ({
    status: 200,
    statusText: '',
    headers: {},
    config,
    data: {
      success: true,
      message: 'OK',
      data: {
        items: [
          {
            ...ownListingFixture,
            ad_type: adType,
            status: config.params.status,
          },
        ],
        pagination: { current_page: 1, per_page: 20, total: 1, last_page: 1 },
      },
    },
  });
  try {
    await mount();
    expect(tree.root.findByType(FlatList).props.data[0].id).toBe(501);
    for (const label of ['Clifton', 'Marina', 'Carry Parcel'])
      expect(
        tree.root.findAll(n => n.props.children === label).length,
      ).toBeGreaterThan(0);
    adType = 'Send';
    await Renderer.act(async () => {
      await tree.root.findByType(FlatList).props.onRefresh();
    });
    await settle();
    expect(
      tree.root.findAll(n => n.props.children === 'Send Parcel').length,
    ).toBeGreaterThan(0);
    await press('Expired listings');
    expect(tree.root.findByType(FlatList).props.data[0].backend.status).toBe(2);
    expect(token).toHaveBeenCalled();
  } finally {
    apiClient.defaults.adapter = original;
  }
});
