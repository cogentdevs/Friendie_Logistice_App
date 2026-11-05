import {
  useFilterDraftStore,
  draftReady,
} from '../src/features/search/store/filterDraftStore';
import { useLocationStore } from '../src/features/location/store/locationStore';
import { useSearchStore } from '../src/features/search/store/searchStore';
import {
  locationService,
  LocationError,
} from '../src/features/location/services/locationService';
import { maxGpsAgeMs } from '../src/features/location/services/filterLocationService';
import { placesService } from '../src/features/location/services/placesService';
import { buildListingSearchParams } from '../src/features/listings/services/listingsService';
import { appConfig } from '../src/constants/appConfig';
import { routeFixture } from '../test/fixtures/search';
const fix = { latitude: 24.812345, longitude: 67.054321, accuracyMeters: 8 };
const original = {
  verified: appConfig.placesApiVerified,
  url: appConfig.placesProxyUrl,
};
beforeEach(() => {
  useLocationStore.getState().useWorldwide();
  useSearchStore.getState().reset();
  useFilterDraftStore.getState().reset();
  useFilterDraftStore.setState({ appliedKey: undefined });
  useFilterDraftStore.getState().syncApplied();
});
afterEach(() => {
  jest.restoreAllMocks();
  appConfig.placesApiVerified = original.verified;
  appConfig.placesProxyUrl = original.url;
});
test('mount synchronization never requests permission or fabricates a GPS center', () => {
  const gps = jest.spyOn(locationService, 'currentPosition');
  useFilterDraftStore.getState().syncApplied();
  expect(gps).not.toHaveBeenCalled();
  expect(useFilterDraftStore.getState().mode).toBe('worldwide');
  expect(useLocationStore.getState().selection).toEqual({ mode: 'worldwide' });
});
test('GPS radius uses the exact device point and never substitutes an area center', async () => {
  useSearchStore
    .getState()
    .setFilters({ from: routeFixture.from, to: routeFixture.to });
  jest.spyOn(locationService, 'currentPosition').mockResolvedValue(fix);
  await useFilterDraftStore.getState().selectGps();
  useFilterDraftStore.getState().setRadius(37);
  expect(useFilterDraftStore.getState().apply()).toBe(true);
  const selection = useLocationStore.getState().selection;
  expect(selection).toMatchObject({
    mode: 'radius',
    filter: { ...fix, source: 'gps', radiusKm: 37 },
  });
  if (selection.mode !== 'radius') throw Error('radius expected');
  expect(selection.filter.latitude).not.toBe(
    routeFixture.from.coordinates!.latitude,
  );
  const params = buildListingSearchParams(
    1,
    { radiusTarget: 'destination' },
    selection,
  );
  expect(params).toMatchObject({
    latitude: fix.latitude,
    longitude: fix.longitude,
    radius_target: 'destination',
    distance_metric: 'straight_line',
  });
  expect(params).not.toHaveProperty('areaId');
  expect(params).not.toHaveProperty('cityId');
});
test('a late GPS response cannot overwrite an explicit manual point', async () => {
  let resolve!: (value: typeof fix) => void;
  const pending = new Promise<typeof fix>(done => {
    resolve = done;
  });
  jest.spyOn(locationService, 'currentPosition').mockReturnValue(pending);
  const request = useFilterDraftStore.getState().selectGps();
  useFilterDraftStore.getState().selectManual();
  const pin = { latitude: 25.1, longitude: 55.2 };
  useFilterDraftStore.getState().setExactPin(pin);
  resolve(fix);
  await request;
  expect(useFilterDraftStore.getState().mode).toBe('manual');
  expect(useFilterDraftStore.getState().manual?.coordinates).toEqual(pin);
  useFilterDraftStore.getState().apply();
  expect(useLocationStore.getState().selection).toMatchObject({
    mode: 'radius',
    filter: { ...pin, source: 'manual' },
  });
});
test('reset ignores pending GPS and clears restrictions as explicit worldwide', async () => {
  let resolve!: (value: typeof fix) => void;
  const pending = new Promise<typeof fix>(done => {
    resolve = done;
  });
  jest.spyOn(locationService, 'currentPosition').mockReturnValue(pending);
  const request = useFilterDraftStore.getState().selectGps();
  useFilterDraftStore.getState().reset();
  resolve(fix);
  await request;
  expect(useFilterDraftStore.getState().gps).toBeUndefined();
  useFilterDraftStore.getState().apply();
  const selection = useLocationStore.getState().selection;
  expect(selection).toEqual({ mode: 'worldwide' });
  const params = buildListingSearchParams(1, {}, selection);
  expect(params.worldwide).toBe(true);
  expect(params).not.toHaveProperty('latitude');
  expect(params).not.toHaveProperty('radiusKm');
});
test.each(['denied', 'blocked', 'disabled', 'timeout', 'unavailable'] as const)(
  'GPS %s keeps Apply disabled with a clear fallback',
  async reason => {
    jest
      .spyOn(locationService, 'currentPosition')
      .mockRejectedValue(new LocationError(reason));
    await useFilterDraftStore.getState().selectGps();
    expect(draftReady(useFilterDraftStore.getState())).toBe(false);
    expect(useFilterDraftStore.getState().problem?.reason).toBe(reason);
    expect(useLocationStore.getState().selection).toEqual({
      mode: 'worldwide',
    });
  },
);
test('inaccurate and stale GPS fixes cannot be applied', async () => {
  jest
    .spyOn(locationService, 'currentPosition')
    .mockResolvedValue({ ...fix, accuracyMeters: 3000 });
  await useFilterDraftStore.getState().selectGps();
  expect(useFilterDraftStore.getState().problem?.reason).toBe('inaccurate');
  useFilterDraftStore.setState({
    gps: { ...fix, capturedAt: Date.now() - maxGpsAgeMs - 1 },
    mode: 'gps',
    pending: false,
  });
  expect(useFilterDraftStore.getState().apply()).toBe(false);
  expect(useLocationStore.getState().selection).toEqual({ mode: 'worldwide' });
});
test('a newer radius setting survives a pending GPS read', async () => {
  let resolve!: (value: typeof fix) => void;
  const pending = new Promise<typeof fix>(done => {
    resolve = done;
  });
  jest.spyOn(locationService, 'currentPosition').mockReturnValue(pending);
  const request = useFilterDraftStore.getState().selectGps();
  useFilterDraftStore.getState().setRadius(88);
  resolve(fix);
  await request;
  useFilterDraftStore.getState().apply();
  expect(useLocationStore.getState().selection).toMatchObject({
    mode: 'radius',
    filter: { radiusKm: 88 },
  });
});
test('manual resolution uses verified provider points and exact pins override them', async () => {
  appConfig.placesApiVerified = true;
  appConfig.placesProxyUrl = 'https://example.test/places';
  const point = { latitude: 24.8, longitude: 67.1 };
  jest.spyOn(placesService, 'resolve').mockResolvedValue(point);
  await useFilterDraftStore
    .getState()
    .resolveManual({ ...routeFixture.from, coordinates: undefined });
  expect(useFilterDraftStore.getState().manual?.kind).toBe('reference');
  const pin = { latitude: 24.81, longitude: 67.11 };
  useFilterDraftStore.getState().setExactPin(pin);
  expect(useFilterDraftStore.getState().apply()).toBe(true);
  expect(useLocationStore.getState().selection).toMatchObject({
    mode: 'radius',
    filter: { ...pin, centerKind: 'pin', source: 'manual' },
  });
  const params = buildListingSearchParams(
    1,
    {},
    useLocationStore.getState().selection,
  );
  expect(params).not.toHaveProperty('areaId');
});
test('an explicit point does not call a geocoder, and unresolved names cannot enable Apply', async () => {
  const resolve = jest.spyOn(placesService, 'resolve');
  await useFilterDraftStore.getState().resolveManual(routeFixture.from);
  expect(resolve).not.toHaveBeenCalled();
  appConfig.placesApiVerified = false;
  await useFilterDraftStore
    .getState()
    .resolveManual({ ...routeFixture.from, coordinates: undefined });
  expect(draftReady(useFilterDraftStore.getState())).toBe(false);
  expect(resolve).not.toHaveBeenCalled();
});
test('draft filters survive navigation synchronization and advanced flags survive new route search', () => {
  useFilterDraftStore.getState().selectManual();
  useFilterDraftStore
    .getState()
    .setExactPin({ latitude: 24.8, longitude: 67.1 });
  useFilterDraftStore.getState().setRadius(44);
  useFilterDraftStore
    .getState()
    .setFlags({
      verifiedOnly: true,
      availableNow: true,
      target: 'destination',
    });
  useFilterDraftStore.getState().syncApplied();
  expect(useFilterDraftStore.getState()).toMatchObject({
    mode: 'manual',
    radiusKm: 44,
    verifiedOnly: true,
    target: 'destination',
  });
  useFilterDraftStore.getState().apply();
  useSearchStore.getState().resetRoute();
  expect(useSearchStore.getState().filters).toEqual({
    verifiedOnly: true,
    availableNow: true,
    radiusTarget: 'destination',
  });
});
test('radius values clamp to 1 through 200 km', () => {
  useFilterDraftStore.getState().setRadius(-10);
  expect(useFilterDraftStore.getState().radiusKm).toBe(1);
  useFilterDraftStore.getState().setRadius(500);
  expect(useFilterDraftStore.getState().radiusKm).toBe(200);
});
