import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import {
  getMyListings,
  MyListing,
} from '../src/features/listings/services/myListingsService';
import { getListingDetails } from '../src/features/listings/services/listingDetailsService';
const item: MyListing = {
  id: 1,
  ownerId: 8,
  status: 'active',
  type: 'carry',
  title: 'Trip',
  origin: 'Karachi',
  destination: 'Dubai',
  departureDate: '2000-01-01',
  category: 'Documents',
  price: 120,
  currency: 'USD',
  capacityKg: 15,
};
let previous: { url: string; verified: boolean; preview: boolean };
beforeEach(() => {
  previous = {
    url: appConfig.apiBaseUrl,
    verified: appConfig.myListingsApiVerified,
    preview: appConfig.uiPreviewEnabled,
  };
  useDevelopmentStore.setState({ previewActive: false });
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'm@example.test' });
});
afterEach(() => {
  appConfig.apiBaseUrl = previous.url;
  appConfig.myListingsApiVerified = previous.verified;
  appConfig.uiPreviewEnabled = previous.preview;
  useDevelopmentStore.setState({ previewActive: false });
  jest.restoreAllMocks();
});
test('unverified endpoint and unauthenticated requests transmit nothing', async () => {
  appConfig.myListingsApiVerified = false;
  const get = jest.spyOn(apiClient, 'get');
  await expect(getMyListings('active', 1)).rejects.toThrow('unavailable');
  useAuthStore.getState().clear();
  await expect(getMyListings('active', 1)).rejects.toThrow('Sign in');
  expect(get).not.toHaveBeenCalled();
});
test('verified route is authenticated/scoped and owner mismatch is rejected', async () => {
  appConfig.apiBaseUrl = 'https://example.test/api';
  appConfig.myListingsApiVerified = true;
  const get = jest
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce({
      data: { data: [item], meta: { current_page: 1, last_page: 1, total: 1 } },
    })
    .mockResolvedValueOnce({
      data: {
        data: [{ ...item, ownerId: 99 }],
        meta: { current_page: 1, last_page: 1 },
      },
    });
  const result = await getMyListings('active', 1);
  expect(get).toHaveBeenCalledWith('/user/listings', {
    signal: undefined,
    params: { status: 'active', page: 1 },
  });
  expect(result.data[0].status).toBe('active');
  await expect(getMyListings('active', 1)).rejects.toMatchObject({
    kind: 'forbidden',
  });
});
test('wrong status is rejected rather than inferring expiration from dates', async () => {
  appConfig.apiBaseUrl = 'https://example.test/api';
  appConfig.myListingsApiVerified = true;
  jest
    .spyOn(apiClient, 'get')
    .mockResolvedValue({
      data: {
        data: [{ ...item, status: 'completed' }],
        meta: { current_page: 1, last_page: 1 },
      },
    });
  await expect(getMyListings('active', 1)).rejects.toThrow(
    'selected listing status',
  );
});
test('preview status fixtures and matching details are available without authentication', async () => {
  appConfig.uiPreviewEnabled = true;
  useAuthStore.getState().clear();
  useDevelopmentStore.setState({ previewActive: true });
  const get = jest.spyOn(apiClient, 'get');
  const active = await getMyListings('active', 1),
    completed = await getMyListings('completed', 1),
    expired = await getMyListings('expired', 1);
  expect(active.meta.counts).toEqual({ active: 3, completed: 1, expired: 1 });
  expect(completed.data[0].status).toBe('completed');
  expect(expired.data[0].status).toBe('expired');
  await expect(
    getListingDetails(String(completed.data[0].id)),
  ).resolves.toMatchObject({ status: 'completed' });
  expect(get).not.toHaveBeenCalled();
});
test('an account change during a read prevents returning old account data', async () => {
  appConfig.apiBaseUrl = 'https://example.test/api';
  appConfig.myListingsApiVerified = true;
  let finish!: (value: unknown) => void;
  jest.spyOn(apiClient, 'get').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const result = getMyListings('active', 1);
  useAuthStore
    .getState()
    .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
  finish({ data: { data: [item], meta: { current_page: 1, last_page: 1 } } });
  await expect(result).rejects.toMatchObject({ kind: 'unauthorized' });
});
