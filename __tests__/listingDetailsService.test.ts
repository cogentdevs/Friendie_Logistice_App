import { publicListingFixture } from '../test/fixtures/publicListing';
import { appConfig } from '../src/constants/appConfig';
import { apiClient } from '../src/services/api/apiClient';
import {
  getListingDetails,
  permittedPhone,
  requestUnavailableReason,
  ListingDetail,
} from '../src/features/listings/services/listingDetailsService';
const detail: ListingDetail = {
  id: 12,
  ownerId: 7,
  status: 'active',
  type: 'carry',
  title: 'Trip',
  origin: 'Karachi',
  destination: 'Dubai',
  departureDate: '2099-11-12',
  category: 'Documents',
  price: 120,
  currency: 'USD',
};
afterEach(() => jest.restoreAllMocks());
test('invalid IDs never call a guessed endpoint', async () => {
  const get = jest.spyOn(apiClient, 'get');
  await expect(getListingDetails('../user')).rejects.toThrow('Invalid listing');
  expect(get).not.toHaveBeenCalled();
});
test('explicit verified contract fetches ID with cancellation and rejects mismatched IDs', async () => {
  const previous = {
    url: appConfig.apiBaseUrl,
    verified: appConfig.listingDetailsApiVerified,
  };
  appConfig.apiBaseUrl = 'https://example.test/api';
  appConfig.listingDetailsApiVerified = true;
  const get = jest
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce({
      status: 200,
      data: { success: true, data: { ...publicListingFixture, id: 12 } },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: { success: true, data: { ...publicListingFixture, id: 99 } },
    });
  const controller = new AbortController();
  try {
    await expect(
      getListingDetails('12', controller.signal),
    ).resolves.toMatchObject({ id: 12 });
    expect(get).toHaveBeenCalledWith('/listings/12', {
      signal: controller.signal,
      headers: { Authorization: false },
    });
    await expect(getListingDetails('12')).rejects.toThrow(
      'Unable to read listing',
    );
  } finally {
    appConfig.apiBaseUrl = previous.url;
    appConfig.listingDetailsApiVerified = previous.verified;
  }
});
test.each(['expired', 'unavailable', 'deleted'] as const)(
  '%s status blocks requests',
  status => {
    expect(requestUnavailableReason({ ...detail, status }, 88)).toMatch(
      /expired|unavailable|deleted/,
    );
  },
);
test('own, pending and accepted requests are blocked', () => {
  expect(requestUnavailableReason(detail, 7)).toContain('own listing');
  for (const requestStatus of ['pending', 'accepted'] as const)
    expect(
      requestUnavailableReason({ ...detail, requestStatus }, 88),
    ).toContain('already requested');
  expect(requestUnavailableReason(detail)).toContain('Sign in');
  expect(requestUnavailableReason(detail, 88)).toContain(
    'currently unavailable',
  );
});
test('unverified contact contract never unlocks a phone', () => {
  expect(
    permittedPhone({
      ...detail,
      contact: { phone: '+92 300 1234567', callPermitted: true },
    }),
  ).toBeUndefined();
  expect(
    permittedPhone({ ...detail, contact: { phone: '+923001234567' } }),
  ).toBeUndefined();
  expect(
    permittedPhone({
      ...detail,
      contact: { phone: '*123#', callPermitted: true },
    }),
  ).toBeUndefined();
});

// These cases exercise the non-fixture API contract, not the development catalogue.
const originalStaticMarketplace = appConfig.staticMarketplaceEnabled;
beforeEach(() => {
  appConfig.staticMarketplaceEnabled = false;
});
afterEach(() => {
  appConfig.staticMarketplaceEnabled = originalStaticMarketplace;
});
