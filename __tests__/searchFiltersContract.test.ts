import {
  publicSearchParams,
  getPublicListings,
} from '../src/features/listings/services/publicListingsService';
import { homeSearchSchema } from '../src/features/home/types/homeSearchSchema';
import { validSearchWeight } from '../src/features/search/types/searchValidation';
import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
import type { SearchFilters } from '../src/features/search/store/searchStore';
import { routeFixture } from '../test/fixtures/search';
import { useFilterDraftStore } from '../src/features/search/store/filterDraftStore';
import { useLocationStore } from '../src/features/location/store/locationStore';
import { useSearchStore } from '../src/features/search/store/searchStore';

const worldwide = { mode: 'worldwide' } as const;
const original = appConfig.staticMarketplaceEnabled;
beforeEach(() => {
  appConfig.staticMarketplaceEnabled = false;
});
afterEach(() => {
  appConfig.staticMarketplaceEnabled = original;
  jest.restoreAllMocks();
});

test('combined public query preserves real identities, zero, exact local date and trims search', () => {
  expect(
    publicSearchParams(
      2,
      {
        query: '  parcel  ',
        category: '42',
        type: 'carry',
        weightKg: 0,
        from: routeFixture.from,
        to: routeFixture.to,
        dates: { start: '2027-01-09', end: '2027-01-09' },
      },
      worldwide,
    ),
  ).toEqual({
    page: 2,
    per_page: 20,
    search: 'parcel',
    category_id: 42,
    ad_type: 'Carring',
    weight: 0,
    departure_on: '2027-01-09',
    from_country_id: Number(routeFixture.from.country.id),
    from_city_id: Number(routeFixture.from.city.id),
    to_country_id: Number(routeFixture.to.country.id),
    to_city_id: Number(routeFixture.to.city.id),
  });
});
test('empty keyword/category are omitted, not converted to zero identities', () => {
  expect(
    publicSearchParams(1, { query: '   ', category: '' }, worldwide),
  ).toEqual({ page: 1, per_page: 20 });
});
test.each(['2027-02-30', '2027-13-01', '01/01/2027', '2027-1-01'])(
  'invalid calendar date %s is rejected before HTTP',
  async date => {
    const get = jest.spyOn(apiClient, 'get');
    await expect(
      getPublicListings(1, { date }, worldwide),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(get).not.toHaveBeenCalled();
  },
);
test.each([0.5, -1, NaN, Infinity, 2147483648])(
  'invalid weight %s is rejected',
  weightKg => {
    expect(() => publicSearchParams(1, { weightKg }, worldwide)).toThrow();
  },
);
test.each(['1e2', ' 42', '0', '-3', 'fixture', true])(
  'noncanonical category %s is rejected',
  category => {
    expect(() =>
      publicSearchParams(1, { category } as SearchFilters, worldwide),
    ).toThrow();
  },
);
test.each([
  { verifiedOnly: true },
  { availableNow: true },
  { origin: 'London' },
  { currency: 'USD' },
  { sort: 'price' },
  { type: 'unknown' },
  { dates: { start: '2027-01-01', end: '2027-01-02' } },
])('unsupported filters never become invented parameters: %j', filters => {
  expect(() =>
    publicSearchParams(1, filters as SearchFilters, worldwide),
  ).toThrow();
});
test.each(['0', '2147483647', ''])('live weight accepts %s', value => {
  expect(validSearchWeight(value, false)).toBe(true);
});
test.each(['0.5', '-1', '2147483648', 'Infinity', '1e2'])(
  'live weight rejects %s',
  value => {
    expect(validSearchWeight(value, false)).toBe(false);
  },
);
test('Home live validation accepts zero and rejects decimals and overlength keywords', () => {
  const values = { type: 'send', query: '', category: '', weight: '0' };
  expect(homeSearchSchema.safeParse(values).success).toBe(true);
  expect(homeSearchSchema.safeParse({ ...values, weight: '7.5' }).success).toBe(
    false,
  );
  expect(
    homeSearchSchema.safeParse({ ...values, query: 'a'.repeat(101) }).success,
  ).toBe(false);
});
test('demo validation keeps its existing positive-decimal behavior', () => {
  expect(validSearchWeight('7.5', true)).toBe(true);
  expect(validSearchWeight('0', true)).toBe(false);
});

test('live advanced Apply rejects unsupported flags without changing applied state; Reset can clear them', () => {
  useLocationStore.getState().useWorldwide();
  useSearchStore.setState({ filters: { query: 'keep', category: '42' } });
  useFilterDraftStore.getState().reset();
  const before = useSearchStore.getState().filters;
  useFilterDraftStore.getState().setFlags({ verifiedOnly: true });
  expect(useFilterDraftStore.getState().apply()).toBe(false);
  expect(useSearchStore.getState().filters).toBe(before);
  expect(useLocationStore.getState().selection).toEqual({ mode: 'worldwide' });
  useFilterDraftStore.getState().reset();
  expect(useFilterDraftStore.getState().apply()).toBe(true);
  expect(useSearchStore.getState().filters).toMatchObject({
    query: 'keep',
    category: '42',
    verifiedOnly: false,
  });
});
