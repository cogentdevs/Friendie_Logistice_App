import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TextInput } from 'react-native';
import { FiltersScreen } from '../src/features/search/screens/FiltersScreen';
import { useFilterDraftStore } from '../src/features/search/store/filterDraftStore';
import { useLocationStore } from '../src/features/location/store/locationStore';
import { useSearchStore } from '../src/features/search/store/searchStore';
import {
  locationService,
  LocationError,
} from '../src/features/location/services/locationService';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
let tree: ReactTestRenderer, client: QueryClient;
const navigation = {
  setOptions: jest.fn(),
  getState: () => ({
    index: 1,
    routes: [{ name: 'Search' }, { name: 'Filters' }],
  }),
  goBack: jest.fn(),
  replace: jest.fn(),
};
beforeEach(async () => {
  useLocationStore.getState().useWorldwide();
  useSearchStore.getState().reset();
  useFilterDraftStore.getState().reset();
  useFilterDraftStore.setState({ appliedKey: undefined });
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <FiltersScreen
          route={{ key: 'filters', name: 'Filters' }}
          navigation={
            navigation as unknown as React.ComponentProps<
              typeof FiltersScreen
            >['navigation']
          }
        />
      </QueryClientProvider>,
    );
  });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree.unmount();
    client.clear();
  });
  jest.restoreAllMocks();
  navigation.setOptions.mockClear();
  navigation.goBack.mockClear();
  navigation.replace.mockClear();
});
const button = (label: string) =>
  tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
async function press(label: string) {
  await Renderer.act(async () => {
    await button(label).props.onPress();
  });
}
test('GPS is requested only by explicit mode selection; blocked access offers Settings', async () => {
  const gps = jest
    .spyOn(locationService, 'currentPosition')
    .mockRejectedValue(new LocationError('blocked'));
  expect(gps).not.toHaveBeenCalled();
  await press('My Current Location');
  expect(gps).toHaveBeenCalledTimes(1);
  expect(button('Apply Filters').props.disabled).toBe(true);
  expect(button('Open location settings')).toBeDefined();
});
test('manual exact point and checkboxes apply through the existing stores without GPS', async () => {
  const gps = jest.spyOn(locationService, 'currentPosition');
  await press('Select Location Manually');
  expect(button('Apply Filters').props.disabled).toBe(true);
  await press('Choose filter Country');
  await press('Set exact map coordinates');
  await Renderer.act(async () => {
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Pin latitude')!
      .props.onChangeText('24.8');
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Pin longitude')!
      .props.onChangeText('67.1');
  });
  await press('Use exact point');
  await press('Verified Users Only');
  await press('Show Available Now');
  await press('Match destination');
  const slider = tree.root.findAll(
    node => node.props.accessibilityRole === 'adjustable',
  )[0];
  await Renderer.act(async () => {
    slider.props.onAccessibilityAction({
      nativeEvent: { actionName: 'increment' },
    });
  });
  expect(useFilterDraftStore.getState().radiusKm).toBe(26);
  await press('Apply Filters');
  expect(gps).not.toHaveBeenCalled();
  expect(navigation.goBack).toHaveBeenCalled();
  expect(useLocationStore.getState().selection).toMatchObject({
    mode: 'radius',
    filter: { latitude: 24.8, longitude: 67.1, radiusKm: 26, source: 'manual' },
  });
  expect(useSearchStore.getState().filters).toMatchObject({
    verifiedOnly: true,
    availableNow: true,
    radiusTarget: 'destination',
  });
});
test('header Reset restores explicit worldwide state and unchecked flags', async () => {
  await press('Select Location Manually');
  await press('Verified Users Only');
  const header =
    navigation.setOptions.mock.calls[
      navigation.setOptions.mock.calls.length - 1
    ][0].headerRight();
  await Renderer.act(async () => {
    header.props.onPress();
  });
  await press('Apply Filters');
  expect(useLocationStore.getState().selection).toEqual({ mode: 'worldwide' });
  expect(useSearchStore.getState().filters.verifiedOnly).toBe(false);
});
test('GPS selection disables manual dropdowns and never displays precise coordinates', async () => {
  jest
    .spyOn(locationService, 'currentPosition')
    .mockResolvedValue({
      latitude: 24.812345,
      longitude: 67.054321,
      accuracyMeters: 6,
    });
  await press('My Current Location');
  expect(button('Choose filter Country').props.disabled).toBe(true);
  expect(button('Apply Filters').props.disabled).toBe(false);
  expect(
    tree.root.findAll(
      node =>
        typeof node.props.children === 'string' &&
        node.props.children.includes('24.812345'),
    ),
  ).toHaveLength(0);
});
