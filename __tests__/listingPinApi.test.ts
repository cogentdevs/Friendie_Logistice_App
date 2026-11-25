import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { ApiError } from '../src/types/api';
import {
  createListing,
  createListingPayload,
  listingSubmission,
} from '../src/features/post-listing/services/createListingService';
import {
  loadListingEdit,
  changedListingFields,
  updateListing,
  editContext,
} from '../src/features/post-listing/services/updateListingService';
import {
  ownListingApiSchema,
  OwnListingRecord,
} from '../src/features/listings/types/myListingsApi.types';
import { publicListingSchema } from '../src/features/listings/services/publicListingsService';
import { getOwnListingDetails } from '../src/features/listings/services/ownListingDetailsService';
import { getOwnListingsPage } from '../src/features/listings/services/myListingsApiService';
import { editManualListingPin as pin } from '../src/features/post-listing/types/manualListingPin';
import { listingPinErrors } from '../src/features/post-listing/services/listingPinPayload';
import {
  createListingDraft as draft,
  createdListingRecord,
  referenceResponse,
  loadListingReferences,
} from '../test/fixtures/createListing';

// Test server resolves string input to numeric response columns.
function resolvedPins(payload: Record<string, unknown>) {
  const result = { ...payload };
  for (const side of ['from', 'to']) {
    const key = side + '_location_pin';
    if (!(key in result)) continue;
    const value = result[key];
    delete result[key];
    const pair =
      value === null || value === ''
        ? [null, null]
        : String(value).split(',').map(Number);
    result[side + '_latitude'] = pair[0];
    result[side + '_longitude'] = pair[1];
  }
  return result;
}
function pinWire(
  fields: Record<string, unknown>,
  input: Record<string, unknown>,
) {
  const result = { ...fields };
  for (const side of ['from', 'to']) {
    if (!(side + '_latitude' in result)) continue;
    result[side + '_location_pin'] =
      result[side + '_latitude'] === null
        ? null
        : (input[side + 'Pin'] as { text: string }).text.trim();
    delete result[side + '_latitude'];
    delete result[side + '_longitude'];
  }
  return result;
}
const pins = {
  from_latitude: 0,
  from_longitude: 0,
  to_latitude: -33.8688197,
  to_longitude: 151.2092955,
};
let row: OwnListingRecord,
  post: jest.SpyInstance,
  put: jest.SpyInstance,
  get: jest.SpyInstance;
beforeEach(async () => {
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Owner', email: 'owner@example.test' });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('pin-test-token');
  row = ownListingApiSchema.parse({
    ...createdListingRecord,
    status: 1,
    ...pins,
  });
  get = jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) =>
      url === '/customer/listings/123'
        ? { status: 200, data: { success: true, message: 'Owned', data: row } }
        : referenceResponse(url, config),
    );
  post = jest
    .spyOn(apiClient, 'post')
    .mockImplementation(async (_url, payload) => ({
      status: 201,
      data: {
        success: true,
        message: 'Created',
        data: { ...row, ...resolvedPins(payload as Record<string, unknown>) },
      },
    }));
  put = jest
    .spyOn(apiClient, 'put')
    .mockImplementation(async (_url, payload) => {
      row = ownListingApiSchema.parse({
        ...row,
        ...resolvedPins(payload as Record<string, unknown>),
      });
      return {
        status: 200,
        data: { success: true, message: 'Updated', data: row },
      };
    });
  await loadListingReferences();
});
afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.getState().clear();
});

