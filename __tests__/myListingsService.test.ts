import axios from 'axios';
import { apiClient } from '../src/services/api/apiClient';
import { appConfig } from '../src/constants/appConfig';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { secureStorage } from '../src/services/storage/secureStorage';
import {
  getMyListings,
  UnsupportedMyListingStatusError,
  myListingsErrorMessage,
} from '../src/features/listings/services/myListingsService';
import { getOwnListingsPage } from '../src/features/listings/services/myListingsApiService';
import * as ownApi from '../src/features/listings/services/myListingsApiService';
import { ownListingFixture as item } from '../test/fixtures/myListings';
const member = { id: 8, name: 'Member', email: 'member@example.test' };
const previous = {
  adapter: apiClient.defaults.adapter,
  preview: appConfig.uiPreviewEnabled,
};
let body: unknown;
let token: string | null;
let calls: number;
const responseBody = (record: unknown = item, page = 1) => ({
  success: true,
  message: 'Your listings retrieved successfully.',
  data: {
    items: [record],
    pagination: { current_page: page, per_page: 20, total: 21, last_page: 2 },
  },
});
beforeEach(() => {
  useAuthStore.getState().setUser(member);
  useDevelopmentStore.setState({ previewActive: false });
  token = 'own-listings-contract-test-token';
  calls = 0;
  body = responseBody();
  jest.spyOn(secureStorage, 'getToken').mockImplementation(async () => token);
  apiClient.defaults.adapter = async config => {
    calls++;
    return { status: 200, statusText: '', config, headers: {}, data: body };
  };
});
afterEach(() => {
  apiClient.defaults.adapter = previous.adapter;
  appConfig.uiPreviewEnabled = previous.preview;
  jest.restoreAllMocks();
});
test.each([
  ['active', 1, 'Carring', 'carry'],
  ['expired', 2, 'Send', 'send'],
] as const)(
  '%s sends verified private GET and maps real %s/%s data',
  async (status, backendStatus, adType, type) => {
    const raw = { ...item, status: backendStatus, ad_type: adType };
    body = responseBody(raw);
    apiClient.defaults.adapter = async config => {
      calls++;
      expect(config.method).toBe('get');
      expect(config.url).toBe('/customer/listings');
      expect(config.baseURL).toBe(appConfig.apiBaseUrl);
      expect(config.headers.Authorization).toBe(
        'Bearer own-listings-contract-test-token',
      );
      expect(config.params).toEqual({
        page: 1,
        per_page: 20,
        status: backendStatus,
      });
      return { status: 200, statusText: '', config, headers: {}, data: body };
    };
    const result = await getMyListings(status, 1);
    expect(result.data[0]).toMatchObject({
      id: 501,
      ownerId: 8,
      status,
      type,
      origin: 'Clifton',
      destination: 'Marina',
      price: 20,
      currency: 'USD',
      departureDate: item.departure_on,
      weight: { value: 5, unit: 'kg' },
      backend: raw,
    });
    expect(result.meta).toEqual({ current_page: 1, last_page: 2, total: 21 });
    expect(result.meta.counts).toBeUndefined();
    expect(calls).toBe(1);
  },
);
test('Completed has no backend mapping and never requests or labels Pending as Completed', async () => {
  await expect(getMyListings('completed', 1)).rejects.toBeInstanceOf(
    UnsupportedMyListingStatusError,
  );
  expect(calls).toBe(0);
  expect(secureStorage.getToken).not.toHaveBeenCalled();
  expect(
    myListingsErrorMessage(new UnsupportedMyListingStatusError()),
  ).toContain('Pending listings cannot');
});
test('verified raw read filters support actual Pending/Send/search/sort without new UI or mutation', async () => {
  body = responseBody({ ...item, status: 0, ad_type: 'Send' });
  apiClient.defaults.adapter = async config => {
    expect(config.params).toEqual({
      page: 1,
      per_page: 20,
      status: 0,
      ad_type: 'Send',
      search: 'parcel',
      sort: 'oldest',
    });
    return { status: 200, statusText: '', config, headers: {}, data: body };
  };
  expect(
    (
      await getOwnListingsPage(1, {
        status: 0,
        ad_type: 'Send',
        search: 'parcel',
        sort: 'oldest',
      })
    ).items[0].status,
  ).toBe(0);
});
test('missing values remain null in the record, with honest location/date UI fallbacks', async () => {
  body = responseBody({
    ...item,
    title: null,
    category_id: null,
    from_area: null,
    to_area: null,
    weight: null,
    weight_price: null,
    currency: null,
    departure_on: null,
    image_url: null,
  });
  const row = (await getMyListings('active', 1)).data[0];
  expect(row).toMatchObject({
    title: null,
    category: null,
    price: null,
    currency: null,
    origin: 'Location unavailable',
    departureDate: '',
    coverImageUrl: null,
  });
  expect(row.weight).toBeUndefined();
  expect(row.capacityKg).toBeUndefined();
  expect(row.backend?.from_country_id).toBe(179);
});
test('empty and last pages use authoritative pagination without synthetic records/counts', async () => {
  body = {
    success: true,
    message: 'OK',
    data: {
      items: [],
      pagination: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
    },
  };
  expect(await getMyListings('active', 1)).toMatchObject({
    data: [],
    meta: { total: 0, last_page: 1 },
  });
  body = responseBody(item, 2);
  expect((await getMyListings('active', 2)).meta.current_page).toBe(2);
});
test.each([
  { ...item, ad_type: 'Carry' },
  { ...item, status: 3 },
  { ...item, status: 0 },
  { ...item, image_url: 'file:///private' },
])(
  'invalid/unknown type/status or mismatched filter fails safely %j',
  async raw => {
    body = responseBody(raw);
    await expect(getMyListings('active', 1)).rejects.toMatchObject({
      kind: 'unknown',
    });
  },
);
test('invalid envelope and mismatched response pagination are rejected', async () => {
  body = {};
  await expect(getMyListings('active', 1)).rejects.toMatchObject({
    kind: 'unknown',
  });
  body = responseBody(item, 2);
  await expect(getMyListings('active', 1)).rejects.toMatchObject({
    kind: 'unknown',
  });
});
test.each([0, 1.5, 100001])('invalid page %s sends no HTTP', async page => {
  await expect(getOwnListingsPage(page)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(calls).toBe(0);
});
test.each(['guest', 'demo'])(
  '%s cannot call the real endpoint; existing demo Completed fixture remains isolated',
  async mode => {
    useAuthStore.getState().clear();
    appConfig.uiPreviewEnabled = true;
    useDevelopmentStore.setState({ previewActive: mode === 'demo' });
    await expect(getOwnListingsPage()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    if (mode === 'demo')
      expect((await getMyListings('completed', 1)).data[0].status).toBe(
        'completed',
      );
    else
      await expect(getMyListings('active', 1)).rejects.toMatchObject({
        kind: 'unauthorized',
      });
    expect(calls).toBe(0);
  },
);
test('missing token uses conditional existing session cleanup', async () => {
  token = null;
  jest.spyOn(secureStorage, 'removeTokenIfCurrent').mockResolvedValue(true);
  await expect(getMyListings('active', 1)).rejects.toMatchObject({
    kind: 'unauthorized',
  });
  expect(useAuthStore.getState().status).toBe('guest');
  expect(calls).toBe(0);
});
test.each(['logout', 'switch', 'relogin', 'token-change', 'abort'])(
  'late %s responses cannot enter a new account cache',
  async action => {
    const controller = new AbortController();
    apiClient.defaults.adapter = async config => {
      if (action === 'logout') useAuthStore.getState().clear();
      if (action === 'switch')
        useAuthStore.getState().setUser({ ...member, id: 9 });
      if (action === 'relogin') useAuthStore.getState().setUser({ ...member });
      if (action === 'token-change') token = 'changed-test-token';
      if (action === 'abort') controller.abort();
      return { status: 200, statusText: '', config, headers: {}, data: body };
    };
    await expect(
      getMyListings('active', 1, controller.signal),
    ).rejects.toMatchObject({ kind: 'cancelled' });
  },
);
test.each([403, 404, 429, 500, undefined])(
  'error %s remains safe and does not destroy a valid session',
  async status => {
    apiClient.defaults.adapter = async config => {
      throw new axios.AxiosError(
        'internal',
        'ERR_NETWORK',
        config,
        undefined,
        status
          ? {
              status,
              statusText: '',
              config,
              headers: {},
              data: { message: 'internal exception' },
            }
          : undefined,
      );
    };
    const error = await getMyListings('active', 1).catch(value => value);
    expect(myListingsErrorMessage(error)).not.toContain('internal');
    expect(useAuthStore.getState().user).toBe(member);
  },
);
test('401 clears only the matching current credentials through the existing interceptor', async () => {
  jest.spyOn(secureStorage, 'removeTokenIfCurrent').mockResolvedValue(true);
  apiClient.defaults.adapter = async config => {
    throw new axios.AxiosError(
      'expired',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      { status: 401, statusText: '', config, headers: {}, data: {} },
    );
  };
  await expect(getMyListings('active', 1)).rejects.toMatchObject({
    kind: 'unauthorized',
  });
  expect(useAuthStore.getState().status).toBe('guest');
});

test('UI adapter rejects a session change in the await gap after the verified raw read', async () => {
  jest.spyOn(ownApi, 'getOwnListingsPage').mockImplementation(async () => {
    useAuthStore.getState().setUser({ ...member, id: 9 });
    return {
      items: [item],
      pagination: { current_page: 1, per_page: 20, total: 1, last_page: 1 },
      ownerId: 8,
    };
  });
  await expect(getMyListings('active', 1)).rejects.toMatchObject({
    kind: 'cancelled',
  });
});
