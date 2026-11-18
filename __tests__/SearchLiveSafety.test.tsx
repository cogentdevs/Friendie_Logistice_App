import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchScreen } from '../src/features/search/screens/SearchScreen';
import { useSearchStore } from '../src/features/search/store/searchStore';
import { useLocationStore } from '../src/features/location/store/locationStore';
import { useRecentSearchStore } from '../src/features/search/store/recentSearchStore';
import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
import { routeFixture } from '../test/fixtures/search';
import { ApiError } from '../src/types/api';
import { getListingReferences } from '../src/features/post-listing/services/listingReferencesService';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockFocused,
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
const original = appConfig.staticMarketplaceEnabled;
let tree: ReactTestRenderer, client: QueryClient;
const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
const page = {
  status: 200,
  data: {
    success: true,
    data: {
      items: [],
      pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
    },
  },
};
const deferred = () => {
  let resolve!: (value: typeof page) => void;
  const promise = new Promise<typeof page>(r => {
    resolve = r;
  });
  return { promise, resolve };
};
beforeEach(async () => {
  mockFocused = true;
  appConfig.staticMarketplaceEnabled = false;
  useLocationStore.getState().useWorldwide();
  useSearchStore.setState({
    filters: {
      from: routeFixture.from,
      to: routeFixture.to,
      type: 'carry',
      query: '  parcel  ',
      category: '42',
      weightKg: 0,
    },
  });
  useRecentSearchStore.setState({ items: [], ready: true });
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
          navigation={navigation as never}
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
  appConfig.staticMarketplaceEnabled = original;
  navigation.navigate.mockClear();
  jest.restoreAllMocks();
});
const send = () =>
  tree.root
    .findAll(
      n =>
        n.props.accessibilityLabel === 'Search Listings' &&
        typeof n.props.onPress === 'function',
    )[0]
    .props.onPress();

test('live submission keeps keyword, category and zero weight with route/type and warms exactly the results scope', async () => {
  // Navigation is mocked, so no Results observer mounts to retain its warmed page.
  client.setQueryDefaults(['listings'], { gcTime: Infinity });
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue(page);
  await Renderer.act(async () => {
    await send();
  });
  expect(get).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith(
    '/listings',
    expect.objectContaining({
      headers: { Authorization: false },
      params: expect.objectContaining({
        search: 'parcel',
        category_id: 42,
        weight: 0,
        ad_type: 'Carring',
        page: 1,
      }),
    }),
  );
  expect(navigation.navigate).toHaveBeenCalledWith('Results');
  expect(
    client.getQueryData([
      'listings',
      useSearchStore.getState().filters,
      useLocationStore.getState().selection,
    ]),
  ).toMatchObject({ pageParams: [1], pages: [{ data: [] }] });
});
test('double taps issue only one public GET', async () => {
  const pending = deferred();
  const get = jest.spyOn(apiClient, 'get').mockReturnValue(pending.promise);
  await Renderer.act(async () => {
    send();
    send();
  });
  expect(get).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => {
    pending.resolve(page);
    await pending.promise;
  });
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
});
test('a late response cannot navigate or publish results over newer applied filters', async () => {
  const pending = deferred();
  jest.spyOn(apiClient, 'get').mockReturnValue(pending.promise);
  await Renderer.act(async () => {
    send();
  });
  await Renderer.act(async () => {
    useSearchStore.getState().setFilters({ query: 'newer' });
  });
  await Renderer.act(async () => {
    pending.resolve(page);
    await pending.promise;
  });
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(client.getQueriesData({ queryKey: ['listings'] })).toEqual([]);
});
test('a response after blur cannot navigate', async () => {
  const pending = deferred();
  jest.spyOn(apiClient, 'get').mockReturnValue(pending.promise);
  await Renderer.act(async () => {
    send();
  });
  mockFocused = false;
  await Renderer.act(async () => {
    tree.update(
      <QueryClientProvider client={client}>
        <SearchScreen
          navigation={navigation as never}
          route={{ key: 'search', name: 'Search' }}
        />
      </QueryClientProvider>,
    );
  });
  await Renderer.act(async () => {
    pending.resolve(page);
    await pending.promise;
  });
  expect(navigation.navigate).not.toHaveBeenCalled();
});
test('failed live search preserves route/draft and stays available for explicit retry', async () => {
  const get = jest
    .spyOn(apiClient, 'get')
    .mockRejectedValueOnce(new ApiError('Unable to connect.', 'network'))
    .mockResolvedValueOnce(page);
  await Renderer.act(async () => {
    await send();
  });
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(useSearchStore.getState().filters.weightKg).toBe(0);
  await Renderer.act(async () => {
    await send();
  });
  expect(get).toHaveBeenCalledTimes(2);
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
});
test('unsupported applied flags are rejected before requests/history/cache changes', async () => {
  const get = jest.spyOn(apiClient, 'get');
  await Renderer.act(async () => {
    useSearchStore.getState().setFilters({ verifiedOnly: true });
  });
  await Renderer.act(async () => {
    await send();
  });
  expect(get).not.toHaveBeenCalled();
  expect(useRecentSearchStore.getState().items).toEqual([]);
  expect(navigation.navigate).not.toHaveBeenCalled();
});
test('country-only approved filters submit from Search without inventing legacy city labels or history records', async () => {
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue(page);
  get.mockResolvedValueOnce({
    status: 200,
    data: {
      success: true,
      message: 'OK',
      data: {
        items: [{ id: 42, name: 'Alpha', short_name: null, image_url: null }],
      },
    },
  });
  const options = await getListingReferences('countries');
  await Renderer.act(async () => {
    useSearchStore
      .getState()
      .setFilters({
        from: undefined,
        to: undefined,
        routeReferences: {
          from: { country: options[0].value as { id: number; name: string } },
        },
      });
  });
  // Model returning from Filters: initialize Search from the newly applied state.
  await Renderer.act(async () => {
    tree.unmount();
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <SearchScreen
          navigation={navigation as never}
          route={{ key: 'search', name: 'Search' }}
        />
      </QueryClientProvider>,
    );
  });
  await Renderer.act(async () => {
    await send();
  });
  expect(get).toHaveBeenLastCalledWith(
    '/listings',
    expect.objectContaining({
      params: expect.objectContaining({
        from_country_id: 42,
        weight: 0,
        search: 'parcel',
      }),
    }),
  );
  expect(navigation.navigate).toHaveBeenCalledWith('Results');
  expect(useRecentSearchStore.getState().items).toEqual([]);
});
