import { appConfig } from '../src/constants/appConfig';
import { isStaticMarketplaceEnabled } from '../src/features/listings/development/staticMarketplace';
import { homeService } from '../src/features/home/services/homeService';
import { getListings } from '../src/features/listings/services/listingsService';
import {
  getListingDetails,
  permittedPhone,
} from '../src/features/listings/services/listingDetailsService';
import { useAuthStore } from '../src/store/authStore';
import {
  useDevelopmentStore,
  isUiPreviewActive,
} from '../src/store/developmentStore';
import { apiClient } from '../src/services/api/apiClient';
const original = {
  enabled: appConfig.staticMarketplaceEnabled,
  ui: appConfig.uiPreviewEnabled,
  testing: appConfig.testingUiPreview,
};
beforeEach(() => {
  appConfig.staticMarketplaceEnabled = true;
  appConfig.uiPreviewEnabled = false;
  useDevelopmentStore.setState({ previewActive: false });
  useAuthStore.getState().clear();
});
afterEach(() => {
  appConfig.staticMarketplaceEnabled = original.enabled;
  appConfig.uiPreviewEnabled = original.ui;
  appConfig.testingUiPreview = original.testing;
  useAuthStore.getState().clear();
  jest.restoreAllMocks();
});
test('guest and member receive the same existing catalogue without authentication or HTTP', async () => {
  const get = jest.spyOn(apiClient, 'get');
  const guestIdentity = useAuthStore.getState();
  const guest = await Promise.all([
    homeService.categories(),
    homeService.destinations(),
    homeService.latest(),
  ]);
  expect(guest[0].map(c => c.name)).toEqual([
    'Food Items',
    'Personal Items',
    'Documents',
  ]);
  expect(
    guest[1]
      .filter(d => d.photo)
      .map(d => d.country.code)
      .sort(),
  ).toEqual(['AE', 'GB', 'PK', 'SA']);
  expect(guest[2].map(d => d.id)).toEqual([900001, 900002, 900003]);
  expect(useAuthStore.getState()).toBe(guestIdentity);
  const first = await getListings(1, {}, { mode: 'worldwide' });
  const second = await getListings(2, {}, { mode: 'worldwide' });
  expect(new Set([...first.data, ...second.data].map(d => d.id)).size).toBe(8);
  for (const listing of [...first.data, ...second.data]) {
    const detail = await getListingDetails(String(listing.id));
    expect(detail.contact?.phone).toBeUndefined();
    expect(permittedPhone(detail)).toBeUndefined();
  }
  useAuthStore
    .getState()
    .setUser({ id: 44, name: 'Member', email: 'member@example.test' });
  expect(
    await Promise.all([
      homeService.categories(),
      homeService.destinations(),
      homeService.latest(),
    ]),
  ).toEqual(guest);
  expect(isUiPreviewActive()).toBe(false);
  useAuthStore.getState().clear();
  expect(await homeService.latest()).toEqual(guest[2]);
  expect(get).not.toHaveBeenCalled();
});
test('production runtime excludes fixtures even with development and release preview flags set', async () => {
  jest.replaceProperty(
    globalThis as typeof globalThis & { __DEV__: boolean },
    '__DEV__',
    false,
  );
  appConfig.staticMarketplaceEnabled = true;
  appConfig.uiPreviewEnabled = true;
  appConfig.testingUiPreview = true;
  useDevelopmentStore.setState({ previewActive: true });
  expect(isStaticMarketplaceEnabled()).toBe(false);
  await expect(homeService.categories()).rejects.toThrow('disabled');
});

test.each([
  ['keyword', { query: 'Dubai' }, 8],
  ['carry type', { type: 'carry' as const }, 6],
  ['send type', { type: 'send' as const }, 2],
  ['existing category', { category: 'Personal Items' }, 8],
  ['category without matching listings', { category: 'Documents' }, 0],
  [
    'UAE destination',
    { destinationCountry: { id: 'demo-AE', code: 'AE', name: 'UAE' } },
    8,
  ],
  [
    'destination without matching listings',
    {
      destinationCountry: { id: 'demo-GB', code: 'GB', name: 'United Kingdom' },
    },
    0,
  ],
  ['minimum capacity', { weightKg: 20 }, 2],
])(
  'guest public %s search uses the existing catalogue without login or HTTP',
  async (_label, filters, total) => {
    const get = jest.spyOn(apiClient, 'get');
    const result = await getListings(1, filters, { mode: 'worldwide' });
    expect(result.meta.total).toBe(total);
    for (const listing of result.data) {
      const detail = await getListingDetails(String(listing.id));
      expect(detail.id).toBe(listing.id);
      expect(permittedPhone(detail)).toBeUndefined();
    }
    expect(useAuthStore.getState().status).toBe('guest');
    expect(isUiPreviewActive()).toBe(false);
    expect(get).not.toHaveBeenCalled();
  },
);
