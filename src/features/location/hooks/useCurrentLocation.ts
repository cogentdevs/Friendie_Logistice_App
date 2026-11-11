import { useMutation } from '@tanstack/react-query';
import { detectCurrentLocation } from '../services/currentLocationService';
import { useLocationStore } from '../store/locationStore';
// Only an explicit user action calls this. A newer manual choice wins over pending GPS.
export function useCurrentLocation() {
  return useMutation({
    mutationFn: detectCurrentLocation,
    onMutate: () => ({ selection: useLocationStore.getState().selection }),
    onSuccess: (coordinates, _variables, context) => {
      const state = useLocationStore.getState();
      if (state.selection !== context.selection) return;
      state.setLocation({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracyMeters: coordinates.accuracyMeters,
        capturedAt: coordinates.capturedAt,
        countryName: coordinates.address.countryName,
        countryCode: coordinates.address.countryCode,
        cityName: coordinates.address.city,
        areaName: coordinates.address.area,
        source: 'gps',
        radiusKm:
          state.selection.mode === 'radius'
            ? state.selection.filter.radiusKm
            : 25,
      });
    },
  });
}
