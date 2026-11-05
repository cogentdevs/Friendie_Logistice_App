import { useMutation } from '@tanstack/react-query';
import { locationService } from '../services/locationService';
import { useLocationStore } from '../store/locationStore';
// Only an explicit user action calls this. A newer manual choice wins over pending GPS.
export function useCurrentLocation() {
  return useMutation({
    mutationFn: () => locationService.currentPosition(),
    onMutate: () => ({ selection: useLocationStore.getState().selection }),
    onSuccess: (coordinates, _variables, context) => {
      const state = useLocationStore.getState();
      if (state.selection !== context.selection) return;
      state.setLocation({
        ...coordinates,
        source: 'gps',
        radiusKm:
          state.selection.mode === 'radius'
            ? state.selection.filter.radiusKm
            : 25,
      });
    },
  });
}
