import { useDevelopmentStore } from '../src/store/developmentStore';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { ApiError } from '../src/types/api';
import {
  loadListingEdit,
  changedListingFields,
  updateListing,
  editContext,
  EditContext,
} from '../src/features/post-listing/services/updateListingService';
import {
  createListingDraft as draft,
  createdListingRecord as record,
  referenceResponse,
} from '../test/fixtures/createListing';
import { useListingDraft } from '../src/features/post-listing/store/listingDraftStore';
let get: jest.SpyInstance,
  put: jest.SpyInstance,
  post: jest.SpyInstance,
  context: EditContext;
const envelope = (row = record) => ({
  status: 200,
  data: { success: true, message: 'Listing updated successfully.', data: row },
});
test('Task 35 loaded addresses survive unrelated edits and explicit clear uses null', async () => {
  context.original = { ...context.original, from_address: '12 Origin Street', to_address: '34 Destination Road' };
  const current = {...draft, fromAddress: '12 Origin Street', toAddress: '34 Destination Road'};
  expect(changedListingFields(context, {...current, title: 'Changed'})).toEqual({title: 'Changed'});
  expect(changedListingFields(context, {...current, fromAddress: ''})).toEqual({from_address: null});
});
test('Task 35 owner details addresses load into editable form without exposing public fields', async () => {
  context.state = 'confirmed';
  get.mockImplementation(async (url, config) => url === '/customer/listings/123' ? envelope({...record, from_address: '12 Origin Street', to_address: '34 Destination Road'} as typeof record) : referenceResponse(url, config));
  const loaded = await loadListingEdit('123');
  expect(loaded.initial).toMatchObject({fromAddress: '12 Origin Street', toAddress: '34 Destination Road'});
});
beforeEach(async () => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Test', email: 'test@example.test' });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('edit-test-token');
  get = jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) =>
      url === '/customer/listings/123'
        ? envelope()
        : referenceResponse(url, config),
    );
  put = jest
    .spyOn(apiClient, 'put')
    .mockImplementation(async (_url, payload) =>
      envelope({ ...record, ...(payload as object) }),
    );
  post = jest
    .spyOn(apiClient, 'post')
    .mockRejectedValue(new Error('Unexpected POST'));
  context = await loadListingEdit('123');
});
afterEach(() => {
  jest.restoreAllMocks();
  useDevelopmentStore.setState({ previewActive: false });
  useAuthStore.getState().clear();
});
test('authoritative owner GET + public references prefill exact values including zero', () => {
  expect(context.initial).toEqual(draft);
  expect(get).toHaveBeenCalledWith(
    '/customer/listings/123',
    expect.objectContaining({
      headers: { Authorization: 'Bearer edit-test-token' },
    }),
  );
  expect(get).toHaveBeenCalledWith(
    '/cities',
    expect.objectContaining({
      params: { country_id: 1 },
      headers: { Authorization: false },
    }),
  );
  expect(get).toHaveBeenCalledWith(
    '/cities',
    expect.objectContaining({ params: { country_id: 2 } }),
  );
});
test('unchanged draft sends no PUT', async () => {
  expect(changedListingFields(context, draft)).toEqual({});
  expect(await updateListing(context, draft)).toBeNull();
  expect(put).not.toHaveBeenCalled();
});
test('only title changes; exact PUT/token/JSON, no POST or image/status fields', async () => {
  const result = await updateListing(context, { ...draft, title: 'Changed' });
  expect(result).toMatchObject({ id: 123, title: 'Changed', status: 0 });
  expect(put).toHaveBeenCalledTimes(1);
  expect(put).toHaveBeenCalledWith(
    '/customer/listings/123',
    { title: 'Changed' },
    expect.objectContaining({
      headers: { Authorization: 'Bearer edit-test-token' },
    }),
  );
  expect(post).not.toHaveBeenCalled();
});
test('multifield Send + dates + zero preserve final state', () => {
  expect(
    changedListingFields(context, {
      ...draft,
      type: 'send',
      date: '2099-01-02',
      reachedOn: '2099-01-03',
      weight: '00',
    }),
  ).toEqual({
    ad_type: 'Send',
    departure_on: '2099-01-02',
    reached_on: '2099-01-03',
  });
});
test('clearing optional weight and area uses null, not zero or missing', () => {
  expect(
    changedListingFields(context, {
      ...draft,
      weight: '',
      from: { ...draft.from!, area: undefined },
    }),
  ).toEqual({ weight: null, from_area: null });
});
test.each(['1.5', '-1', '1e2', '2147483648'])(
  'invalid integer %s never submits',
  async weight => {
    await expect(
      updateListing(context, { ...draft, weight }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(put).not.toHaveBeenCalled();
  },
);
test('date comparison uses stored arrival when only departure changes', async () => {
  await expect(
    updateListing(context, { ...draft, date: '2099-01-03' }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(put).not.toHaveBeenCalled();
});
test('invalid city-country relationship never submits', async () => {
  await expect(
    updateListing(context, {
      ...draft,
      from: { ...draft.from!, city: draft.to!.city },
    }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(put).not.toHaveBeenCalled();
});
test('unverified category never submits', async () => {
  await expect(
    updateListing(context, {
      ...draft,
      category: { id: 999, name: 'Fixture' },
    }),
  ).rejects.toMatchObject({ kind: 'validation' });
});
test.each(['', 'NO_SUCH'])(
  'invalid currency %s never submits',
  async currency => {
    await expect(
      updateListing(context, { ...draft, currency }),
    ).rejects.toMatchObject({ kind: 'validation' });
  },
);
test.each([400, 401, 403, 404, 409, 422, 429])(
  'HTTP %s definite rejection preserves ready context and original',
  async status => {
    const fields = { title: ['Invalid title'] };
    put.mockRejectedValueOnce(
      new ApiError('Rejected', 'validation', status, fields),
    );
    await expect(
      updateListing(context, { ...draft, title: 'Changed' }),
    ).rejects.toMatchObject({ status, fields });
    expect(context.state).toBe('ready');
    expect(context.original).toEqual(record);
  },
);
test.each([
  new ApiError('Timeout', 'network'),
  new ApiError('Server failure', 'server', 500),
])(
  'ambiguous error holds draft without retry and reads authoritative owner state',
  async error => {
    put.mockRejectedValueOnce(error);
    await expect(
      updateListing(context, { ...draft, title: 'Changed' }),
    ).rejects.toBe(error);
    expect(context.state).toBe('unknown');
    expect(put).toHaveBeenCalledTimes(1);
    await expect(
      updateListing(context, { ...draft, title: 'Changed' }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(put).toHaveBeenCalledTimes(1);
    expect(
      get.mock.calls.filter(call => call[0] === '/customer/listings/123'),
    ).toHaveLength(2);
  },
);
test.each([
  { status: 201, data: envelope().data },
  { status: 200, data: {} },
  envelope({ ...record, id: 999 }),
])('invalid success cannot confirm update', async response => {
  put.mockResolvedValueOnce(response);
  await expect(
    updateListing(context, { ...draft, title: 'Changed' }),
  ).rejects.toMatchObject({ kind: 'unknown' });
  expect(context.state).toBe('unknown');
});
test('double submissions produce a single PUT', async () => {
  let resolve!: (value: unknown) => void;
  put.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const first = updateListing(context, { ...draft, title: 'Changed' });
  await Promise.resolve();
  await Promise.resolve();
  await expect(
    updateListing(context, { ...draft, title: 'Changed' }),
  ).rejects.toMatchObject({ kind: 'validation' });
  resolve(envelope({ ...record, title: 'Changed' }));
  await first;
  expect(put).toHaveBeenCalledTimes(1);
});
test.each(['logout', 'switch'] as const)(
  '%s invalidates pending response and clears contexts',
  async action => {
    let resolve!: (value: unknown) => void;
    put.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    const pending = updateListing(context, { ...draft, title: 'Changed' });
    await Promise.resolve();
    await Promise.resolve();
    if (action === 'logout') useAuthStore.getState().clear();
    else
      useAuthStore
        .getState()
        .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
    resolve(envelope());
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
    expect(editContext('123')).toBeUndefined();
  },
);
test('cloned context cannot authorize a fixture ID', async () => {
  await expect(
    updateListing({ ...context }, { ...draft, title: 'Changed' }),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  expect(put).not.toHaveBeenCalled();
});
test('guest cannot load or update a listing', async () => {
  useAuthStore.getState().clear();
  await expect(loadListingEdit('123')).rejects.toMatchObject({ status: 401 });
  await expect(updateListing(context, draft)).rejects.toMatchObject({
    kind: 'cancelled',
  });
});
test('invalid navigation ID fails before owner read', async () => {
  get.mockClear();
  await expect(loadListingEdit('fixture-1')).rejects.toMatchObject({
    status: 404,
  });
  expect(get).not.toHaveBeenCalled();
});
test('missing token never sends PUT', async () => {
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue(null);
  await expect(
    updateListing(context, { ...draft, title: 'Changed' }),
  ).rejects.toMatchObject({ status: 401 });
  expect(put).not.toHaveBeenCalled();
});
test('creation draft and image recovery survive owner edit', async () => {
  useListingDraft.getState().update({ ...draft, title: 'Unsaved creation' });
  const before = useListingDraft.getState().values;
  await updateListing(context, { ...draft, title: 'Changed' });
  expect(useListingDraft.getState().values).toBe(before);
  expect(post).not.toHaveBeenCalled();
});
test('legacy visibility and non-form description/price are omitted', () => {
  context.original.show_contact_info = 1;
  context.original.description = '<p>Saved</p>';
  context.original.weight_price = 50;
  expect(changedListingFields(context, { ...draft, title: 'Changed' })).toEqual(
    { title: 'Changed' },
  );
});
test('timeout is reconciled only when authoritative owner state matches every intended field', async () => {
  put.mockRejectedValueOnce(new ApiError('Timeout', 'network'));
  get.mockImplementation(async (url, config) =>
    url === '/customer/listings/123'
      ? envelope({ ...record, title: 'Changed' })
      : referenceResponse(url, config),
  );
  const observed = await updateListing(context, { ...draft, title: 'Changed' });
  expect(observed?.title).toBe('Changed');
  expect(context.state).toBe('confirmed');
  expect(put).toHaveBeenCalledTimes(1);
});
test('partial reconciliation does not confirm a multi-field update', async () => {
  put.mockRejectedValueOnce(new ApiError('Timeout', 'network'));
  get.mockImplementation(async (url, config) =>
    url === '/customer/listings/123'
      ? envelope({ ...record, title: 'Changed' })
      : referenceResponse(url, config),
  );
  await expect(
    updateListing(context, { ...draft, title: 'Changed', weight: '10' }),
  ).rejects.toMatchObject({ kind: 'network' });
  expect(context.state).toBe('unknown');
});
test('aborted before submission never dispatches', async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(
    updateListing(context, { ...draft, title: 'Changed' }, abort.signal),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  expect(put).not.toHaveBeenCalled();
});
test('token changes during response cannot confirm or reconcile through another session', async () => {
  put.mockImplementationOnce(async () => {
    jest.spyOn(secureStorage, 'getToken').mockResolvedValue('different-token');
    return envelope();
  });
  await expect(
    updateListing(context, { ...draft, title: 'Changed' }),
  ).rejects.toMatchObject({ kind: 'cancelled' });
  expect(context.state).toBe('unknown');
  expect(
    get.mock.calls.filter(call => call[0] === '/customer/listings/123'),
  ).toHaveLength(1);
});
test('same-country origin and destination share the verified city request', async () => {
  useAuthStore.getState().setUser({ id: 8, name: 'Fresh', email: 'fresh@example.test' });
  get.mockClear();
  get.mockImplementation(async (url, config) => url === '/customer/listings/123' ? envelope({ ...record, to_country_id: 1, to_city_id: 101 }) : referenceResponse(url, config));
  const same = await loadListingEdit('123'); expect(same.initial.to?.city.id).toBe(101);
  expect(get.mock.calls.filter(call => call[0] === '/cities')).toHaveLength(1);
});
test('returning without edits refetches owner state; a dirty draft is not overwritten', async () => {
  const fresh = await loadListingEdit('123'); expect(fresh).not.toBe(context);
  fresh.draft = { ...draft, title: 'Editing' }; const reads = get.mock.calls.length;
  expect(await loadListingEdit('123')).toBe(fresh); expect(get).toHaveBeenCalledTimes(reads); expect(fresh.draft.title).toBe('Editing');
});

test('demo preview cannot fetch or mutate private listing details', async () => {
  useAuthStore.getState().clear(); useDevelopmentStore.setState({ previewActive: true }); get.mockClear();
  await expect(loadListingEdit('123')).rejects.toMatchObject({ status: 401 });
  await expect(updateListing(context, { ...draft, title: 'Changed' })).rejects.toMatchObject({ kind: 'cancelled' });
  expect(get).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled();
});
