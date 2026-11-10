import * as authFlow from '../src/features/auth/services/authFlowCoordinator';
import {
  clearAuthFlow,
  useAuthFlowStore,
} from '../src/features/auth/store/authFlowStore';
import React from 'react';
import { Image, RefreshControl, TextInput } from 'react-native';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeScreen } from '../src/features/home/screens/HomeScreen';
import { homeService } from '../src/features/home/services/homeService';
import { HomeCollectionPicker } from '../src/features/home/components/HomeSections';
import { RouteLocationPicker } from '../src/features/location/components/RouteLocationPicker';
import { SearchDatePicker } from '../src/features/search/components/SearchDatePicker';
import { useSearchStore } from '../src/features/search/store/searchStore';
import { useLocationStore } from '../src/features/location/store/locationStore';
import { useListingBookmarks } from '../src/features/listings/store/bookmarkStore';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
import { routeFixture } from '../test/fixtures/search';
import { locationService } from '../src/features/location/services/locationService';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
let tree: ReactTestRenderer, client: QueryClient;
const nav = { navigate: jest.fn(), openDrawer: jest.fn() };
const original = appConfig.uiPreviewEnabled;
const originalStatic = appConfig.staticMarketplaceEnabled;
async function settle() {
  await Renderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 25));
  });
}
async function mount() {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <HomeScreen
          route={{ key: 'home', name: 'Home' }}
          navigation={
            nav as unknown as React.ComponentProps<
              typeof HomeScreen
            >['navigation']
          }
        />
      </QueryClientProvider>,
    );
  });
  await settle();
}
beforeEach(() => {
  clearAuthFlow();
  jest.clearAllMocks();
  appConfig.uiPreviewEnabled = true;
  appConfig.staticMarketplaceEnabled = true;
  useDevelopmentStore.setState({
    previewActive: true,
    authEntryRequested: false,
  });
  useAuthStore.getState().clear();
  useSearchStore.getState().reset();
  useLocationStore.getState().useWorldwide();
  useListingBookmarks.setState({ ids: [], owner: undefined });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
  });
  jest.restoreAllMocks();
  appConfig.uiPreviewEnabled = original;
  appConfig.staticMarketplaceEnabled = originalStatic;
});
const input = (label: string) =>
  tree.root
    .findAllByType(TextInput)
    .find(n => n.props.accessibilityLabel === label)!;
const button = (label: string) =>
  tree.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  )[0];
const present = (text: string) =>
  tree.root.findAll(n => n.props.children === text).length > 0;
