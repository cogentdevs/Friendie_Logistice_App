import { apiClient } from '../src/services/api/apiClient';
import {
  matchListingAddress,
  listingGpsService,
} from '../src/features/post-listing/services/listingGpsService';
import { detectCurrentLocation } from '../src/features/location/services/currentLocationService';
import {
  locationService,
  LocationError,
} from '../src/features/location/services/locationService';
import { NativeModules, Linking, Platform } from 'react-native';
import {
  check,
  requestMultiple,
  RESULTS,
  PERMISSIONS,
} from 'react-native-permissions';
import Geolocation from 'react-native-geolocation-service';

let countries: unknown[], cities: unknown[], get: jest.SpyInstance;
test('Task 35 street address is optional and never inferred from city-only results', async () => {
  expect(await matchListingAddress({countryCode: 'AE', city: 'Dubai'})).not.toHaveProperty('address');
  expect(await matchListingAddress({countryCode: 'AE', city: 'Dubai', streetAddress: '12 Example Street, Dubai'})).toHaveProperty('address', '12 Example Street, Dubai');
  expect(await matchListingAddress({countryCode: 'AE', city: 'Unknown', streetAddress: '12 Example Street'})).not.toHaveProperty('address');
});
const response = (items: unknown[]) => ({
  status: 200,
  data: { success: true, message: 'OK', data: { items } },
});
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  countries = [
    { id: 8, name: 'United Arab Emirates', short_name: 'AE', image_url: null },
  ];
  cities = [{ id: 71, name: 'Dubai', short_name: 'DXB', country_id: 8 }];
  get = jest
    .spyOn(apiClient, 'get')
    .mockImplementation(async url =>
      response(url === '/countries' ? countries : cities),
    );
});
afterEach(() => jest.restoreAllMocks());
test.each([
  { countryCode: 'AE', countryName: 'UAE', city: 'Dubai' },
  { countryName: ' united arab emirates ', city: ' DUBAI ' },
  { countryName: 'AE', city: 'DXB' },
])('unique exact server names/codes resolve real IDs (%#)', async address => {
  expect(await matchListingAddress({ ...address, area: 'Marina' })).toEqual({
    country: { id: 8, name: 'United Arab Emirates' },
    city: { id: 71, name: 'Dubai', countryId: 8 },
    area: 'Marina',
  });
  expect(get).toHaveBeenCalledWith(
    '/cities',
    expect.objectContaining({
      params: { country_id: 8 },
      headers: { Authorization: false },
    }),
  );
});
test('unmatched city returns country only without inventing city or area', async () => {
  expect(
    await matchListingAddress({
      countryCode: 'AE',
      city: 'Unknown',
      area: 'Area',
    }),
  ).toEqual({ country: { id: 8, name: 'United Arab Emirates' } });
});
test('unknown country does not select first result or fetch unrelated cities', async () => {
  expect(
    await matchListingAddress({ countryName: 'Unknown', city: 'Dubai' }),
  ).toBeUndefined();
  expect(get).toHaveBeenCalledTimes(1);
});
test('ambiguous country does not guess', async () => {
  countries.push({
    id: 9,
    name: 'United Arab Emirates',
    short_name: 'AE',
    image_url: null,
  });
  expect(
    await matchListingAddress({ countryCode: 'AE', city: 'Dubai' }),
  ).toBeUndefined();
});
test('ambiguous city leaves country selected only', async () => {
  cities.push({ id: 72, name: 'Dubai', short_name: null, country_id: 8 });
  expect(
    (await matchListingAddress({ countryCode: 'AE', city: 'Dubai' }))?.city,
  ).toBeUndefined();
});
test('server city in another country is rejected', async () => {
  cities = [{ id: 71, name: 'Dubai', short_name: null, country_id: 9 }];
  await expect(
    matchListingAddress({ countryCode: 'AE', city: 'Dubai' }),
  ).rejects.toThrow();
});
test('aborted match cannot produce selected IDs', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    matchListingAddress({ countryCode: 'AE' }, controller.signal),
  ).rejects.toThrow();
});
test('automatic provider options never request permission or open a system dialog', async () => {
  jest.mocked(check).mockResolvedValue(RESULTS.GRANTED);
  jest
    .mocked(Geolocation.getCurrentPosition)
    .mockImplementationOnce(success =>
      success({ coords: { latitude: 1, longitude: 2, accuracy: 10 } } as never),
    );
  const permission = jest.spyOn(locationService, 'requestForegroundPermission');
  await detectCurrentLocation({
    requestPermission: false,
    showLocationDialog: false,
  });
  expect(permission).not.toHaveBeenCalled();
  expect(Geolocation.getCurrentPosition).toHaveBeenLastCalledWith(
    expect.any(Function),
    expect.any(Function),
    expect.objectContaining({
      showLocationDialog: false,
      maximumAge: 0,
      timeout: 15000,
    }),
  );
});
test('ungranted automatic permission does not request access or GPS', async () => {
  jest.mocked(check).mockResolvedValue(RESULTS.DENIED);
  const request = jest.spyOn(locationService, 'requestForegroundPermission');
  const gps = jest.spyOn(Geolocation, 'getCurrentPosition');
  gps.mockClear();
  await expect(
    locationService.currentPosition({ requestPermission: false }),
  ).rejects.toBeInstanceOf(LocationError);
  expect(request).not.toHaveBeenCalled();
  expect(gps).not.toHaveBeenCalled();
});
test('permanently blocked permission is surfaced for App Settings', async () => {
  jest.mocked(check).mockResolvedValue(RESULTS.DENIED);
  jest.mocked(requestMultiple).mockResolvedValue({
    [PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION]: RESULTS.BLOCKED,
    [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]: RESULTS.BLOCKED,
  } as Awaited<ReturnType<typeof requestMultiple>>);
  await expect(
    locationService.requestForegroundPermission(),
  ).rejects.toMatchObject({ reason: 'blocked' });
});
test('native enabled status and explicit system settings path are reused', async () => {
  const previous = NativeModules.FriendieGeocoder;
  NativeModules.FriendieGeocoder = {
    isLocationEnabled: jest.fn(async () => false),
  };
  const intent = jest.spyOn(Linking, 'sendIntent').mockResolvedValue(undefined);
  try {
    expect(await listingGpsService.enabled()).toBe(false);
    await listingGpsService.openLocationSettings();
    expect(intent).toHaveBeenCalledWith(
      'android.settings.LOCATION_SOURCE_SETTINGS',
    );
  } finally {
    NativeModules.FriendieGeocoder = previous;
  }
});

