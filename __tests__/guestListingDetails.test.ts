import {
  getListingDetails,
  ListingDetail,
} from '../src/features/listings/services/listingDetailsService';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
const originalUrl = appConfig.apiBaseUrl,
  originalVerified = appConfig.listingDetailsApiVerified;
const data: ListingDetail = {
  id: 12,
  ownerId: 7,
  status: 'active',
  type: 'carry',
  title: 'Public listing',
  origin: 'Karachi',
  destination: 'Dubai',
  departureDate: '2099-01-01',
  category: 'Documents',
  price: 10,
  currency: 'USD',
  contact: {
    phone: '+923001234567',
    conversationId: 'private-thread',
    callPermitted: true,
  },
  requestStatus: 'accepted',
};
beforeEach(() => {
  appConfig.apiBaseUrl = 'https://api.example.test';
  appConfig.listingDetailsApiVerified = true;
  useDevelopmentStore.setState({ previewActive: false });
  useAuthStore.getState().clear();
});
afterEach(() => {
  appConfig.apiBaseUrl = originalUrl;
  appConfig.listingDetailsApiVerified = originalVerified;
  jest.restoreAllMocks();
});
test('public detail response drops contact and account request metadata before entering guest cache', async () => {
  jest.spyOn(apiClient, 'get').mockResolvedValue({ data: { data } });
  const result = await getListingDetails('12');
  expect(result.title).toBe('Public listing');
  expect(result.contact).toBeUndefined();
  expect(result.requestStatus).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain('private-thread');
  expect(JSON.stringify(result)).not.toContain('+923001234567');
});
test('login alone cannot publish phone data without accepted-participant authorization', async () => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  jest.spyOn(apiClient, 'get').mockResolvedValue({ data: { data } });
  expect((await getListingDetails('12')).contact).toEqual({
    conversationId: 'private-thread',
  });
});
test('an in-flight member response cannot populate a guest cache after session changes', async () => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  let finish!: (value: unknown) => void;
  jest.spyOn(apiClient, 'get').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const result = getListingDetails('12');
  useAuthStore.getState().clear();
  finish({ data: { data } });
  await expect(result).rejects.toMatchObject({ kind: 'cancelled' });
});

test.each([
  'none',
  'pending',
  'rejected',
  'cancelled',
  'accepted',
  'unexpected',
])(
  'status %s never grants phone disclosure without a verified participant contract',
  async requestStatus => {
    useAuthStore
      .getState()
      .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
    jest
      .spyOn(apiClient, 'get')
      .mockResolvedValue({ data: { data: { ...data, requestStatus } } });
    const result = await getListingDetails('12');
    expect(result.contact?.phone).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('+923001234567');
    if (requestStatus === 'unexpected')
      expect(result.requestStatus).toBeUndefined();
  },
);

test('public mapping drops private email and phone fields from raw owner metadata', async () => {
  jest.spyOn(apiClient, 'get').mockResolvedValue({
    data: {
      data: {
        ...data,
        createdByEmail: 'private@example.test',
        traveller: {
          id: 7,
          name: 'Public display name',
          email: 'private@example.test',
          phone: '+923001234567',
        },
      },
    },
  });
  const result = await getListingDetails('12');
  expect(result.traveller?.name).toBe('Public display name');
  expect(JSON.stringify(result)).not.toContain('private@example.test');
  expect(JSON.stringify(result)).not.toContain('+923001234567');
});

// These cases exercise the non-fixture API contract, not the development catalogue.
const originalStaticMarketplace = appConfig.staticMarketplaceEnabled;
beforeEach(() => {
  appConfig.staticMarketplaceEnabled = false;
});
afterEach(() => {
  appConfig.staticMarketplaceEnabled = originalStaticMarketplace;
});