async function press(label: string) {
  await Renderer.act(async () => {
    await button(label).props.onPress();
  });
  await settle();
}
test('all sections render and existing drawer, quick actions and parcel flows remain functional', async () => {
  const guard = jest.spyOn(authFlow, 'requireAuth').mockReturnValue(true);
  await mount();
  for (const heading of [
    'Our Categories',
    'Popular Locations',
    'Latest Ads',
    'Earn Cash by Carrying Goods',
  ])
    expect(present(heading)).toBe(true);
  await press('Open navigation menu');
  expect(nav.openDrawer).toHaveBeenCalledTimes(1);
  for (const label of [
    'Notifications',
    'Open profile',
    'Open My Listings',
    'Send Parcel',
    'Carry Parcel',
    'Open Listings',
    'Open Saved',
    'Open Messages',
    'Open Reviews',
  ])
    await press(label);
  expect(guard).toHaveBeenCalledWith({
    type: 'POST_LISTING',
    params: { listingType: 'send' },
  });
  expect(guard).toHaveBeenCalledWith({ type: 'OPEN_MESSAGES' });
  await press('Post Your Ad');
  expect(guard).toHaveBeenLastCalledWith({
    type: 'POST_LISTING',
    params: { listingType: 'carry' },
  });
  await press('Browse Ads');
  expect(nav.navigate).toHaveBeenLastCalledWith('Results');
  expect(useSearchStore.getState().filters.type).toBe('carry');
}, 15000);
test('route search validates, carries structured IDs/coordinates and weight, and never requests GPS', async () => {
  const gps = jest.spyOn(locationService, 'currentPosition');
  await mount();
  await press('Search Listings');
  expect(present('Select an origin location')).toBe(true);
  expect(nav.navigate).not.toHaveBeenCalled();
  await press('Select search origin');
  await Renderer.act(async () => {
    tree.root.findByType(RouteLocationPicker).props.onSelect(routeFixture.from);
  });
  await press('Select search destination');
  await Renderer.act(async () => {
    tree.root.findByType(RouteLocationPicker).props.onSelect(routeFixture.to);
  });
  await Renderer.act(async () => {
    input('Weight (Kg, optional)').props.onChangeText('7.5');
  });
  await press('Search type carry');
  await press('Search Listings');
  expect(nav.navigate).toHaveBeenLastCalledWith('Results');
  expect(useSearchStore.getState().filters).toMatchObject({
    from: routeFixture.from,
    to: routeFixture.to,
    weightKg: 7.5,
    type: 'carry',
  });
  expect(gps).not.toHaveBeenCalled();
});
test.each(['gps', 'manual'] as const)(
  '%s radius center survives advanced filters, country and category navigation',
  async source => {
    useLocationStore.getState().setLocation({
      latitude: 24.81234,
      longitude: 67.08765,
      radiusKm: 25,
      source,
      centerKind: source === 'gps' ? 'gps' : 'pin',
    });
    const before = useLocationStore.getState().selection;
    await mount();
    await press('Open Home advanced filters');
    expect(nav.navigate).toHaveBeenLastCalledWith('Filters');
    expect(useLocationStore.getState().selection).toEqual(before);
    await press('Search listings in Pakistan');
    expect(useSearchStore.getState().filters.destinationCountry).toEqual({
      id: 'demo-PK',
      code: 'PK',
      name: 'Pakistan',
    });
    expect(useLocationStore.getState().selection).toEqual(before);
    await press('Browse category Food Items');
    expect(useSearchStore.getState().filters.category).toBe('Food Items');
    expect(
      useSearchStore.getState().filters.destinationCountry,
    ).toBeUndefined();
    expect(useLocationStore.getState().selection).toEqual(before);
  },
);
test('date selection and category directory are functional; invalid weight blocks submit', async () => {
  await mount();
  await Renderer.act(async () => {
    input('Weight (Kg, optional)').props.onChangeText('-2');
  });
  await press('Open Home advanced filters');
  expect(present('Enter a positive weight in kg')).toBe(true);
  await press('Select home travel date');
  const today = new Date();
  const day = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  await Renderer.act(async () => {
    tree.root
      .findByType(SearchDatePicker)
      .props.onApply({ start: day, end: day });
  });
  await press('Select search category');
  await press('Choose Documents');
  expect(present('Documents')).toBe(true);
  await press('View all categories');
  expect(tree.root.findByType(HomeCollectionPicker).props.title).toBe(
    'Our Categories',
  );
  await press('Choose Food Items');
  expect(useSearchStore.getState().filters.category).toBe('Food Items');
});
test('View All actions, bounded latest details and unauthenticated save entry work', async () => {
  await mount();
  await press('View all locations');
  await press('Choose UAE');
  expect(useSearchStore.getState().filters.destinationCountry?.code).toBe('AE');
  await press('View all latest ads');
  expect(useSearchStore.getState().filters).toEqual({});
  await press('Open listing Traveller to Dubai');
  expect(nav.navigate).toHaveBeenLastCalledWith('ListingDetails', {
    listingId: '900001',
  });
  await press('Save listing 900001 on this device');
  expect(useAuthFlowStore.getState().flow?.action).toEqual({
    type: 'SAVE_LISTING',
    params: { listingId: '900001' },
  });
});
test('real signed-in local bookmark toggle works and does not claim server persistence', async () => {
  const ads = await homeService.latest();
  jest.spyOn(homeService, 'latest').mockResolvedValue(ads);
  useDevelopmentStore.setState({ previewActive: false });
  useAuthStore
    .getState()
    .setUser({ id: 81, name: 'Real Member', email: 'member@example.test' });
  await mount();
  await press('Save listing 900001 on this device');
  expect(useListingBookmarks.getState().ids).toContain(900001);
  await press('Unsave listing 900001 on this device');
  expect(useListingBookmarks.getState().ids).not.toContain(900001);
  expect(present('Saved listings are stored on this device.')).toBe(true);
});
test('empty/error states, retry, image fallback and pull refresh render without repeated keystroke fetches', async () => {
  const categories = jest
    .spyOn(homeService, 'categories')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue([
      {
        id: 'Food Items',
        name: 'Food Items',
        imageUrl: 'https://example.test/category.png',
      },
    ]);
  jest.spyOn(homeService, 'destinations').mockResolvedValue([]);
  await mount();
  expect(present('No destinations available yet.')).toBe(true);
  await press('Retry Categories');
  expect(present('Food Items')).toBe(true);
  const image = tree.root
    .findAllByType(Image)
    .find(n => n.props.source?.uri === 'https://example.test/category.png')!;
  await Renderer.act(async () => {
    image.props.onError();
  });
  expect(
    tree.root
      .findAllByType(Image)
      .some(n => n.props.source?.uri === 'https://example.test/category.png'),
  ).toBe(false);
  const count = categories.mock.calls.length;
  await Renderer.act(async () => {
    input('Search listings, routes or locations').props.onChangeText('Dubai');
    input('Weight (Kg, optional)').props.onChangeText('8');
  });
  expect(categories).toHaveBeenCalledTimes(count);
  await Renderer.act(async () => {
    tree.root.findByType(RefreshControl).props.onRefresh();
  });
  await settle();
  expect(categories.mock.calls.length).toBeGreaterThan(count);
});

