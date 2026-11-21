import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { ApiError } from '../src/types/api';
import {
  createListing,
  createListingPayload,
  listingSubmission,
  beginListingDraft,
} from '../src/features/post-listing/services/createListingService';
import { getListingReferences } from '../src/features/post-listing/services/listingReferencesService';
import { listingDraftSchema } from '../src/features/post-listing/types/listingDraft';
import {
  createListingDraft as draft,
  createdListingRecord as record,
  referenceResponse,
  loadListingReferences,
} from '../test/fixtures/createListing';

let post: jest.SpyInstance, get: jest.SpyInstance;
test('Task 35 separate addresses use exact API keys and authoritative response', async () => {
  post.mockResolvedValueOnce({ status: 201, data: { success: true, message: 'Created', data: { ...record, from_address: '12 Origin Street', to_address: '34 Destination Road' } } });
  const result = await createListing({ ...draft, fromAddress: '12 Origin Street', toAddress: '34 Destination Road' });
  expect(post.mock.calls[0][1]).toMatchObject({ from_address: '12 Origin Street', to_address: '34 Destination Road', from_area: 'Clifton', to_area: 'Deira' });
  expect(result.from_address).toBe('12 Origin Street');
});
test('Task 35 missing address confirmation cannot silently report a saved address', async () => {
  await expect(createListing({ ...draft, fromAddress: '12 Origin Street' })).rejects.toMatchObject({ kind: 'unknown' });
  expect(listingSubmission()?.state).toBe('unknown');
});
test.each(['fromAddress', 'toAddress'] as const)('Task 35 %s optional whitespace and length validation', key => {
  expect(createListingPayload({ ...draft, [key]: '   ' })).not.toHaveProperty(key === 'fromAddress' ? 'from_address' : 'to_address');
  expect(() => createListingPayload({ ...draft, [key]: 'x'.repeat(256) })).toThrow();
  expect(createListingPayload({ ...draft, [key]: 'x'.repeat(255) })).toHaveProperty(key === 'fromAddress' ? 'from_address' : 'to_address', 'x'.repeat(255));
});
beforeEach(async () => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Test customer', email: 'test@example.test' });
  useDevelopmentStore.setState({ previewActive: false });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('listing-test-token');
  get = jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) => referenceResponse(url, config));
  post = jest.spyOn(apiClient, 'post').mockResolvedValue({
    status: 201,
    data: {
      success: true,
      message: 'Listing created and pending approval.',
      data: record,
    },
  });
  await loadListingReferences();
});
afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.getState().clear();
});

