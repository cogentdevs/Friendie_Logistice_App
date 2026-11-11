import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { NativeModules, Platform, TextInput } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import * as permissions from 'react-native-permissions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouteLocationPicker } from '../src/features/location/components/RouteLocationPicker';
import { HomeSearchCard } from '../src/features/home/components/HomeSearchCard';
import {
  locationService,
  LocationError,
} from '../src/features/location/services/locationService';
import { placesService } from '../src/features/location/services/placesService';
import { detectCurrentLocation } from '../src/features/location/services/currentLocationService';
import { useFilterDraftStore } from '../src/features/search/store/filterDraftStore';
import { useLocationStore } from '../src/features/location/store/locationStore';
import { useSearchStore } from '../src/features/search/store/searchStore';
import { useAuthStore } from '../src/store/authStore';
import { useDevelopmentStore } from '../src/store/developmentStore';
import { apiClient } from '../src/services/api/apiClient';
import { routeFixture } from '../test/fixtures/search';

const fix = { latitude: 24.812345, longitude: 67.054321, accuracyMeters: 8 };
const address = {
  countryName: 'Pakistan',
  countryCode: 'PK',
  city: 'Karachi',
  area: 'DHA',
};
let tree: ReactTestRenderer | undefined;
let client: QueryClient;
const originalBridge = NativeModules.FriendieGeocoder;
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  useSearchStore.getState().reset();
  useLocationStore.getState().useWorldwide();
  useFilterDraftStore.getState().reset();
  useAuthStore.getState().clear();
  useDevelopmentStore.setState({ previewActive: false });
  NativeModules.FriendieGeocoder = { reverse: jest.fn(async () => address) };
  jest.spyOn(locationService, 'currentPosition').mockResolvedValue(fix);
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client.clear();
  });
  tree = undefined;
  NativeModules.FriendieGeocoder = originalBridge;
  useDevelopmentStore.setState({ previewActive: false });
  jest.restoreAllMocks();
});
async function mount(element: React.ReactElement) {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>{element}</QueryClientProvider>,
    );
  });
}
async function press(label: string) {
  await Renderer.act(async () => {
    await tree!.root
      .findAll(
        n =>
          n.props.accessibilityLabel === label &&
          typeof n.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
}
const input = (label: string) =>
  tree!.root
    .findAllByType(TextInput)
    .find(n => n.props.accessibilityLabel === label)!;
async function edit(label: string, value: string) {
  await Renderer.act(async () => {
    input(label).props.onChangeText(value);
  });
}

test.each([false, true])(
  'native address autofills for preview=%s without authentication or backend requests',
  async previewActive => {
    useDevelopmentStore.setState({ previewActive });
    const get = jest.spyOn(apiClient, 'get');
    const onSelect = jest.fn();
    await mount(
      <RouteLocationPicker
        title="From"
        onClose={jest.fn()}
        onSelect={onSelect}
      />,
    );
    await press('Use Current Location');
    expect(input('Country').props.value).toBe('Pakistan');
    expect(input('Country code (two letters)').props.value).toBe('PK');
    expect(input('City').props.value).toBe('Karachi');
    expect(input('Area (optional)').props.value).toBe('DHA');
    expect(
      tree!.root
        .findAllByType(TextInput)
        .some(n => /latitude|longitude/i.test(n.props.accessibilityLabel)),
    ).toBe(false);
    await press('Select location');
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        country: { name: 'Pakistan', code: 'PK' },
        city: { name: 'Karachi' },
        area: { name: 'DHA' },
        source: 'gps',
        coordinates: { latitude: fix.latitude, longitude: fix.longitude },
      }),
    );
    expect(NativeModules.FriendieGeocoder.reverse).toHaveBeenCalledWith(
      fix.latitude,
      fix.longitude,
    );
    expect(useAuthStore.getState().status).toBe('guest');
    expect(get).not.toHaveBeenCalled();
  },
);