test('pending feeds show skeletons and resolve without fabricating counts', async () => {
  let finish!: (items: { id: string; name: string }[]) => void;
  jest.spyOn(homeService, 'categories').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  expect(
    tree.root.findAll(n => n.props.accessibilityLabel === 'Loading Categories')
      .length,
  ).toBeGreaterThan(0);
  await Renderer.act(async () => {
    finish([]);
  });
  await settle();
  expect(present('No categories available yet.')).toBe(true);
});

test('keyword submission uses the same validated results flow and preserves advanced filters', async () => {
  useSearchStore
    .getState()
    .setFilters({ verifiedOnly: true, radiusTarget: 'destination' });
  await mount();
  await Renderer.act(async () => {
    input('Search listings, routes or locations').props.onChangeText(
      '  documents  ',
    );
  });
  await press('Submit keyword and selected filters');
  expect(nav.navigate).not.toHaveBeenCalled();
  expect(present('Select an origin location')).toBe(true);
  for (const [label, value] of [
    ['Select search origin', routeFixture.from],
    ['Select search destination', routeFixture.to],
  ] as const) {
    await press(label);
    await Renderer.act(async () => {
      tree.root.findByType(RouteLocationPicker).props.onSelect(value);
    });
  }
  await press('Submit keyword and selected filters');
  expect(nav.navigate).toHaveBeenLastCalledWith('Results');
  expect(useSearchStore.getState().filters).toMatchObject({
    query: 'documents',
    from: routeFixture.from,
    to: routeFixture.to,
    verifiedOnly: true,
    radiusTarget: 'destination',
  });
  await Renderer.act(async () => {
    useSearchStore.getState().setFilters({ query: 'updated on results' });
  });
  expect(input('Search listings, routes or locations').props.value).toBe(
    'updated on results',
  );
});

test.each(['guest', 'authenticated'])(
  'public Home cards render for %s with login preview disabled',
  async status => {
    appConfig.uiPreviewEnabled = false;
    useDevelopmentStore.setState({ previewActive: false });
    if (status === 'authenticated')
      useAuthStore
        .getState()
        .setUser({ id: 81, name: 'Member', email: 'member@example.test' });
    const identity = useAuthStore.getState();
    await mount();
    expect(button('Browse category Food Items')).toBeDefined();
    for (const country of ['UAE', 'Saudi Arabia', 'Pakistan', 'United Kingdom'])
      expect(button('Search listings in ' + country)).toBeDefined();
    expect(button('Open listing Traveller to Dubai')).toBeDefined();
    expect(present('Development preview')).toBe(false);
    expect(useAuthStore.getState()).toBe(identity);
  },
);
test('disabled fixtures explain the build state without network text or retry', async () => {
  appConfig.staticMarketplaceEnabled = false;
  await mount();
  expect(present('Static marketplace content is disabled in this build.')).toBe(
    true,
  );
  expect(button('Retry Categories')).toBeUndefined();
  expect(button('Retry Destinations')).toBeUndefined();
  expect(button('Retry Latest ads')).toBeUndefined();
});
