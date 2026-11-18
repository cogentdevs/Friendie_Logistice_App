import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { FiltersScreen } from '../src/features/search/screens/FiltersScreen';
import { ListingReferencePicker } from '../src/features/post-listing/components/ListingReferencePicker';
import { useFilterDraftStore } from '../src/features/search/store/filterDraftStore';
import { useSearchStore } from '../src/features/search/store/searchStore';
import { useLocationStore } from '../src/features/location/store/locationStore';
import { publicSearchParams } from '../src/features/listings/services/publicListingsService';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import type { ListingReference } from '../src/features/post-listing/services/listingReferencesService';
import { HomeSearchCard } from '../src/features/home/components/HomeSearchCard';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
const countries = [
  { id: 42, name: 'Alpha', short_name: 'AA', image_url: null },
  { id: 87, name: 'Beta', short_name: 'BB', image_url: null },
];
const response = (items: unknown[]) => ({
  status: 200,
  data: { success: true, message: 'OK', data: { items } },
});
const city = (countryId: number) => ({
  id: countryId === 42 ? 501 : 777,
  country_id: countryId,
  name: countryId === 42 ? 'Alpha City' : 'Beta City',
  short_name: null,
});
const originalMode = appConfig.staticMarketplaceEnabled;
let tree: ReactTestRenderer, client: QueryClient, get: jest.SpyInstance;
const navigation = {
  getState: () => ({
    routes: [{ name: 'Search' }, { name: 'Filters' }],
    index: 1,
  }),
  goBack: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
};
async function mount() {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <FiltersScreen navigation={navigation} />
      </QueryClientProvider>,
    );
  });
}
beforeEach(async () => {
  appConfig.staticMarketplaceEnabled = false;
  useLocationStore.getState().useWorldwide();
  useSearchStore.setState({
    filters: {
      query: 'parcel',
      category: '72',
      type: 'carry',
      weightKg: 0,
      date: '2027-01-09',
    },
  });
  useFilterDraftStore.getState().reset();
  useFilterDraftStore.setState({ appliedKey: undefined });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  get = jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) =>
      response(
        url === '/countries'
          ? countries
          : [
              city(
                Number(
                  (config?.params as { country_id?: number } | undefined)
                    ?.country_id,
                ),
              ),
            ],
      ),
    );
  await mount();
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree.unmount();
    client.clear();
  });
  appConfig.staticMarketplaceEnabled = originalMode;
  jest.restoreAllMocks();
  navigation.goBack.mockClear();
});
const button = (label: string) =>
  tree.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  )[0];
async function press(label: string) {
  await waitFor(() => button(label));
  await Renderer.act(async () => {
    await button(label).props.onPress();
  });
}
async function waitFor<T>(read: () => T): Promise<T> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const value = read();
    if (value) return value;
    await Renderer.act(async () => {
      await new Promise<void>(resolve => setImmediate(resolve));
    });
  }
  throw new Error('Expected reference UI did not settle.');
}
async function country(side: 'From' | 'To', name = 'Alpha') {
  await press('Choose ' + side + ' Country');
  await press(name);
}
async function selectCity(side: 'From' | 'To', name = 'Alpha City') {
  await press('Choose ' + side + ' City');
  await press(name);
}
const countryValue = (id: number): ListingReference => ({
  id,
  name: id === 42 ? 'Alpha' : 'Beta',
});

