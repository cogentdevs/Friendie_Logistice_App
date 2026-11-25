import { subscribeDealRevocation } from '../src/features/deals/dealAccessEvents';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { ApiError } from '../src/types/api';
import { getPublicListingDetails } from '../src/features/listings/services/publicListingsService';
import {
  actOnDeal,
  createDeal,
  getDeal,
  getDeals,
  verifyCandidate,
  UncertainDealError,
  refreshDealData,
  Deal,
} from '../src/features/deals/dealsService';
import { QueryClient } from '@tanstack/react-query';
import * as ownListings from '../src/features/listings/services/myListingsApiService';
import { requestCandidates } from '../src/features/deals/dealsService';
const user = { id: 1, name: 'Test', email: 'test@example.test' };
export const dealFixture: Deal = {
  id: 9,
  sender_listing_id: 11,
  carrier_listing_id: 12,
  sender_user_id: 1,
  carrier_user_id: 2,
  initiated_by: 1,
  requested_kg: 5,
  agreed_kg: 5,
  status: 'pending',
  acceptance_expires_at: null,
  capacity: {
    sender: {
      total_kg: 5,
      reserved_kg: 0,
      committed_kg: 0,
      remaining_kg: 5,
      available: true,
    },
    carrier: {
      total_kg: 12,
      reserved_kg: 0,
      committed_kg: 0,
      remaining_kg: 12,
      available: true,
    },
  },
  allowed_actions: ['cancel'],
};
const response = (data: unknown, status = 200) => ({
  status,
  data: { success: true, message: 'OK', data },
});
function publicRow(id: number, owner: number, type: 'Send' | 'Carring') {
  return {
    id,
    ad_type: type,
    availability: {
      total_kg: type === 'Send' ? 5 : 12,
      reserved_kg: 0,
      committed_kg: 0,
      remaining_kg: type === 'Send' ? 5 : 12,
      available: true,
    },
    request_eligibility:
      owner === 1
        ? { eligible: false, reason: 'self_listing' }
        : { eligible: true, reason: 'eligible' },
    title: 'Parcel',
    short_description: null,
    image_url: null,
    category: { id: 1, name: 'Parcel' },
    origin: { country_id: 1, city_id: 2, country: 'Country', city: 'City' },
    destination: {
      country_id: 3,
      city_id: 4,
      country: 'Country',
      city: 'City',
    },
    weight: type === 'Send' ? 5 : 12,
    weight_price: 0,
    currency: 'USD',
    departure_on: '2030-01-01',
    reached_on: '2030-01-02',
    is_featured: false,
    created_at: null,
    owner: { id: owner, display_name: null, image_url: null },
    description: null,
  };
}
async function pair() {
  jest
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce(response(publicRow(12, 2, 'Carring')))
    .mockResolvedValueOnce(response(publicRow(11, 1, 'Send')));
  const target = await getPublicListingDetails('12');
  const own = await verifyCandidate(target, 11);
  return { target, own };
}
beforeEach(() => {
  useAuthStore.getState().clear();
  useAuthStore.getState().setUser({ ...user });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('dummy-deal-token');
});
afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.getState().clear();
});
test('GET inbox has exact authenticated endpoint, pagination and participant-only parsed fields', async () => {
  const get = jest.spyOn(apiClient, 'get').mockResolvedValue(
    response({
      items: [{ ...dealFixture, phone: 'never expose', from_latitude: 12 }],
      pagination: { current_page: 2, last_page: 3, total: 41, per_page: 20 },
    }),
  );
  const result = await getDeals(2);
  expect(get).toHaveBeenCalledWith(
    '/customer/deals',
    expect.objectContaining({
      params: { page: 2, per_page: 20 },
      headers: { Authorization: 'Bearer dummy-deal-token' },
    }),
  );
  expect(result.items[0]).toEqual(dealFixture);
});
test('GET details retains backend capacity, effective status and allowed actions', async () => {
  const data = {
    ...dealFixture,
    status: 'accepted',
    acceptance_expires_at: '2030-01-02 12:00:00',
    allowed_actions: ['confirm', 'cancel'],
    capacity: {
      sender: null,
      carrier: {
        ...dealFixture.capacity.carrier!,
        available: false,
        remaining_kg: 7,
      },
    },
  };
  jest.spyOn(apiClient, 'get').mockResolvedValue(response(data));
  expect(await getDeal(9)).toEqual(data);
});
test.each([0, -1, 1.5, NaN])('invalid ID %s makes no request', async value => {
  const get = jest.spyOn(apiClient, 'get');
  await expect(getDeal(value)).rejects.toThrow();
  expect(get).not.toHaveBeenCalled();
});
test('guest/demo never contacts private endpoint', async () => {
  useAuthStore.getState().clear();
  const get = jest.spyOn(apiClient, 'get');
  await expect(getDeals()).rejects.toMatchObject({ status: 401 });
  expect(get).not.toHaveBeenCalled();
});
test('missing secure token fails before private request', async () => {
  jest.mocked(secureStorage.getToken).mockResolvedValue(null);
  const get = jest.spyOn(apiClient, 'get');
  await expect(getDeals()).rejects.toMatchObject({ status: 401 });
  expect(get).not.toHaveBeenCalled();
});
test('real verified pair submits whole sender weight and only contract fields', async () => {
  const { target, own } = await pair();
  const post = jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue(response(dealFixture, 201));
  expect(await createDeal(target, own)).toEqual(dealFixture);
  expect(post).toHaveBeenCalledWith(
    '/customer/deals',
    { sender_listing_id: 11, carrier_listing_id: 12, requested_kg: 5 },
    expect.objectContaining({
      headers: { Authorization: 'Bearer dummy-deal-token' },
    }),
  );
});
test('fixture objects including numeric IDs are rejected', async () => {
  const post = jest.spyOn(apiClient, 'post');
  await expect(createDeal({ id: 12 }, { id: 11 })).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});
