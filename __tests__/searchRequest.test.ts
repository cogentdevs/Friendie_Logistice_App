import {
  buildListingSearchParams,
  getListings,
} from '../src/features/listings/services/listingsService';
import {
  sameLocation,
  dateRangeSchema,
  routeLocationSchema,
} from '../src/features/search/types/search';
import { routeFixture } from '../test/fixtures/search';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
afterEach(() => jest.restoreAllMocks());
test('same city names in different countries are distinct route locations', () => {
  const a = {
    ...routeFixture.from,
    placeId: undefined,
    coordinates: undefined,
    area: undefined,
  };
  const b = { ...a, country: { code: 'IN', name: 'India' } };
  expect(sameLocation(a, b)).toBe(false);
  expect(sameLocation(a, { ...a })).toBe(true);
});
test('coordinates and real calendar dates are validated', () => {
  expect(
    routeLocationSchema.safeParse({
      ...routeFixture.from,
      coordinates: { latitude: 91, longitude: 10 },
    }).success,
  ).toBe(false);
  expect(
    dateRangeSchema.safeParse({ start: '2027-02-30', end: '2027-03-01' })
      .success,
  ).toBe(false);
  expect(
    dateRangeSchema.safeParse({ start: '2027-03-01', end: '2027-02-28' })
      .success,
  ).toBe(false);
});
test.each(['manual', 'gps'] as const)(
  'structured route serialization preserves IDs, coordinates and %s radius mode',
  source => {
    const params = buildListingSearchParams(
      1,
      {
        type: 'carry',
        from: routeFixture.from,
        to: routeFixture.to,
        dates: { start: '2099-01-01', end: '2099-01-05' },
      },
      {
        mode: 'radius',
        filter: {
          latitude: 51.5,
          longitude: -0.1,
          radiusKm: 30,
          source,
          cityId: 9,
        },
      },
    );
    expect(params).toMatchObject({
      from: routeFixture.from,
      to: routeFixture.to,
      date_from: '2099-01-01',
      date_to: '2099-01-05',
      latitude: 51.5,
      longitude: -0.1,
      radiusKm: 30,
      source,
      ...(source === 'manual' ? { cityId: 9 } : {}),
      worldwide: false,
    });
  },
);
test('unverified listing contract sends no network request', async () => {
  const old = appConfig.listingsApiVerified;
  appConfig.listingsApiVerified = false;
  const get = jest.spyOn(apiClient, 'get');
  try {
    await expect(getListings(1, {}, { mode: 'worldwide' })).rejects.toThrow(
      'currently unavailable',
    );
    expect(get).not.toHaveBeenCalled();
  } finally {
    appConfig.listingsApiVerified = old;
  }
});
