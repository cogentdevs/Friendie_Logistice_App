// Live tests use the production selector, never the Jest-only catalogue mock.
jest.unmock('../src/features/listings/development/staticMarketplace');
import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { RefreshControl, TextInput } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { HomeScreen } from '../src/features/home/screens/HomeScreen';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { useSearchStore } from '../src/features/search/store/searchStore';
import { useLocationStore } from '../src/features/location/store/locationStore';
import * as profiles from '../src/features/profile/services/profileService';
import { ApiError } from '../src/types/api';
import { publicHomeKey } from '../src/services/api/publicHomeCache';
import { clearPrivateAccountMemory } from '../src/features/auth/services/sessionLogout';
import { homeResponse } from '../test/fixtures/home';
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockFocused,
}));
const original = {
  static: appConfig.staticMarketplaceEnabled,
  testing: appConfig.staticTestingBuild,
};
const nav = { navigate: jest.fn(), openDrawer: jest.fn() };
let tree: ReactTestRenderer, client: QueryClient;
let get: jest.SpiedFunction<typeof apiClient.get>;
const render = () => (
  <QueryClientProvider client={client}>
    <HomeScreen
      route={{ key: 'home', name: 'Home' }}
      navigation={
        nav as unknown as React.ComponentProps<typeof HomeScreen>['navigation']
      }
    />
  </QueryClientProvider>
);
const flush = async () => {
  await Renderer.act(async () => {
    await new Promise<void>(done => setTimeout(done, 0));
  });
};
async function mount() {
  await Renderer.act(async () => {
    tree = Renderer.create(render());
  });
  await flush();
}
const button = (label: string) =>
  tree.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  )[0];
const present = (label: string) =>
  tree.root.findAll(n => n.props.children === label).length > 0;
const press = async (label: string) => {
  await Renderer.act(async () => {
    await button(label).props.onPress();
  });
  await flush();
};
beforeEach(() => {
  mockFocused = true;
  jest.clearAllMocks();
  appConfig.staticMarketplaceEnabled = false;
  appConfig.staticTestingBuild = false;
  useAuthStore.getState().clear();
  useDevelopmentStore.setState({ previewActive: false });
  useSearchStore.getState().reset();
  useLocationStore.getState().useWorldwide();
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  get = jest
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data: homeResponse() });
  jest
    .spyOn(profiles, 'getProfile')
    .mockRejectedValue(new ApiError('Unavailable', 'network'));
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client.clear();
  });
  jest.restoreAllMocks();
  appConfig.staticMarketplaceEnabled = original.static;
  appConfig.staticTestingBuild = original.testing;
});
test('guest Home renders real categories/latest in existing cards with exactly one public request', async () => {
  const toast = jest.spyOn(Toast, 'show');
  await mount();
  expect(button('Browse category Documents')).toBeDefined();
  expect(button('Open listing Actual trip')).toBeDefined();
  expect(present('Popular locations are not provided by the Home API.')).toBe(
    true,
  );
  expect(button('Retry Destinations')).toBeUndefined();
  expect(get).toHaveBeenCalledTimes(1);
  expect(get.mock.calls[0]).toEqual([
    '/home',
    expect.objectContaining({ headers: { Authorization: false } }),
  ]);
  expect(profiles.getProfile).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});