test('Create-only concurrent/remount detections share a single device fix and discard aborted selection', async () => {
  let complete!: (value: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
  }) => void;
  const position = jest
    .spyOn(locationService, 'currentPosition')
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          complete = resolve;
        }),
    );
  const {
    placesService,
  } = require('../src/features/location/services/placesService');
  jest
    .spyOn(placesService, 'reverseGeocode')
    .mockResolvedValue({ countryCode: 'AE', city: 'Dubai', area: 'Marina' });
  const abandoned = new AbortController(),
    active = new AbortController();
  const old = listingGpsService.detect(abandoned.signal),
    next = listingGpsService.detect(active.signal);
  abandoned.abort();
  complete({ latitude: 1, longitude: 2, accuracyMeters: 150 });
  expect(await old).toBeUndefined();
  expect(await next).toEqual({
    country: { id: 8, name: 'United Arab Emirates' },
    city: { id: 71, name: 'Dubai', countryId: 8 },
  });
  expect(position).toHaveBeenCalledTimes(1);
});

test('incompatible oversized geocoder area is omitted without truncating it or losing valid city IDs', async () => {
  expect(
    await matchListingAddress({
      countryCode: 'AE',
      city: 'Dubai',
      area: 'x'.repeat(256),
    }),
  ).toEqual({
    country: { id: 8, name: 'United Arab Emirates' },
    city: { id: 71, name: 'Dubai', countryId: 8 },
  });
});
