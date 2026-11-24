import {
  parseManualListingPin as parse,
  formatManualListingPin as format,
  editManualListingPin,
  listingGeographyChanged,
} from '../src/features/post-listing/types/manualListingPin';
import { listingDraftSchema } from '../src/features/post-listing/types/listingDraft';
import {
  createListingDraft as draft,
  loadListingReferences,
  referenceResponse,
} from '../test/fixtures/createListing';
import { apiClient } from '../src/services/api/apiClient';
import { createListingPayload } from '../src/features/post-listing/services/createListingService';
import { changedListingFields } from '../src/features/post-listing/services/updateListingService';
import { createdListingRecord } from '../test/fixtures/createListing';
import { useListingDraft } from '../src/features/post-listing/store/listingDraftStore';
import { useEditListingDraft } from '../src/features/post-listing/store/editListingDraftStore';
import { useAuthStore } from '../src/store/authStore';
import { ownListingApiSchema } from '../src/features/listings/types/myListingsApi.types';

test.each(['', ' ', '\n'])('empty optional %j never becomes zero', text => {
  expect(parse(text)).toEqual({ valid: true });
});
test.each([
  ['24.8607343, 67.0011364', 24.8607343, 67.0011364],
  [' 24.8607343,67.0011364 ', 24.8607343, 67.0011364],
  ['-33.8688197, -151.2092955', -33.8688197, -151.2092955],
  ['0, 0', 0, 0],
  ['-90, -180', -90, -180],
  ['90,180', 90, 180],
  ['0.0000001, -0.0000001', 0.0000001, -0.0000001],
])('whole pair %s parses exactly', (text, latitude, longitude) => {
  expect(parse(text)).toEqual({
    valid: true,
    coordinates: { latitude, longitude },
  });
});
test.each([
  '91,0',
  '-90.0000001,0',
  '0,180.0000001',
  '0,-181',
  '0.12345678,0',
  '0,1.00000000',
  ',0',
  '0,',
  '0',
  '1,2,3',
  '1;2',
  '1,,2',
  'NaN,0',
  '0,Infinity',
  '1abc,2',
  'lat:1,2',
  '1e1,2',
  '+1,2',
  'https://maps.google.com/?q=1,2',
  'https://maps.app.goo.gl/example',
  '1 2,3',
])('rejects entire invalid input %s', text => {
  expect(parse(text).valid).toBe(false);
});
test('formatter supports authorized zero and small numbers without defaults/rounding', () => {
  expect(format(undefined)).toBe('');
  expect(format(null)).toBe('');
  expect(format({ latitude: 0, longitude: 0 })).toBe('0, 0');
  expect(format({ latitude: 0.0000001, longitude: -180 })).toBe(
    '0.0000001, -180',
  );
  expect(format({ latitude: 0.00000001, longitude: 0 })).toBe('');
  expect(format({ latitude: 91, longitude: 0 })).toBe('');
  expect(format({ latitude: NaN, longitude: 0 })).toBe('');
});
test('intent preserves untouched vs explicit clear while raw text remains unchanged', () => {
  expect(editManualListingPin(' 0, 0 ')).toEqual({
    text: ' 0, 0 ',
    intent: 'replace',
  });
  expect(editManualListingPin('')).toEqual({ text: '', intent: 'clear' });
  expect(
    listingGeographyChanged(draft.from, JSON.parse(JSON.stringify(draft.from))),
  ).toBe(false);
  expect(listingGeographyChanged(draft.from, draft.to)).toBe(true);
});
test('form validation allows optional pins and rejects invalid nonempty without changing existing required rules', () => {
  expect(listingDraftSchema.safeParse(draft).success).toBe(true);
  expect(
    listingDraftSchema.safeParse({
      ...draft,
      fromPin: editManualListingPin('0,0'),
    }).success,
  ).toBe(true);
  expect(
    listingDraftSchema.safeParse({ ...draft, toPin: editManualListingPin('') })
      .success,
  ).toBe(true);
  const bad = listingDraftSchema.safeParse({
    ...draft,
    fromPin: editManualListingPin('1,'),
  });
  expect(bad.success).toBe(false);
  if (!bad.success)
    expect(bad.error.issues[0].path).toEqual(['fromPin', 'text']);
  expect(
    listingDraftSchema.safeParse({
      ...draft,
      title: '',
      fromPin: editManualListingPin('0,0'),
    }).success,
  ).toBe(false);
});
test('Phase3 adds complete numeric pin pairs without changing other create/update fields', async () => {
  const get = jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) => referenceResponse(url, config));
  await loadListingReferences();
  const withPins = {
    ...draft,
    fromPin: editManualListingPin('0,0'),
    toPin: editManualListingPin('1,2'),
  };
  const coordinates = {from_latitude:0,from_longitude:0,to_latitude:1,to_longitude:2};
  expect(createListingPayload(withPins)).toEqual({...createListingPayload(draft),...coordinates});
  const context = {
    original: ownListingApiSchema.parse(createdListingRecord),
    initial: draft,
    user: {},
    state: 'ready' as const,
  };
  expect(changedListingFields(context, withPins)).toEqual(
    {...changedListingFields(context, draft),...coordinates},
  );
  get.mockRestore();
});
test('create/edit local pins clear on reset/logout/account switch', () => {
  useAuthStore
    .getState()
    .setUser({ id: 70, name: 'A', email: 'a@example.test' });
  const values = { ...draft, fromPin: editManualListingPin('0,0') };
  useListingDraft.getState().update(values);
  useEditListingDraft.getState().update(values);
  useListingDraft.getState().discard();
  expect(useListingDraft.getState().values.fromPin).toBeUndefined();
  useAuthStore
    .getState()
    .setUser({ id: 71, name: 'B', email: 'b@example.test' });
  expect(useEditListingDraft.getState().values.fromPin).toBeUndefined();
  useListingDraft.getState().update(values);
  useAuthStore.getState().clear();
  expect(useListingDraft.getState().values.fromPin).toBeUndefined();
});