test('geocoder failure retains the point while missing labels are entered manually', async () => {
  NativeModules.FriendieGeocoder.reverse.mockRejectedValue(
    Error('unavailable'),
  );
  const onSelect = jest.fn();
  await mount(
    <RouteLocationPicker
      title="From"
      requireCoordinates
      onClose={jest.fn()}
      onSelect={onSelect}
    />,
  );
  await press('Use Current Location');
  expect(input('City').props.value).toBe('');
  await edit('Country', 'Pakistan');
  await edit('Country code (two letters)', 'PK');
  await edit('City', 'Karachi');
  await press('Select location');
  expect(onSelect.mock.calls[0][0].coordinates).toEqual({
    latitude: fix.latitude,
    longitude: fix.longitude,
  });
});

test('partial address never invents a city or area', async () => {
  NativeModules.FriendieGeocoder.reverse.mockResolvedValue({
    countryName: 'Pakistan',
    countryCode: 'PK',
  });
  const result = await detectCurrentLocation();
  expect(result.address.city).toBeUndefined();
  expect(result.address.area).toBeUndefined();
  expect(result.addressMessage).toBeDefined();
  expect(result.latitude).toBe(fix.latitude);
});

test('editing a resolved city changes to manual and drops the stale device point', async () => {
  const onSelect = jest.fn();
  await mount(
    <RouteLocationPicker
      title="From"
      onClose={jest.fn()}
      onSelect={onSelect}
    />,
  );
  await press('Use Current Location');
  await edit('City', 'Lahore');
  await press('Select location');
  expect(onSelect.mock.calls[0][0]).toMatchObject({
    source: 'manual',
    city: { name: 'Lahore' },
  });
  expect(onSelect.mock.calls[0][0].coordinates).toBeUndefined();
  expect(useLocationStore.getState().selection).toEqual({ mode: 'worldwide' });
});

test.each(['denied', 'blocked', 'disabled', 'timeout', 'unavailable'] as const)(
  '%s GPS leaves manual entry usable',
  async reason => {
    jest
      .spyOn(locationService, 'currentPosition')
      .mockRejectedValue(new LocationError(reason));
    const onSelect = jest.fn();
    await mount(
      <RouteLocationPicker
        title="From"
        onClose={jest.fn()}
        onSelect={onSelect}
      />,
    );
    await press('Use Current Location');
    expect(input('Country').props.editable).toBe(true);
    await edit('Country', 'Pakistan');
    await edit('Country code (two letters)', 'PK');
    await edit('City', 'Karachi');
    await press('Select location');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(NativeModules.FriendieGeocoder.reverse).not.toHaveBeenCalled();
  },
);

test('GPS address metadata cannot replace the radius center or route endpoints', async () => {
  useSearchStore
    .getState()
    .setFilters({ from: routeFixture.from, to: routeFixture.to });
  await useFilterDraftStore.getState().selectGps();
  expect(useFilterDraftStore.getState().gps?.address).toEqual(address);
  expect(useFilterDraftStore.getState().apply()).toBe(true);
  expect(useLocationStore.getState().selection).toMatchObject({
    mode: 'radius',
    filter: {
      latitude: fix.latitude,
      longitude: fix.longitude,
      countryName: 'Pakistan',
      cityName: 'Karachi',
      areaName: 'DHA',
      source: 'gps',
    },
  });
  expect(useSearchStore.getState().filters.from).toEqual(routeFixture.from);
  expect(useSearchStore.getState().filters.to).toEqual(routeFixture.to);
});

test('Home From GPS uses the shared picker and preserves Destination', async () => {
  useSearchStore.getState().setFilters({ type: 'send', to: routeFixture.to });
  const onSearch = jest.fn();
  await mount(
    <HomeSearchCard
      categories={{
        data: [],
        isPending: false,
        isError: false,
        refetch: jest.fn(),
      }}
      onSearch={onSearch}
      onFilters={jest.fn()}
    />,
  );
  await press('Select search origin');
  await press('Use Current Location');
  await press('Select location');
  await press('Search Listings');
  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(onSearch.mock.calls[0][0].from.coordinates).toEqual({
    latitude: fix.latitude,
    longitude: fix.longitude,
  });
  expect(onSearch.mock.calls[0][0].to).toEqual(routeFixture.to);
  expect(useLocationStore.getState().selection).toEqual({ mode: 'worldwide' });
});