test('public verification rejects another account candidate', async () => {
  jest
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce(response(publicRow(12, 2, 'Carring')))
    .mockResolvedValueOnce(response(publicRow(11, 3, 'Send')));
  const target = await getPublicListingDetails('12');
  await expect(verifyCandidate(target, 11)).rejects.toMatchObject({
    kind: 'validation',
  });
});
test('duplicate concurrent create is blocked without a second POST', async () => {
  const { target, own } = await pair();
  let finish!: (value: any) => void;
  const post = jest.spyOn(apiClient, 'post').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const first = createDeal(target, own);
  while (!finish) await Promise.resolve();
  await expect(createDeal(target, own)).rejects.toMatchObject({
    kind: 'validation',
  });
  finish(response(dealFixture, 201));
  await first;
  expect(post).toHaveBeenCalledTimes(1);
});
test('timeout blocks unsafe repeated create even after dialog reopen', async () => {
  const { target, own } = await pair();
  const post = jest
    .spyOn(apiClient, 'post')
    .mockRejectedValue(new ApiError('Timeout', 'network'));
  await expect(createDeal(target, own)).rejects.toBeInstanceOf(
    UncertainDealError,
  );
  await expect(createDeal(target, own)).rejects.toBeInstanceOf(
    UncertainDealError,
  );
  expect(post).toHaveBeenCalledTimes(1);
});
test.each(['accept', 'reject', 'confirm', 'cancel'] as const)(
  '%s uses empty authenticated POST only when allowed',
  async action => {
    const post = jest.spyOn(apiClient, 'post').mockResolvedValue(
      response({
        ...dealFixture,
        status: (
          {
            accept: 'accepted',
            reject: 'rejected',
            confirm: 'confirmed',
            cancel: 'cancelled',
          } as const
        )[action],
      }),
    );
    await actOnDeal({ ...dealFixture, allowed_actions: [action] }, action);
    expect(post).toHaveBeenCalledWith(
      `/customer/deals/9/${action}`,
      undefined,
      expect.objectContaining({
        headers: { Authorization: 'Bearer dummy-deal-token' },
      }),
    );
  },
);
test('disallowed action never makes a mutation', async () => {
  const post = jest.spyOn(apiClient, 'post');
  await expect(actOnDeal(dealFixture, 'accept')).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});