test.each(['carry', 'send'] as const)(
  'exact JSON endpoint, token and %s mapping preserve zero and Pending',
  async type => {
    post.mockResolvedValueOnce({
      status: 201,
      data: {
        success: true,
        message: 'Created',
        data: { ...record, ad_type: type === 'carry' ? 'Carring' : 'Send' },
      },
    });
    const result = await createListing({ ...draft, type });
    expect(result).toMatchObject({ id: 123, status: 0, weight: 0 });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/customer/listings',
      {
        ad_type: type === 'carry' ? 'Carring' : 'Send',
        title: draft.title,
        category_id: 7,
        from_country_id: 1,
        from_city_id: 101,
        to_country_id: 2,
        to_city_id: 102,
        currency: 'PKR',
        departure_on: '2099-01-01',
        reached_on: '2099-01-02',
        weight: 0,
        from_area: 'Clifton',
        to_area: 'Deira',
        show_contact_info: 0,
      },
      {
        signal: undefined,
        headers: { Authorization: 'Bearer listing-test-token' },
      },
    );
    expect(listingSubmission()?.state).toBe('confirmed');
    expect(
      post.mock.calls.some(([url]) => String(url).includes('/image')),
    ).toBe(false);
  },
);
test.each(['', '   '])('blank optional weight is omitted (%#)', weight => {
  expect(createListingPayload({ ...draft, weight })).not.toHaveProperty(
    'weight',
  );
});
test.each(['0', '2147483647', '001'])(
  'valid integer %s is preserved',
  weight => {
    expect(createListingPayload({ ...draft, weight }).weight).toBe(
      Number(weight),
    );
  },
);
test.each(['-1', '1.2', '1,2', 'Infinity', 'NaN', '1e3', '2147483648'])(
  'invalid weight %s prevents POST',
  async weight => {
    await expect(createListing({ ...draft, weight })).rejects.toMatchObject({
      kind: 'validation',
    });
    expect(post).not.toHaveBeenCalled();
  },
);
test.each([
  { title: '' },
  { title: ' ' },
  { title: 'x'.repeat(256) },
  { category: undefined },
  { currency: '' },
  { from: undefined },
  { to: undefined },
  { date: '2099-02-31' },
  { reachedOn: '' },
  { reachedOn: '2000-01-01' },
])('required/invalid fields (%#) prevent POST', async change => {
  await expect(createListing({ ...draft, ...change })).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(post).not.toHaveBeenCalled();
});
test('same route, past departure, equal arrival allowed; date strings retain local Y-m-d', () => {
  const value = {
    ...draft,
    to: draft.from,
    date: '2000-01-01',
    reachedOn: '2000-01-01',
  };
  expect(listingDraftSchema.safeParse(value).success).toBe(true);
  expect(createListingPayload(value)).toMatchObject({
    departure_on: '2000-01-01',
    reached_on: '2000-01-01',
  });
});
test.each([
  { category: { id: 900001, name: 'Fixture' } },
  { currency: 'FAKE' },
  {
    from: {
      ...draft.from!,
      city: { id: 900001, name: 'Fixture', countryId: 1 },
    },
  },
  { from: { ...draft.from!, city: { id: 102, name: 'Dubai', countryId: 2 } } },
  { from: { ...draft.from!, source: 'manual' } },
])(
  'unverified fixture IDs or wrong country relationship (%#) rejected',
  async change => {
    await expect(
      createListing({ ...draft, ...change } as typeof draft),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(post).not.toHaveBeenCalled();
  },
);
test('public reference contracts omit auth, request dependent cities and preserve currency code', async () => {
  const countries = await getListingReferences('countries');
  expect(countries[1].value).toEqual({ id: 2, name: 'United Arab Emirates' });
  expect(await getListingReferences('currencies')).toEqual([
    { key: 'PKR', label: 'PKR', value: 'PKR' },
  ]);
  await getListingReferences('cities', 2);
  expect(get).toHaveBeenCalledWith('/cities', {
    signal: undefined,
    headers: { Authorization: false },
    params: { country_id: 2 },
  });
  expect(
    get.mock.calls.every(
      ([, config]) => config.headers.Authorization === false,
    ),
  ).toBe(true);
});
test('invalid country, wrong-country response, null labels and invalid envelope handled safely', async () => {
  await expect(getListingReferences('cities', 0)).rejects.toMatchObject({
    kind: 'validation',
  });
  get.mockResolvedValueOnce(
    referenceResponse('/cities', { params: { country_id: 2 } }),
  );
  await expect(getListingReferences('cities', 1)).rejects.toMatchObject({
    kind: 'unknown',
  });
  get.mockResolvedValueOnce({
    status: 200,
    data: {
      success: true,
      message: 'OK',
      data: {
        items: [{ id: 3, name: null, short_name: null, image_url: null }],
      },
    },
  });
  expect(await getListingReferences('countries')).toEqual([]);
  get.mockResolvedValueOnce({ status: 200, data: { items: [] } });
  await expect(getListingReferences('currencies')).rejects.toMatchObject({
    kind: 'unknown',
  });
});
test.each([400, 401, 403, 404, 409, 422, 429])(
  'HTTP %s preserves draft, clears only rejected guard and never auto retries',
  async status => {
    const error = new ApiError('Rejected', 'validation', status, {
      title: ['Invalid title'],
    });
    post.mockRejectedValueOnce(error);
    await expect(createListing(draft)).rejects.toBe(error);
    expect(listingSubmission()).toBeUndefined();
    expect(draft.weight).toBe('0');
    expect(post).toHaveBeenCalledTimes(1);
  },
);
test.each([
  new ApiError('Timeout', 'network'),
  new ApiError('Offline', 'network'),
  new ApiError('Server error', 'server', 500),
])(
  'ambiguous outcome (%#) retains full draft and blocks all repeat POSTs',
  async error => {
    post.mockRejectedValueOnce(error);
    await expect(createListing(draft)).rejects.toBe(error);
    expect(listingSubmission()).toEqual({ state: 'unknown', draft });
    beginListingDraft(draft);
    await expect(
      createListing({ ...draft, title: 'Changed draft' }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(post).toHaveBeenCalledTimes(1);
  },
);
test.each([
  { status: 200, data: { success: true, message: 'OK', data: record } },
  {
    status: 201,
    data: { success: true, message: 'OK', data: { ...record, status: 1 } },
  },
  {
    status: 201,
    data: {
      success: true,
      message: 'OK',
      data: { ...record, from_city_id: 999 },
    },
  },
  {
    status: 201,
    data: {
      success: true,
      message: 'OK',
      data: { ...record, show_contact_info: 1 },
    },
  },
  { status: 201, data: { success: true, data: {} } },
])('unconfirmed response (%#) holds the submission', async response => {
  post.mockResolvedValueOnce(response);
  await expect(createListing(draft)).rejects.toMatchObject({ kind: 'unknown' });
  expect(listingSubmission()?.state).toBe('unknown');
});
test('synchronous in-flight guard prevents concurrent POST; successful result cannot replay without explicit new draft', async () => {
  let resolve!: (value: unknown) => void;
  post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const first = createListing(draft);
  await expect(createListing(draft)).rejects.toMatchObject({
    kind: 'validation',
  });
  resolve({
    status: 201,
    data: { success: true, message: 'OK', data: record },
  });
  await first;
  await expect(createListing(draft)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(post).toHaveBeenCalledTimes(1);
  beginListingDraft(draft);
  await expect(createListing(draft)).rejects.toMatchObject({
    kind: 'validation',
  });
  const next = { ...draft, title: 'New intentional listing' };
  beginListingDraft(next);
  post.mockResolvedValueOnce({
    status: 201,
    data: {
      success: true,
      message: 'Created',
      data: { ...record, title: next.title },
    },
  });
  await createListing(next);
  expect(post).toHaveBeenCalledTimes(2);
});
test.each(['guest', 'demo'])(
  '%s cannot POST protected creation',
  async mode => {
    useAuthStore.getState().clear();
    useDevelopmentStore.setState({ previewActive: mode === 'demo' });
    await expect(createListing(draft)).rejects.toMatchObject({ status: 401 });
    expect(post).not.toHaveBeenCalled();
  },
);
test('missing token cleans invalid session before POST', async () => {
  jest.mocked(secureStorage.getToken).mockResolvedValue(null);
  jest.spyOn(secureStorage, 'removeTokenIfCurrent').mockResolvedValue(true);
  await expect(createListing(draft)).rejects.toMatchObject({ status: 401 });
  expect(useAuthStore.getState().status).toBe('guest');
  expect(post).not.toHaveBeenCalled();
});
test.each(['logout', 'account', 'token', 'abort'])(
  'late response after %s cannot confirm or restore account data',
  async change => {
    let resolve!: (value: unknown) => void;
    post.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    const controller = new AbortController();
    const first = createListing(draft, controller.signal);
    await Promise.resolve();
    await Promise.resolve();
    if (change === 'logout') useAuthStore.getState().clear();
    if (change === 'account')
      useAuthStore
        .getState()
        .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
    if (change === 'token')
      jest.mocked(secureStorage.getToken).mockResolvedValue('new-token');
    if (change === 'abort') controller.abort();
    resolve({
      status: 201,
      data: { success: true, message: 'OK', data: record },
    });
    await expect(first).rejects.toMatchObject({ kind: 'cancelled' });
    expect(listingSubmission()?.state).not.toBe('confirmed');
    if (change === 'logout' || change === 'account')
      expect(listingSubmission()).toBeUndefined();
  },
);

test.each(['', '0', '12.50', '.5', '1e2'])(
  'optional price %s maps without losing zero',
  weightPrice => {
    const payload = createListingPayload({
      ...draft,
      description: 'Original description',
      weightPrice,
    });
    expect(payload.description).toBe('Original description');
    if (weightPrice) expect(payload.weight_price).toBe(Number(weightPrice));
    else expect(payload).not.toHaveProperty('weight_price');
    expect(payload.show_contact_info).toBe(0);
  },
);
test.each(['-1', 'NaN', 'Infinity', '1e999', '1,2', '0x10'])(
  'invalid optional price %s prevents submission',
  weightPrice => {
    expect(() => createListingPayload({ ...draft, weightPrice })).toThrow();
    expect(post).not.toHaveBeenCalled();
  },
);
test('description remains optional and enforces Laravel 10000 character boundary', () => {
  expect(
    createListingPayload({ ...draft, description: '' }),
  ).not.toHaveProperty('description');
  expect(
    createListingPayload({ ...draft, description: 'x'.repeat(10000) })
      .description,
  ).toHaveLength(10000);
  expect(() =>
    createListingPayload({ ...draft, description: 'x'.repeat(10001) }),
  ).toThrow();
});

test.each(['Parcel &amp; documents'])(
  '201 accepts authoritative sanitized description %s without another POST',
  async description => {
    post.mockResolvedValueOnce({
      status: 201,
      data: {
        success: true,
        message: 'Created',
        data: { ...record, description },
      },
    });
    const result = await createListing({
      ...draft,
      description: 'Parcel & documents',
    });
    expect(result.description).toBe(description);
    expect(result.id).toBe(record.id);
    expect(result.status).toBe(0);
    expect(post).toHaveBeenCalledTimes(1);
    expect(listingSubmission()?.state).toBe('confirmed');
  },
);
