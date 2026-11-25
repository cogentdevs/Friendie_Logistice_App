import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { ApiError } from '../src/types/api';
import * as contactService from '../src/features/deals/dealContactService';
import { chatAuthorizationFixture } from '../test/fixtures/dealContact';
import {
  getPublicListingDetails,
  isVerifiedPublicListing,
  getPublicListings,
  publicSearchParams,
} from '../src/features/listings/services/publicListingsService';
import {
  createOrReuseConversation,
  conversationSubmissionState,
} from '../src/features/messages/services/createConversationService';
import {
  publicListingFixture as row,
  conversationCreatedFixture as result,
} from '../test/fixtures/publicListing';
const adapter = apiClient.defaults.adapter;
let post: jest.SpyInstance;
beforeEach(() => {
  jest
    .spyOn(contactService, 'readDealContact')
    .mockImplementation(async () => chatAuthorizationFixture());
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Member', email: 'member@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
  jest
    .spyOn(secureStorage, 'getToken')
    .mockResolvedValue('conversation-test-token');
  post = jest
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ status: 201, data: result });
  jest
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data: { success: true, data: row } });
});
afterEach(() => {
  apiClient.defaults.adapter = adapter;
  jest.restoreAllMocks();
  useAuthStore.getState().clear();
});
const listing = async () =>
  Object.assign(await getPublicListingDetails('123'), { dealId: 9 });