test.each([400, 401, 403, 404, 409, 422, 429])(
  'HTTP %s preserves rejection and makes one request',
  async status => {
    const error = new ApiError(
      'Rejected',
      status === 422 ? 'validation' : 'unknown',
      status,
    );
    const post = jest.spyOn(apiClient, 'post').mockRejectedValue(error);
    await expect(actOnDeal(dealFixture, 'cancel')).rejects.toBe(error);
    expect(post).toHaveBeenCalledTimes(1);
  },
);
test.each([500, 503])(
  'HTTP %s mutation is uncertain without auto retry',
  async status => {
    const post = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValue(new ApiError('Server', 'server', status));
    await expect(actOnDeal(dealFixture, 'cancel')).rejects.toBeInstanceOf(
      UncertainDealError,
    );
    expect(post).toHaveBeenCalledTimes(1);
  },
);
test('invalid success envelope and wrong deal IDs are not success', async () => {
  jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue(response({ ...dealFixture, id: 100 }));
  await expect(actOnDeal(dealFixture, 'cancel')).rejects.toBeInstanceOf(
    UncertainDealError,
  );
});
test('nonparticipant response is rejected', async () => {
  jest
    .spyOn(apiClient, 'get')
    .mockResolvedValue(
      response({ ...dealFixture, sender_user_id: 4, carrier_user_id: 5 }),
    );
  await expect(getDeal(9)).rejects.toThrow();
});
test('logout/account switch prevents a late private response', async () => {
  let finish!: (value: any) => void;
  jest.spyOn(apiClient, 'get').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const pending = getDeal(9);
  while (!finish) await Promise.resolve();
  useAuthStore
    .getState()
    .setUser({ id: 3, name: 'Other', email: 'other@example.test' });
  finish(response(dealFixture));
  await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
});

