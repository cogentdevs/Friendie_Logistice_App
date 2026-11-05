import React from 'react';
import { Alert, TextInput } from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SearchScreen } from '../src/features/search/screens/SearchScreen';
import { SearchDatePicker } from '../src/features/search/components/SearchDatePicker';
import { RouteLocationPicker } from '../src/features/location/components/RouteLocationPicker';
import { useSearchStore } from '../src/features/search/store/searchStore';
import { useRecentSearchStore } from '../src/features/search/store/recentSearchStore';
import * as listingService from '../src/features/listings/services/listingsService';
import { routeFixture } from '../test/fixtures/search';
import { localDate } from '../src/features/search/types/search';
import { ApiError } from '../src/types/api';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
let tree: ReactTestRenderer, client: QueryClient;
const navigate = jest.fn();
beforeEach(async () => {
  await AsyncStorage.removeItem('friendie.recent-searches');
  useRecentSearchStore.setState({ items: [], ready: false });
  useSearchStore.setState({
    filters: {
      type: routeFixture.type,
      from: routeFixture.from,
      to: routeFixture.to,
    },
  });
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <SearchScreen
          navigation={
            {
              navigate,
              setOptions: jest.fn(),
            } as unknown as React.ComponentProps<
              typeof SearchScreen
            >['navigation']
          }
          route={{ key: 'search', name: 'Search' }}
        />
      </QueryClientProvider>,
    );
  });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree.unmount();
    client.clear();
  });
  jest.restoreAllMocks();
  navigate.mockClear();
});
const button = (label: string) =>
  tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
async function press(label: string) {
  await Renderer.act(async () => {
    await button(label).props.onPress();
  });
}
const hasText = (text: string) =>
  tree.root.findAll(node => node.props.children === text).length > 0;
test('segment preserves locations and swapping exchanges complete location identities', async () => {
  const get = jest
    .spyOn(listingService, 'getListings')
    .mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1 } });
  await press('Carry Parcel');
  await press('Swap From and To');
  await press('Search Listings');
  expect(get.mock.calls[0][1]).toMatchObject({
    type: 'carry',
    from: routeFixture.to,
    to: routeFixture.from,
  });
  expect(navigate).toHaveBeenCalledWith('Results');
  expect(useRecentSearchStore.getState().items[0]).toMatchObject({
    type: 'carry',
    from: routeFixture.to,
    to: routeFixture.from,
  });
});
test('missing route validation prevents network calls', async () => {
  const get = jest.spyOn(listingService, 'getListings');
  await press('Select From location');
  await Renderer.act(async () => {
    tree.root.findByType(RouteLocationPicker).props.onSelect(undefined);
  });
  await press('Search Listings');
  expect(hasText('Select both From and To locations.')).toBe(true);
  expect(get).not.toHaveBeenCalled();
});
test('date picker applies a selected local date and segment changes preserve it', async () => {
  await press('Choose travel or delivery dates');
  const today = localDate(new Date());
  await press('Choose ' + today);
  await press('Apply dates');
  expect(tree.root.findAllByType(SearchDatePicker)).toHaveLength(0);
  await press('Carry Parcel');
  const get = jest
    .spyOn(listingService, 'getListings')
    .mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1 } });
  await press('Search Listings');
  expect(get.mock.calls[0][1]).toMatchObject({
    dates: { start: today, end: today },
    type: 'carry',
  });
});
test('failed search remains retryable and a recent search restores its full route', async () => {
  jest
    .spyOn(listingService, 'getListings')
    .mockRejectedValue(
      new ApiError('Unable to connect. Check your connection.', 'network'),
    );
  await press('Search Listings');
  expect(hasText('Unable to connect. Check your connection.')).toBe(true);
  await press('Swap From and To');
  const recent = tree.root.findAll(
    node =>
      typeof node.props.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.startsWith('Restore recent search') &&
      typeof node.props.onPress === 'function',
  )[0];
  await Renderer.act(async () => {
    recent.props.onPress();
  });
  expect(button('Select From location').props.accessibilityHint).toContain(
    'Karachi',
  );
  expect(button('Select To location').props.accessibilityHint).toContain(
    'Dubai',
  );
});
test('history clear requires confirmation and cancellation preserves saved values', async () => {
  jest
    .spyOn(listingService, 'getListings')
    .mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1 } });
  await press('Search Listings');
  const alert = jest.spyOn(Alert, 'alert');
  await press('Clear recent searches');
  expect(useRecentSearchStore.getState().items).toHaveLength(1);
  const actions = alert.mock.calls[0][2]!;
  expect(actions.find(action => action.text === 'Cancel')).toBeDefined();
  await Renderer.act(async () => {
    await actions.find(action => action.text === 'Clear')!.onPress!();
  });
  expect(useRecentSearchStore.getState().items).toHaveLength(0);
  expect(hasText('Your recent searches will appear here.')).toBe(true);
});

test('manual location edits clear stale place identifiers and preserve explicit country/city/area', async () => {
  await press('Select From location');
  await Renderer.act(async () => {
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'City')!
      .props.onChangeText('Lahore');
  });
  await press('Select location');
  const get = jest
    .spyOn(listingService, 'getListings')
    .mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1 } });
  await press('Search Listings');
  const selected = get.mock.calls[0][1].from!;
  expect(selected.country).toEqual(routeFixture.from.country);
  expect(selected.city).toEqual({ name: 'Lahore' });
  expect(selected.placeId).toBeUndefined();
  expect(selected.coordinates).toBeUndefined();
});

test('date picker supports a future range, reversed selection and clearing dates', async () => {
  await press('Choose travel or delivery dates');
  await press('Next month');
  const now = new Date();
  const earlier = localDate(new Date(now.getFullYear(), now.getMonth() + 1, 5));
  const later = localDate(new Date(now.getFullYear(), now.getMonth() + 1, 10));
  await press('Choose ' + later);
  await press('Choose ' + earlier);
  await press('Apply dates');
  const get = jest
    .spyOn(listingService, 'getListings')
    .mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1 } });
  await press('Search Listings');
  expect(get.mock.calls[0][1].dates).toEqual({ start: earlier, end: later });
  await press('Choose travel or delivery dates');
  await press('Any date');
  await press('Search Listings');
  expect(get.mock.calls[1][1].dates).toBeUndefined();
});
