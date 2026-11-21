// Exercise the real production selector, never the Jest-only catalogue mock.
jest.unmock('../src/features/listings/development/staticMarketplace');
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
import React from 'react';
import Renderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useListingDetails } from '../src/features/listings/hooks/useListingDetails';
import { demoMyListings } from '../src/features/listings/development/demoMyListings';
import { ListingsScreen } from '../src/features/listings/screens/ListingsScreen';
import { appConfig } from '../src/constants/appConfig';
import { isStaticMarketplaceEnabled } from '../src/features/listings/development/staticMarketplace';
import { isListingDemoMode } from '../src/features/listings/development/demoListings';
import { categoriesDataSource } from '../src/features/home/services/categoriesService';
import { getHome } from '../src/features/home/services/homeApiService';
import { homeService } from '../src/features/home/services/homeService';
import { getListings } from '../src/features/listings/services/listingsService';
import { getListingDetails } from '../src/features/listings/services/listingDetailsService';
import { isVerifiedPublicListing } from '../src/features/listings/services/publicListingsService';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { apiClient } from '../src/services/api/apiClient';
import { homeResponse } from '../test/fixtures/home';
import { publicListingFixture } from '../test/fixtures/publicListing';
const adapter = apiClient.defaults.adapter;
const flags = {
  enabled: appConfig.staticMarketplaceEnabled,
  testing: appConfig.staticTestingBuild,
};
let calls: string[];
const page = (current = 1, empty = false) => ({
  success: true,
  data: {
    items: empty ? [] : [publicListingFixture],
    pagination: {
      current_page: current,
      per_page: 20,
      total: empty ? 0 : 21,
      last_page: empty ? 1 : 2,
    },
  },
});
beforeEach(() => {
  calls = [];
  appConfig.staticMarketplaceEnabled = true;
  useAuthStore.getState().clear();
  useDevelopmentStore.setState({ previewActive: false });
  apiClient.defaults.adapter = async config => {
    calls.push(config.url!);
    expect(config.headers.Authorization).toBe(false);
    expect(config.data).toBeUndefined();
    const data =
      config.url === '/home'
        ? homeResponse()
        : config.url === '/categories'
        ? {
            success: true,
            message: 'Categories retrieved successfully.',
            data: { items: [{ id: 42, name: 'Documents', image_url: null }] },
          }
        : config.url === '/listings'
        ? page(config.params?.page)
        : { success: true, data: publicListingFixture };
    return { status: 200, statusText: 'OK', headers: {}, config, data };
  };
});
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  appConfig.staticMarketplaceEnabled = flags.enabled;
  appConfig.staticTestingBuild = flags.testing;
  jest.restoreAllMocks();
  useAuthStore.getState().clear();
  useDevelopmentStore.setState({ previewActive: false });
});
const modes = [true, false].flatMap(debug =>
  [true, false].flatMap(native =>
    [true, false].map(member => ({ debug, native, member })),
  ),
);
test.each(modes)(
  'real public requests with debug=$debug native=$native authenticated=$member',
  async ({ debug, native, member }) => {
    jest.replaceProperty(
      globalThis as typeof globalThis & { __DEV__: boolean },
      '__DEV__',
      debug,
    );
    appConfig.staticTestingBuild = native;
    if (member)
      useAuthStore
        .getState()
        .setUser({ id: 7, name: 'Member', email: 'member@example.test' });
    else useDevelopmentStore.setState({ previewActive: true });
    expect(isStaticMarketplaceEnabled()).toBe(false);
    expect(isListingDemoMode()).toBe(false);
    expect(categoriesDataSource()).toBe('api');
    const home = await getHome();
    expect(home.latest[0].id).toBe(703);
    expect(home.latest[0].coverImageUrl).toBe(
      'https://media.example.test/ad.jpg',
    );
    expect((await homeService.categories())[0].id).toBe('42');
    const listings = await getListings(1, {}, { mode: 'worldwide' });
    expect(listings.data[0].id).toBe(123);
    const detail = await getListingDetails(String(listings.data[0].id));
    expect(detail.id).toBe(123);
    expect(isVerifiedPublicListing(detail)).toBe(true);
    expect(calls).toEqual([
      '/home',
      '/categories',
      '/listings',
      '/listings/123',
    ]);
  },
);
test('pagination/search use public HTTP parameters, not local fixture filtering', async () => {
  const get = jest.spyOn(apiClient, 'get');
  const result = await getListings(
    2,
    { query: 'Karachi', type: 'carry', category: '4', weightKg: 0 },
    { mode: 'worldwide' },
  );
  expect(result.meta.current_page).toBe(2);
  expect(result.meta.last_page).toBe(2);
  expect(get).toHaveBeenCalledWith(
    '/listings',
    expect.objectContaining({
      params: expect.objectContaining({
        page: 2,
        search: 'Karachi',
        ad_type: 'Carring',
        category_id: 4,
        weight: 0,
      }),
      headers: { Authorization: false },
    }),
  );
});
test('empty API results stay empty', async () => {
  apiClient.defaults.adapter = async config => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    data:
      config.url === '/home'
        ? {
            ...homeResponse(),
            data: {
              categories: [],
              featured_listings: [],
              latest_listings: [],
            },
          }
        : page(1, true),
  });
  expect((await getHome()).latest).toEqual([]);
  expect((await getListings(1, {}, { mode: 'worldwide' })).data).toEqual([]);
});
test.each(['home', 'listings', 'details'])(
  '%s network failure never returns fixture success',
  async target => {
    const get = jest
      .spyOn(apiClient, 'get')
      .mockRejectedValue(new Error('network unavailable'));
    const work =
      target === 'home'
        ? getHome()
        : target === 'listings'
        ? getListings(1, {}, { mode: 'worldwide' })
        : getListingDetails('123');
    await expect(work).rejects.toThrow();
    expect(get).toHaveBeenCalledTimes(1);
    expect(isListingDemoMode()).toBe(false);
  },
);
test('fixture-only providers remain unreachable in production even when legacy flags are true', async () => {
  await expect(homeService.latest()).rejects.toThrow('disabled');
  await expect(homeService.destinations()).rejects.toThrow('disabled');
  expect(calls).toEqual([]);
});
test('private Demo owner-preview IDs never escape to the public Details API', async () => {
  useDevelopmentStore.setState({ previewActive: true });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  let observed: ReturnType<typeof useListingDetails> | undefined;
  function Probe() {
    observed = useListingDetails(String(demoMyListings[0].id), true);
    return null;
  }
  let tree: Renderer.ReactTestRenderer;
  try {
    await Renderer.act(async () => {
      tree = Renderer.create(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(Probe),
        ),
      );
    });
    await Renderer.act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
    expect(observed?.data?.id).toBe(demoMyListings[0].id);
    expect(calls).toEqual([]);
  } finally {
    await Renderer.act(async () => {
      tree?.unmount();
      client.clear();
    });
  }
});
test('debug Listings card navigates with the server ID under legacy static flags', async () => {
  appConfig.staticTestingBuild = true;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const navigation = {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    canGoBack: () => true,
    goBack: jest.fn(),
  };
  let tree: Renderer.ReactTestRenderer;
  try {
    await Renderer.act(async () => {
      tree = Renderer.create(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(ListingsScreen, {
            route: { name: 'Listings', key: 'listings' },
            navigation: navigation as never,
          }),
        ),
      );
    });
    await Renderer.act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
    const card = tree!.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Open listing Trip' &&
        typeof node.props.onPress === 'function',
    )[0];
    expect(card).toBeDefined();
    await Renderer.act(async () => {
      card.props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith('ListingDetails', {
      listingId: '123',
    });
    expect(calls).toEqual(['/listings']);
  } finally {
    await Renderer.act(async () => {
      tree?.unmount();
      client.clear();
    });
  }
});
