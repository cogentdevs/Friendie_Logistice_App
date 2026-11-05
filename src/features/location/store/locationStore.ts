import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Coordinates,
  LocationSearchFilter,
  LocationSelection,
} from '../types/location';
export function validateLocation(filter: LocationSearchFilter) {
  if (
    !filter ||
    (filter.source !== 'gps' && filter.source !== 'manual') ||
    !Number.isFinite(filter.latitude) ||
    Math.abs(filter.latitude) > 90 ||
    !Number.isFinite(filter.longitude) ||
    Math.abs(filter.longitude) > 180 ||
    !Number.isFinite(filter.radiusKm) ||
    filter.radiusKm < 1 ||
    filter.radiusKm > 200
  )
    throw Error('Invalid location or radius');
}
interface LocationState {
  selection: LocationSelection;
  setLocation: (filter: LocationSearchFilter) => void;
  selectPin: (pin: Coordinates) => void;
  setRadius: (radius: number) => void;
  useWorldwide: () => void;
}
export const useLocationStore = create<LocationState>()(
  persist(
    set => ({
      selection: { mode: 'worldwide' },
      setLocation: filter => {
        validateLocation(filter);
        set({ selection: { mode: 'radius', filter } });
      },
      selectPin: pin =>
        set(state => {
          const filter: LocationSearchFilter = {
            // A moved pin has a new reference point; old place IDs may be stale.
            radiusKm:
              state.selection.mode === 'radius'
                ? state.selection.filter.radiusKm
                : 25,
            ...pin,
            source: 'manual',
            accuracyMeters: undefined,
          };
          validateLocation(filter);
          return { selection: { mode: 'radius', filter } };
        }),
      setRadius: radiusKm =>
        set(state => {
          if (state.selection.mode === 'worldwide') return state;
          const filter = { ...state.selection.filter, radiusKm };
          validateLocation(filter);
          return { selection: { mode: 'radius', filter } };
        }),
      useWorldwide: () => set({ selection: { mode: 'worldwide' } }),
    }),
    {
      skipHydration: true,
      name: 'friendie.location',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ selection: state.selection }),
      merge: (persisted, current) => {
        let selection: LocationSelection = { mode: 'worldwide' };
        if (
          typeof persisted === 'object' &&
          persisted !== null &&
          'selection' in persisted
        ) {
          const candidate = persisted.selection;
          if (
            typeof candidate === 'object' &&
            candidate !== null &&
            'mode' in candidate &&
            candidate.mode === 'radius' &&
            'filter' in candidate
          ) {
            try {
              validateLocation(candidate.filter as LocationSearchFilter);
              selection = {
                mode: 'radius',
                filter: candidate.filter as LocationSearchFilter,
              };
            } catch {
              /* Invalid saved geometry is never a fabricated center. */
            }
          }
        }
        return { ...current, selection };
      },
    },
  ),
);