test('late address lookup after unmount cannot select a location', async () => {
  let resolve!: (value: typeof address) => void;
  NativeModules.FriendieGeocoder.reverse.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  const onSelect = jest.fn();
  await mount(
    <RouteLocationPicker
      title="From"
      onClose={jest.fn()}
      onSelect={onSelect}
    />,
  );
  let request!: Promise<void>;
  await Renderer.act(async () => {
    request = tree!.root
      .findAll(
        n =>
          n.props.accessibilityLabel === 'Use Current Location' &&
          typeof n.props.onPress === 'function',
      )[0]
      .props.onPress();
    await Promise.resolve();
  });
  await Renderer.act(async () => {
    tree!.unmount();
  });
  tree = undefined;
  await Renderer.act(async () => {
    resolve(address);
    await request;
  });
  expect(onSelect).not.toHaveBeenCalled();
});

test('Android foreground permission grant reaches the real GPS adapter before native geocoding', async () => {
  jest.mocked(locationService.currentPosition).mockRestore();
  jest
    .spyOn(permissions, 'check')
    .mockResolvedValue(permissions.RESULTS.DENIED);
  const request = jest.spyOn(permissions, 'requestMultiple').mockResolvedValue({
    [permissions.PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]:
      permissions.RESULTS.GRANTED,
    [permissions.PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION]:
      permissions.RESULTS.GRANTED,
  } as Record<permissions.Permission, permissions.PermissionStatus>);
  jest.mocked(Geolocation.getCurrentPosition).mockImplementationOnce(success =>
    success({
      coords: {
        ...fix,
        accuracy: fix.accuracyMeters,
        altitude: null,
        heading: null,
        speed: null,
        altitudeAccuracy: null,
      },
      timestamp: Date.now(),
    }),
  );
  const result = await detectCurrentLocation();
  expect(request).toHaveBeenCalledTimes(1);
  expect(Geolocation.getCurrentPosition).toHaveBeenCalled();
  expect(result.address).toEqual(address);
  expect(result.latitude).toBe(fix.latitude);
});

test('Android denied permission never calls the native GPS provider or geocoder', async () => {
  jest.mocked(locationService.currentPosition).mockRestore();
  jest
    .spyOn(permissions, 'check')
    .mockResolvedValue(permissions.RESULTS.DENIED);
  jest.spyOn(permissions, 'requestMultiple').mockResolvedValue({
    [permissions.PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]:
      permissions.RESULTS.DENIED,
    [permissions.PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION]:
      permissions.RESULTS.DENIED,
  } as Record<permissions.Permission, permissions.PermissionStatus>);
  jest.mocked(Geolocation.getCurrentPosition).mockClear();
  await expect(detectCurrentLocation()).rejects.toMatchObject({
    reason: 'denied',
  });
  expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  expect(NativeModules.FriendieGeocoder.reverse).not.toHaveBeenCalled();
});

test('switch to manual after an incomplete GPS address retains the point without requiring coordinates', async () => {
  jest
    .spyOn(placesService, 'reverseGeocode')
    .mockResolvedValue({ countryName: 'Pakistan', countryCode: 'PK' });
  await useFilterDraftStore.getState().selectGps();
  useFilterDraftStore.getState().selectManual();
  const manual = useFilterDraftStore.getState().manual!;
  const onSelect = jest.fn();
  await mount(
    <RouteLocationPicker
      title="Manual radius location"
      requireCoordinates
      initialPoint={manual.coordinates}
      initialAddress={manual.address}
      onClose={jest.fn()}
      onSelect={onSelect}
    />,
  );
  expect(input('Country').props.value).toBe('Pakistan');
  await edit('City', 'Karachi');
  await press('Select location');
  expect(onSelect.mock.calls[0][0].coordinates).toEqual({
    latitude: fix.latitude,
    longitude: fix.longitude,
  });
});