test('candidate pages preserve server pagination and restrict type/route without inventing capacity', async () => {
  const { target } = await pair();
  const matching = {
    id: 11,
    from_country_id: 1,
    from_city_id: 2,
    to_country_id: 3,
    to_city_id: 4,
    weight: 5,
  };
  const get = jest.spyOn(ownListings, 'getOwnListingsPage').mockResolvedValue({
    ownerId: 1,
    items: [
      matching,
      { ...matching, id: 13, from_city_id: 99 },
      { ...matching, id: 14, weight: 0 },
    ] as any,
    pagination: { current_page: 2, last_page: 3, per_page: 20, total: 42 },
  });
  const result = await requestCandidates(target, 2);
  expect(get).toHaveBeenCalledWith(
    2,
    { status: 1, ad_type: 'Send' },
    undefined,
  );
  expect(result.items).toEqual([matching]);
  expect(result.pagination.last_page).toBe(3);
});
test('cross-country public candidate is rejected before any POST', async () => {
  const row = publicRow(11, 1, 'Send');
  row.origin.country_id = 99;
  jest
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce(response(publicRow(12, 2, 'Carring')))
    .mockResolvedValueOnce(response(row));
  const target = await getPublicListingDetails('12');
  await expect(verifyCandidate(target, 11)).rejects.toMatchObject({
    kind: 'validation',
  });
});
test('aborted request ignores stale completion and blocks unsafe repeat', async () => {
  const { target, own } = await pair();
  let finish!: (value: any) => void;
  const post = jest.spyOn(apiClient, 'post').mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const controller = new AbortController(),
    pending = createDeal(target, own, controller.signal);
  while (!finish) await Promise.resolve();
  controller.abort();
  finish(response(dealFixture, 201));
  await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
  await expect(createDeal(target, own)).rejects.toBeInstanceOf(
    UncertainDealError,
  );
  expect(post).toHaveBeenCalledTimes(1);
});
test('unknown action result can be resolved by an authoritative GET before a new deliberate action', async () => {
  const post = jest
    .spyOn(apiClient, 'post')
    .mockRejectedValueOnce(new ApiError('Timeout', 'network'))
    .mockResolvedValueOnce(response({ ...dealFixture, status: 'cancelled' }));
  await expect(actOnDeal(dealFixture, 'cancel')).rejects.toBeInstanceOf(
    UncertainDealError,
  );
  expect(post).toHaveBeenCalledTimes(1);
  jest.spyOn(apiClient, 'get').mockResolvedValue(response(dealFixture));
  const refreshed = await getDeal(9);
  await actOnDeal(refreshed, 'cancel');
  expect(post).toHaveBeenCalledTimes(2);
});
test('successful mutation invalidation refreshes only relevant listings/deals, not contact or dashboard counts', async () => {
  const client = new QueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await refreshDealData(client);
  const predicate = invalidate.mock.calls[0][0]!.predicate!;
  expect(predicate({ queryKey: ['deal', 1, 9] } as any)).toBe(true);
  expect(predicate({ queryKey: ['listingDetails', 12] } as any)).toBe(true);
  expect(predicate({ queryKey: ['profileDashboard', 1] } as any)).toBe(false);
  expect(predicate({ queryKey: ['deals', 3] } as any)).toBe(false);
  expect(predicate({ queryKey: ['home', 'unread', 1] } as any)).toBe(false);
  client.clear();
});
describe('delivery transitions and history', () => {
  test.each(['pickup', 'complete'] as const)(
    '%s uses authenticated empty JSON and authoritative timestamps',
    async action => {
      useAuthStore
        .getState()
        .setUser({ id: 2, name: 'Carrier', email: 'carrier@example.test' });
      const picked = '2026-11-25T10:00:00Z';
      const updated = {
        ...dealFixture,
        status: action === 'complete' ? 'completed' : 'confirmed',
        picked_up_at: picked,
        completed_at: action === 'complete' ? picked : null,
        allowed_actions: [],
      };
      const post = jest
        .spyOn(apiClient, 'post')
        .mockResolvedValue(response(updated));
      const result = await actOnDeal(
        {
          ...dealFixture,
          status: 'confirmed',
          picked_up_at: action === 'complete' ? picked : null,
          allowed_actions: [action],
        },
        action,
      );
      expect(post).toHaveBeenCalledWith(
        `/customer/deals/9/${action}`,
        {},
        expect.objectContaining({
          headers: { Authorization: 'Bearer dummy-deal-token' },
        }),
      );
      expect(result.picked_up_at).toBe(picked);
      expect(result.status).toBe(updated.status);
    },
  );
  test('cancel is rejected after pickup even with stale allowed_actions', async () => {
    const post = jest.spyOn(apiClient, 'post');
    await expect(
      actOnDeal(
        { ...dealFixture, picked_up_at: '2026-11-25T10:00:00Z' },
        'cancel',
      ),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(post).not.toHaveBeenCalled();
  });
  test.each(['pending', 'completed'] as const)(
    'history sends %s filter and page to server',
    async status => {
      const get = jest.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: {
          success: true,
          data: {
            items: [
              {
                ...dealFixture,
                status: status === 'pending' ? 'confirmed' : 'completed',
              },
            ],
            pagination: {
              current_page: 2,
              last_page: 2,
              per_page: 20,
              total: 21,
            },
          },
        },
      });
      const result = await getDeals(2, undefined, status);
      expect(get).toHaveBeenCalledWith(
        '/customer/deals',
        expect.objectContaining({ params: { page: 2, per_page: 20, status } }),
      );
      expect(result.items).toHaveLength(1);
    },
  );
  test('missing pickup confirmation is uncertain and does not resend', async () => {
    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue(response({ ...dealFixture, status: 'confirmed' }));
    const input = { ...dealFixture, allowed_actions: ['pickup' as const] };
    await expect(actOnDeal(input, 'pickup')).rejects.toBeInstanceOf(
      UncertainDealError,
    );
    await expect(actOnDeal(input, 'pickup')).rejects.toBeInstanceOf(
      UncertainDealError,
    );
    expect(post).toHaveBeenCalledTimes(1);
  });
});

