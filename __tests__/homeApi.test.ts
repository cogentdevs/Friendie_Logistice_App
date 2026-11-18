import { AxiosError, AxiosHeaders } from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '../src/services/api/apiClient';
import { getHome } from '../src/features/home/services/homeApiService';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { clearPrivateAccountMemory } from '../src/features/auth/services/sessionLogout';
import { publicHomeKey } from '../src/services/api/publicHomeCache';
import { homeListing } from '../test/fixtures/home';
const original = apiClient.defaults.adapter;
let calls: Array<{
  method?: string;
  url?: string;
  body: unknown;
  params: unknown;
  authorization: unknown;
}>;
let body: unknown;
beforeEach(() => {
  calls = [];
  body = {
    success: true,
    message: 'Home retrieved successfully.',
    data: {
      categories: [
        { id: 42, name: 'Documents', image_url: null },
        {
          id: 3,
          name: 'Food',
          image_url: 'https://media.example.test/food.png',
        },
      ],
      featured_listings: [homeListing],
      latest_listings: [
        homeListing,
        { ...homeListing, id: 701, ad_type: 'Send' },
      ],
    },
  };
  useAuthStore.getState().clear();
  apiClient.defaults.adapter = async config => {
    calls.push({
      method: config.method,
      url: config.url,
      body: config.data,
      params: config.params,
      authorization: config.headers.Authorization,
    });
    return { status: 200, statusText: 'OK', headers: {}, config, data: body };
  };
});
afterEach(() => {
  apiClient.defaults.adapter = original;
  jest.restoreAllMocks();
});
test.each([false, true])(
  'Home GET is public for authenticated=%s, without body, params or token lookup',
  async authenticated => {
    if (authenticated)
      useAuthStore
        .getState()
        .setUser({ id: 7, name: 'Member', email: 'm@example.test' });
    const token = jest.spyOn(secureStorage, 'getToken');
    const data = await getHome();
    expect(calls).toEqual([
      {
        method: 'get',
        url: '/home',
        body: undefined,
        params: undefined,
        authorization: false,
      },
    ]);
    expect(token).not.toHaveBeenCalled();
    expect(data.categories.map(x => x.id)).toEqual(['42', '3']);
    expect(data.latest.map(x => x.id)).toEqual([703, 701]);
    expect(data.latest.map(x => x.type)).toEqual(['carry', 'send']);
    expect(data.latest[0]).toMatchObject({
      origin: 'Start, Origin',
      destination: 'End, Destination',
      price: 0,
      capacityKg: 0,
      coverImageUrl: homeListing.image_url,
    });
    expect(data).not.toHaveProperty('destinations');
  },
);
test('nullable backend fields stay unavailable, never replaced with sample identities/locations/prices', async () => {
  body = {
    success: true,
    message: 'OK',
    data: {
      categories: [{ id: 4, name: null, image_url: null }],
      featured_listings: [],
      latest_listings: [
        {
          ...homeListing,
          title: null,
          image_url: null,
          weight: null,
          weight_price: null,
          currency: null,
          departure_on: null,
          category: { id: 42, name: null },
          origin: { ...homeListing.origin, city: null, country: null },
          owner: { id: 81, display_name: null, image_url: null },
        },
      ],
    },
  };
  const result = await getHome();
  expect(result.categories).toEqual([{ id: '4', name: '' }]);
  expect(result.latest[0]).toMatchObject({
    title: '',
    origin: 'Location unavailable',
    price: null,
    currency: null,
    coverImageUrl: null,
    traveller: { id: 81, name: '', avatarUrl: null },
  });
  expect(result.latest[0]).not.toHaveProperty('capacityKg');
});
test('empty collections remain empty and no fake popularity or listing records are added', async () => {
  body = {
    success: true,
    message: 'OK',
    data: { categories: [], featured_listings: [], latest_listings: [] },
  };
  await expect(getHome()).resolves.toEqual({
    categories: [],
    featured: [],
    latest: [],
  });
});
test.each([
  {},
  { success: false, data: {} },
  { success: true, message: 'OK', data: { categories: [] } },
  {
    success: true,
    message: 'OK',
    data: {
      categories: [],
      featured_listings: [],
      latest_listings: [{ id: 123 }],
    },
  },
])('invalid Home envelope is rejected: %j', async invalid => {
  body = invalid;
  await expect(getHome()).rejects.toMatchObject({ kind: 'unknown' });
});
test('only public fields are retained in Home state; phone/private extras never reach the cache model', async () => {
  body = {
    success: true,
    message: 'OK',
    customer: { token: 'not-real' },
    data: {
      categories: [],
      featured_listings: [],
      latest_listings: [
        {
          ...homeListing,
          phone: 'private',
          status: 'untrusted-extra',
          owner: {
            ...homeListing.owner,
            phone: 'private',
            email: 'private@example.test',
          },
        },
      ],
    },
  };
  const result = await getHome();
  expect(JSON.stringify(result)).not.toContain('private');
  expect(JSON.stringify(result)).not.toContain('not-real');
  expect(result.latest[0]).not.toHaveProperty('status');
});
test.each([400, 401, 403, 404, 429, 500])(
  'HTTP %s follows normalized errors without clearing a public viewer session',
  async status => {
    useAuthStore
      .getState()
      .setUser({ id: 7, name: 'Member', email: 'm@example.test' });
    const viewer = useAuthStore.getState().user;
    apiClient.defaults.adapter = async config => {
      throw new AxiosError('Failure', 'ERR_BAD_RESPONSE', config, undefined, {
        status,
        statusText: 'Error',
        config,
        headers: new AxiosHeaders(),
        data: { message: 'Internal details' },
      });
    };
    await expect(getHome()).rejects.toMatchObject({ status });
    expect(useAuthStore.getState().user).toBe(viewer);
  },
);
test.each(['ECONNABORTED', 'ERR_NETWORK'])(
  '%s is not turned into fixtures or automatically retried',
  async code => {
    let count = 0;
    apiClient.defaults.adapter = async config => {
      count++;
      throw new AxiosError('Failure', code, config);
    };
    await expect(getHome()).rejects.toMatchObject({ kind: 'network' });
    expect(count).toBe(1);
  },
);
test('a canceled request cannot publish a late response', async () => {
  const controller = new AbortController();
  jest.spyOn(apiClient, 'get').mockImplementation(async () => {
    controller.abort();
    return { status: 200, data: body };
  });
  await expect(getHome(controller.signal)).rejects.toMatchObject({
    kind: 'cancelled',
  });
});
test('session cleanup retains only the public Home key and removes private/customer/demo data', async () => {
  const client = new QueryClient();
  const data = await getHome();
  client.setQueryData(publicHomeKey, data);
  const timestamp = client.getQueryState(publicHomeKey)?.dataUpdatedAt;
  for (const key of [
    ['profile', 7],
    ['messages.inbox', 7],
    ['home', 'latest', 'static'],
    ['home', 'latest', 'api', 7],
  ])
    client.setQueryData(key, { private: true });
  clearPrivateAccountMemory(client);
  expect(client.getQueryData(publicHomeKey)).toBe(data);
  expect(client.getQueryState(publicHomeKey)?.dataUpdatedAt).toBe(timestamp);
  expect(
    client
      .getQueryCache()
      .getAll()
      .map(q => q.queryKey),
  ).toEqual([publicHomeKey]);
  client.clear();
});