test.each([
  [{}, {}],
  [{ fromPin: pin('0,0') }, { from_latitude: 0, from_longitude: 0 }],
  [
    { toPin: pin('-33.8688197, 151.2092955') },
    { to_latitude: -33.8688197, to_longitude: 151.2092955 },
  ],
  [
    { fromPin: pin('90,-180'), toPin: pin('0.0000001, -0.0000001') },
    {
      from_latitude: 90,
      from_longitude: -180,
      to_latitude: 0.0000001,
      to_longitude: -0.0000001,
    },
  ],
])(
  'create complete optional pairs %# through existing JSON/Bearer boundary',
  async (fields, expected) => {
    await createListing({ ...draft, ...fields });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/customer/listings',
      { ...createListingPayload(draft), ...pinWire(expected, fields) },
      expect.objectContaining({
        headers: { Authorization: 'Bearer pin-test-token' },
      }),
    );
    const payload = post.mock.calls[0][1];
    expect(
      Object.keys(payload)
        .filter(key => /_location_pin$/.test(key))
        .sort(),
    ).toEqual(Object.keys(pinWire(expected, fields)).sort());
    expect(Object.values(payload)).not.toContain(undefined);
    expect(Object.values(payload)).not.toContain(null);
  },
);
test.each(['1,', '91,0', '0.00000001,0', 'not a pin'])(
  'invalid pin %s prevents any POST',
  async text => {
    await expect(
      createListing({ ...draft, fromPin: pin(text) }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(post).not.toHaveBeenCalled();
  },
);
test.each([
  { ...pins, from_longitude: 1 },
  { to_latitude: null, to_longitude: null },
])(
  'create does not confirm wrong or missing coordinate echo %#',
  async coordinates => {
    post.mockResolvedValueOnce({
      status: 201,
      data: {
        success: true,
        message: 'Created',
        data: { ...createdListingRecord, ...coordinates },
      },
    });
    await expect(
      createListing({ ...draft, fromPin: pin('0,0') }),
    ).rejects.toMatchObject({ kind: 'unknown' });
    expect(listingSubmission()?.state).toBe('unknown');
    await expect(
      createListing({ ...draft, fromPin: pin('0,0') }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(post).toHaveBeenCalledTimes(1);
  },
);

test.each([
  pins,
  {
    from_latitude: 0,
    from_longitude: 0,
    to_latitude: null,
    to_longitude: null,
  },
  {
    from_latitude: null,
    from_longitude: null,
    to_latitude: -90,
    to_longitude: -180,
  },
  {
    from_latitude: null,
    from_longitude: null,
    to_latitude: null,
    to_longitude: null,
  },
  {},
])('owner parser preserves optional/null/zero pairs %#', coordinates => {
  const parsed = ownListingApiSchema.parse({
    ...createdListingRecord,
    ...coordinates,
  });
  for (const [key, value] of Object.entries(coordinates))
    expect(parsed).toHaveProperty(key, value);
  if (!Object.keys(coordinates).length)
    expect(parsed).not.toHaveProperty('from_latitude');
});
test.each([
  { from_latitude: 1 },
  { from_latitude: 0, from_longitude: null },
  { from_latitude: '0', from_longitude: '0' },
  { from_latitude: NaN, from_longitude: 0 },
  { from_latitude: 91, from_longitude: 0 },
  { from_latitude: 0, from_longitude: Infinity },
  { from_latitude: 0.00000001, from_longitude: 0 },
])('owner malformed/incomplete pair fails closed %#', coordinates => {
  expect(
    ownListingApiSchema.safeParse({ ...createdListingRecord, ...coordinates })
      .success,
  ).toBe(false);
});
test('owner details and edit hydrate exact saved coordinates without writing or marking dirty', async () => {
  expect((await getOwnListingDetails('123')).backend).toMatchObject(pins);
  const context = await loadListingEdit('123');
  expect(context.initial.fromPin).toEqual({
    text: '0, 0',
    intent: 'unchanged',
  });
  expect(context.initial.toPin).toEqual({
    text: '-33.8688197, 151.2092955',
    intent: 'unchanged',
  });
  expect(changedListingFields(context, context.initial)).toEqual({});
  expect(post).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
});

test('slow duplicate hydration cannot replace a newer manual draft snapshot', async () => {
  const context = await loadListingEdit('123');
  let resolve!: (value: unknown) => void;
  get.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const pending = loadListingEdit('123');
  await Promise.resolve();
  await Promise.resolve();
  context.draft = { ...context.initial, fromPin: pin('5,6') };
  resolve({
    status: 200,
    data: { success: true, message: 'Owned', data: row },
  });
  expect(await pending).toBe(context);
  expect(editContext('123')?.draft?.fromPin?.text).toBe('5,6');
});
test.each([undefined, null])(
  'edit missing/null %s does not create fake coordinates',
  async value => {
    row = ownListingApiSchema.parse({
      ...createdListingRecord,
      from_latitude: value,
      from_longitude: value,
      to_latitude: value,
      to_longitude: value,
    });
    const context = await loadListingEdit('123');
    expect(context.initial.fromPin?.text ?? '').toBe('');
    expect(
      changedListingFields(context, { ...context.initial, fromPin: pin('') }),
    ).toEqual({});
  },
);
test.each([
  [{}, {}],
  [{ fromPin: pin('0.0000000, 0.0') }, {}],
  [{ title: 'Updated' }, { title: 'Updated' }],
  [{ fromPin: pin('1,2') }, { from_latitude: 1, from_longitude: 2 }],
  [{ toPin: pin('0,0') }, { to_latitude: 0, to_longitude: 0 }],
  [
    { fromPin: pin('1,2'), toPin: pin('3,4') },
    { from_latitude: 1, from_longitude: 2, to_latitude: 3, to_longitude: 4 },
  ],
  [{ fromPin: pin('') }, { from_latitude: null, from_longitude: null }],
  [{ toPin: pin('') }, { to_latitude: null, to_longitude: null }],
  [
    { fromPin: pin(''), toPin: pin('') },
    {
      from_latitude: null,
      from_longitude: null,
      to_latitude: null,
      to_longitude: null,
    },
  ],
])(
  'edit pair diff %# preserves omit/replace/clear semantics',
  async (fields, expected) => {
    const context = await loadListingEdit('123');
    expect(
      changedListingFields(context, { ...context.initial, ...fields }),
    ).toEqual(pinWire(expected, fields));
  },
);
test('confirmed JSON PUT clear and subsequent owner read/hydration remain cleared', async () => {
  const context = await loadListingEdit('123');
  const saved = await updateListing(context, {
    ...context.initial,
    fromPin: pin(''),
  });
  expect(saved?.from_latitude).toBeNull();
  expect(put).toHaveBeenCalledWith(
    '/customer/listings/123',
    { from_location_pin: null },
    expect.objectContaining({
      headers: { Authorization: 'Bearer pin-test-token' },
    }),
  );
  const reloaded = await loadListingEdit('123');
  expect(reloaded.initial.fromPin?.text).toBe('');
  expect(reloaded.initial.toPin?.text).toBe('-33.8688197, 151.2092955');
});
test('geography change drops stale unchanged coordinates; new explicit replacement is atomic', async () => {
  const context = await loadListingEdit('123');
  const changed = { ...context.initial, from: draft.to };
  expect(changedListingFields(context, changed)).toEqual({
    from_country_id: 2,
    from_city_id: 102,
    from_area: 'Deira',
  });
  expect(
    changedListingFields(context, { ...changed, fromPin: pin('5,6') }),
  ).toMatchObject({ from_location_pin: '5,6' });
  expect(
    changedListingFields(context, { ...context.initial, fromPin: pin('') }),
  ).toEqual({ from_location_pin: null });
});
test('backend geography clearing must be confirmed; stale echo never reports pin save success', async () => {
  const context = await loadListingEdit('123');
  put.mockResolvedValueOnce({
    status: 200,
    data: {
      success: true,
      message: 'Updated',
      data: { ...row, from_country_id: 2, from_city_id: 102 },
    },
  });
  await expect(
    updateListing(context, { ...context.initial, from: draft.to }),
  ).rejects.toMatchObject({ kind: 'unknown' });
  expect(context.state).toBe('unknown');
});
test.each([401, 403, 404, 422, 429])(
  'HTTP%s preserves draft/removal and permits only explicit safe retry',
  async status => {
    const context = await loadListingEdit('123');
    const edited = { ...context.initial, fromPin: pin('') };
    context.draft = edited;
    put.mockRejectedValueOnce(
      new ApiError(
        'Rejected',
        status === 422 ? 'validation' : 'unknown',
        status,
      ),
    );
    await expect(updateListing(context, edited)).rejects.toMatchObject({
      status,
    });
    expect(context.draft?.fromPin).toEqual({ text: '', intent: 'clear' });
    expect(put).toHaveBeenCalledTimes(1);
    if (status === 422) {
      await updateListing(context, edited);
      expect(put.mock.calls[1][1]).toEqual({ from_location_pin: null });
    }
  },
);
test('unknown PUT reconciles authoritative coordinates without retry', async () => {
  const context = await loadListingEdit('123');
  put.mockImplementationOnce(async () => {
    row = { ...row, from_latitude: 1, from_longitude: 2 };
    throw new ApiError('Timeout', 'network');
  });
  expect(
    await updateListing(context, { ...context.initial, fromPin: pin('1,2') }),
  ).toMatchObject({ from_latitude: 1, from_longitude: 2 });
  expect(put).toHaveBeenCalledTimes(1);
});

test('inconclusive timeout preserves explicit removal and prevents automatic/repeated PUT', async () => {
  const context = await loadListingEdit('123');
  const edited = { ...context.initial, fromPin: pin('') };
  context.draft = edited;
  put.mockRejectedValueOnce(new ApiError('Timeout', 'network'));
  get.mockRejectedValueOnce(new ApiError('Offline', 'network'));
  await expect(updateListing(context, edited)).rejects.toMatchObject({
    kind: 'network',
  });
  expect(context.state).toBe('unknown');
  expect(context.draft?.fromPin).toEqual({ text: '', intent: 'clear' });
  await expect(updateListing(context, edited)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(put).toHaveBeenCalledTimes(1);
});

test('create timeout holds the exact pin draft and never automatically resubmits', async () => {
  const edited = { ...draft, fromPin: pin(' 0, 0 ') };
  post.mockRejectedValueOnce(new ApiError('Timeout', 'network'));
  await expect(createListing(edited)).rejects.toMatchObject({
    kind: 'network',
  });
  expect(listingSubmission()?.draft.fromPin?.text).toBe(' 0, 0 ');
  expect(listingSubmission()?.state).toBe('unknown');
  await expect(createListing(edited)).rejects.toMatchObject({
    kind: 'validation',
  });
  expect(post).toHaveBeenCalledTimes(1);
});
test('logout during owner response ignores coordinates and prevents restored edit context', async () => {
  let resolve!: (value: unknown) => void;
  get.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const request = getOwnListingDetails('123');
  await Promise.resolve();
  await Promise.resolve();
  useAuthStore.getState().clear();
  resolve({
    status: 200,
    data: { success: true, message: 'Owned', data: row },
  });
  await expect(request).rejects.toMatchObject({ kind: 'cancelled' });
});
test('guest and nonowner cannot obtain owner coordinates', async () => {
  get.mockRejectedValueOnce(new ApiError('Missing', 'not-found', 404));
  await expect(getOwnListingDetails('123')).rejects.toMatchObject({
    status: 404,
  });
  useAuthStore.getState().clear();
  get.mockClear();
  await expect(getOwnListingDetails('123')).rejects.toMatchObject({
    status: 401,
  });
  expect(get).not.toHaveBeenCalled();
});
test('account switch during coordinate PUT prevents stale success and clears private edit context', async () => {
  const context = await loadListingEdit('123');
  let resolve!: (value: unknown) => void;
  put.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const request = updateListing(context, {
    ...context.initial,
    fromPin: pin('1,2'),
  });
  await Promise.resolve();
  await Promise.resolve();
  useAuthStore
    .getState()
    .setUser({ id: 9, name: 'Other', email: 'other@example.test' });
  resolve({
    status: 200,
    data: {
      success: true,
      message: 'Updated',
      data: { ...row, from_latitude: 1, from_longitude: 2 },
    },
  });
  await expect(request).rejects.toMatchObject({ kind: 'cancelled' });
  expect(editContext('123')).toBeUndefined();
});
test('coordinate validation errors group by matching manual input without losing unrelated errors', () => {
  expect(
    listingPinErrors({
      from_latitude: ['Invalid pair'],
      from_longitude: ['Invalid pair'],
      to_longitude: ['Invalid range'],
      title: ['Required'],
    }),
  ).toEqual({
    fromPin: ['Invalid pair'],
    toPin: ['Invalid range'],
    title: ['Required'],
  });
});
test('public parser has no private coordinate fields, even if server unexpectedly adds them', () => {
  const publicRow = {
    id: 123,
    ad_type: 'Send',
    title: 'Public',
    short_description: null,
    image_url: null,
    category: { id: 1, name: 'Parcel' },
    origin: { country_id: 1, country: 'A', city_id: 101, city: 'A' },
    destination: { country_id: 2, country: 'B', city_id: 102, city: 'B' },
    weight: null,
    weight_price: null,
    currency: null,
    departure_on: null,
    reached_on: null,
    is_featured: false,
    created_at: null,
    owner: { id: 8, display_name: 'Owner', image_url: null },
    ...pins,
  };
  const parsed = publicListingSchema.parse(publicRow);
  expect(parsed).not.toHaveProperty('from_latitude');
  expect(parsed).not.toHaveProperty('to_longitude');
});

test('account-scoped owner collection retains authorized numeric pins and pagination', async () => {
  get.mockResolvedValueOnce({
    status: 200,
    data: {
      success: true,
      message: 'Owned listings',
      data: {
        items: [row],
        pagination: { current_page: 1, per_page: 20, total: 1, last_page: 1 },
      },
    },
  });
  const page = await getOwnListingsPage();
  expect(page.items[0]).toMatchObject(pins);
  expect(page.ownerId).toBe(8);
  expect(get).toHaveBeenLastCalledWith(
    '/customer/listings',
    expect.objectContaining({
      headers: { Authorization: 'Bearer pin-test-token' },
      params: { page: 1, per_page: 20 },
    }),
  );
});

const links = [
  'https://www.google.com/maps/search/?api=1&query=24.8607343%2C67.0011364',
  'https://maps.app.goo.gl/ExampleCode',
  'https://goo.gl/maps/ExampleCode',
  'https://maps.google.com/?q=24.8607343,67.0011364',
  'https://www.google.com/maps/place/Example/data=!3d24.8607343!4d67.0011364',
];
test.each(links)(
  'create passes link unchanged for Laravel resolution: %s',
  async link => {
    post.mockResolvedValueOnce({
      status: 201,
      data: {
        success: true,
        message: 'Created',
        data: {
          ...row,
          from_latitude: 24.8607343,
          from_longitude: 67.0011364,
          to_latitude: 0,
          to_longitude: 0,
        },
      },
    });
    const saved = await createListing({
      ...draft,
      fromPin: pin(link),
      toPin: pin('0,0'),
    });
    // Authoritative response must also match the submitted raw destination.
    expect(saved.from_latitude).toBe(24.8607343);
    expect(post.mock.calls[0][1]).toMatchObject({
      from_location_pin: link,
      to_location_pin: '0,0',
    });
    expect(post.mock.calls[0][1]).not.toHaveProperty('from_latitude');
    expect(post.mock.calls[0][1]).not.toHaveProperty('to_longitude');
  },
);
test('edit link replacement and clear use only pin fields', async () => {
  const context = await loadListingEdit('123');
  expect(
    changedListingFields(context, {
      ...context.initial,
      fromPin: pin(links[1]),
      toPin: pin(''),
    }),
  ).toEqual({ from_location_pin: links[1], to_location_pin: null });
});
test('link resolution validation errors map to existing form pins and preserve input', async () => {
  const link = links[1],
    edited = { ...draft, fromPin: pin(link) };
  post.mockRejectedValueOnce(
    new ApiError('Validation', 'validation', 422, {
      from_location_pin: ['This link does not identify an exact pin.'],
    }),
  );
  await expect(createListing(edited)).rejects.toMatchObject({ status: 422 });
  expect(edited.fromPin.text).toBe(link);
  expect(
    listingPinErrors({
      from_location_pin: ['Invalid link'],
      to_location_pin: ['Unresolved link'],
    }),
  ).toEqual({ fromPin: ['Invalid link'], toPin: ['Unresolved link'] });
});
test('unknown link update cannot reconcile by old coordinates or retry automatically', async () => {
  const context = await loadListingEdit('123');
  put.mockRejectedValueOnce(new ApiError('Timeout', 'network'));
  await expect(
    updateListing(context, { ...context.initial, fromPin: pin(links[1]) }),
  ).rejects.toMatchObject({ kind: 'network' });
  expect(editContext('123')?.state).toBe('unknown');
  await expect(
    updateListing(context, { ...context.initial, fromPin: pin(links[1]) }),
  ).rejects.toMatchObject({ kind: 'validation' });
  expect(put).toHaveBeenCalledTimes(1);
});