test('Home category and listing taps preserve real IDs and existing routes', async () => {
  await mount();
  await press('Browse category Documents');
  expect(useSearchStore.getState().filters.category).toBe('42');
  expect(nav.navigate).toHaveBeenLastCalledWith('Results');
  await press('Open listing Actual trip');
  expect(nav.navigate).toHaveBeenLastCalledWith('ListingDetails', {
    listingId: '703',
  });
});
test('keyword navigation keeps entered query and does not invent Home request parameters', async () => {
  await mount();
  const input = tree.root
    .findAllByType(TextInput)
    .find(
      n =>
        n.props.accessibilityLabel === 'Search listings, routes or locations',
    )!;
  await Renderer.act(async () => {
    input.props.onChangeText('Documents');
  });
  await press('Submit keyword and selected filters');
  expect(useSearchStore.getState().filters.query).toBe('Documents');
  expect(nav.navigate).toHaveBeenLastCalledWith('Results');
  expect(get).toHaveBeenCalledTimes(1);
});
test('initial loading and empty results use existing section states with no fixtures', async () => {
  let resolve!: (value: {
    status: number;
    data: ReturnType<typeof homeResponse>;
  }) => void;
  get.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await mount();
  expect(
    tree.root.findAll(n => n.props.accessibilityLabel === 'Loading Categories')
      .length,
  ).toBeGreaterThan(0);
  expect(
    tree.root.findAll(n => n.props.accessibilityLabel === 'Loading Latest ads')
      .length,
  ).toBeGreaterThan(0);
  const empty = homeResponse();
  empty.data.categories = [];
  empty.data.latest_listings = [];
  await Renderer.act(async () => {
    resolve({ status: 200, data: empty });
  });
  await flush();
  expect(present('No categories available yet.')).toBe(true);
  expect(present('No latest ads available yet.')).toBe(true);
  expect(button('Open listing Traveller to Dubai')).toBeUndefined();
});
test('automatic load error is inline; simultaneous explicit section retries share one request and one Toast', async () => {
  get.mockRejectedValue(new ApiError('Private server details', 'network'));
  const toast = jest.spyOn(Toast, 'show');
  await mount();
  expect(button('Retry Categories')).toBeDefined();
  expect(button('Retry Latest ads')).toBeDefined();
  expect(toast).not.toHaveBeenCalled();
  await Renderer.act(async () => {
    button('Retry Categories').props.onPress();
    button('Retry Latest ads').props.onPress();
  });
  await flush();
  expect(get).toHaveBeenCalledTimes(2);
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'error', text1: 'Home unavailable' }),
  );
  expect(JSON.stringify(toast.mock.calls)).not.toContain(
    'Private server details',
  );
});
test('pull refresh performs one Home request and no guest private profile request', async () => {
  await mount();
  await Renderer.act(async () => {
    tree.root.findByType(RefreshControl).props.onRefresh();
  });
  await flush();
  expect(get).toHaveBeenCalledTimes(2);
  expect(profiles.getProfile).not.toHaveBeenCalled();
});
test('returning within the existing cache lifetime does not duplicate requests', async () => {
  await mount();
  mockFocused = false;
  await Renderer.act(async () => {
    tree.update(render());
  });
  mockFocused = true;
  await Renderer.act(async () => {
    tree.update(render());
  });
  await flush();
  expect(get).toHaveBeenCalledTimes(1);
});
test('logout/account cleanup keeps valid public Home data and does not fetch it again', async () => {
  useAuthStore
    .getState()
    .setUser({ id: 17, name: 'Member', email: 'm@example.test' });
  await mount();
  const data = client.getQueryData(publicHomeKey);
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
    clearPrivateAccountMemory(client);
  });
  await flush();
  expect(client.getQueryData(publicHomeKey)).toBe(data);
  expect(button('Open listing Actual trip')).toBeDefined();
  expect(get).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(['profile', 17])).toBeUndefined();
});
test('public Home DTO is retained on refresh failure, never replaced with fixtures', async () => {
  await mount();
  const data = client.getQueryData(publicHomeKey);
  get.mockRejectedValueOnce(new ApiError('timeout', 'network'));
  await Renderer.act(async () => {
    tree.root.findByType(RefreshControl).props.onRefresh();
  });
  await flush();
  expect(client.getQueryData(publicHomeKey)).toBe(data);
  expect(button('Open listing Traveller to Dubai')).toBeUndefined();
  expect(button('Retry Latest ads')).toBeDefined();
});
test('legacy static-testing flags cannot replace live Home cards or their real navigation IDs', async () => {
  await mount();
  appConfig.staticMarketplaceEnabled = true;
  appConfig.staticTestingBuild = true;
  await Renderer.act(async () => {
    tree.update(render());
  });
  await flush();
  expect(button('Open listing Actual trip')).toBeDefined();
  expect(button('Open listing Traveller to Dubai')).toBeUndefined();
  await press('Open listing Actual trip');
  expect(nav.navigate).toHaveBeenLastCalledWith('ListingDetails', {
    listingId: '703',
  });
  expect(get).toHaveBeenCalledTimes(1);
  appConfig.staticMarketplaceEnabled = false;
  appConfig.staticTestingBuild = false;
  await Renderer.act(async () => {
    tree.update(render());
  });
  await flush();
  expect(button('Open listing Actual trip')).toBeDefined();
  expect(button('Open listing Traveller to Dubai')).toBeUndefined();
  expect(get).toHaveBeenCalledTimes(1);
});
test('retry completion after navigation away cannot show an error Toast', async () => {
  get.mockRejectedValueOnce(new ApiError('offline', 'network'));
  await mount();
  const toast = jest.spyOn(Toast, 'show');
  let reject!: (error: Error) => void;
  get.mockImplementationOnce(
    () =>
      new Promise((_done, fail) => {
        reject = fail;
      }),
  );
  await Renderer.act(async () => {
    button('Retry Categories').props.onPress();
  });
  mockFocused = false;
  await Renderer.act(async () => {
    tree.update(render());
  });
  await Renderer.act(async () => {
    reject(new ApiError('timeout', 'network'));
  });
  await flush();
  expect(toast).not.toHaveBeenCalled();
});
