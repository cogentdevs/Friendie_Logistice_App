import {
  clearAuthFlow,
  useAuthFlowStore,
} from '../src/features/auth/store/authFlowStore';
import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { FlatList } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ListingsScreen } from '../src/features/listings/screens/ListingsScreen';
import { formatPrice } from '../src/features/listings/components/ListingCard';
import * as service from '../src/features/listings/services/listingsService';
import { useSearchStore } from '../src/features/search/store/searchStore';
import { useLocationStore } from '../src/features/location/store/locationStore';
import { useAuthStore } from '../src/store/authStore';
import { useListingBookmarks } from '../src/features/listings/store/bookmarkStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
const item: service.Listing = {
  id: 1,
  type: 'carry',
  title: 'Carry to Dubai',
  origin: 'Karachi',
  destination: 'Dubai',
  departureDate: '2026-11-12',
  category: 'goods',
  price: 120,
  currency: 'USD',
  capacityKg: 15,
  traveller: {
    id: 7,
    name: 'Test Traveller',
    verified: true,
    rating: 4.9,
    reviewCount: 128,
  },
};
let tree: ReactTestRenderer, client: QueryClient;
const navigation = {
  setOptions: jest.fn(),
  navigate: jest.fn(),
  canGoBack: () => true,
  goBack: jest.fn(),
};
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 25));
  });
}
async function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <ListingsScreen
          navigation={
            navigation as unknown as React.ComponentProps<
              typeof ListingsScreen
            >['navigation']
          }
          route={{ key: 'listings', name: 'Listings' }}
        />
      </QueryClientProvider>,
    );
  });
  await settle();
}
async function press(label: string) {
  await Renderer.act(async () => {
    const control = tree.root.findAll(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    )[0];
    await control.props.onPress();
  });
  await settle();
}
beforeEach(async () => {
  clearAuthFlow();
  useSearchStore.getState().reset();
  useLocationStore.getState().useWorldwide();
  useAuthStore.setState({ status: 'guest', user: null });
  useListingBookmarks.setState({ ids: [], owner: undefined });
  await AsyncStorage.removeItem('friendie.bookmarks.77');
  navigation.setOptions.mockClear();
  navigation.navigate.mockClear();
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  jest.restoreAllMocks();
});
test('real count, verified card, details, deduplicated pagination and filter removal', async () => {
  const get = jest
    .spyOn(service, 'getListings')
    .mockImplementation(async page => ({
      data:
        page === 1
          ? [item]
          : [
              item,
              { ...item, id: 2, traveller: { id: 8, name: 'Unverified' } },
            ],
      meta: { current_page: page, last_page: 2, total: 2 },
    }));
  useSearchStore.getState().setFilters({ verifiedOnly: true, type: 'carry' });
  await mount();
  expect(navigation.setOptions.mock.calls.at(-1)![0].title).toBe(
    'Listings (2)',
  );
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(1);
  await press('Open listing Carry to Dubai');
  expect(navigation.navigate).toHaveBeenCalledWith('ListingDetails', {
    listingId: '1',
  });
  await Renderer.act(async () => {
    tree.root.findByType(FlatList).props.onEndReached();
  });
  await settle();
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(2);
  expect(get).toHaveBeenCalledTimes(2);
  await press('Remove filter Verified only');
  expect(useSearchStore.getState().filters.verifiedOnly).toBe(false);
  expect(get.mock.calls.at(-1)![1].verifiedOnly).toBe(false);
});
test('failed request exposes retry, no invented count, then empty state', async () => {
  const get = jest
    .spyOn(service, 'getListings')
    .mockRejectedValueOnce(Error('offline'))
    .mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1 } });
  await mount();
  expect(navigation.setOptions.mock.calls.at(-1)![0].title).toBe('Listings');
  await press('Retry listings');
  expect(get).toHaveBeenCalledTimes(2);
  expect(
    tree.root.findAll(node => node.props.children === 'No listings found')
      .length,
  ).toBeGreaterThan(0);
});
test('guest save is blocked; authenticated bookmarks persist locally and toggle', async () => {
  jest.spyOn(service, 'getListings').mockResolvedValue({
    data: [item],
    meta: { current_page: 1, last_page: 1 },
  });
  await mount();
  await press('Save listing 1 on this device');
  expect(useAuthFlowStore.getState().flow?.action).toEqual({
    type: 'SAVE_LISTING',
    params: { listingId: '1' },
  });
  expect(useListingBookmarks.getState().ids).toEqual([]);
  await Renderer.act(async () => {
    useAuthStore
      .getState()
      .setUser({ id: 77, name: 'Member', email: 'member@example.test' });
  });
  await settle();
  await press('Save listing 1 on this device');
  expect(
    JSON.parse((await AsyncStorage.getItem('friendie.bookmarks.77'))!),
  ).toEqual([1]);
  await press('Unsave listing 1 on this device');
  expect(useListingBookmarks.getState().ids).toEqual([]);
});
test('schema rejects made-up invalid prices and formatting retains currency', () => {
  expect(service.listingSchema.safeParse({ ...item, price: -1 }).success).toBe(
    false,
  );
  expect(formatPrice(120, 'USD')).toContain('USD');
  expect(
    service.listingSchema.parse({ ...item, traveller: undefined }).traveller,
  ).toBeUndefined();
});

test('a late previous-filter response cannot replace current results', async () => {
  let resolveOld!: (
    value: Awaited<ReturnType<typeof service.getListings>>,
  ) => void;
  const oldPage = new Promise<Awaited<ReturnType<typeof service.getListings>>>(
    resolve => {
      resolveOld = resolve;
    },
  );
  jest
    .spyOn(service, 'getListings')
    .mockImplementation(async (_page, filters) =>
      filters.verifiedOnly
        ? oldPage
        : {
            data: [{ ...item, id: 3 }],
            meta: { current_page: 1, last_page: 1, total: 1 },
          },
    );
  useSearchStore.getState().setFilters({ verifiedOnly: true });
  await mount();
  await press('Remove filter Verified only');
  expect(
    tree.root
      .findByType(FlatList)
      .props.data.map((row: service.Listing) => row.id),
  ).toEqual([3]);
  await Renderer.act(async () => {
    resolveOld({
      data: [item],
      meta: { current_page: 1, last_page: 1, total: 50 },
    });
  });
  await settle();
  expect(
    tree.root
      .findByType(FlatList)
      .props.data.map((row: service.Listing) => row.id),
  ).toEqual([3]);
  expect(navigation.setOptions.mock.calls.at(-1)![0].title).toBe(
    'Listings (1)',
  );
});

test('a failed device bookmark write does not claim a saved listing', async () => {
  jest.spyOn(service, 'getListings').mockResolvedValue({
    data: [item],
    meta: { current_page: 1, last_page: 1 },
  });
  useAuthStore
    .getState()
    .setUser({ id: 77, name: 'Member', email: 'member@example.test' });
  await mount();
  jest
    .spyOn(AsyncStorage, 'setItem')
    .mockRejectedValueOnce(Error('Storage full'));
  await press('Save listing 1 on this device');
  expect(useListingBookmarks.getState().ids).toEqual([]);
  expect(
    tree.root.findAll(
      node =>
        node.props.children ===
        'Could not save this listing on your device. Please try again.',
    ).length,
  ).toBeGreaterThan(0);
});