test.each([201, 200])(
  'status %i extracts authoritative room without Send Message POST',
  async status => {
    post.mockResolvedValue({
      status,
      data: {
        ...result,
        message:
          status === 201 ? result.message : 'Conversation already exists.',
      },
    });
    const remote = await listing();
    expect(await createOrReuseConversation(remote, ' Hello ')).toMatchObject({
      created: status === 201,
      conversation: { id: 42 },
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/customer/conversations',
      { deal_id: 9, message: ' Hello ' },
      {
        signal: undefined,
        headers: { Authorization: 'Bearer conversation-test-token' },
      },
    );
  },
);
test.each(['', '  \n', 'x'.repeat(10001), 'bad\0text'])(
  'invalid message causes no POST (%#)',
  async text => {
    await expect(
      createOrReuseConversation(await listing(), text),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(post).not.toHaveBeenCalled();
  },
);
test('numeric fixture or cloned remote object is not proof of origin', async () => {
  const remote = await listing();
  expect(isVerifiedPublicListing(remote)).toBe(true);
  expect(isVerifiedPublicListing({ ...remote })).toBe(false);
  await expect(
    createOrReuseConversation({ id: 123 }, 'Hello'),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(post).not.toHaveBeenCalled();
});
test('guest and demo cannot POST', async () => {
  const remote = await listing();
  useAuthStore.getState().clear();
  await expect(
    createOrReuseConversation(remote, 'Hello'),
  ).rejects.toMatchObject({ status: 401 });
  useDevelopmentStore.setState({ previewActive: true });
  await expect(
    createOrReuseConversation(remote, 'Hello'),
  ).rejects.toMatchObject({ status: 401 });
  expect(post).not.toHaveBeenCalled();
});
test('double submission has a synchronous session/listing guard', async () => {
  const remote = await listing();
  let resolve!: (value: unknown) => void;
  post.mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const first = createOrReuseConversation(remote, 'Hello');
  await expect(
    createOrReuseConversation(remote, 'Hello'),
  ).rejects.toMatchObject({ kind: 'validation' });
  while (!resolve) await Promise.resolve();
  resolve({ status: 201, data: result });
  await first;
  expect(post).toHaveBeenCalledTimes(1);
});
test.each([400, 401, 403, 404, 409, 422, 429])(
  'explicit HTTP %i rejection releases guard',
  async status => {
    post.mockRejectedValue(new ApiError('Rejected', 'validation', status));
    await expect(
      createOrReuseConversation(await listing(), 'Hello'),
    ).rejects.toMatchObject({ status });
    expect(conversationSubmissionState(9)).toBeUndefined();
  },
);
test.each([
  new ApiError('Timeout', 'network'),
  new ApiError('Offline', 'network'),
  new ApiError('Server', 'server', 500),
])('ambiguous failure never automatically retries (%#)', async error => {
  const remote = await listing();
  post.mockRejectedValue(error);
  await expect(createOrReuseConversation(remote, 'Hello')).rejects.toThrow();
  expect(conversationSubmissionState(9)).toBe('unknown');
  await expect(
    createOrReuseConversation(remote, 'Hello'),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(post).toHaveBeenCalledTimes(1);
});
test.each([
  { ...result, data: { ...result.data, id: 0 } },
  { ...result, data: { ...result.data, listing: { id: 999, title: null } } },
  { success: true, data: {} },
])('invalid response cannot produce a guessed ID (%#)', async data => {
  post.mockResolvedValue({ status: 201, data });
  await expect(
    createOrReuseConversation(await listing(), 'Hello'),
  ).rejects.toMatchObject({ kind: 'unknown' });
  expect(conversationSubmissionState(9)).toBe('unknown');
});
test.each(['logout', 'switch'])(
  'late completion after %s is rejected',
  async mode => {
    const remote = await listing();
    post.mockImplementation(async () => {
      if (mode === 'logout') useAuthStore.getState().clear();
      else
        useAuthStore
          .getState()
          .setUser({ id: 55, name: 'Other', email: 'o@example.test' });
      return { status: 201, data: result };
    });
    await expect(
      createOrReuseConversation(remote, 'Hello'),
    ).rejects.toMatchObject({ kind: 'cancelled' });
  },
);
test('public Details is public, maps actual nullable fields and rejects mismatched ID', async () => {
  useAuthStore.getState().clear();
  const remote = await listing();
  expect(remote).toMatchObject({
    id: 123,
    origin: 'Karachi, Pakistan',
    price: 25,
    type: 'carry',
  });
  expect(apiClient.get).toHaveBeenCalledWith('/listings/123', {
    signal: undefined,
    headers: { Authorization: false },
  });
  jest.mocked(apiClient.get).mockResolvedValue({
    status: 200,
    data: { success: true, data: { ...row, id: 9 } },
  });
  await expect(listing()).rejects.toThrow();
});
test.each(['../123', '0', 'abc', '2147483648'])(
  'invalid ID %s never requests',
  async value => {
    await expect(getPublicListingDetails(value)).rejects.toMatchObject({
      status: 404,
    });
    expect(apiClient.get).not.toHaveBeenCalled();
  },
);
test('public pagination and filters map only documented keys', async () => {
  const params = publicSearchParams(
    2,
    {
      query: 'Trip',
      category: '4',
      type: 'carry',
      weightKg: 10,
      destinationCountry: { id: 3, code: 'AE', name: 'UAE' },
    },
    { mode: 'worldwide' },
  );
  expect(params).toEqual({
    page: 2,
    per_page: 20,
    search: 'Trip',
    category_id: 4,
    ad_type: 'Carring',
    weight: 10,
    to_country_id: 3,
  });
  jest.mocked(apiClient.get).mockResolvedValue({
    status: 200,
    data: {
      success: true,
      data: {
        items: [row],
        pagination: {
          current_page: 2,
          per_page: 20,
          total: 21,
          last_page: 2,
        },
      },
    },
  });
  expect(await getPublicListings(2, {}, { mode: 'worldwide' })).toMatchObject({
    data: [{ id: 123 }],
    meta: { current_page: 2, total: 21 },
  });
});
test('nullable backend values are not fabricated and stale abort is rejected', async () => {
  jest.mocked(apiClient.get).mockResolvedValue({
    status: 200,
    data: {
      success: true,
      data: {
        ...row,
        weight_price: null,
        currency: null,
        owner: { ...row.owner, display_name: null },
      },
    },
  });
  expect(await listing()).toMatchObject({
    price: null,
    currency: null,
    traveller: { name: '' },
  });
  const control = new AbortController();
  control.abort();
  await expect(
    getPublicListingDetails('123', control.signal),
  ).rejects.toMatchObject({ kind: 'cancelled' });
});
test('unsupported range/radius never becomes a misleading broader request', () => {
  expect(() =>
    publicSearchParams(
      1,
      { dates: { start: '2099-01-01', end: '2099-01-02' } },
      { mode: 'worldwide' },
    ),
  ).toThrow('not supported');
});
test('actual Axios adapter receives personalized public GET then only exact deal Bearer JSON POST', async () => {
  jest.mocked(apiClient.get).mockRestore();
  jest.mocked(apiClient.post).mockRestore();
  jest.mocked(secureStorage.getToken).mockResolvedValue('adapter-test-token');
  const calls: string[] = [];
  apiClient.defaults.adapter = async config => {
    calls.push(config.method + ' ' + config.url);
    if (config.method === 'get') {
      expect(config.headers.Authorization).toBe('Bearer adapter-test-token');
      return {
        status: 200,
        statusText: '',
        headers: {},
        config,
        data: { success: true, data: row },
      };
    }
    expect(config.headers.Authorization).toBe('Bearer adapter-test-token');
    expect(JSON.parse(config.data)).toEqual({
      deal_id: 9,
      message: 'Hello',
    });
    return { status: 201, statusText: '', headers: {}, config, data: result };
  };
  await createOrReuseConversation(await listing(), 'Hello');
  expect(calls).toEqual(['get /listings/123', 'post /customer/conversations']);
});
