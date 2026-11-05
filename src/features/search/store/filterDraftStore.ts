import { create } from 'zustand';
import { Coordinates, LocationSelection } from '../../location/types/location';
import {
  useLocationStore,
  validateLocation,
} from '../../location/store/locationStore';
import { locationService } from '../../location/services/locationService';
import {
  validatePoint,
  locationProblem,
  maxGpsAgeMs,
  maxGpsAccuracyMeters,
  readFilterGps,
  resolveFilterReference,
} from '../../location/services/filterLocationService';
import { RouteLocation } from '../types/search';
import { useSearchStore } from './searchStore';
type GpsPoint = Coordinates & { accuracyMeters: number; capturedAt: number };
type ManualPoint = {
  reference?: RouteLocation;
  coordinates: Coordinates;
  kind: 'pin' | 'reference';
};
export type RadiusTarget = 'origin' | 'destination';
interface Draft {
  mode: 'worldwide' | 'gps' | 'manual';
  radiusKm: number;
  gps?: GpsPoint;
  manual?: ManualPoint;
  verifiedOnly: boolean;
  availableNow: boolean;
  target: RadiusTarget;
  pending: boolean;
  problem?: { reason: string; message: string };
  revision: number;
  appliedKey?: string;
  syncApplied: () => void;
  selectGps: () => Promise<void>;
  selectManual: () => void;
  resolveManual: (value: RouteLocation) => Promise<void>;
  setExactPin: (point: Coordinates) => void;
  setRadius: (value: number) => void;
  setFlags: (
    flags: Partial<Pick<Draft, 'verifiedOnly' | 'availableNow' | 'target'>>,
  ) => void;
  worldwide: () => void;
  reset: () => void;
  apply: () => boolean;
  openSettings: () => Promise<void>;
}
function appliedKey() {
  const f = useSearchStore.getState().filters;
  return JSON.stringify([
    useLocationStore.getState().selection,
    f.verifiedOnly,
    f.availableNow,
    f.radiusTarget,
  ]);
}
export function gpsFresh(point?: GpsPoint) {
  return Boolean(
    point &&
      point.accuracyMeters > 0 &&
      point.accuracyMeters <= maxGpsAccuracyMeters &&
      Date.now() - point.capturedAt >= 0 &&
      Date.now() - point.capturedAt <= maxGpsAgeMs,
  );
}
export function draftReady(
  state: Pick<Draft, 'mode' | 'pending' | 'gps' | 'manual'>,
) {
  return (
    !state.pending &&
    (state.mode === 'worldwide' ||
      (state.mode === 'gps' ? gpsFresh(state.gps) : Boolean(state.manual)))
  );
}
export const useFilterDraftStore = create<Draft>((set, get) => ({
  mode: 'worldwide',
  radiusKm: 25,
  verifiedOnly: false,
  availableNow: false,
  target: 'origin',
  pending: false,
  revision: 0,
  syncApplied: () => {
    const key = appliedKey();
    if (get().appliedKey === key) return;
    const selection = useLocationStore.getState().selection,
      filters = useSearchStore.getState().filters;
    let mode: Draft['mode'] = 'worldwide',
      gps: GpsPoint | undefined,
      manual: ManualPoint | undefined,
      radiusKm = 25;
    if (selection.mode === 'radius') {
      try {
        validateLocation(selection.filter);
        const f = selection.filter;
        radiusKm = f.radiusKm;
        mode = f.source;
        if (
          f.source === 'gps' &&
          f.accuracyMeters !== undefined &&
          f.capturedAt !== undefined
        )
          gps = {
            latitude: f.latitude,
            longitude: f.longitude,
            accuracyMeters: f.accuracyMeters,
            capturedAt: f.capturedAt,
          };
        if (f.source === 'manual')
          manual = {
            coordinates: { latitude: f.latitude, longitude: f.longitude },
            kind: f.centerKind === 'reference' ? 'reference' : 'pin',
            reference:
              f.countryName && f.countryCode && f.cityName
                ? {
                    source: 'manual',
                    country: {
                      name: f.countryName,
                      code: f.countryCode,
                      id: f.countryId,
                    },
                    city: { name: f.cityName, id: f.cityId },
                    area: f.areaName
                      ? { name: f.areaName, id: f.areaId }
                      : undefined,
                    placeId: f.placeId,
                    coordinates: {
                      latitude: f.latitude,
                      longitude: f.longitude,
                    },
                  }
                : undefined,
          };
      } catch {
        mode = 'worldwide';
      }
    }
    set({
      mode,
      gps,
      manual,
      radiusKm,
      verifiedOnly: filters.verifiedOnly ?? false,
      availableNow: filters.availableNow ?? false,
      target: filters.radiusTarget ?? 'origin',
      pending: false,
      problem: undefined,
      revision: get().revision + 1,
      appliedKey: key,
    });
  },
  selectGps: async () => {
    const revision = get().revision + 1;
    set({
      mode: 'gps',
      gps: undefined,
      pending: true,
      problem: undefined,
      revision,
    });
    try {
      const gps = await readFilterGps();
      if (get().revision === revision && get().mode === 'gps')
        set({ gps, pending: false });
    } catch (error) {
      if (get().revision === revision && get().mode === 'gps')
        set({
          gps: undefined,
          pending: false,
          problem: locationProblem(error),
        });
    }
  },
  selectManual: () =>
    set({
      mode: 'manual',
      pending: false,
      problem: undefined,
      revision: get().revision + 1,
    }),
  resolveManual: async value => {
    const revision = get().revision + 1;
    set({
      mode: 'manual',
      manual: undefined,
      pending: true,
      problem: undefined,
      revision,
    });
    try {
      const manual = await resolveFilterReference(value);
      if (get().revision === revision && get().mode === 'manual')
        set({ manual, pending: false });
    } catch (error) {
      if (get().revision === revision && get().mode === 'manual')
        set({
          manual: undefined,
          pending: false,
          problem: locationProblem(error),
        });
    }
  },
  setExactPin: coordinates => {
    try {
      validatePoint(coordinates);
      set({
        mode: 'manual',
        manual: {
          coordinates: { ...coordinates },
          kind: 'pin',
          reference: get().manual?.reference,
        },
        pending: false,
        problem: undefined,
        revision: get().revision + 1,
      });
    } catch (error) {
      set({ problem: locationProblem(error) });
    }
  },
  setRadius: radiusKm => {
    if (!Number.isFinite(radiusKm)) return;
    set({ radiusKm: Math.max(1, Math.min(200, Math.round(radiusKm))) });
  },
  setFlags: flags => set(flags),
  worldwide: () =>
    set({
      mode: 'worldwide',
      pending: false,
      problem: undefined,
      revision: get().revision + 1,
    }),
  reset: () =>
    set({
      mode: 'worldwide',
      radiusKm: 25,
      gps: undefined,
      manual: undefined,
      verifiedOnly: false,
      availableNow: false,
      target: 'origin',
      pending: false,
      problem: undefined,
      revision: get().revision + 1,
    }),
  apply: () => {
    const state = get();
    if (!draftReady(state)) {
      set({
        problem: {
          reason: 'unresolved',
          message:
            state.mode === 'gps'
              ? 'Refresh your current location before applying filters.'
              : 'Choose a resolved manual location before applying filters.',
        },
      });
      return false;
    }
    let selection: LocationSelection = { mode: 'worldwide' };
    if (state.mode === 'gps' && state.gps)
      selection = {
        mode: 'radius',
        filter: {
          ...state.gps,
          source: 'gps',
          radiusKm: state.radiusKm,
          centerKind: 'gps',
        },
      };
    if (state.mode === 'manual' && state.manual) {
      const { reference: r, coordinates, kind } = state.manual;
      selection = {
        mode: 'radius',
        filter: {
          ...coordinates,
          source: 'manual',
          radiusKm: state.radiusKm,
          centerKind: kind,
          placeId: r?.placeId,
          countryId:
            typeof r?.country.id === 'number' ? r?.country.id : undefined,
          cityId: typeof r?.city.id === 'number' ? r?.city.id : undefined,
          areaId: typeof r?.area?.id === 'number' ? r.area.id : undefined,
          countryName: r?.country.name,
          countryCode: r?.country.code,
          cityName: r?.city.name,
          areaName: r?.area?.name,
        },
      };
    }
    if (selection.mode === 'worldwide')
      useLocationStore.getState().useWorldwide();
    else useLocationStore.getState().setLocation(selection.filter);
    useSearchStore
      .getState()
      .setFilters({
        verifiedOnly: state.verifiedOnly,
        availableNow: state.availableNow,
        radiusTarget: state.target,
      });
    set({ appliedKey: appliedKey(), problem: undefined });
    return true;
  },
  openSettings: async () => {
    try {
      await locationService.openSettings();
    } catch {
      set({
        problem: {
          reason: 'settings',
          message:
            'Unable to open device settings. Open Settings manually and enable location access.',
        },
      });
    }
  },
}));
