import React from 'react';
import Renderer from 'react-test-renderer';
import { QueryClient } from '@tanstack/react-query';
import {
  availabilitySchema,
  eligibilitySchema,
  availabilityLabel,
  remainingLabel,
  availabilityRequestReason,
  availabilitySessionKey,
  publicListingSession,
} from '../src/features/listings/services/listingAvailability';
import { ListingAvailability } from '../src/features/listings/components/ListingAvailability';
import {
  normalizePublicListing,
  publicListingSchema,
  getPublicListingDetails,
} from '../src/features/listings/services/publicListingsService';
import { publicListingFixture } from '../test/fixtures/publicListing';
import {
  refreshDealData,
  createDeal,
} from '../src/features/deals/dealsService';
import { useAuthStore } from '../src/store/authStore';
import { secureStorage } from '../src/services/storage/secureStorage';
import { apiClient } from '../src/services/api/apiClient';
const capacity = {
  total_kg: 12,
  reserved_kg: 0,
  committed_kg: 5,
  remaining_kg: 7,
  available: true,
};
const account = { id: 1, name: 'Member', email: 'member@example.test' };
beforeEach(() => {
  useAuthStore.getState().clear();
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('test-token');
});
afterEach(() => {
  jest.restoreAllMocks();
});
test.each([
  undefined,
  null,
  {},
  { available: true, total_kg: 12 },
  { ...capacity, remaining_kg: -1 },
  { ...capacity, available: 'true' },
])('invalid capacity is unknown and blocks submission: %j', input => {
  const availability = availabilitySchema.parse(input);
  expect(availability).toBeUndefined();
  expect(availabilityLabel(availability)).toBe('Availability unknown');
  expect(remainingLabel(availability)).toBe('Remaining KG unavailable');
  expect(availabilityRequestReason({ availability }, 1)).toBeDefined();
});
test('backend remaining KG is preserved, never replaced with total or recalculated', () => {
  const result = normalizePublicListing(
    publicListingSchema.parse({
      ...publicListingFixture,
      availability: capacity,
      request_eligibility: { eligible: true, reason: 'eligible' },
    }),
  );
  expect(result.availability?.remaining_kg).toBe(7);
  expect(remainingLabel(result.availability)).toBe('7 KG remaining');
  expect(availabilityRequestReason(result, 1)).toBeUndefined();
});
test.each([
  'ineligible_account',
  'self_listing',
  'listing_unavailable',
  'no_eligible_complementary_listing',
  'infrastructure_unavailable',
  'authentication_required',
] as const)(
  'reason %s disables authenticated submission with a friendly message',
  reason => {
    const detail = {
      availability: capacity,
      requestEligibility: eligibilitySchema.parse({ eligible: false, reason }),
    };
    expect(availabilityRequestReason(detail, 1)).toMatch(/[a-z]/i);
    expect(availabilityRequestReason(detail, 1)).not.toBe(reason);
  },
);
test('missing and invalid eligibility cannot enable an authenticated request', () => {
  expect(
    eligibilitySchema.parse({ eligible: true, reason: 'unexpected' }),
  ).toBeUndefined();
  expect(
    availabilityRequestReason({ availability: capacity }, 1),
  ).toBeDefined();
  expect(
    availabilityRequestReason({
      availability: capacity,
      requestEligibility: { eligible: null, reason: 'authentication_required' },
    }),
  ).toBeUndefined();
  expect(
    availabilityRequestReason(
      { availability: { ...capacity, available: false } },
      1,
    ),
  ).toBeDefined();
});
test.each([
  [true, 'Available'],
  [false, 'Not Available'],
  [null, 'Availability unknown'],
] as const)(
  'badges use authoritative availability %s',
  async (available, label) => {
    let tree!: Renderer.ReactTestRenderer;
    await Renderer.act(async () => {
      tree = Renderer.create(
        <ListingAvailability availability={{ ...capacity, available }} />,
      );
    });
    const content = JSON.stringify(tree.toJSON());
    expect(content).toContain(label);
    expect(content).toContain('7 KG remaining');
    await Renderer.act(async () => tree.unmount());
  },
);
test('account changes and signing back into the same ID use fresh eligibility scopes', () => {
  useAuthStore.getState().setUser({ ...account });
  const a = availabilitySessionKey();
  useAuthStore.getState().clear();
  expect(availabilitySessionKey()).toBe('guest');
  useAuthStore.getState().setUser({ ...account, id: 2 });
  expect(availabilitySessionKey()).not.toBe(a);
  useAuthStore.getState().setUser({ ...account });
  expect(availabilitySessionKey()).not.toBe(a);
});
test('guest calls suppress tokens and authenticated calls send the current bearer', async () => {
  expect((await publicListingSession()).headers.Authorization).toBe(false);
  expect(secureStorage.getToken).not.toHaveBeenCalled();
  useAuthStore.getState().setUser({ ...account });
  expect((await publicListingSession()).headers.Authorization).toBe(
    'Bearer test-token',
  );
});
test('in-flight eligibility cannot publish after account switch or token rotation', async () => {
  useAuthStore.getState().setUser({ ...account });
  const session = await publicListingSession();
  useAuthStore.getState().setUser({ ...account, id: 2 });
  await expect(session.check()).rejects.toMatchObject({ kind: 'cancelled' });
  const rotated = await publicListingSession();
  jest.mocked(secureStorage.getToken).mockResolvedValue('replacement');
  await expect(rotated.check()).rejects.toMatchObject({ kind: 'cancelled' });
});
test('accept/confirm/reject/cancel refreshes include lists, details, own listings and personalized Home', async () => {
  useAuthStore.getState().setUser({ ...account });
  const client = new QueryClient();
  const keys = [
    ['listings', {}, {}, availabilitySessionKey()],
    ['listingDetails', '12', availabilitySessionKey()],
    ['home', 'latest', 'api', availabilitySessionKey()],
    ['myListings.read', 'user:1'],
    ['ownListingDetails', 1, '12'],
    ['deal', 1, 9],
  ];
  keys.forEach(key => client.setQueryData(key, {}));
  await refreshDealData(client);
  keys.forEach(key =>
    expect(client.getQueryState(key)?.isInvalidated).toBe(true),
  );
  client.clear();
});
test('a verified remote listing with unknown availability cannot be submitted', async () => {
  useAuthStore.getState().setUser({ ...account });
  jest
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        data: {
          ...publicListingFixture,
          id: 12,
          owner: { id: 2, display_name: 'Other', image_url: null },
        },
      },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        data: {
          ...publicListingFixture,
          id: 11,
          owner: { id: 1, display_name: 'Member', image_url: null },
        },
      },
    });
  const target = await getPublicListingDetails('12'),
    own = await getPublicListingDetails('11');
  const post = jest.spyOn(apiClient, 'post');
  await expect(createDeal(target, own)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(post).not.toHaveBeenCalled();
});
