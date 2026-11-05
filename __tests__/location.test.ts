import { useLocationStore } from '../src/features/location/store/locationStore';
import { distanceKm } from '../src/utils/distance';
beforeEach(() => useLocationStore.getState().useWorldwide());
test('manual map pin becomes the radius origin and preserves chosen radius', () => {
  const state = useLocationStore.getState();
  state.setLocation({
    source: 'manual',
    latitude: 24.8,
    longitude: 67.1,
    radiusKm: 12,
    cityId: 1,
  });
  state.selectPin({ latitude: 24.9, longitude: 67.2 });
  expect(useLocationStore.getState().selection).toEqual({
    mode: 'radius',
    filter: {
      source: 'manual',
      latitude: 24.9,
      longitude: 67.2,
      radiusKm: 12,
      accuracyMeters: undefined,
    },
  });
});
test('worldwide has no fabricated coordinates', () => {
  expect(useLocationStore.getState().selection).toEqual({ mode: 'worldwide' });
});
test('invalid coordinates and nonpositive radius are rejected', () => {
  expect(() =>
    useLocationStore.getState().setLocation({
      source: 'gps',
      latitude: 91,
      longitude: 67,
      radiusKm: 10,
    }),
  ).toThrow();
  expect(() =>
    useLocationStore.getState().setLocation({
      source: 'manual',
      latitude: 24,
      longitude: 67,
      radiusKm: 0,
    }),
  ).toThrow();
});
test('distance estimate is symmetric and zero at the same point', () => {
  const a = { latitude: 24.8, longitude: 67.1 },
    b = { latitude: 24.9, longitude: 67.2 };
  expect(distanceKm(a, a)).toBe(0);
  expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a));
  expect(distanceKm(a, b)).toBeGreaterThan(10);
});
