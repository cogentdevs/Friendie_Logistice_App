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
async function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
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
    client?.clear();
  });
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
