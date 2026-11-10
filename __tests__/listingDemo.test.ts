import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { appConfig } from '../src/constants/appConfig';
import { getListings } from '../src/features/listings/services/listingsService';
import { getListingDetails } from '../src/features/listings/services/listingDetailsService';
import { apiClient } from '../src/services/api/apiClient';
import { getDemoListings } from '../src/features/listings/development/demoListings';
const previous = appConfig.uiPreviewEnabled;
const previousStatic = appConfig.staticMarketplaceEnabled;
beforeEach(() => {
  appConfig.staticMarketplaceEnabled = true;
});
afterEach(() => {
  appConfig.uiPreviewEnabled = previous;
  appConfig.staticMarketplaceEnabled = previousStatic;
  useDevelopmentStore.setState({ previewActive: false });
  jest.restoreAllMocks();
});
test('UI preview supplies paginated demo cards and matching details without API calls', async () => {
  appConfig.uiPreviewEnabled = true;
  useDevelopmentStore.setState({ previewActive: true });
  const get = jest.spyOn(apiClient, 'get');
  const first = await getListings(1, {}, { mode: 'worldwide' });
  const next = await getListings(2, {}, { mode: 'worldwide' });
  expect(first.meta.total).toBe(8);
  expect(new Set([...first.data, ...next.data].map(item => item.id)).size).toBe(
    8,
  );
  const details = await getListingDetails(String(first.data[0].id));
  expect(details.price).toBe(first.data[0].price);
  expect(details.contact?.conversationId).toBe('demo-listing-' + details.id);
  expect(get).not.toHaveBeenCalled();
});
test('public fixture availability has its own off switch', async () => {
  appConfig.staticMarketplaceEnabled = false;
  appConfig.uiPreviewEnabled = false;
  useDevelopmentStore.setState({ previewActive: true });
  await expect(getListingDetails('900001')).rejects.toThrow('unavailable');
});
test('demo filters update the sample result count', () => {
  const carry = getDemoListings(1, { type: 'carry' }, { mode: 'worldwide' });
  const send = getDemoListings(1, { type: 'send' }, { mode: 'worldwide' });
  expect(carry.meta.total).toBe(6);
  expect(send.meta.total).toBe(2);
  expect(
    getDemoListings(1, { destination: 'London' }, { mode: 'worldwide' }).meta
      .total,
  ).toBe(0);
});

test('authenticated viewers retain public fixtures independently of login preview', async () => {
  appConfig.uiPreviewEnabled = true;
  useDevelopmentStore.setState({ previewActive: true });
  useAuthStore
    .getState()
    .setUser({ id: 12, name: 'Member', email: 'member@example.test' });
  const {
    isListingDemoMode,
  } = require('../src/features/listings/development/demoListings');
  expect(isListingDemoMode()).toBe(true);
  useAuthStore.getState().clear();
});
