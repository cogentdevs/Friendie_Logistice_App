import { homeService } from '../src/features/home/services/homeService';
import { homeSearchSchema } from '../src/features/home/types/homeSearchSchema';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { useAuthStore } from '../src/store/authStore';
import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
import { getListings } from '../src/features/listings/services/listingsService';
import { routeFixture } from '../test/fixtures/search';
const original = appConfig.uiPreviewEnabled;
const originalStatic = appConfig.staticMarketplaceEnabled;
beforeEach(() => {
  appConfig.uiPreviewEnabled = true;
  appConfig.staticMarketplaceEnabled = true;
  useDevelopmentStore.setState({ previewActive: false });
  useAuthStore.getState().clear();
});
afterEach(() => {
  appConfig.uiPreviewEnabled = original;
  appConfig.staticMarketplaceEnabled = originalStatic;
  jest.restoreAllMocks();
});
test('disabled static feeds never guess production endpoints', async () => {
  appConfig.staticMarketplaceEnabled = false;
  const get = jest.spyOn(apiClient, 'get');
  await expect(homeService.categories()).rejects.toThrow('disabled');
  await expect(homeService.destinations()).rejects.toThrow('disabled');
  await expect(homeService.latest()).rejects.toThrow('disabled');
  await expect(homeService.unread()).rejects.toThrow('unavailable');
  expect(get).not.toHaveBeenCalled();
});
test('development-only sections include reference categories/destinations and a bounded sample feed', async () => {
  useDevelopmentStore.setState({ previewActive: true });
  expect(await homeService.categories()).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'Food Items' })]),
  );
  expect((await homeService.destinations()).map(d => d.country.code)).toEqual([
    'SA',
    'AE',
    'PH',
    'BH',
    'PK',
    'IN',
    'GB',
  ]);
  expect(await homeService.latest()).toHaveLength(3);
});
test('route and optional weight/date validation reject invalid search values', () => {
  const valid = {
    type: 'carry' as const,
    query: '',
    category: '',
    weight: '5',
    from: routeFixture.from,
    to: routeFixture.to,
  };
  expect(homeSearchSchema.safeParse(valid).success).toBe(true);
  for (const weight of ['0', '-3', 'NaN', 'Infinity', '1e3'])
    expect(homeSearchSchema.safeParse({ ...valid, weight }).success).toBe(
      false,
    );
  expect(homeSearchSchema.safeParse({ ...valid, weight: '' }).success).toBe(
    true,
  );
  expect(
    homeSearchSchema.safeParse({ ...valid, from: null, to: null }).success,
  ).toBe(true);
  expect(
    homeSearchSchema.safeParse({
      ...valid,
      from: undefined,
      to: undefined,
      query: 'Dubai',
    }).success,
  ).toBe(true);
  expect(homeSearchSchema.safeParse({ ...valid, to: null }).success).toBe(true);
  expect(homeSearchSchema.safeParse({ ...valid, to: valid.from }).success).toBe(
    false,
  );
  expect(
    homeSearchSchema.safeParse({
      ...valid,
      dates: { start: '2000-01-01', end: '2000-01-01' },
    }).success,
  ).toBe(false);
});
test('country and weight constraints cannot be silently sent to an unverified serializer contract', async () => {
  const config = {
    staticMarketplaceEnabled: appConfig.staticMarketplaceEnabled,
    apiBaseUrl: appConfig.apiBaseUrl,
    listingsApiVerified: appConfig.listingsApiVerified,
  };
  Object.assign(appConfig, {
    staticMarketplaceEnabled: false,
    apiBaseUrl: 'https://example.test',
    listingsApiVerified: true,
  });
  const get = jest.spyOn(apiClient, 'get');
  try {
    await expect(
      getListings(1, { weightKg: 5 }, { mode: 'worldwide' }),
    ).rejects.toThrow('verified backend filter contract');
    await expect(
      getListings(
        1,
        { destinationCountry: { id: 12, code: 'AE', name: 'UAE' } },
        { mode: 'worldwide' },
      ),
    ).rejects.toThrow('verified backend filter contract');
    expect(get).not.toHaveBeenCalled();
  } finally {
    Object.assign(appConfig, config);
  }
});