test('completion immediately revokes private contact and chat access', async () => {
  const listener = jest.fn(),
    unsubscribe = subscribeDealRevocation(listener);
  try {
    jest.spyOn(apiClient, 'post').mockResolvedValue(
      response({
        ...dealFixture,
        status: 'completed',
        picked_up_at: '2026-11-25T10:00:00Z',
        completed_at: '2026-11-25T11:00:00Z',
        allowed_actions: [],
      }),
    );
    await actOnDeal(
      { ...dealFixture, allowed_actions: ['complete'] },
      'complete',
    );
    expect(listener).toHaveBeenCalledWith(9);
  } finally {
    unsubscribe();
  }
});
test.each([403, 404, 409])(
  'delivery respects backend rejection %s without retry',
  async status => {
    const post = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValue(new ApiError('Rejected', 'forbidden', status));
    await expect(
      actOnDeal({ ...dealFixture, allowed_actions: ['pickup'] }, 'pickup'),
    ).rejects.toMatchObject({ status });
    expect(post).toHaveBeenCalledTimes(1);
  },
);
test('history preserves nullable snapshots and zero weight while stripping private fields', async () => {
  const side = {
    user: { id: 1, display_name: null, phone: 'private' },
    listing: {
      id: 11,
      title: null,
      ad_type: null,
      weight_kg: 0,
      route: {
        from_country_id: null,
        from_city_id: null,
        to_country_id: null,
        to_city_id: null,
        from_latitude: 2,
      },
    },
  };
  jest.spyOn(apiClient, 'get').mockResolvedValue(
    response({
      ...dealFixture,
      history: {
        sender: side,
        carrier: { ...side, user: { id: 2, display_name: 'Carrier' } },
      },
    }),
  );
  const result = await getDeal(9);
  expect(result.history?.sender.listing.weight_kg).toBe(0);
  expect(result.history?.sender.listing.title).toBeNull();
  expect(result.history?.sender.user).not.toHaveProperty('phone');
  expect(result.history?.sender.listing.route).not.toHaveProperty(
    'from_latitude',
  );
});
test('history cache refresh covers both tabs for this account only', async () => {
  const client = new QueryClient();
  try {
    client.setQueryData(['deals', 1, 'history', 'pending'], {});
    client.setQueryData(['deals', 1, 'history', 'completed'], {});
    client.setQueryData(['deals', 2, 'history', 'completed'], {});
    await refreshDealData(client, dealFixture);
    expect(
      client.getQueryState(['deals', 1, 'history', 'pending'])?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(['deals', 1, 'history', 'completed'])?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(['deals', 2, 'history', 'completed'])?.isInvalidated,
    ).toBe(false);
  } finally {
    client.clear();
  }
});

test.each([undefined, null, 'Historical Country'])(
  'route name %s is preserved without lookup or private fields',
  async name => {
    const side = {
      user: { id: 1, display_name: null },
      listing: {
        id: 11,
        title: null,
        ad_type: null,
        weight_kg: 5,
        route: {
          from_country_id: 1,
          from_city_id: 2,
          to_country_id: 3,
          to_city_id: 4,
          from_country_name: name,
          from_city_name: 'Historical City',
          to_country_name: 'Destination',
          to_city_name: null,
          from_latitude: 1,
        },
      },
    };
    const get = jest
      .spyOn(apiClient, 'get')
      .mockResolvedValue(
        response({
          ...dealFixture,
          history: {
            sender: side,
            carrier: { ...side, user: { id: 2, display_name: null } },
          },
        }),
      );
    const detail = await getDeal(9);
    expect(detail.history?.sender.listing.route.from_country_name).toBe(name);
    expect(detail.history?.carrier.listing.route.from_city_name).toBe(
      'Historical City',
    );
    expect(detail.history?.sender.listing.route.to_city_name).toBeNull();
    expect(detail.history?.sender.listing.route).not.toHaveProperty(
      'from_latitude',
    );
    expect(get).toHaveBeenCalledTimes(1);
  },
);
