import { create } from 'zustand';
import type { SearchFilters } from '../../search/store/searchStore';
import type { LocationSelection } from '../../location/types/location';

// Listings tab has its own public search scope. Home search and saved GPS preferences
// must never silently restrict this catalogue. Only explicit tab filters change it.
export const useBrowseFiltersStore = create<{
  filters: SearchFilters;
  location: LocationSelection;
  setFilters: (filters: SearchFilters) => void;
  setLocation: (location: LocationSelection) => void;
  reset: () => void;
}>(set => ({
  filters: {},
  location: { mode: 'worldwide' },
  setFilters: filters =>
    set(state => ({ filters: { ...state.filters, ...filters } })),
  setLocation: location => set({ location }),
  reset: () => set({ filters: {}, location: { mode: 'worldwide' } }),
}));