test('guest selectors use the existing public reference services, real labels/IDs, shared countries and exact route query', async () => {
  expect(button('Choose From City').props.disabled).toBe(true);
  await country('From');
  await selectCity('From');
  await country('To', 'Beta');
  await selectCity('To', 'Beta City');
  expect(get.mock.calls.filter(call => call[0] === '/countries')).toHaveLength(
    1,
  );
  expect(get).toHaveBeenCalledWith(
    '/cities',
    expect.objectContaining({
      headers: { Authorization: false },
      params: { country_id: 42 },
    }),
  );
  expect(get).toHaveBeenCalledWith(
    '/cities',
    expect.objectContaining({ params: { country_id: 87 } }),
  );
  expect(useSearchStore.getState().filters.routeReferences).toBeUndefined();
  await press('Apply Filters');
  expect(
    publicSearchParams(1, useSearchStore.getState().filters, {
      mode: 'worldwide',
    }),
  ).toEqual({
    page: 1,
    per_page: 20,
    search: 'parcel',
    category_id: 72,
    ad_type: 'Carring',
    weight: 0,
    departure_on: '2027-01-09',
    from_country_id: 42,
    from_city_id: 501,
    to_country_id: 87,
    to_city_id: 777,
  });
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
  await press('Apply Filters');
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
});
test('changing one country clears only its city; country-only queries and independent sides work', async () => {
  await country('From');
  await selectCity('From');
  await country('To');
  await selectCity('To');
  await country('From', 'Beta');
  expect(useFilterDraftStore.getState().routeReferences).toMatchObject({
    from: { country: { id: 87 } },
    to: { city: { id: 501 } },
  });
  expect(
    useFilterDraftStore.getState().routeReferences.from?.city,
  ).toBeUndefined();
  await press('Apply Filters');
  const params = publicSearchParams(1, useSearchStore.getState().filters, {
    mode: 'worldwide',
  });
  expect(params).toMatchObject({
    from_country_id: 87,
    to_country_id: 42,
    to_city_id: 501,
  });
  expect(params.from_city_id).toBeUndefined();
});
test('clearing a city preserves its country; clearing country clears dependent city', async () => {
  await country('From');
  await selectCity('From');
  await country('To', 'Beta');
  await press('Clear From City');
  expect(useFilterDraftStore.getState().routeReferences.from).toEqual({
    country: countryValue(42),
  });
  await selectCity('From');
  await press('Clear From Country');
  expect(useFilterDraftStore.getState().routeReferences.from).toBeUndefined();
  expect(useFilterDraftStore.getState().routeReferences.to?.country.id).toBe(
    87,
  );
  expect(button('Choose From City').props.disabled).toBe(true);
});
test('cancel/back and reopening discard uncommitted edits without modifying applied filters', async () => {
  const before = useSearchStore.getState().filters;
  await country('From');
  expect(useSearchStore.getState().filters).toBe(before);
  await Renderer.act(async () => {
    tree.unmount();
  });
  await mount();
  expect(useFilterDraftStore.getState().routeReferences).toEqual({});
  expect(useSearchStore.getState().filters).toBe(before);
});
test('Reset clears route selections only on Apply and keeps unrelated keyword/category/weight/date', async () => {
  await country('From');
  await selectCity('From');
  const header = navigation.setOptions.mock.calls.at(-1)![0];
  await Renderer.act(async () => {
    const node = header.headerRight();
    node.props.onPress();
  });
  await press('Apply Filters');
  expect(
    publicSearchParams(1, useSearchStore.getState().filters, {
      mode: 'worldwide',
    }),
  ).toEqual({
    page: 1,
    per_page: 20,
    search: 'parcel',
    category_id: 72,
    ad_type: 'Carring',
    weight: 0,
    departure_on: '2027-01-09',
  });
});
test('a stale city callback cannot restore a city after its country changes', async () => {
  await country('From');
  await press('Choose From City');
  const stale = tree.root.findByType(ListingReferencePicker).props.onSelect;
  await Renderer.act(async () => {
    useFilterDraftStore.getState().selectRouteCountry('from', countryValue(87));
  });
  await Renderer.act(async () => {
    stale({
      key: '501',
      label: 'Alpha City',
      value: { id: 501, name: 'Alpha City', countryId: 42 },
    });
  });
  expect(useFilterDraftStore.getState().routeReferences.from).toEqual({
    country: countryValue(87),
  });
});
test('empty country response keeps truthful empty feedback and does not fabricate options', async () => {
  get.mockResolvedValueOnce(response([]));
  await press('Choose From Country');
  await waitFor(
    () =>
      tree.root.findAll(n => n.props.children === 'No options available.')
        .length,
  );
  expect(
    tree.root.findAll(n => n.props.children === 'No options available.').length,
  ).toBeGreaterThan(0);
  await press('Cancel selection');
  expect(useFilterDraftStore.getState().routeReferences).toEqual({});
});
test('failed public reference request uses existing inline retry, with Toast only on explicit retry failure', async () => {
  const toast = jest.spyOn(Toast, 'show');
  get.mockRejectedValue(new Error('offline'));
  await press('Choose From Country');
  expect(toast).not.toHaveBeenCalled();
  await press('Retry options');
  expect(toast).toHaveBeenCalledTimes(1);
  await press('Cancel selection');
  expect(useSearchStore.getState().filters.routeReferences).toBeUndefined();
});
test('city-country mismatch is rejected by the existing reference parser', async () => {
  await country('From');
  get.mockResolvedValueOnce(response([city(87)]));
  await press('Choose From City');
  await waitFor(
    () =>
      tree.root.findAll(
        n => n.props.children === 'Unable to load options. Please try again.',
      ).length,
  );
  expect(
    tree.root.findAll(
      n => n.props.children === 'Unable to load options. Please try again.',
    ).length,
  ).toBeGreaterThan(0);
  expect(
    useFilterDraftStore.getState().routeReferences.from?.city,
  ).toBeUndefined();
});
test('late city response is canceled after a rapid parent change and cannot populate the new country', async () => {
  await country('From');
  let resolve!: (value: ReturnType<typeof response>) => void;
  const pending = new Promise<ReturnType<typeof response>>(r => {
    resolve = r;
  });
  get.mockReturnValueOnce(pending);
  await press('Choose From City');
  const signal = get.mock.calls.at(-1)![1].signal as AbortSignal;
  await Renderer.act(async () => {
    useFilterDraftStore.getState().selectRouteCountry('from', countryValue(87));
  });
  expect(signal.aborted).toBe(true);
  await Renderer.act(async () => {
    resolve(response([city(42)]));
    await pending;
  });
  expect(
    useFilterDraftStore.getState().routeReferences.from?.city,
  ).toBeUndefined();
  await selectCity('From', 'Beta City');
  expect(useFilterDraftStore.getState().routeReferences.from?.city?.id).toBe(
    777,
  );
});
test('empty city list keeps selected country and does not fabricate a city', async () => {
  await country('From');
  get.mockResolvedValueOnce(response([]));
  await press('Choose From City');
  await waitFor(
    () =>
      tree.root.findAll(n => n.props.children === 'No options available.')
        .length,
  );
  expect(useFilterDraftStore.getState().routeReferences.from).toEqual({
    country: countryValue(42),
  });
});
test('invalid country envelope exposes the existing error state without selected IDs', async () => {
  get.mockResolvedValueOnce({
    status: 200,
    data: { success: true, data: { items: [{ id: 42 }] } },
  });
  await press('Choose From Country');
  await waitFor(
    () =>
      tree.root.findAll(
        n => n.props.children === 'Unable to load options. Please try again.',
      ).length,
  );
  expect(useFilterDraftStore.getState().routeReferences).toEqual({});
});
test('unknown numeric IDs and foreign cities cannot enter selected route state', async () => {
  await country('From');
  await selectCity('From');
  await Renderer.act(async () => {
    useFilterDraftStore
      .getState()
      .selectRouteCountry('to', { id: 999999, name: 'Unverified' });
    useFilterDraftStore
      .getState()
      .selectRouteCity('from', 42, { id: 777, name: 'Foreign', countryId: 87 });
  });
  expect(useFilterDraftStore.getState().routeReferences.to).toBeUndefined();
  expect(useFilterDraftStore.getState().routeReferences.from?.city?.id).toBe(
    501,
  );
  expect(() =>
    publicSearchParams(
      1,
      {
        routeReferences: {
          from: {
            country: countryValue(42),
            city: { id: 777, countryId: 87, name: 'Foreign' },
          },
        },
      },
      { mode: 'worldwide' },
    ),
  ).toThrow();
});
test('Home submission retains the approved filter reference IDs without changing Home controls', async () => {
  await country('From');
  await selectCity('From');
  await country('To', 'Beta');
  await press('Apply Filters');
  const references = useSearchStore.getState().filters.routeReferences;
  const submit = jest.fn();
  await Renderer.act(async () => {
    tree.unmount();
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <HomeSearchCard
          categories={{
            data: [],
            isPending: false,
            isError: false,
            refetch: async () => {},
          }}
          onSearch={submit}
          onFilters={jest.fn()}
        />
      </QueryClientProvider>,
    );
  });
  await press('Submit keyword and selected filters');
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit.mock.calls[0][0].routeReferences).toBe(references);
  expect(
    publicSearchParams(1, submit.mock.calls[0][0], { mode: 'worldwide' }),
  ).toMatchObject({
    from_country_id: 42,
    from_city_id: 501,
    to_country_id: 87,
    weight: 0,
  });
});
test('explicit demo mode retains the old filter presentation and makes no reference requests', async () => {
  await Renderer.act(async () => {
    tree.unmount();
    appConfig.staticMarketplaceEnabled = true;
  });
  await mount();
  expect(button('Choose From Country')).toBeUndefined();
  expect(get).not.toHaveBeenCalled();
});
