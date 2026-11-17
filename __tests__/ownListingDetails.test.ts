import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { ApiError } from '../src/types/api';
import { getOwnListingDetails } from '../src/features/listings/services/ownListingDetailsService';
import { ownListingFixture } from '../test/fixtures/myListings';

const member = { id: 8, name: 'Member', email: 'member@example.test' };
const originalAdapter = apiClient.defaults.adapter;
let record: unknown;
let calls: number;
beforeEach(() => {
  useAuthStore.getState().setUser(member);
  record = ownListingFixture;
  calls = 0;
  useDevelopmentStore.setState({ previewActive: false });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('details-test-token');
  apiClient.defaults.adapter = async config => {
    calls++;
    expect(config.method).toBe('get');
    expect(config.url).toBe('/customer/listings/501');
    expect(config.params).toBeUndefined();
    expect(config.headers.Authorization).toBe('Bearer details-test-token');
    return {
      status: 200,
      statusText: '',
      config,
      headers: {},
      data: {
        success: true,
        message: 'Your listing retrieved successfully.',
        data: record,
      },
    };
  };
});
afterEach(() => {
  useDevelopmentStore.setState({ previewActive: false });
  apiClient.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});
test.each([
  [0, 'pending', 'Carring', 'carry'],
  [1, 'active', 'Send', 'send'],
  [2, 'expired', 'Carring', 'carry'],
] as const)(
  'preserves status %s and type %s with the exact owner GET',
  async (status, normalized, ad_type, type) => {
    record = { ...ownListingFixture, status, ad_type };
    const result = await getOwnListingDetails('501');
    expect(result).toMatchObject({
      id: 501,
      ownerId: 8,
      status: normalized,
      type,
      origin: 'Clifton',
      destination: 'Marina',
      price: 20,
      currency: 'USD',
      coverImageUrl: ownListingFixture.image_url,
      departureDate: ownListingFixture.departure_on,
      weight: { value: 5, unit: 'kg' },
      backend: record,
    });
    expect(result.contact).toBeUndefined();
    expect(result.traveller).toBeUndefined();
    expect(calls).toBe(1);
  },
);
test('preserves missing fields without fake names, price, image or contacts', async () => {
  record = {
    ...ownListingFixture,
    from_area: null,
    to_area: null,
    weight: null,
    weight_price: null,
    currency: null,
    image_url: null,
    departure_on: null,
  };
  expect(await getOwnListingDetails('501')).toMatchObject({
    origin: 'Location unavailable',
    destination: 'Location unavailable',
    category: '',
    price: null,
    currency: null,
    coverImageUrl: null,
    departureDate: '',
  });
});
test.each(['0', '-1', 'abc', '1/2', '01', '9007199254740992'])(
  'rejects invalid ID %s without HTTP',
  async id => {
    await expect(getOwnListingDetails(id)).rejects.toMatchObject({
      status: 404,
    });
    expect(calls).toBe(0);
  },
);
test.each([
  null,
  { ...ownListingFixture, id: 502 },
  { ...ownListingFixture, status: 3 },
  { ...ownListingFixture, ad_type: 'Carry' },
])('rejects invalid response %j', async invalid => {
  record = invalid;
  await expect(getOwnListingDetails('501')).rejects.toMatchObject({
    kind: 'unknown',
  });
});
test('guest and local demo sessions cannot request private details', async () => {
  useAuthStore.getState().clear();
  await expect(getOwnListingDetails('501')).rejects.toMatchObject({
    status: 401,
  });
  useDevelopmentStore.setState({ previewActive: true });
  await expect(getOwnListingDetails('501')).rejects.toMatchObject({
    status: 401,
  });
  expect(calls).toBe(0);
});

test.each([
  ['unauthorized', 401],
  ['forbidden', 403],
  ['not-found', 404],
  ['validation', 422],
  ['rate-limit', 429],
  ['server', 500],
  ['network', undefined],
] as const)(
  'preserves normalized %s failure without fabricated data',
  async (kind, status) => {
    apiClient.defaults.adapter = async () => {
      throw new ApiError('Request failed.', kind, status);
    };
    await expect(getOwnListingDetails('501')).rejects.toMatchObject({
      kind,
      status,
    });
  },
);

test('a missing local token never makes an HTTP request', async () => {
  jest.mocked(secureStorage.getToken).mockResolvedValue(null);
  jest.spyOn(secureStorage, 'removeTokenIfCurrent').mockResolvedValue(true);
  await expect(getOwnListingDetails('501')).rejects.toMatchObject({
    status: 401,
  });
  expect(calls).toBe(0);
  expect(useAuthStore.getState().status).toBe('guest');
});
test.each(['logout', 'switch', 'token', 'abort'])(
  'ignores late response after %s',
  async change => {
    const controller = new AbortController();
    apiClient.defaults.adapter = async config => {
      if (change === 'logout') useAuthStore.getState().clear();
      if (change === 'switch')
        useAuthStore.getState().setUser({ ...member, id: 9 });
      if (change === 'token')
        jest.mocked(secureStorage.getToken).mockResolvedValue('new-token');
      if (change === 'abort') controller.abort();
      return {
        status: 200,
        statusText: '',
        config,
        headers: {},
        data: {
          success: true,
          message: 'OK',
          data: record,
        },
      };
    };
    await expect(
      getOwnListingDetails('501', controller.signal),
    ).rejects.toBeDefined();
  },
);
